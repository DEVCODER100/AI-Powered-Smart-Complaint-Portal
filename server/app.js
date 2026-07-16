// Express app for the AI Powered Smart Complaint Portal.
// Exported WITHOUT listening so tests (vitest + supertest) can import it;
// server/index.js is the thin production/dev entry point that listens.

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import { query, pool } from "./db.js";
import {
  authRequired,
  adminOnly,
  hashPassword,
  verifyPassword,
  signToken,
  publicUser,
} from "./auth.js";
import { SLA_TARGET_HOURS, DEPARTMENTS } from "./classify.js";
import { classifyText, embedText, toVectorParam } from "./ai.js";
import {
  validate,
  registerSchema,
  loginSchema,
  googleSchema,
  complaintSchema,
  statusSchema,
  classificationSchema,
  assignSchema,
  mediaAttachSchema,
  STATUSES,
} from "./validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ---------- media (Cloudinary) config ----------
const CLOUDINARY = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
  folder: "complaints",
};
const cloudinaryReady = () =>
  Boolean(CLOUDINARY.cloudName && CLOUDINARY.apiKey && CLOUDINARY.apiSecret);

// Media is only meaningful for something a worker can physically see/photograph.
const PHYSICAL_CATEGORIES = new Set(["plumbing", "electrical", "cleaning"]);

// Server-side caps (enforced against real metadata fetched from Cloudinary).
const MEDIA_LIMITS = {
  image: { maxBytes: 2 * 1024 * 1024, formats: ["jpg", "jpeg", "png", "webp"] },
  video: { maxBytes: 25 * 1024 * 1024, maxDurationSec: 15, formats: ["mp4", "webm", "mov"] },
};

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const app = express();

// Running behind a proxy in production (Render/Railway) — needed so
// express-rate-limit sees the real client IP.
app.set("trust proxy", 1);

app.use(helmet());

// CORS: same-origin in dev (Vite proxies /api), explicit origin in production.
const ALLOWED_ORIGINS = [process.env.FRONTEND_ORIGIN, "http://localhost:5173"].filter(Boolean);
app.use(cors({ origin: ALLOWED_ORIGINS }));

// Complaints are ≤1000 chars; nothing legitimate needs a big body.
app.use(express.json({ limit: "20kb" }));

// ---------- rate limits ----------

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in 15 minutes." },
});

// Keyed by authenticated user id (runs after authRequired).
const complaintLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `u:${req.user.id}` : ipKeyGenerator(req.ip)),
  message: { error: "Complaint limit reached (5 per hour). Please try again later." },
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Slow down a little." },
});
app.use("/api", globalLimiter);

// ---------- helpers ----------

const minsAgo = (ts) => Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
const hoursAgo = (ts) => Math.max(0, (Date.now() - new Date(ts).getTime()) / 3600000);

// Shape a complaint row (+ reporter count) into the frontend's Complaint type.
function toComplaint(row) {
  return {
    id: row.code,
    dbId: row.id,
    category: row.category,
    block: row.block,
    floor: row.floor,
    severity: row.severity,
    status: row.status,
    title: row.title || null,
    description: row.raw_text,
    reportedAgoMinutes: minsAgo(row.created_at),
    othersReported: Math.max(0, Number(row.reporter_count) - 1),
    mediaUrl: row.media_url || null,
    mediaType: row.media_type || null,
    // Latest worker assignment, when the query joined it in (F10).
    assignment: row.worker_name
      ? {
          workerName: row.worker_name,
          workerRole: row.worker_role,
          workerPhone: row.worker_phone,
          etaStart: row.eta_start || null,
          etaEnd: row.eta_end || null,
        }
      : null,
  };
}

// LATERAL join that attaches each complaint's most recent assignment + worker.
const LATEST_ASSIGNMENT_JOIN = `
  LEFT JOIN LATERAL (
    SELECT a.eta_start, a.eta_end, w.name AS worker_name, w.role AS worker_role, w.phone AS worker_phone
    FROM assignments a JOIN workers w ON w.id = a.worker_id
    WHERE a.complaint_id = c.id
    ORDER BY a.assigned_at DESC LIMIT 1
  ) asn ON true`;

function toAdminCluster(row) {
  return {
    ...toComplaint(row),
    department: row.department,
    slaTargetHours: SLA_TARGET_HOURS[row.severity],
    ageHours: Math.round(hoursAgo(row.created_at)),
    aiFlagged: row.ai_flagged,
    possibleDuplicateOf: row.possible_duplicate_code || null,
    statusNote: row.status_note || null,
  };
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

const OPEN_STATUSES_SQL = `status NOT IN ('done','rejected')`;

async function reporterCount(runner, complaintId) {
  const r = await runner.query(
    "SELECT count(*)::int AS n FROM complaint_reporters WHERE complaint_id = $1",
    [complaintId]
  );
  return r.rows[0].n;
}

// ---------- health ----------

app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---------- auth ----------

app.post("/api/auth/register", authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password, room, block } = req.body;
  try {
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows[0]) return res.status(409).json({ error: "Email already registered" });

    const hash = await hashPassword(password);
    // Role is forced to 'student' — never accepted from the client.
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role, room, block)
       VALUES ($1, $2, $3, 'student', $4, $5) RETURNING *`,
      [name, email, hash, room || null, block || null]
    );
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/auth/login", authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Sign in with Google (ID-token flow), verified server-side.
app.post("/api/auth/google", authLimiter, validate(googleSchema), async (req, res) => {
  const { credential } = req.body;
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "Google sign-in is not configured on the server" });
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    const email = p?.email?.toLowerCase();
    if (!email || !p.email_verified) {
      return res.status(401).json({ error: "Google account email is not verified" });
    }
    const name = p.name || email.split("@")[0];

    let user = (await query("SELECT * FROM users WHERE email = $1", [email])).rows[0];
    if (!user) {
      const randomHash = await hashPassword(crypto.randomUUID());
      user = (
        await query(
          `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'student') RETURNING *`,
          [name, email, randomHash]
        )
      ).rows[0];
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch {
    res.status(401).json({ error: "Invalid Google credential" });
  }
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ---------- complaints (student) ----------

// Create a complaint: AI classification (Gemini → rules fallback) + semantic
// de-duplication (embeddings → exact-match fallback).
app.post(
  "/api/complaints",
  authRequired,
  complaintLimiter,
  validate(complaintSchema),
  async (req, res) => {
    const text = req.body.text;

    const client = await pool.connect();
    try {
      // Both calls degrade gracefully; neither can fail the request.
      const meta = await classifyText(text);
      const embedding = await embedText(text);
      const vec = toVectorParam(embedding);

      // --- find a duplicate candidate ---
      // Semantic path: nearest OPEN complaint by cosine similarity within the
      // same block (or same category when block is unknown).
      let dupRow = null; // confirmed duplicate → merge
      let possibleDupId = null; // near-duplicate → create but flag
      if (vec) {
        const byBlock = meta.block !== "Unspecified";
        const cand = await client.query(
          `SELECT c.*, 1 - (c.embedding <=> $1::vector) AS sim
           FROM complaints c
           WHERE c.${OPEN_STATUSES_SQL} AND c.embedding IS NOT NULL
             AND ${byBlock ? "c.block = $2" : "c.category = $2"}
           ORDER BY c.embedding <=> $1::vector ASC
           LIMIT 1`,
          [vec, byBlock ? meta.block : meta.category]
        );
        const best = cand.rows[0];
        if (best) {
          const sim = Number(best.sim);
          if (sim >= 0.85) dupRow = best;
          else if (sim >= 0.7) possibleDupId = best.id;
        }
      } else {
        // Fallback: legacy exact (category, block, floor) match.
        const dup = await client.query(
          `SELECT * FROM complaints
           WHERE category = $1 AND block = $2 AND floor = $3 AND ${OPEN_STATUSES_SQL}
           ORDER BY created_at ASC LIMIT 1`,
          [meta.category, meta.block, meta.floor]
        );
        if (dup.rows[0] && meta.block !== "Unspecified") dupRow = dup.rows[0];
      }

      await client.query("BEGIN");

      let complaint;
      let merged = false;

      if (dupRow) {
        // Merge: attach this student as a reporter of the existing issue,
        // keeping their original wording for a possible unmerge later.
        complaint = dupRow;
        await client.query(
          `INSERT INTO complaint_reporters (complaint_id, user_id, raw_text)
           VALUES ($1, $2, $3)
           ON CONFLICT (complaint_id, user_id) DO NOTHING`,
          [complaint.id, req.user.id, text]
        );
        merged = true;
      } else {
        const ins = await client.query(
          `INSERT INTO complaints
             (owner_id, raw_text, title, category, block, floor, severity, department,
              ai_flagged, embedding, possible_duplicate_of)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::vector,$11) RETURNING *`,
          [
            req.user.id,
            text,
            meta.title || null,
            meta.category,
            meta.block,
            meta.floor,
            meta.severity,
            meta.department,
            // Near-duplicates always need admin review.
            meta.aiFlagged || possibleDupId !== null,
            vec,
            possibleDupId,
          ]
        );
        complaint = ins.rows[0];
        await client.query(
          `INSERT INTO complaint_reporters (complaint_id, user_id, raw_text) VALUES ($1, $2, $3)`,
          [complaint.id, req.user.id, text]
        );
      }

      const count = await reporterCount(client, complaint.id);
      await client.query("COMMIT");

      const shaped = toComplaint({ ...complaint, reporter_count: count });
      const message = merged
        ? `Got it. This is the ${count}${ordinal(count)} report of this issue, marked ${complaint.severity} priority. You'll be notified on every update.`
        : `Got it. Logged as ${shaped.id} — ${meta.category}, ${meta.block}${meta.floor !== "Unspecified" ? " · " + meta.floor : ""}, marked ${complaint.severity} priority. You'll be notified on every update.`;

      res.status(201).json({ complaint: shaped, merged, message });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ error: String(e.message || e) });
    } finally {
      client.release();
    }
  }
);

// ---------- media upload (optional, one photo OR one short video) ----------

// Issue a short-lived signed signature so the client can upload the file
// DIRECTLY to Cloudinary (the file never passes through our server / Postgres).
app.post("/api/complaints/media/signature", authRequired, (req, res) => {
  if (!cloudinaryReady()) {
    return res.status(503).json({ error: "Media upload is not configured on the server" });
  }
  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary signs the alphabetically-sorted params the client will send.
  const toSign = `folder=${CLOUDINARY.folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(toSign + CLOUDINARY.apiSecret).digest("hex");
  res.json({
    cloudName: CLOUDINARY.cloudName,
    apiKey: CLOUDINARY.apiKey,
    folder: CLOUDINARY.folder,
    timestamp,
    signature,
  });
});

// Attach an uploaded file to a complaint. The client sends only the Cloudinary
// public_id; the server fetches the AUTHORITATIVE metadata from Cloudinary and
// validates format / size / duration + physical-category + one-media-per-complaint
// before storing the secure URL. Nothing client-supplied is trusted.
app.patch(
  "/api/complaints/:code/media",
  authRequired,
  validate(mediaAttachSchema),
  async (req, res) => {
    if (!cloudinaryReady()) {
      return res.status(503).json({ error: "Media upload is not configured on the server" });
    }
    const { publicId, resourceType } = req.body;
    try {
      const compRes = await query("SELECT * FROM complaints WHERE code = $1", [req.params.code]);
      const c = compRes.rows[0];
      if (!c) return res.status(404).json({ error: "Complaint not found" });
      if (c.owner_id !== req.user.id) {
        return res.status(403).json({ error: "Only the reporter can attach media to this complaint" });
      }
      if (!PHYSICAL_CATEGORIES.has(c.category)) {
        return res.status(400).json({
          error: "Media can only be added to physical complaints (plumbing, electrical, cleaning).",
        });
      }
      if (c.media_url) {
        return res.status(409).json({ error: "This complaint already has one media item." });
      }

      // Ask Cloudinary for the real file details (Basic auth = api_key:api_secret).
      const auth = Buffer.from(`${CLOUDINARY.apiKey}:${CLOUDINARY.apiSecret}`).toString("base64");
      const idPath = String(publicId).split("/").map(encodeURIComponent).join("/");
      const metaUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/resources/${resourceType}/upload/${idPath}`;
      const metaRes = await fetchWithTimeout(metaUrl, { headers: { Authorization: `Basic ${auth}` } }, 8000);
      if (!metaRes.ok) {
        return res.status(400).json({ error: "Could not verify the uploaded file" });
      }
      const meta = await metaRes.json();

      // Enforce the same folder we signed, so only our uploads can be attached.
      if (meta.folder && meta.folder !== CLOUDINARY.folder) {
        return res.status(400).json({ error: "Unexpected upload location" });
      }

      const limits = MEDIA_LIMITS[resourceType];
      const format = String(meta.format || "").toLowerCase();
      if (!limits.formats.includes(format)) {
        return res.status(400).json({ error: `Unsupported ${resourceType} format (.${format})` });
      }
      if (Number(meta.bytes) > limits.maxBytes) {
        const mb = Math.round(limits.maxBytes / (1024 * 1024));
        return res.status(400).json({ error: `File too large (max ${mb} MB)` });
      }
      if (resourceType === "video" && Number(meta.duration) > limits.maxDurationSec + 1) {
        return res.status(400).json({ error: "Video must be 15 seconds or less." });
      }

      const upd = await query(
        `UPDATE complaints SET media_url = $1, media_type = $2, updated_at = now()
         WHERE id = $3 RETURNING *`,
        [meta.secure_url, resourceType, c.id]
      );
      const n = await reporterCount(pool, c.id);
      res.json({ complaint: toComplaint({ ...upd.rows[0], reporter_count: n }) });
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) });
    }
  }
);

// A student's own complaints (issues they reported), newest first.
app.get("/api/complaints/mine", authRequired, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              asn.worker_name, asn.worker_role, asn.worker_phone, asn.eta_start, asn.eta_end,
              (SELECT count(*) FROM complaint_reporters r2 WHERE r2.complaint_id = c.id) AS reporter_count
       FROM complaints c
       JOIN complaint_reporters r ON r.complaint_id = c.id
       ${LATEST_ASSIGNMENT_JOIN}
       WHERE r.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ complaints: rows.map(toComplaint) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ---------- admin ----------

// All complaints, sorted by severity then report count, paginated.
// Defaults keep the previous behavior for the existing frontend.
app.get("/api/admin/complaints", authRequired, adminOnly, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  try {
    const totalRes = await query("SELECT count(*)::int AS n FROM complaints");
    const { rows } = await query(
      `SELECT c.*, d.code AS possible_duplicate_code,
              asn.worker_name, asn.worker_role, asn.worker_phone, asn.eta_start, asn.eta_end,
              (SELECT count(*) FROM complaint_reporters r WHERE r.complaint_id = c.id) AS reporter_count
       FROM complaints c
       LEFT JOIN complaints d ON d.id = c.possible_duplicate_of
       ${LATEST_ASSIGNMENT_JOIN}
       ORDER BY CASE c.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                reporter_count DESC,
                c.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ clusters: rows.map(toAdminCluster), total: totalRes.rows[0].n, limit, offset });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Reporters of a complaint (for the unmerge/detach affordance).
app.get("/api/admin/complaints/:code/reporters", authRequired, adminOnly, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT r.user_id, u.name, r.raw_text, r.created_at
       FROM complaint_reporters r
       JOIN users u ON u.id = r.user_id
       JOIN complaints c ON c.id = r.complaint_id
       WHERE c.code = $1
       ORDER BY r.created_at ASC`,
      [req.params.code]
    );
    res.json({
      reporters: rows.map((r) => ({
        userId: r.user_id,
        name: r.name,
        rawText: r.raw_text,
        agoMinutes: minsAgo(r.created_at),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Unmerge: detach one reporter from a cluster and open a fresh complaint from
// their original wording.
app.post(
  "/api/admin/complaints/:code/detach/:userId",
  authRequired,
  adminOnly,
  async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isInteger(userId)) return res.status(400).json({ error: "Invalid user id" });

    const client = await pool.connect();
    try {
      const compRes = await client.query("SELECT * FROM complaints WHERE code = $1", [
        req.params.code,
      ]);
      const source = compRes.rows[0];
      if (!source) return res.status(404).json({ error: "Complaint not found" });

      const repRes = await client.query(
        "SELECT * FROM complaint_reporters WHERE complaint_id = $1 AND user_id = $2",
        [source.id, userId]
      );
      if (!repRes.rows[0])
        return res.status(404).json({ error: "That user is not a reporter of this complaint" });

      const count = await reporterCount(client, source.id);
      if (count <= 1)
        return res.status(400).json({ error: "Cannot detach the only reporter — the complaint would be empty" });

      // Use the reporter's own words when we have them (post-migration merges do).
      const text = repRes.rows[0].raw_text || source.raw_text;
      const meta = await classifyText(text);
      const embedding = await embedText(text);
      const vec = toVectorParam(embedding);

      await client.query("BEGIN");
      await client.query(
        "DELETE FROM complaint_reporters WHERE complaint_id = $1 AND user_id = $2",
        [source.id, userId]
      );
      const ins = await client.query(
        `INSERT INTO complaints
           (owner_id, raw_text, title, category, block, floor, severity, department, ai_flagged, embedding)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::vector) RETURNING *`,
        [
          userId,
          text,
          meta.title || null,
          meta.category,
          meta.block,
          meta.floor,
          meta.severity,
          meta.department,
          meta.aiFlagged,
          vec,
        ]
      );
      const fresh = ins.rows[0];
      await client.query(
        `INSERT INTO complaint_reporters (complaint_id, user_id, raw_text) VALUES ($1,$2,$3)`,
        [fresh.id, userId, text]
      );
      await client.query(
        `INSERT INTO notifications (user_id, complaint_id, title, body) VALUES ($1,$2,$3,$4)`,
        [
          userId,
          fresh.id,
          "Your report is now tracked separately",
          `Your report was split from ${source.code} into its own complaint (${fresh.code}) so it gets individual attention.`,
        ]
      );
      await client.query("COMMIT");

      const [srcCount, freshCount] = [
        await reporterCount(pool, source.id),
        await reporterCount(pool, fresh.id),
      ];
      res.json({
        cluster: toAdminCluster({ ...source, reporter_count: srcCount }),
        detached: toAdminCluster({ ...fresh, reporter_count: freshCount }),
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ error: String(e.message || e) });
    } finally {
      client.release();
    }
  }
);

// Feedback loop: admins correct AI classification; every change is logged.
// Reporters are intentionally NOT notified for classification edits.
app.patch(
  "/api/admin/complaints/:code/classification",
  authRequired,
  adminOnly,
  validate(classificationSchema),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const compRes = await client.query("SELECT * FROM complaints WHERE code = $1", [
        req.params.code,
      ]);
      const c = compRes.rows[0];
      if (!c) return res.status(404).json({ error: "Complaint not found" });

      const changes = [];
      for (const field of ["category", "severity", "block", "floor"]) {
        const next = req.body[field];
        if (next !== undefined && next !== c[field]) changes.push({ field, old: c[field], next });
      }
      if (!changes.length) {
        const n = await reporterCount(client, c.id);
        return res.json({ complaint: toAdminCluster({ ...c, reporter_count: n }) });
      }

      await client.query("BEGIN");
      const merged = { ...c };
      for (const ch of changes) merged[ch.field] = ch.next;
      const department = DEPARTMENTS[merged.category] || merged.department;

      const upd = await client.query(
        `UPDATE complaints
         SET category=$1, severity=$2, block=$3, floor=$4, department=$5,
             ai_flagged=false, updated_at=now()
         WHERE id=$6 RETURNING *`,
        [merged.category, merged.severity, merged.block, merged.floor, department, c.id]
      );
      for (const ch of changes) {
        await client.query(
          `INSERT INTO classification_corrections (complaint_id, field, old_value, new_value, corrected_by)
           VALUES ($1,$2,$3,$4,$5)`,
          [c.id, ch.field, String(ch.old), String(ch.next), req.user.id]
        );
      }
      await client.query("COMMIT");

      const n = await reporterCount(pool, c.id);
      res.json({ complaint: toAdminCluster({ ...upd.rows[0], reporter_count: n }) });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ error: String(e.message || e) });
    } finally {
      client.release();
    }
  }
);

// ---------- worker assignment (F10) ----------

// Roster for the assign picker; optionally filtered by department.
app.get("/api/admin/workers", authRequired, adminOnly, async (req, res) => {
  const dept = req.query.department;
  try {
    const { rows } = dept
      ? await query(
          `SELECT id, name, phone, role, department, is_available FROM workers
           WHERE department = $1 ORDER BY is_available DESC, name`,
          [dept]
        )
      : await query(
          `SELECT id, name, phone, role, department, is_available FROM workers
           ORDER BY department, name`
        );
    res.json({
      workers: rows.map((w) => ({
        id: w.id,
        name: w.name,
        phone: w.phone,
        role: w.role,
        department: w.department,
        isAvailable: w.is_available,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Assign a worker + ETA window. One transaction: assignment row → status
// in_progress → notify every reporter in the cluster. Supports reassignment
// (a newer assignment row simply supersedes the previous one).
app.post(
  "/api/admin/complaints/:code/assign",
  authRequired,
  adminOnly,
  validate(assignSchema),
  async (req, res) => {
    const { workerId, etaStart, etaEnd, note } = req.body;
    const client = await pool.connect();
    try {
      const compRes = await client.query("SELECT * FROM complaints WHERE code = $1", [
        req.params.code,
      ]);
      const c = compRes.rows[0];
      if (!c) return res.status(404).json({ error: "Complaint not found" });

      const wRes = await client.query("SELECT * FROM workers WHERE id = $1", [workerId]);
      const worker = wRes.rows[0];
      if (!worker) return res.status(404).json({ error: "Worker not found" });

      await client.query("BEGIN");
      await client.query(
        `INSERT INTO assignments (complaint_id, worker_id, assigned_by, eta_start, eta_end, note)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [c.id, workerId, req.user.id, etaStart, etaEnd, note || null]
      );
      // Assigning a worker moves the complaint into progress.
      const upd = await client.query(
        `UPDATE complaints SET status = 'in-progress', updated_at = now() WHERE id = $1 RETURNING *`,
        [c.id]
      );
      const updated = upd.rows[0];

      await client.query(
        `INSERT INTO notifications (user_id, complaint_id, title, body)
         SELECT user_id, $1, $2, $3 FROM complaint_reporters WHERE complaint_id = $1`,
        [
          c.id,
          `Help is on the way for ${c.code} 🛠️`,
          `${worker.name} (${worker.role}) has been assigned to your ${c.category} complaint (${c.code}). See the complaint for their arrival time and contact number.`,
        ]
      );
      await client.query("COMMIT");

      const n = await reporterCount(pool, c.id);
      const shaped = toAdminCluster({
        ...updated,
        reporter_count: n,
        worker_name: worker.name,
        worker_role: worker.role,
        worker_phone: worker.phone,
        eta_start: etaStart,
        eta_end: etaEnd,
      });
      res.json({ complaint: shaped });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ error: String(e.message || e) });
    } finally {
      client.release();
    }
  }
);

// Admin moves a complaint through the pipeline; every reporter gets notified.
// Also handles reject (with optional reason) and reopen (done/rejected → pending).
app.patch(
  "/api/complaints/:code/status",
  authRequired,
  adminOnly,
  validate(statusSchema),
  async (req, res) => {
    const { status, reason } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const prevRes = await client.query("SELECT status FROM complaints WHERE code = $1", [
        req.params.code,
      ]);
      if (!prevRes.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Complaint not found" });
      }
      const prev = prevRes.rows[0].status;

      const upd = await client.query(
        `UPDATE complaints SET status = $1, status_note = $2, updated_at = now()
         WHERE code = $3 RETURNING *`,
        [status, reason || null, req.params.code]
      );
      const c = upd.rows[0];

      const label = {
        pending: "Pending",
        "in-progress": "In Progress",
        waiting: "Waiting",
        done: "Done",
        rejected: "Rejected",
      }[status];
      const reopened = status === "pending" && (prev === "done" || prev === "rejected");

      let title = `Update on ${c.code}`;
      let body = `${c.code} (${c.block}${c.floor !== "Unspecified" ? " · " + c.floor : ""}) moved to ${label}.`;
      if (status === "done") {
        title = "Resolved 🎉";
        body = `Your ${c.category} complaint (${c.code}) was marked Done.`;
      } else if (status === "rejected") {
        title = `Complaint ${c.code} was rejected`;
        body = `Your ${c.category} complaint (${c.code}) was rejected${reason ? `: ${reason}` : "."}`;
      } else if (reopened) {
        title = `Complaint ${c.code} reopened`;
        body = `${c.code} was reopened and is back in the queue${reason ? `: ${reason}` : "."}`;
      }

      await client.query(
        `INSERT INTO notifications (user_id, complaint_id, title, body)
         SELECT user_id, $1, $2, $3 FROM complaint_reporters WHERE complaint_id = $1`,
        [c.id, title, body]
      );
      await client.query("COMMIT");

      const n = await reporterCount(pool, c.id);
      res.json({ complaint: toAdminCluster({ ...c, reporter_count: n }) });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ error: String(e.message || e) });
    } finally {
      client.release();
    }
  }
);

// ---------- notifications ----------

app.get("/api/notifications", authRequired, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  try {
    const totalRes = await query(
      "SELECT count(*)::int AS n FROM notifications WHERE user_id = $1",
      [req.user.id]
    );
    const { rows } = await query(
      `SELECT * FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json({
      notifications: rows.map((n) => ({
        id: String(n.id),
        title: n.title,
        body: n.body,
        agoMinutes: minsAgo(n.created_at),
        unread: n.unread,
      })),
      total: totalRes.rows[0].n,
      limit,
      offset,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/notifications/read-all", authRequired, async (req, res) => {
  try {
    await query("UPDATE notifications SET unread = false WHERE user_id = $1", [req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

export { STATUSES };
export default app;

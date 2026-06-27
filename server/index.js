import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { query, pool } from "./db.js";
import {
  authRequired,
  adminOnly,
  hashPassword,
  verifyPassword,
  signToken,
  publicUser,
} from "./auth.js";
import { SLA_TARGET_HOURS } from "./classify.js";
import { classifyText } from "./ai.js";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

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
    description: row.raw_text,
    reportedAgoMinutes: minsAgo(row.created_at),
    othersReported: Math.max(0, Number(row.reporter_count) - 1),
  };
}

function toAdminCluster(row) {
  const slaTargetHours = SLA_TARGET_HOURS[row.severity];
  return {
    ...toComplaint(row),
    department: row.department,
    slaTargetHours,
    ageHours: Math.round(hoursAgo(row.created_at)),
    aiFlagged: row.ai_flagged,
  };
}

const SEVERITY_RANK = { critical: 0, high: 1, normal: 2 };

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

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, room, block } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  try {
    const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows[0]) return res.status(409).json({ error: "Email already registered" });

    const hash = await hashPassword(password);
    // Role is forced to 'student' — never accepted from the client (PDF Section 3).
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role, room, block)
       VALUES ($1, $2, $3, 'student', $4, $5) RETURNING *`,
      [name, email.toLowerCase(), hash, room || null, block || null]
    );
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const { rows } = await query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Sign in with Google (ID-token flow). Frontend gets a Google credential, we
// verify it server-side, then issue our own session token. Users map into the
// same `users` table and always default to the 'student' role.
app.post("/api/auth/google", async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: "Missing Google credential" });
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
      // No password is ever used for Google accounts; store a random hash.
      const randomHash = await hashPassword(crypto.randomUUID());
      user = (
        await query(
          `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'student') RETURNING *`,
          [name, email, randomHash]
        )
      ).rows[0];
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(401).json({ error: "Invalid Google credential" });
  }
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ---------- complaints (student) ----------

// Create a complaint. Rule-based intake extraction + simple dedup clustering.
app.post("/api/complaints", authRequired, async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "Describe the problem first" });

  const client = await pool.connect();
  try {
    const meta = await classifyText(text); // Gemini intake (falls back to rules)
    await client.query("BEGIN");

    // Dedup: is there an OPEN complaint for the same category+block+floor?
    const dup = await client.query(
      `SELECT * FROM complaints
       WHERE category = $1 AND block = $2 AND floor = $3 AND status <> 'done'
       ORDER BY created_at ASC LIMIT 1`,
      [meta.category, meta.block, meta.floor]
    );

    let complaint;
    let merged = false;

    if (dup.rows[0] && meta.block !== "Unspecified") {
      // Merge: attach this student as a reporter of the existing issue.
      complaint = dup.rows[0];
      await client.query(
        `INSERT INTO complaint_reporters (complaint_id, user_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [complaint.id, req.user.id]
      );
      merged = true;
    } else {
      const ins = await client.query(
        `INSERT INTO complaints (owner_id, raw_text, category, block, floor, severity, department, ai_flagged)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.user.id, text.trim(), meta.category, meta.block, meta.floor, meta.severity, meta.department, meta.aiFlagged]
      );
      complaint = ins.rows[0];
      await client.query(
        `INSERT INTO complaint_reporters (complaint_id, user_id) VALUES ($1, $2)`,
        [complaint.id, req.user.id]
      );
    }

    const countRes = await client.query(
      "SELECT count(*)::int AS n FROM complaint_reporters WHERE complaint_id = $1",
      [complaint.id]
    );
    const reporterCount = countRes.rows[0].n;

    await client.query("COMMIT");

    const shaped = toComplaint({ ...complaint, reporter_count: reporterCount });
    const message = merged
      ? `Got it. This is the ${reporterCount}${ordinal(reporterCount)} report of this issue, marked ${complaint.severity} priority. You'll be notified on every update.`
      : `Got it. Logged as ${shaped.id} — ${meta.category}, ${meta.block}${meta.floor !== "Unspecified" ? " · " + meta.floor : ""}, marked ${complaint.severity} priority. You'll be notified on every update.`;

    res.status(201).json({ complaint: shaped, merged, message });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: String(e.message || e) });
  } finally {
    client.release();
  }
});

// A student's own complaints (issues they reported), newest first.
app.get("/api/complaints/mine", authRequired, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              (SELECT count(*) FROM complaint_reporters r2 WHERE r2.complaint_id = c.id) AS reporter_count
       FROM complaints c
       JOIN complaint_reporters r ON r.complaint_id = c.id
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

// All complaints as clusters, pre-sorted by severity then report count (PDF Feature 7).
app.get("/api/admin/complaints", authRequired, adminOnly, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              (SELECT count(*) FROM complaint_reporters r WHERE r.complaint_id = c.id) AS reporter_count
       FROM complaints c
       ORDER BY c.created_at DESC`
    );
    const clusters = rows.map(toAdminCluster).sort((a, b) => {
      if (SEVERITY_RANK[a.severity] !== SEVERITY_RANK[b.severity])
        return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      return b.othersReported - a.othersReported;
    });
    res.json({ clusters });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

const STATUSES = ["pending", "in-progress", "waiting", "done"];

// Admin moves a complaint through the pipeline; every reporter gets notified.
app.patch("/api/complaints/:code/status", authRequired, adminOnly, async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const upd = await client.query(
      `UPDATE complaints SET status = $1, updated_at = now() WHERE code = $2 RETURNING *`,
      [status, req.params.code]
    );
    if (!upd.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Complaint not found" });
    }
    const c = upd.rows[0];

    // Notify every reporter (loop closure — PDF Feature 5).
    const label = { pending: "Pending", "in-progress": "In Progress", waiting: "Waiting", done: "Done" }[status];
    const title = status === "done" ? "Resolved 🎉" : `Update on ${c.code}`;
    const body =
      status === "done"
        ? `Your ${c.category} complaint (${c.code}) was marked Done.`
        : `${c.code} (${c.block}${c.floor !== "Unspecified" ? " · " + c.floor : ""}) moved to ${label}.`;

    await client.query(
      `INSERT INTO notifications (user_id, complaint_id, title, body)
       SELECT user_id, $1, $2, $3 FROM complaint_reporters WHERE complaint_id = $1`,
      [c.id, title, body]
    );
    await client.query("COMMIT");

    const countRes = await query(
      "SELECT count(*)::int AS n FROM complaint_reporters WHERE complaint_id = $1",
      [c.id]
    );
    res.json({ complaint: toAdminCluster({ ...c, reporter_count: countRes.rows[0].n }) });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: String(e.message || e) });
  } finally {
    client.release();
  }
});

// ---------- notifications ----------

app.get("/api/notifications", authRequired, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({
      notifications: rows.map((n) => ({
        id: String(n.id),
        title: n.title,
        body: n.body,
        agoMinutes: minsAgo(n.created_at),
        unread: n.unread,
      })),
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

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

app.listen(PORT, () => {
  console.log(`[api] AI Powered Complaint Portal backend listening on http://localhost:${PORT}`);
});

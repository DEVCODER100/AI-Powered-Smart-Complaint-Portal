// AI intake using Google Gemini:
//  - classifyText(text)  → category/block/floor/severity + title + confidence
//  - embedText(text)     → 768-dim embedding (text-embedding-004) for semantic dedup
// Both degrade gracefully: any missing key, error, or timeout falls back to the
// rule-based classifier / proceeds without an embedding. Complaint submission
// must NEVER fail because of this module.

import { classify, DEPARTMENTS } from "./classify.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
export const EMBED_DIMS = 768;
export const CONFIDENCE_FLAG_THRESHOLD = 0.7;

const SYSTEM = `You triage hostel and campus maintenance complaints.
The input may be written in English, Hindi, Gujarati, or romanized mixes of them
(Hinglish e.g. "paani nahi aa raha", Gujarati e.g. "pani nathi avtu"). Regardless
of input language, ALWAYS output normalized English values.
Given a resident's free-text message, extract:
- category: one of plumbing, wifi, electrical, cleaning, other
- block: the hostel block formatted as "Block X" (a single letter), or "Unspecified" if not mentioned
- floor: formatted as "Floor N" (a number), or "All Floors" if it affects the whole block/wing, or "Unspecified"
- severity: "critical" for a safety hazard (sparking, fire, smoke, gas, electric shock, flooding);
  "high" for a major outage affecting many people (e.g. no water, entire block, dead equipment, no signal at all);
  "normal" otherwise.
- title: a short human-readable English summary of the issue, 60 characters or less
- confidence: your self-assessed confidence (0 to 1) that category AND severity are correct
- isComplaint: true if the message describes a genuine hostel/campus maintenance or facility
  problem; false if it is gibberish, random characters, keyboard mashing, a test, spam, an
  empty greeting, or otherwise not an actual complaint
Respond with JSON only.`;

const SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: ["plumbing", "wifi", "electrical", "cleaning", "other"] },
    block: { type: "string" },
    floor: { type: "string" },
    severity: { type: "string", enum: ["critical", "high", "normal"] },
    title: { type: "string" },
    confidence: { type: "number" },
    isComplaint: { type: "boolean" },
  },
  required: ["category", "block", "floor", "severity", "title", "confidence", "isComplaint"],
};

const CATEGORIES = ["plumbing", "wifi", "electrical", "cleaning", "other"];
const SEVERITIES = ["critical", "high", "normal"];

function normalizeBlock(b) {
  if (!b) return "Unspecified";
  const s = String(b).trim();
  if (/^unspecified$/i.test(s)) return "Unspecified";
  const m = s.match(/([a-z])\s*$/i);
  if (/block/i.test(s) && m) return `Block ${m[1].toUpperCase()}`;
  if (/^[a-z]$/i.test(s)) return `Block ${s.toUpperCase()}`;
  return s;
}

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Gemini-only classification. Throws on any failure — callers must catch. */
export async function classifyWithGemini(text, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
    },
  };

  const res = await fetchWithTimeout(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    9000
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini returned no content");

  const p = JSON.parse(raw);
  const category = CATEGORIES.includes(p.category) ? p.category : "other";
  const severity = SEVERITIES.includes(p.severity) ? p.severity : "normal";
  const confidence =
    typeof p.confidence === "number" && p.confidence >= 0 && p.confidence <= 1 ? p.confidence : 0;

  return {
    category,
    severity,
    block: normalizeBlock(p.block),
    floor: p.floor && String(p.floor).trim() ? String(p.floor).trim() : "Unspecified",
    department: DEPARTMENTS[category],
    // Low model confidence → surface for admin review (Phase 1a).
    aiFlagged: confidence < CONFIDENCE_FLAG_THRESHOLD,
    title: String(p.title || "").slice(0, 60) || null,
    confidence,
    isComplaint: p.isComplaint !== false, // reject only when the model is sure it's not
    source: "gemini",
  };
}

/** Public entry point used by the API. Tries Gemini, falls back to rules. */
export async function classifyText(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ...classify(text), source: "rules" };
  try {
    return await classifyWithGemini(text, key);
  } catch (e) {
    console.warn("[ai] Gemini intake failed, using rule-based fallback:", e.message);
    return { ...classify(text), source: "rules" };
  }
}

/**
 * Embed the complaint text for semantic dedup. Returns a number[768] or null.
 * Null is always safe — callers fall back to exact-match dedup.
 */
export async function embedText(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${key}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: String(text).slice(0, 2000) }] },
          outputDimensionality: EMBED_DIMS, // match the vector(768) column
        }),
      },
      6000
    );
    if (!res.ok) throw new Error(`embed ${res.status}`);
    const data = await res.json();
    const values = data?.embedding?.values;
    if (!Array.isArray(values) || values.length !== EMBED_DIMS) throw new Error("bad embedding shape");
    return values;
  } catch (e) {
    console.warn("[ai] embedding failed (continuing without):", e.message);
    return null;
  }
}

/** Serialize an embedding for a pgvector parameter ('[1,2,3]'). */
export function toVectorParam(values) {
  return values ? `[${values.join(",")}]` : null;
}

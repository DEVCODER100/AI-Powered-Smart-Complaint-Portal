// AI intake using Google Gemini. Extracts category / location / severity from
// the resident's free-text complaint. Falls back to the deterministic
// rule-based classifier whenever the API key is missing or the call fails,
// so complaint submission never breaks.

import { classify, DEPARTMENTS } from "./classify.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const SYSTEM = `You triage hostel and campus maintenance complaints.
Given a resident's free-text message, extract these fields:
- category: one of plumbing, wifi, electrical, cleaning, other
- block: the hostel block formatted as "Block X" (a single letter), or "Unspecified" if not mentioned
- floor: formatted as "Floor N" (a number), or "All Floors" if it affects the whole block/wing, or "Unspecified"
- severity: "critical" for a safety hazard (sparking, fire, smoke, gas, electric shock, flooding);
  "high" for a major outage affecting many people (e.g. no water, entire block, dead equipment, no signal at all);
  "normal" otherwise.
Respond with JSON only.`;

const SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: ["plumbing", "wifi", "electrical", "cleaning", "other"] },
    block: { type: "string" },
    floor: { type: "string" },
    severity: { type: "string", enum: ["critical", "high", "normal"] },
  },
  required: ["category", "block", "floor", "severity"],
};

const CATEGORIES = ["plumbing", "wifi", "electrical", "cleaning", "other"];
const SEVERITIES = ["critical", "high", "normal"];

function normalizeBlock(b) {
  if (!b) return "Unspecified";
  const m = String(b).match(/([a-z])/i);
  return m && /block/i.test(b) ? `Block ${m[1].toUpperCase()}` : /^[a-z]$/i.test(b.trim()) ? `Block ${b.trim().toUpperCase()}` : b;
}

async function classifyWithGemini(text, key) {
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini returned no content");

  const p = JSON.parse(raw);
  const category = CATEGORIES.includes(p.category) ? p.category : "other";
  const severity = SEVERITIES.includes(p.severity) ? p.severity : "normal";

  return {
    category,
    severity,
    block: normalizeBlock(p.block),
    floor: p.floor && String(p.floor).trim() ? String(p.floor).trim() : "Unspecified",
    department: DEPARTMENTS[category],
    aiFlagged: false,
    source: "gemini",
  };
}

// Public entry point used by the API. Tries Gemini, falls back to rules.
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

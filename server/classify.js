// Rule-based intake extraction — the deterministic, zero-dependency fallback.
// Gemini (server/ai.js) is the primary classifier; this must keep working with
// no API key and no network. Keyword maps include common romanized Hindi /
// Gujarati (Hinglish) terms so the fallback understands multilingual input.

const CATEGORY_RULES = [
  {
    category: "plumbing",
    words: [
      "water", "tap", "leak", "drain", "toilet", "flush", "pipe", "plumb", "basin", "geyser",
      // Hinglish / Hindi / Gujarati
      "paani", "pani", "nal", "tapak", "tapkta", "leakage", "bathroom bhar", "naliyu", "panino",
    ],
  },
  {
    category: "wifi",
    words: [
      "wifi", "wi-fi", "internet", "network", "router", "signal", "lan", "connection",
      "net band", "wifi band", "net nahi", "net slow", "net bahut", "net chal",
      "signal nahi", "net chalu nathi",
    ],
  },
  {
    category: "electrical",
    words: [
      "socket", "spark", "sparking", "electric", "wire", "wiring", "power", "current",
      "switch", "fan", "light", "bulb", "shock", "short circuit",
      "bijli", "batti", "pankha", "light nahi", "light gayi", "current lag", "pankho", "vij",
      "jhatka", "chingari",
    ],
  },
  {
    category: "cleaning",
    words: [
      "clean", "garbage", "trash", "dirty", "dustbin", "sweep", "smell", "mosquito", "pest",
      "safai", "gandagi", "ganda", "kachra", "kachro", "machhar", "badbu", "saf nahi", "gandu",
    ],
  },
];

const DEPARTMENTS = {
  plumbing: "Maintenance",
  wifi: "IT",
  electrical: "Maintenance",
  cleaning: "Housekeeping",
  other: "Front Office",
};

// Safety-critical signals -> critical, regardless of other wording.
const CRITICAL_WORDS = [
  "spark", "sparking", "fire", "smoke", "gas leak", "shock", "shock risk", "electrocut",
  "short circuit", "burning",
  "aag", "jhatka", "current lag", "chingari", "dhuan", "dhamaka", "jalne ki",
];

// Strong outage / severe-impact signals -> high.
const HIGH_WORDS = [
  "no water", "completely", "entire", "all floors", "dead", "no signal", "flood", "overflow",
  "blocked", "since morning", "not working at all",
  "paani nahi", "pani nahi", "bilkul", "poora block", "pura block", "band hai", "subah se",
  "bilkul band", "kaam nahi kar",
];

/** Short human-readable title from raw text (fallback when Gemini is off). */
export function makeTitle(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= 60) return clean.charAt(0).toUpperCase() + clean.slice(1);
  const cut = clean.slice(0, 57);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 30 ? cut.slice(0, lastSpace) : cut;
  return base.charAt(0).toUpperCase() + base.slice(1) + "…";
}

export function classify(text) {
  const t = (text || "").toLowerCase();

  // category
  let category = "other";
  let best = 0;
  for (const rule of CATEGORY_RULES) {
    const hits = rule.words.filter((w) => t.includes(w)).length;
    if (hits > best) {
      best = hits;
      category = rule.category;
    }
  }

  // severity (with safe default + flag when uncertain)
  let severity = "normal";
  let aiFlagged = false;
  if (CRITICAL_WORDS.some((w) => t.includes(w))) {
    severity = "critical";
  } else if (HIGH_WORDS.some((w) => t.includes(w))) {
    severity = "high";
  } else if (best === 0) {
    // couldn't even read a category -> default safe + flag for admin review
    severity = "normal";
    aiFlagged = true;
  }

  // location
  const blockMatch =
    t.match(/block\s*[-–]?\s*([a-z])\b/i) || t.match(/\b([a-z])\s+wing\b/i);
  const block = blockMatch ? `Block ${blockMatch[1].toUpperCase()}` : "Unspecified";

  let floor = "Unspecified";
  // "3rd floor" / "floor 3" / "teesri manzil" style extraction first;
  // whole-block phrases only apply when no specific floor is named.
  const ord = t.match(/(\d+)\s*(st|nd|rd|th)?\s*(floor|manzil|mala)/);
  const rev = t.match(/floor\s*[-:]?\s*(\d+)/);
  const word = t.match(/\b(ground|first|second|third|fourth|fifth)\b\s*floor/);
  const wordMap = { ground: 0, first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
  if (ord) floor = `Floor ${ord[1]}`;
  else if (rev) floor = `Floor ${rev[1]}`;
  else if (word) floor = `Floor ${wordMap[word[1]]}`;
  else if (
    /all floors|entire\s+([a-z]\s+)?(block|wing|building)|whole\s+(of\s+)?(the\s+)?block|every floor|poore block|poora block|pura block|aakho/.test(t)
  ) {
    floor = "All Floors";
  }

  return {
    category,
    severity,
    block,
    floor,
    department: DEPARTMENTS[category],
    aiFlagged,
    title: makeTitle(text),
    confidence: null, // rules make no confidence claim
  };
}

export { DEPARTMENTS };

export const SLA_TARGET_HOURS = { critical: 2, high: 24, normal: 72 };

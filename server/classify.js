// Rule-based intake extraction (workflow-first). This is the deterministic
// fallback the PDF describes; a Claude call can replace/augment it later
// without changing the API contract.

const CATEGORY_RULES = [
  { category: "plumbing", words: ["water", "tap", "leak", "drain", "toilet", "flush", "pipe", "plumb", "basin", "geyser"] },
  { category: "wifi", words: ["wifi", "wi-fi", "internet", "network", "router", "signal", "lan", "connection"] },
  { category: "electrical", words: ["socket", "spark", "electric", "wire", "wiring", "power", "current", "switch", "fan", "light", "bulb", "shock", "short circuit"] },
  { category: "cleaning", words: ["clean", "garbage", "trash", "dirty", "dustbin", "sweep", "smell", "mosquito", "pest"] },
];

const DEPARTMENTS = {
  plumbing: "Maintenance",
  wifi: "IT",
  electrical: "Maintenance",
  cleaning: "Housekeeping",
  other: "Front Office",
};

// Safety-critical signals -> critical, regardless of other wording.
const CRITICAL_WORDS = ["spark", "sparking", "fire", "smoke", "gas leak", "shock", "shock risk", "electrocut", "short circuit", "burning"];
// Strong outage / severe-impact signals -> high.
const HIGH_WORDS = ["no water", "completely", "entire", "all floors", "dead", "no signal", "flood", "overflow", "blocked", "since morning", "not working at all"];

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
  const blockMatch = t.match(/block\s+([a-z])/i);
  const block = blockMatch ? `Block ${blockMatch[1].toUpperCase()}` : "Unspecified";

  let floor = "Unspecified";
  if (/all floors|entire|whole (block|wing|building)|every floor/.test(t)) {
    floor = "All Floors";
  } else {
    const ord = t.match(/(\d+)\s*(st|nd|rd|th)?\s*floor/);
    const word = t.match(/\b(ground|first|second|third|fourth|fifth)\b\s*floor/);
    const wordMap = { ground: 0, first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
    if (ord) floor = `Floor ${ord[1]}`;
    else if (word) floor = `Floor ${wordMap[word[1]]}`;
  }

  return {
    category,
    severity,
    block,
    floor,
    department: DEPARTMENTS[category],
    aiFlagged,
  };
}

export { DEPARTMENTS };

export const SLA_TARGET_HOURS = { critical: 2, high: 24, normal: 72 };

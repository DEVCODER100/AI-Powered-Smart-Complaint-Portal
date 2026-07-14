// Classification evaluation: runs the labeled dataset through
//   (a) the rule-based classifier (always), and
//   (b) Gemini (only when GEMINI_API_KEY is set and --rules-only is not passed).
// Prints a per-field accuracy table plus every misclassified example —
// designed to be pasted straight into the project report.
//
// Usage: npm run eval [-- --rules-only]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { classify } = await import("../classify.js");
const { classifyWithGemini } = await import("../ai.js");

const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, "dataset.json"), "utf8"));
const FIELDS = ["category", "severity", "block", "floor"];
const rulesOnly = process.argv.includes("--rules-only");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function score(results) {
  const correct = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  let allRight = 0;
  const misses = [];
  for (const { item, pred, error } of results) {
    if (error) {
      misses.push({ text: item.text, error });
      continue;
    }
    let all = true;
    for (const f of FIELDS) {
      if (pred[f] === item[f]) correct[f]++;
      else all = false;
    }
    if (all) allRight++;
    else {
      misses.push({
        text: item.text,
        diff: FIELDS.filter((f) => pred[f] !== item[f])
          .map((f) => `${f}: got "${pred[f]}", expected "${item[f]}"`)
          .join("; "),
      });
    }
  }
  return { correct, allRight, misses };
}

function printReport(name, { correct, allRight, misses }, n) {
  const pct = (x) => `${((100 * x) / n).toFixed(1)}%`;
  console.log(`\n### ${name} (${n} examples)\n`);
  console.log("| Field | Accuracy |");
  console.log("|-------|----------|");
  for (const f of FIELDS) console.log(`| ${f} | ${pct(correct[f])} (${correct[f]}/${n}) |`);
  console.log(`| **all four correct** | **${pct(allRight)}** (${allRight}/${n}) |`);
  if (misses.length) {
    console.log(`\nMisclassified (${misses.length}):`);
    for (const m of misses.slice(0, 25)) {
      console.log(`- "${m.text.slice(0, 70)}${m.text.length > 70 ? "…" : ""}" → ${m.diff || m.error}`);
    }
    if (misses.length > 25) console.log(`  …and ${misses.length - 25} more`);
  }
}

console.log(`# Classification evaluation — ${dataset.length} labeled complaints`);

// (a) rule-based, always
const ruleResults = dataset.map((item) => ({ item, pred: classify(item.text) }));
printReport("Rule-based classifier", score(ruleResults), dataset.length);

// (b) Gemini, when available
const key = process.env.GEMINI_API_KEY;
if (!key || rulesOnly) {
  console.log(
    `\n(Gemini evaluation skipped — ${rulesOnly ? "--rules-only flag" : "no GEMINI_API_KEY set"}.)`
  );
} else {
  console.log(`\nRunning Gemini on ${dataset.length} examples (paced for free-tier rate limits)…`);
  const geminiResults = [];
  for (let i = 0; i < dataset.length; i++) {
    const item = dataset[i];
    try {
      const pred = await classifyWithGemini(item.text, key);
      geminiResults.push({ item, pred });
    } catch (e) {
      geminiResults.push({ item, error: e.message });
    }
    process.stdout.write(`\r  ${i + 1}/${dataset.length}`);
    if (i < dataset.length - 1) await sleep(4500);
  }
  console.log("");
  printReport("Gemini classifier", score(geminiResults), dataset.length);
}

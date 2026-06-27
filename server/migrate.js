import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  console.log("[migrate] applying schema.sql ...");
  await pool.query(sql);
  console.log("[migrate] done.");
  await pool.end();
}

main().catch((e) => {
  console.error("[migrate] failed:", e.message);
  process.exit(1);
});

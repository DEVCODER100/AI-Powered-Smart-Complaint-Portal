import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // 1. Baseline schema (idempotent CREATE IF NOT EXISTS).
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  console.log("[migrate] applying schema.sql ...");
  await pool.query(sql);

  // 2. Ordered, tracked migrations from server/migrations/*.sql.
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const dir = path.join(__dirname, "migrations");
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    : [];

  for (const file of files) {
    const done = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (done.rows[0]) {
      console.log(`[migrate] skip ${file} (already applied)`);
      continue;
    }
    console.log(`[migrate] applying ${file} ...`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`${file} failed: ${e.message}`);
    } finally {
      client.release();
    }
  }

  console.log("[migrate] done.");
  await pool.end();
}

main().catch((e) => {
  console.error("[migrate] failed:", e.message);
  process.exit(1);
});

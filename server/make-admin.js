// Create or promote an admin account (idempotent upsert by email).
// Credentials are passed at runtime — never hardcoded/committed.
//
// Usage:
//   ADMIN_EMAIL=you@x.com ADMIN_PASSWORD=secret npm run make-admin
//   node server/make-admin.js you@x.com secret "Full Name"

import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const email = (process.env.ADMIN_EMAIL || process.argv[2] || "").toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || process.argv[3] || "";
const name = process.env.ADMIN_NAME || process.argv[4] || "Admin";

if (!email || !password) {
  console.error("[make-admin] provide ADMIN_EMAIL and ADMIN_PASSWORD (env or args).");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const { rows } = await pool.query(
  `INSERT INTO users (name, email, password_hash, role)
   VALUES ($1, $2, $3, 'admin')
   ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash, role = 'admin', name = EXCLUDED.name
   RETURNING id, email, role`,
  [name, email, hash]
);
console.log("[make-admin] admin ready:", rows[0]);
await pool.end();

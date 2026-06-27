import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error(
    "\n[db] DATABASE_URL is not set. Create server/.env from server/.env.example " +
      "and paste your Neon connection string.\n"
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requires SSL; allow self-signed in the managed environment.
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

export const query = (text, params) => pool.query(text, params);

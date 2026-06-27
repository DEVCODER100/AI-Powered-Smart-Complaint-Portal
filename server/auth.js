import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "./db.js";

const SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
const TOKEN_TTL = "7d";

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: TOKEN_TTL });
}

export function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, room: u.room, block: u.block };
}

// Attaches req.user from the Bearer token; 401 if missing/invalid.
export async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const payload = jwt.verify(token, SECRET);
    // Re-read the role from the DB — never trust the client's claimed role.
    const { rows } = await query("SELECT * FROM users WHERE id = $1", [payload.id]);
    if (!rows[0]) return res.status(401).json({ error: "User no longer exists" });

    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Must run after authRequired. Enforces admin role server-side (PDF Section 3).
export function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

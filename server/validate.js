// Request-body validation with zod. Every mutating route runs through one of
// these schemas; failures return 400 with a human-readable message.

import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  room: z.string().trim().max(50).optional().or(z.literal("")),
  block: z.string().trim().max(50).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(1, "Password is required").max(100),
});

export const googleSchema = z.object({
  credential: z.string().min(10, "Missing Google credential").max(4096),
});

export const complaintSchema = z.object({
  text: z
    .string({ message: "Describe the problem first" })
    .trim()
    .min(1, "Describe the problem first")
    .max(1000, "Keep it under 1000 characters"),
});

export const STATUSES = ["pending", "in-progress", "waiting", "done", "rejected"];

export const statusSchema = z.object({
  status: z.enum(STATUSES, { message: "Invalid status" }),
  reason: z.string().trim().max(500).optional(),
});

const CATEGORIES = ["plumbing", "wifi", "electrical", "cleaning", "other"];
const SEVERITIES = ["critical", "high", "normal"];

export const classificationSchema = z
  .object({
    category: z.enum(CATEGORIES).optional(),
    severity: z.enum(SEVERITIES).optional(),
    block: z.string().trim().min(1).max(50).optional(),
    floor: z.string().trim().min(1).max(50).optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), {
    message: "Provide at least one field to correct",
  });

/** Express middleware factory: validate req.body against a schema. */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const msg = result.error.issues[0]?.message || "Invalid request";
      return res.status(400).json({ error: msg });
    }
    req.body = result.data;
    next();
  };
}

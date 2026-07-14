// API + classifier tests (vitest + supertest).
// Gemini is stubbed by clearing the key: server/ai.js checks it at call time,
// so every classification here runs the rule-based fallback — no external calls.
// The database IS the real one from server/.env; all rows created here use
// @test.local emails and are cleaned up in afterAll.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app.js";
import { pool } from "../db.js";
import { classify, makeTitle } from "../classify.js";

const stamp = Date.now();
const email = (n) => `t${stamp}-${n}@test.local`;

let studentToken;

beforeAll(() => {
  // Never hit the real Gemini API from tests.
  delete process.env.GEMINI_API_KEY;
});

afterAll(async () => {
  await pool.query(
    `DELETE FROM complaints WHERE owner_id IN (SELECT id FROM users WHERE email LIKE '%@test.local')`
  );
  await pool.query(`DELETE FROM users WHERE email LIKE '%@test.local'`);
  await pool.end();
});

describe("rule-based classifier (Gemini fallback)", () => {
  it("classifies a sparking socket as electrical + critical", () => {
    const r = classify("Sparking socket near the washbasin in Block A");
    expect(r.category).toBe("electrical");
    expect(r.severity).toBe("critical");
    expect(r.block).toBe("Block A");
  });

  it("classifies a water outage with location extraction", () => {
    const r = classify("No water in Block C second floor since morning");
    expect(r.category).toBe("plumbing");
    expect(r.severity).toBe("high");
    expect(r.block).toBe("Block C");
    expect(r.floor).toBe("Floor 2");
  });

  it("understands Hinglish (multilingual fallback)", () => {
    const r = classify("paani nahi aa raha Block B mein subah se");
    expect(r.category).toBe("plumbing");
    expect(r.severity).toBe("high");
    expect(r.block).toBe("Block B");
  });

  it("flags unclassifiable text for admin review", () => {
    const r = classify("something weird is happening");
    expect(r.category).toBe("other");
    expect(r.aiFlagged).toBe(true);
  });

  it("generates a title capped at ~60 chars", () => {
    const t = makeTitle(
      "The water cooler on the second floor of block D has been leaking continuously and the corridor is flooded"
    );
    expect(t.length).toBeLessThanOrEqual(61);
    expect(t.length).toBeGreaterThan(10);
  });
});

describe("auth + roles", () => {
  it("register forces role=student even if the client claims admin", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test A", email: email("a"), password: "secret123", role: "admin" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("student");
    expect(res.body.token).toBeTruthy();
    studentToken = res.body.token;
  });

  it("rejects a bad password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: email("a"), password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid email shape with 400 (zod)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "X", email: "not-an-email", password: "secret123" });
    expect(res.status).toBe(400);
  });

  it("blocks a student token on admin routes with 403", async () => {
    const res = await request(app)
      .get("/api/admin/complaints")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it("blocks unauthenticated complaint creation with 401", async () => {
    const res = await request(app).post("/api/complaints").send({ text: "no token" });
    expect(res.status).toBe(401);
  });
});

describe("complaints", () => {
  it("rejects empty complaint text with 400", async () => {
    const res = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ text: "   " });
    expect(res.status).toBe(400);
  });

  it("rejects >1000 char complaints with 400", async () => {
    const res = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ text: "x".repeat(1001) });
    expect(res.status).toBe(400);
  });

  it("creates a complaint with rule-based classification + title", async () => {
    const res = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ text: "Water leaking from the tap in Block Q 3rd floor bathroom" });
    expect(res.status).toBe(201);
    expect(res.body.merged).toBe(false);
    expect(res.body.complaint.category).toBe("plumbing");
    expect(res.body.complaint.block).toBe("Block Q");
    expect(res.body.complaint.floor).toBe("Floor 3");
    expect(res.body.complaint.title).toBeTruthy();
  });

  it("merges an identical repeat from another student (dedup)", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test B", email: email("b"), password: "secret123" });
    expect(reg.status).toBe(201);

    const res = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${reg.body.token}`)
      .send({ text: "Water leaking from the tap in Block Q 3rd floor bathroom" });
    expect(res.status).toBe(201);
    expect(res.body.merged).toBe(true);
    expect(res.body.complaint.othersReported).toBeGreaterThanOrEqual(1);
    expect(res.body.message).toMatch(/report of this issue/);
  });
});

describe("rate limiting", () => {
  it("fires 429 on login spam", async () => {
    let got429 = false;
    for (let i = 0; i < 12 && !got429; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: `spam@test.local`, password: "nope-nope" });
      if (res.status === 429) got429 = true;
    }
    expect(got429).toBe(true);
  });
});

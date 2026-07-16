// Rich sample dataset for manual testing / demos.
// Resets complaints/users/reporters/notifications/assignments (workers are kept —
// they come from migration 003) and inserts a realistic spread: clusters with
// many reporters, a critical safety case, multilingual reports, every status,
// SLA-overdue items, and a few worker assignments.
//
// Run:  npm run seed:samples
// Logins after seeding:
//   admin   -> SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (from server/.env)
//   student -> aisha.k@campus.edu / hostel123   (all named students share hostel123)

import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("[seed:samples] SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in server/.env");
    process.exit(1);
  }

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "TRUNCATE notifications, assignments, complaint_reporters, complaints, users RESTART IDENTITY CASCADE"
    );

    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const studentHash = await bcrypt.hash("hostel123", 10);
    const genHash = await bcrypt.hash("student123", 10);

    const adminId = (
      await c.query(
        `INSERT INTO users (name, email, password_hash, role, block)
         VALUES ($1,$2,$3,'admin',$4) RETURNING id`,
        ["Hostel Admin", ADMIN_EMAIL.toLowerCase(), adminHash, "Admin Block"]
      )
    ).rows[0].id;

    // Named students (all share password "hostel123").
    const studentDefs = [
      ["Aisha Khan", "aisha.k@campus.edu", "C-214", "Block C"],
      ["Dev Gupta", "dev.g@campus.edu", "B-101", "Block B"],
      ["Naksee Desai", "naksee.d@campus.edu", "D-305", "Block D"],
      ["Aniket Kumbhar", "aniket.k@campus.edu", "A-112", "Block A"],
      ["Suhanee Gupta", "suhanee.g@campus.edu", "C-220", "Block C"],
      ["Rahul Verma", "rahul.v@campus.edu", "B-208", "Block B"],
      ["Priya Menon", "priya.m@campus.edu", "A-405", "Block A"],
      ["Sana Sheikh", "sana.s@campus.edu", "E-118", "Block E"],
      ["Karan Singh", "karan.s@campus.edu", "D-310", "Block D"],
      ["Meera Joshi", "meera.j@campus.edu", "F-203", "Block F"],
      ["Arjun Rao", "arjun.r@campus.edu", "B-115", "Block B"],
      ["Zoya Khan", "zoya.k@campus.edu", "C-119", "Block C"],
    ];
    const sid = [];
    for (const [name, email, room, block] of studentDefs) {
      const id = (
        await c.query(
          `INSERT INTO users (name, email, password_hash, role, room, block)
           VALUES ($1,$2,$3,'student',$4,$5) RETURNING id`,
          [name, email, studentHash, room, block]
        )
      ).rows[0].id;
      sid.push(id);
    }

    // Anonymous padding residents so clusters can show realistic report counts.
    const gen = [];
    for (let i = 1; i <= 30; i++) {
      const id = (
        await c.query(
          `INSERT INTO users (name, email, password_hash, role, block)
           VALUES ($1,$2,$3,'student',$4) RETURNING id`,
          [`Resident ${i}`, `resident${i}@campus.edu`, genHash, "Block " + "ABCDEF"[i % 6]]
        )
      ).rows[0].id;
      gen.push(id);
    }
    const pad = (n) => gen.slice(0, n); // reuse across clusters (a student can report many)

    async function addComplaint(o) {
      const ins = await c.query(
        `INSERT INTO complaints
           (owner_id, raw_text, title, category, block, floor, severity, status, department,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now()-$10::interval, now()-$10::interval)
         RETURNING *`,
        [o.reporters[0], o.text, o.title, o.category, o.block, o.floor, o.severity, o.status, o.department, o.age]
      );
      const comp = ins.rows[0];
      for (const uid of o.reporters) {
        await c.query(
          `INSERT INTO complaint_reporters (complaint_id, user_id, raw_text)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [comp.id, uid, o.text]
        );
      }
      return comp;
    }

    const M = "Maintenance", IT = "IT", HK = "Housekeeping", FO = "Front Office";

    // ---- the dataset ----
    const water = await addComplaint({
      text: "No water in Block C second floor since morning. Taps are completely dry, can't even brush.",
      title: "No water on the second floor since morning",
      category: "plumbing", block: "Block C", floor: "Floor 2", severity: "high",
      status: "in-progress", department: M, age: "3 hours", reporters: [sid[0], ...pad(17)],
    });
    await addComplaint({
      text: "WiFi keeps dropping every few minutes in the entire B wing, online class got disconnected 4 times.",
      title: "WiFi keeps dropping across all of Block B",
      category: "wifi", block: "Block B", floor: "All Floors", severity: "high",
      status: "waiting", department: IT, age: "6 hours", reporters: [sid[1], ...pad(24)],
    });
    const spark = await addComplaint({
      text: "Sparking socket near the washbasin in Block A — water is right next to it, looks dangerous.",
      title: "Sparking socket near the washbasin",
      category: "electrical", block: "Block A", floor: "Floor 1", severity: "critical",
      status: "pending", department: M, age: "3 hours", reporters: [sid[3], ...pad(5)],
    });
    await addComplaint({
      text: "Common bathroom on the 3rd floor of Block D hasn't been cleaned in three days.",
      title: "Common bathroom not cleaned for three days",
      category: "cleaning", block: "Block D", floor: "Floor 3", severity: "normal",
      status: "pending", department: HK, age: "20 hours", reporters: [sid[2], ...pad(8)],
    });
    await addComplaint({
      text: "WiFi router on the 4th floor of Block A is completely dead, no signal at all.",
      title: "WiFi router on 4th floor is dead",
      category: "wifi", block: "Block A", floor: "Floor 4", severity: "normal",
      status: "done", department: IT, age: "2 days", reporters: [sid[6], ...pad(4)],
    });
    const flood = await addComplaint({
      text: "Water is flooding the ground floor corridor in Block A, coming from a burst pipe.",
      title: "Water flooding the ground-floor corridor",
      category: "plumbing", block: "Block A", floor: "Floor 0", severity: "critical",
      status: "in-progress", department: M, age: "1 hour", reporters: [sid[3], ...pad(3)],
    });
    await addComplaint({
      text: "Power is out in the entire D wing, no lights or fans working since evening.",
      title: "Power out in the entire D wing",
      category: "electrical", block: "Block D", floor: "All Floors", severity: "high",
      status: "pending", department: M, age: "5 hours", reporters: [sid[8], ...pad(6)],
    });
    await addComplaint({
      text: "Geyser in the Block C first floor bathroom is not heating water at all.",
      title: "Geyser not heating water",
      category: "plumbing", block: "Block C", floor: "Floor 1", severity: "normal",
      status: "pending", department: M, age: "8 hours", reporters: [sid[4], ...pad(1)],
    });
    await addComplaint({
      text: "Ceiling fan in my room stopped working, room gets really hot at night.",
      title: "Ceiling fan stopped working",
      category: "electrical", block: "Block B", floor: "Floor 2", severity: "normal",
      status: "done", department: M, age: "3 days", reporters: [sid[10]],
    });
    await addComplaint({
      text: "Garbage has not been collected in the B wing for two days, it's starting to smell.",
      title: "Garbage not collected in B wing",
      category: "cleaning", block: "Block B", floor: "Floor 2", severity: "normal",
      status: "waiting", department: HK, age: "26 hours", reporters: [sid[5], ...pad(2)],
    });
    await addComplaint({
      text: "The window latch in my room is broken and the window won't stay shut.",
      title: "Broken window latch in room",
      category: "other", block: "Block F", floor: "Floor 2", severity: "normal",
      status: "pending", department: FO, age: "30 hours", reporters: [sid[9]],
    });
    const messC = await addComplaint({
      text: "Food quality in the mess has dropped a lot this week, please look into it.",
      title: "Complaint about mess food quality",
      category: "other", block: "Block A", floor: "Unspecified", severity: "normal",
      status: "rejected", department: FO, age: "2 days", reporters: [sid[6], ...pad(4)],
    });
    // record a rejection reason on the mess complaint
    await c.query("UPDATE complaints SET status_note = $1 WHERE id = $2", [
      "Forwarded to the mess committee — not a maintenance issue.",
      messC.id,
    ]);
    await addComplaint({
      text: "Block E third floor pe paani nahi aa raha subah se, bahut problem ho rahi hai.",
      title: "No water on Block E third floor",
      category: "plumbing", block: "Block E", floor: "Floor 3", severity: "high",
      status: "pending", department: M, age: "4 hours", reporters: [sid[7], ...pad(2)],
    });
    await addComplaint({
      text: "Block F ma light nathi aavti, aakho floor andhara ma che.",
      title: "No lights on a Block F floor",
      category: "electrical", block: "Block F", floor: "Floor 2", severity: "high",
      status: "pending", department: M, age: "2 hours", reporters: [sid[9], ...pad(3)],
    });
    await addComplaint({
      text: "WiFi is extremely slow in Block C, pages take forever to load.",
      title: "WiFi very slow in Block C",
      category: "wifi", block: "Block C", floor: "All Floors", severity: "normal",
      status: "in-progress", department: IT, age: "10 hours", reporters: [sid[11], ...pad(1)],
    });
    await addComplaint({
      text: "There are cockroaches in the Block D pantry, food is being kept there.",
      title: "Pest problem in the Block D pantry",
      category: "cleaning", block: "Block D", floor: "Floor 1", severity: "high",
      status: "pending", department: HK, age: "12 hours", reporters: [sid[2], ...pad(5)],
    });
    await addComplaint({
      text: "Tap in the Block A second floor washroom keeps leaking, water is being wasted.",
      title: "Tap leaking in the washroom",
      category: "plumbing", block: "Block A", floor: "Floor 2", severity: "normal",
      status: "done", department: M, age: "4 days", reporters: [sid[6]],
    });
    const burning = await addComplaint({
      text: "There is a burning smell coming from the switchboard on Block C third floor.",
      title: "Burning smell from the switchboard",
      category: "electrical", block: "Block C", floor: "Floor 3", severity: "critical",
      status: "waiting", department: M, age: "20 hours", reporters: [sid[0], ...pad(2)],
    });
    await addComplaint({
      text: "The drain in the Block B ground floor washroom is blocked and overflowing.",
      title: "Blocked drain overflowing",
      category: "plumbing", block: "Block B", floor: "Floor 1", severity: "high",
      status: "pending", department: M, age: "7 hours", reporters: [sid[5], ...pad(4)],
    });
    await addComplaint({
      text: "The common room in Block E has not been cleaned or dusted for a week.",
      title: "Common room not cleaned",
      category: "cleaning", block: "Block E", floor: "Floor 1", severity: "normal",
      status: "pending", department: HK, age: "15 hours", reporters: [sid[7], ...pad(1)],
    });

    // ---- a few worker assignments (F10) ----
    const workerId = async (role) =>
      (await c.query("SELECT id FROM workers WHERE role = $1 LIMIT 1", [role])).rows[0]?.id;
    const plumber = await workerId("Plumber");
    const electrician = await workerId("Electrician");
    const maintTech = await workerId("Maintenance Technician");

    async function assign(comp, wId, startH, endH) {
      if (!wId) return;
      await c.query(
        `INSERT INTO assignments (complaint_id, worker_id, assigned_by, eta_start, eta_end)
         VALUES ($1,$2,$3, now()+$4::interval, now()+$5::interval)`,
        [comp.id, wId, adminId, `${startH} hours`, `${endH} hours`]
      );
    }
    await assign(water, plumber, 1, 2);
    await assign(spark, electrician, 0, 1);
    await assign(flood, maintTech, 0, 1);
    await assign(burning, electrician, 1, 3);

    // ---- a few notifications for the demo student (Aisha) ----
    const notes = [
      ["Help is on the way for C-001 🛠️", `${(await c.query("SELECT name FROM workers WHERE id=$1", [plumber])).rows[0].name} (Plumber) has been assigned to your water complaint (C-001).`, true, "12 minutes"],
      ["WiFi issue acknowledged", "C-002 is now Waiting on parts. Many students reported this.", true, "1 hour"],
      ["Resolved 🎉", "Your WiFi router complaint (C-005) was marked Done.", false, "2 days"],
    ];
    for (const [title, body, unread, age] of notes) {
      await c.query(
        `INSERT INTO notifications (user_id, title, body, unread, created_at)
         VALUES ($1,$2,$3,$4, now()-$5::interval)`,
        [sid[0], title, body, unread, age]
      );
    }

    await c.query("COMMIT");

    const counts = await pool.query(
      "SELECT (SELECT count(*) FROM complaints) AS complaints, (SELECT count(*) FROM users WHERE role='student') AS students, (SELECT count(*) FROM assignments) AS assignments"
    );
    const k = counts.rows[0];
    console.log("[seed:samples] done.");
    console.log(`  ${k.complaints} complaints, ${k.students} students, ${k.assignments} assignments`);
    console.log(`  admin   -> ${ADMIN_EMAIL} / (your SEED_ADMIN_PASSWORD)`);
    console.log("  student -> aisha.k@campus.edu / hostel123  (any named student uses hostel123)");
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("[seed:samples] failed:", e.message);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
}

main();

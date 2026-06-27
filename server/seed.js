import bcrypt from "bcryptjs";
import { pool } from "./db.js";

async function main() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "TRUNCATE notifications, complaint_reporters, complaints, users RESTART IDENTITY CASCADE"
    );

    const adminHash = await bcrypt.hash("AZSXDCQWE123", 10);
    const aishaHash = await bcrypt.hash("hostel123", 10);
    const genHash = await bcrypt.hash("pass123", 10);

    // The single admin account. Email stored lowercase to match login lookup.
    await c.query(
      `INSERT INTO users (name, email, password_hash, role, room, block)
       VALUES ($1,$2,$3,'admin',$4,$5)`,
      ["Hostel Admin", "admin@12345.com", adminHash, "Office", "Admin Block"]
    );

    const aisha = (
      await c.query(
        `INSERT INTO users (name, email, password_hash, role, room, block)
         VALUES ($1,$2,$3,'student',$4,$5) RETURNING id`,
        ["Aisha Khan", "aisha.k@campus.edu", aishaHash, "C-214", "Block C"]
      )
    ).rows[0].id;

    // A pool of generic students to act as co-reporters in clusters.
    const students = [];
    for (let i = 1; i <= 40; i++) {
      const r = await c.query(
        `INSERT INTO users (name, email, password_hash, role, room, block)
         VALUES ($1,$2,$3,'student',$4,$5) RETURNING id`,
        [`Student ${i}`, `student${i}@campus.edu`, genHash, `R-${100 + i}`, "Block " + "ABCD"[i % 4]]
      );
      students.push(r.rows[0].id);
    }

    async function addComplaint(opts) {
      const ins = await c.query(
        `INSERT INTO complaints
           (owner_id, raw_text, category, block, floor, severity, status, department, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now()-$9::interval, now()-$9::interval)
         RETURNING *`,
        [
          opts.owner, opts.text, opts.category, opts.block, opts.floor,
          opts.severity, opts.status, opts.department, opts.age,
        ]
      );
      const comp = ins.rows[0];
      for (const uid of opts.reporters) {
        await c.query(
          `INSERT INTO complaint_reporters (complaint_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [comp.id, uid]
        );
      }
      return comp;
    }

    const water = await addComplaint({
      owner: aisha,
      text: "No water in Block C second floor since morning. Taps are completely dry, can't even brush.",
      category: "plumbing", block: "Block C", floor: "Floor 2",
      severity: "high", status: "in-progress", department: "Maintenance",
      age: "3 hours", reporters: [aisha, ...students.slice(0, 17)],
    });

    const wifiB = await addComplaint({
      owner: aisha,
      text: "WiFi keeps dropping every few minutes in the entire B wing, online class got disconnected 4 times.",
      category: "wifi", block: "Block B", floor: "All Floors",
      severity: "high", status: "waiting", department: "IT",
      age: "6 hours", reporters: [aisha, ...students.slice(0, 24)],
    });

    const wifiA = await addComplaint({
      owner: aisha,
      text: "WiFi router on the 4th floor of Block A is completely dead, no signal at all.",
      category: "wifi", block: "Block A", floor: "Floor 4",
      severity: "normal", status: "done", department: "IT",
      age: "2 days", reporters: [aisha, ...students.slice(0, 4)],
    });

    await addComplaint({
      owner: students[0],
      text: "Sparking socket near the washbasin in Block A — water is right next to it, looks dangerous.",
      category: "electrical", block: "Block A", floor: "Floor 1",
      severity: "critical", status: "pending", department: "Maintenance",
      age: "3 hours", reporters: students.slice(0, 7),
    });

    await addComplaint({
      owner: students[5],
      text: "Common bathroom on the 3rd floor of Block D hasn't been cleaned in three days.",
      category: "cleaning", block: "Block D", floor: "Floor 3",
      severity: "normal", status: "pending", department: "Housekeeping",
      age: "20 hours", reporters: students.slice(0, 10),
    });

    const notes = [
      {
        title: "Update on your water complaint",
        body: `${water.code} (Block C · Floor 2) moved to In Progress. A plumber has been assigned.`,
        unread: true, age: "12 minutes",
      },
      {
        title: "WiFi issue acknowledged",
        body: `${wifiB.code} is now Waiting on parts. 24 students reported this.`,
        unread: true, age: "1 hour",
      },
      {
        title: "Resolved 🎉",
        body: `Your WiFi router complaint (${wifiA.code}) was marked Done.`,
        unread: false, age: "2 days",
      },
    ];
    for (const n of notes) {
      await c.query(
        `INSERT INTO notifications (user_id, title, body, unread, created_at)
         VALUES ($1,$2,$3,$4, now()-$5::interval)`,
        [aisha, n.title, n.body, n.unread, n.age]
      );
    }

    await c.query("COMMIT");
    console.log("[seed] done.");
    console.log("  admin   -> Admin@12345.com / AZSXDCQWE123");
    console.log("  student -> aisha.k@campus.edu / hostel123");
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("[seed] failed:", e.message);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
}

main();

# User & Admin Guide — AI Powered Smart Complaint Portal

This guide explains who does what and walks through every workflow, step by step.
There are **two roles**: **Student** (reports & tracks issues) and **Admin** (resolves them).

---

## Test logins (sample data is already loaded)

The database is pre-seeded with **20 realistic complaints**, clusters, worker
assignments, and every status — so you can test immediately.

| Role | Email | Password |
|---|---|---|
| **Admin** | `Admin@12345.com` | `AZSXDCQWE123` |
| **Student** (demo) | `aisha.k@campus.edu` | `hostel123` |
| Other students | `dev.g@campus.edu`, `naksee.d@campus.edu`, `aniket.k@campus.edu`, `suhanee.g@campus.edu`, … | `hostel123` (all named students) |

> Log in as **Aisha** to see a student who has reported several issues (including
> ones with an assigned worker). Log in as **Admin** to see the full worklist.

**Where to log in:**
- Student → the main sign-in page (email/password or "Continue with Google").
- Admin → click **"Admin login"** at the bottom of the sign-in page; it opens a separate admin form.

---

# 👤 STUDENT — what you do

Your job: **report a problem in plain words and stay informed.** That's it. The
system figures out the category, location, severity, duplicates, and routing.

### 1. Sign in / register
- **Register** with your campus email (or Google). New accounts are always students.
- No role selection anywhere — you can't accidentally become an admin.

### 2. Report a complaint (the one-box intake)
1. Go to **Report**.
2. Type what's wrong in **one text box** — natural language, any of English / Hindi / Gujarati / Hinglish.
   - e.g. *"No water in Block C second floor since morning"*
   - e.g. *"Block E third floor pe paani nahi aa raha subah se"*
3. Press **Understand & submit**.
4. The AI reads it and shows a confirmation of what it understood — **category, location, severity** — plus one of:
   - **"Logged as C-0XX…"** — a new complaint was created, **or**
   - **"This is the Nth report of this issue"** — your report **merged** into an existing complaint (no duplicate created).

**You never pick category, urgency, or location** — and you never type your name or phone. The system already knows who you are from your login.

### 3. (Optional) Add a photo or short video *(physical issues only)*
- For plumbing / electrical / cleaning issues, an optional step lets you add **one photo or one short video (≤15s)** to help the worker.
- On a phone it opens the **camera** directly. It's always optional — you can skip it and submit anyway.
- *(This step is available for the categories above; not shown for wifi/other.)*

### 4. Track your complaints
Go to **My Complaints**. Each card shows:
- Category · Block · Floor, a **severity badge**, and a short AI title (tap to see your original words).
- A **status pill** and *"N others reported this."*
- A 4-step **progress tracker**: Pending → In Progress → Waiting → Done.
- **When a worker is assigned:** a "Help is on the way" panel with the worker's **name, role, tappable phone number, and arrival time**.

### 5. Stay in the loop
- The **🔔 bell** (top right) shows notifications and an unread count.
- You're notified automatically when: your status changes, a worker is assigned, your report merges into a cluster, or it's rejected/reopened.
- **Mark all read** clears the dots.

**Student workflow at a glance:**
`Sign in → Report (type it) → (optional photo) → track on My Complaints → get notified on every change`

---

# 🛠️ ADMIN — what you do

Your job: **work a pre-sorted list and close the loop.** The dashboard arrives
already prioritized, so you decide less.

### 1. Sign in
- On the sign-in page click **"Admin login"** → enter the admin email/password.
- Only accounts with the admin role in the database can get in; a student's credentials are rejected here (and every admin API route is protected server-side).

### 2. Read the dashboard
The dashboard lists complaints as **clusters** (duplicates already merged), and:
- **Sorted automatically** by severity, then by report count.
- **Summary tiles:** Open issues · Critical · Overdue (SLA) · Total reports.
- Per-complaint chips: **department** (auto-routed), **SLA target vs. overdue** (red when past target), **"Needs review – AI uncertain"**, **"Possible duplicate of C-0XX"**, and the **assigned worker** if any.
- **No personal contact data** appears in this list view (privacy by design).

### 3. Move a complaint through the pipeline
- Use the **Move to:** buttons — Pending / In Progress / Waiting / Done.
- Every change writes a notification to **all reporters** in the cluster.

### 4. Assign a worker *(the physical loop — F10)*
1. Click **Assign worker** on a complaint.
2. Pick a worker from that complaint's **department** (e.g. a Plumber for a plumbing issue).
3. Set the **arrival window** (from / to time).
4. **Confirm assignment.** This automatically:
   - moves the complaint to **In Progress**,
   - notifies **every reporter**, and
   - shows the worker's name, role, phone, and ETA on each student's card.
- You can **reassign** later; the latest assignment is what shows.

### 5. Reject or reopen
- **Reject** a complaint (with an optional reason) — reporters are told why.
- **Reopen** a Done/Rejected complaint back to Pending if the problem returns.

### 6. Fix the AI when it's wrong
- **View reporters** on a cluster, and **Detach** a report that was wrongly merged — it becomes its own complaint using that student's original words.
- **Correct the classification** (category / severity / block / floor) when the AI got it wrong; every correction is logged.

**Admin workflow at a glance:**
`Admin login → open pre-sorted dashboard → for each issue: set status / assign a worker + ETA / reject / correct AI → reporters auto-notified`

---

## The end-to-end loop (both roles)

```
Student types a problem
        │
        ▼
AI classifies (category, location, severity, title) ──► duplicates merge into one cluster
        │
        ▼
Admin dashboard shows it, pre-sorted by severity + report count (overdue flagged)
        │
        ▼
Admin assigns a worker + ETA  ──►  status → In Progress
        │
        ▼
Every reporter is notified; student sees the worker's name, phone & arrival time
        │
        ▼
Admin marks Done  ──►  "Resolved 🎉" notification to all reporters
```

---

## Good things to try with the sample data
- **As Admin:** notice the top of the list is the **critical, overdue** items (sparking socket, burning smell). Assign a worker to one and watch the status flip to In Progress.
- **As Aisha (student):** open **My Complaints** — C-001 (water) already has **Ramesh Patel, Plumber** assigned with a phone number and ETA. Check the **🔔 bell**.
- **Test dedup:** as a student, submit *"there's no water on the 2nd floor of block C"* — it should **merge** into the existing water cluster and say *"This is the Nth report."*
- **Test multilingual:** submit *"Block F ma light nathi aavti"* — it classifies as **electrical**.

---

*For the full spec see [PRD.md](PRD.md); to run or deploy see [README.md](README.md) and [DEPLOYMENT.md](DEPLOYMENT.md).*

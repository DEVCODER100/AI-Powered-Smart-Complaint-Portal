# AI Powered Smart Complaint Portal — Project Report

**Project Title:** AI Complaint Management and Request Portal (AI Powered Smart Complaint Portal)
**Mentor:** Vedanti Patel
**Institute:** Parul Institute of Engineering and Technology – Diploma Studies, Computer Engineering Department (5th Semester Major Project)
**Repository:** https://github.com/DEVCODER100/AI-Powered-Smart-Complaint-Portal

**Team Members**

| SR | Name | Enrollment No | Division |
|----|------|---------------|----------|
| 1 | Dev Gupta | 2403396160310 | 5QE |
| 2 | Naksee Desai | 2403396160286 | 5QE |
| 3 | Aniket Kumbhar | 2403396160290 | 5QE |
| 4 | Suhanee Gupta | 2403396160289 | 5QE |

---

## 1. Abstract

The AI Powered Smart Complaint Portal is a full-stack web application that streamlines how residents of hostels and campuses report and resolve maintenance issues. Instead of rigid forms and dropdowns, a user simply describes the problem in plain language (e.g. *"No water in Block C second floor since morning"*), and the system automatically extracts the **category, location, and severity** from the text using AI.

A key feature is **intelligent de-duplication**: when many students report the same underlying issue, their reports are merged into a single tracked complaint with a live count of affected people, so staff see one prioritized item instead of dozens of duplicates. Complaints flow through a clear status pipeline (Pending → In Progress → Waiting → Done), and every reporter receives a notification on each status change.

The portal provides **role-based access**: students can submit and track only their own complaints, while a secured admin dashboard lets authorized staff view all complaints — sorted by severity and report count — update statuses, and monitor SLA deadlines. Authentication is enforced server-side with hashed passwords, JWT sessions, and Google Sign-In.

---

## 2. Problem Statement

Traditional complaint handling in hostels/campuses is manual and broken:

- Paper registers and verbal reporting — complaints get delayed or lost
- No tracking: students have no visibility into complaint progress
- Duplicate reports: the same outage gets reported dozens of times, flooding staff
- No prioritization: a sparking socket and a dirty corridor are treated the same
- No accountability or record management

## 3. Proposed Solution

A single web portal where:

1. **Students type what's wrong in one text box.** The AI works out category (plumbing / wifi / electrical / cleaning / other), location (block + floor), and severity (critical / high / normal).
2. **Duplicates are merged automatically.** Reports of the same open issue in the same block/floor become one complaint with an "N others reported this" counter.
3. **Everything is tracked.** A visual four-step pipeline shows exactly where each complaint stands, and reporters are notified on every change.
4. **Admins get a prioritized worklist.** All complaints, pre-sorted by severity then report count, with SLA targets (Critical 2h · High 24h · Normal 72h) and department routing (Maintenance / IT / Housekeeping / Front Office).

---

## 4. System Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  React Frontend  │  /api   │  Express Backend  │   SQL   │  PostgreSQL (Neon)│
│  Vite + Tailwind │ ──────► │  Node.js REST API │ ──────► │  users, complaints│
│  localhost:5173  │  proxy  │  localhost:4000   │         │  reporters, notifs│
└─────────────────┘         └───────┬──────────┘         └──────────────────┘
                                     │
                            ┌────────▼─────────┐
                            │  Google Gemini    │  (AI intake — classify text;
                            │  gemini-2.0-flash │   rule-based fallback if down)
                            └──────────────────┘
```

- The Vite dev server proxies `/api/*` requests to the Express backend (no CORS pain).
- The backend talks to a cloud-hosted PostgreSQL database on **Neon**.
- Complaint text is classified by **Google Gemini** (JSON-schema mode, temperature 0). If the API key is absent or the call fails/times out (9s), a deterministic **rule-based classifier** takes over, so submission never breaks.

---

## 5. Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool / dev server |
| Tailwind CSS | Styling (custom design system) |
| React Router v6 | Client-side navigation |
| Google Identity Services | "Sign in with Google" button |
| Lucide React | Icons |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express.js | REST API server |
| PostgreSQL (Neon cloud) | Database |
| pg | Postgres driver with connection pooling |
| bcryptjs | Password hashing |
| jsonwebtoken (JWT) | Session tokens (7-day expiry) |
| google-auth-library | Verifying Google ID tokens server-side |
| Google Gemini API | AI complaint classification |

---

## 6. Database Design

Four tables (see `server/schema.sql`):

### `users`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name, email | TEXT | email UNIQUE, stored lowercase |
| password_hash | TEXT | bcrypt (10 rounds) |
| role | TEXT | `student` or `admin` (CHECK constraint) |
| room, block, phone | TEXT | optional profile info |
| created_at | TIMESTAMPTZ | |

### `complaints`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| code | TEXT (generated) | human-readable `C-001`, `C-002`, … |
| owner_id | FK → users | first reporter |
| raw_text | TEXT | the original complaint text |
| category | TEXT | plumbing / wifi / electrical / cleaning / other |
| block, floor | TEXT | extracted location |
| severity | TEXT | critical / high / normal |
| status | TEXT | pending / in-progress / waiting / done |
| department | TEXT | auto-routed team |
| ai_flagged | BOOLEAN | true when the classifier was uncertain |
| created_at, updated_at | TIMESTAMPTZ | |

### `complaint_reporters` (the de-duplication join table)
Many students → one complaint. `(complaint_id, user_id)` composite PK.

### `notifications`
Per-user notifications with `unread` flag, linked to complaints.

**ER relationships:** one user submits many complaints; one complaint has many reporters (M:N via `complaint_reporters`); one user has many notifications.

---

## 7. API Reference

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | Server + DB health check |
| POST | `/api/auth/register` | public | Student self-registration (role forced to `student`) |
| POST | `/api/auth/login` | public | Email/password login → JWT |
| POST | `/api/auth/google` | public | Google Sign-In (verifies ID token server-side) |
| GET | `/api/auth/me` | auth | Current user from token |
| POST | `/api/complaints` | student | Create complaint (AI classify + dedup merge) |
| GET | `/api/complaints/mine` | student | The user's own reported issues |
| GET | `/api/admin/complaints` | **admin** | ALL complaints, pre-sorted by severity → count |
| PATCH | `/api/complaints/:code/status` | **admin** | Move status + notify every reporter |
| GET | `/api/notifications` | auth | User's notifications (latest 20) |
| POST | `/api/notifications/read-all` | auth | Mark all read |

---

## 8. Security Model

- **Passwords** are bcrypt-hashed; plaintext is never stored.
- **JWT sessions** signed with a server secret; 7-day expiry.
- **Roles live only in the database** — registration and Google sign-in always create `student`; nobody can self-assign `admin`.
- **Server-side enforcement**: every privileged route re-reads the user's role from the DB (`authRequired` → `adminOnly` middleware). A student token hitting `/api/admin/*` gets **HTTP 403**, regardless of what the frontend shows.
- **Dedicated admin portal**: the "Admin login" button opens a separate email+password form; non-admin credentials are rejected with "This account doesn't have admin access" and the session is cleared.
- **Google Sign-In** uses the ID-token flow: the token is verified server-side against the OAuth Client ID (`google-auth-library`); unverified emails are rejected.
- **Secrets** (`.env`, `server/.env` — DB URL, JWT secret, Gemini key) are gitignored and never committed.
- Reporter contact details are hidden from list views by design (privacy).

---

## 9. AI Intake — How Classification Works

**Primary: Google Gemini** (`server/ai.js`)
- Model: `gemini-2.0-flash` (configurable via `GEMINI_MODEL`)
- Uses Gemini's structured-output mode (`responseMimeType: application/json` + JSON schema) at temperature 0 for deterministic results
- A system prompt defines the triage rules (categories, location formats, severity rubric)
- Output is validated and normalized before use (unknown categories → `other`, blocks normalized to "Block X")

**Fallback: rule-based classifier** (`server/classify.js`)
- Keyword scoring for category (e.g. "tap", "leak" → plumbing; "router", "signal" → wifi)
- Safety words → critical ("spark", "fire", "shock", "short circuit"); outage words → high ("no water", "entire", "dead")
- Regex extraction of "Block C" / "second floor" / "all floors" style location text
- If nothing can be read, severity defaults safe (`normal`) and the complaint is flagged (`ai_flagged`) for admin review

**Guarantee:** Gemini errors/timeouts silently fall back to rules — complaint submission never fails because of the AI layer.

### De-duplication
On create, the backend looks for an **open** complaint with the same `(category, block, floor)`. If found (and location is specified), the new reporter is attached to the existing complaint instead of creating a duplicate — the student sees *"This is the 18th report of this issue."*

---

## 10. Features Walkthrough

### Student side
1. **Login / Register** — email+password or Continue with Google
2. **Report page** — one big text box: "What's the problem?" with example chips; live character count; "Understand & submit"
3. **My Complaints** — cards showing category icon, location, severity badge, status pill, "N others reported this", and a 4-step visual progress tracker
4. **Notifications bell** — unread badge; updates arrive whenever an admin changes a status; "Mark all read"

### Admin side
1. **Admin portal login** — separate restricted form (admin credentials only)
2. **Dashboard** — summary stats (open, overdue), all complaint clusters pre-sorted by severity then report count
3. **Per-complaint**: SLA target vs age (overdue flag), department, AI-flagged marker, and one-click status transitions
4. **Status change** → every reporter is notified automatically ("loop closure")

---

## 11. How to Run

```bash
# 1. Install
npm install

# 2. Configure secrets (both gitignored)
#    server/.env  → DATABASE_URL (Neon Postgres), JWT_SECRET, GOOGLE_CLIENT_ID, GEMINI_API_KEY
#    .env         → VITE_GOOGLE_CLIENT_ID
#    (copy from .env.example / server/.env.example)

# 3. Create tables + demo data
npm run db:setup

# 4. Run frontend (:5173) + backend (:4000) together
npm run dev:all
```

**Demo accounts (seeded)**

The admin account is created from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
in `server/.env` (required — no hardcoded credentials in the repo). A demo
student `aisha.k@campus.edu` is also seeded (password via `SEED_STUDENT_PASSWORD`).

---

## 12. Project Structure

```
├── index.html                  # Vite entry (loads Google GIS script)
├── package.json                # scripts: dev, server, dev:all, migrate, seed, db:setup, build
├── vite.config.ts              # /api proxy → :4000
├── tailwind.config.js          # design tokens (colors, fonts, shadows)
├── server/
│   ├── index.js                # Express app — all API routes
│   ├── db.js                   # pg pool (Neon SSL)
│   ├── auth.js                 # bcrypt/JWT helpers + authRequired/adminOnly middleware
│   ├── ai.js                   # Gemini intake + fallback wiring
│   ├── classify.js             # rule-based classifier + SLA/department maps
│   ├── schema.sql              # tables + indexes
│   ├── migrate.js / seed.js    # DB setup scripts
│   └── .env.example            # secret template
└── src/
    ├── App.tsx                 # routes + RequireAuth/RequireAdmin guards
    ├── lib/
    │   ├── api.ts              # typed fetch client (JWT header)
    │   ├── auth.tsx            # AuthProvider, useAuth, route guards
    │   ├── types.ts            # Complaint/Status/Severity types
    │   └── mockData.ts         # example chips
    ├── components/             # TopNav, ComplaintCard, ProgressTracker,
    │   │                       # SeverityBadge, StatusPill, NotificationsDropdown,
    │   └── GoogleSignInButton.tsx  # real GIS button w/ demo fallback
    └── pages/
        ├── Login.tsx           # student login/register + admin portal form
        ├── Intake.tsx          # "What's the problem?" report page
        ├── MyComplaints.tsx    # student tracker
        └── AdminDashboard.tsx  # admin worklist + status controls
```

---

## 13. Testing / Verification Performed

All verified live against the Neon cloud database:

| Test | Result |
|---|---|
| Health check (`/api/health`) | ✅ ok, db connected |
| Student registration → role forced to `student` | ✅ |
| Email/password login (student + admin) | ✅ |
| Submit complaint → classified (category/location/severity extracted from free text) | ✅ e.g. "Sparking plug point in Block F third floor" → electrical / critical / Block F / Floor 3 |
| Duplicate submission → merged, count incremented | ✅ became "the 18th report" of C-001, no new ticket |
| Data persistence across server restarts | ✅ |
| Admin sees all clusters, sorted severity → report count | ✅ |
| Student token on admin route | ✅ blocked, HTTP 403 |
| Student credentials on admin portal form | ✅ rejected + session cleared |
| Status change → all reporters notified | ✅ "Resolved 🎉" notification appeared |
| Mark-all-read | ✅ unread → 0 |
| Google route verifies tokens against Client ID | ✅ fake token → 401 |
| Frontend production build (`tsc && vite build`) | ✅ no type errors |

---

## 14. Limitations & Future Scope

**Current limitations**
- Email/SMS notifications not implemented (in-app only)
- No image upload with complaints
- No mobile app (responsive web only)
- Admin cannot yet view reporter contact details / edit complaint fields (detail view planned)
- Google OAuth restricted to test users until the consent screen is published

**Future scope**
- Complaint detail view for admins with reporter contact info
- Email notifications (e.g. via Resend/SendGrid)
- Image/attachment upload
- Analytics dashboard (resolution times, category trends, block heatmaps)
- Deployment to production hosting (frontend on Vercel/Netlify, API on Render/Railway, DB already cloud-hosted on Neon)

---

## 15. Configuration Summary (for the team)

All secrets live in gitignored env files; see `.env.example` and
`server/.env.example` for the full list.

| Item | Where | Notes |
|---|---|---|
| Neon Postgres `DATABASE_URL` | `server/.env` | required |
| `JWT_SECRET` | `server/.env` | required — long random string |
| Google OAuth Client ID | `.env` + `server/.env` | optional (Google sign-in) |
| `GEMINI_API_KEY` | `server/.env` | optional — enables AI classification + semantic dedup (falls back to rules) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `server/.env` | required by `npm run seed` |
| `FRONTEND_ORIGIN` | `server/.env` | production CORS origin |

---

*Report generated on 2026-07-14.*

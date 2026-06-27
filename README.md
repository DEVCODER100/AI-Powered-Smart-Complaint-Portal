# AI Powered Complaint Portal

Hostel complaint portal — students report issues in one text box; the system
classifies, de-duplicates, and tracks them to resolution. Admins get a
pre-sorted worklist. Frontend matches the Lovable reference UI.

- **Frontend:** Vite + React + TypeScript + Tailwind
- **Backend:** Express (Node) + PostgreSQL (Neon)
- **Auth:** email/password with hashed passwords + JWT, server-side role checks

## 1. Install

```bash
npm install
```

## 2. Configure the database

1. Create a free Postgres database at https://neon.tech (or any Postgres).
2. Copy its connection string.
3. Create `server/.env` (copy from `server/.env.example`) and fill in:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST/dbname?sslmode=require
JWT_SECRET=some-long-random-string
PORT=4000
```

## 3. Create tables + seed demo data

```bash
npm run db:setup      # runs migrate then seed
```

Seeded accounts:

| Role    | Email                | Password   |
| ------- | -------------------- | ---------- |
| Student | aisha.k@campus.edu   | hostel123  |
| Admin   | admin@campus.edu     | admin123   |

## 4. Run (frontend + backend together)

```bash
npm run dev:all       # web on :5173, api on :4000 (Vite proxies /api -> :4000)
```

Open http://localhost:5173.

Run separately if you prefer: `npm run dev` (web) and `npm run server` (api).

## Workflow

1. Student logs in → describes a problem in one box → `POST /api/complaints`.
2. Server classifies (category/location/severity) with rule-based extraction and
   **merges duplicates** of the same open issue in the same block/floor into one
   counted cluster.
3. Student sees their issues at `/complaints`; admin sees **all** issues at
   `/admin`, pre-sorted by severity then report count, with SLA flags.
4. Admin changes status → every reporter is notified (bell dropdown).

## API

| Method | Path                          | Access  | Purpose                         |
| ------ | ----------------------------- | ------- | ------------------------------- |
| POST   | `/api/auth/register`          | public  | Student self-registration       |
| POST   | `/api/auth/login`             | public  | Login (returns JWT)             |
| GET    | `/api/auth/me`                | auth    | Current user                    |
| POST   | `/api/complaints`             | student | Create (classify + dedup)       |
| GET    | `/api/complaints/mine`        | student | The user's reported issues      |
| GET    | `/api/admin/complaints`       | admin   | All clusters, pre-sorted        |
| PATCH  | `/api/complaints/:code/status`| admin   | Move pipeline + notify reporters|
| GET    | `/api/notifications`          | auth    | The user's notifications        |
| POST   | `/api/notifications/read-all` | auth    | Mark all read                   |

Roles are assigned in the DB, never self-selected; every privileged route is
checked server-side against the stored role.

## Not yet built (roadmap)

- AI intake via Claude/OpenRouter (the rule-based classifier is the documented
  fallback; swapping in a model call does not change the API contract).
- Real Google OAuth (the button currently demo-logs the seeded student).
- Email notifications (in-app notifications are implemented).

# Product Requirements Document — AI Powered Smart Complaint Portal

**Status:** v2 — as-built (reflects the shipped system, not a pre-build spec)
**Type:** Full-stack web application
**Audience:** Hostel/campus students (reporters) + administrators/faculty (resolvers)
**Repository:** https://github.com/DEVCODER100/AI-Powered-Smart-Complaint-Portal

> **Product thesis:** The old portal *stores* complaints. Ours *understands* them, prioritizes them, routes them, and never lets one be forgotten.

---

## 1. Problem & goals

### 1.1 The problem
A passive complaint register fails in three ways:
- **Broken prioritization** — when students self-select urgency, everyone marks "urgent," so the field carries no signal.
- **Duplicate flooding** — one real outage produces dozens of separate tickets.
- **No closed loop** — students can't see progress and aren't told when status changes, so they re-submit, worsening the flood.

### 1.2 Goals
- **G1** Reduce student submission to a single action (one text box).
- **G2** Prioritize by AI-derived severity, not self-report.
- **G3** Collapse duplicate reports into one counted issue.
- **G4** Keep students informed automatically on every change.
- **G5** No complaint silently ignored (SLA response tracking).
- **G6** Verified identity to stop fakes without leaking personal data.
- **G7** Close the physical loop — assign a real worker with contact + ETA.

### 1.3 Non-goals
Repair-time guarantees (only response targets); generic FAQ chatbot; real-time websocket push (polling instead); campus super-app.

---

## 2. Users & roles

| Role | Assignment | Permissions |
|---|---|---|
| **Student** | Self-registers (Google or email/password). Default role. | Submit complaints; view & track own complaints; attach optional media; receive notifications. |
| **Admin / Faculty** | Provisioned via seeded credentials. No public signup, no role dropdown. | View all complaints; change status; assign workers; correct AI classification; unmerge; reject/reopen. |

**Hard security rule:** roles are never self-selected. Every privileged action is checked **server-side** against the role stored in the database — never a client-side claim. Google and email registration always create `student`.

---

## 3. Technology stack (as built)

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS (mobile-first) |
| Backend / API | Node.js + Express (runs locally, and as a Vercel serverless function in prod) |
| Database | PostgreSQL on Neon (+ `pgvector` for semantic dedup) |
| Auth | Email/password (bcrypt + JWT, 7-day) + Google Sign-In (ID-token, verified server-side) |
| AI / LLM | Google **Gemini** — `gemini-2.0-flash` (classification) + `text-embedding-004` (dedup embeddings) |
| Media | Cloudinary (signed direct upload; server stores only the URL) |
| Notifications | In-app (implemented). Email = roadmap. |
| Hosting | Vercel (frontend + serverless API); Neon (DB) |

---

## 4. Architecture

```
[ Student browser ]                          [ Admin browser ]
        |                                            |
        v                                            v
+------------------ Vercel (one domain) --------------------+
|  React SPA (Vite build)   |  Express API (serverless fn)  |
|  - one-box intake         |  /api/auth/*  /api/complaints  |
|  - student tracker        |  /api/admin/*  /api/notifications
|  - admin dashboard        |                                |
+---------------------------|-------------------------------+
                            |
      +---------------------+----------+------------------+
      v                     v          v                  v
 [ Neon Postgres ]   [ Google Gemini ] [ Cloudinary ]  [ Google Sign-In ]
 users, complaints,  classify + embed  photo/video      ID-token verify
 reporters, workers, (graceful         (signed upload)
 assignments, notifs  fallback)
```

**AI call pattern:** on complaint create, one Gemini call returns category/location/severity/title/confidence; a second call returns a 768-dim embedding for semantic duplicate matching. **Both degrade gracefully** — any missing key/error/timeout falls back to a deterministic rule-based classifier and exact-match dedup. Submission can never fail because of AI.

---

## 5. Data model (current tables)

- **users** — id, name, email (unique), password_hash (bcrypt), `role` (student|admin, CHECK), room, block, phone, created_at.
- **complaints** — id, `code` (generated `C-001`…), owner_id, raw_text, `title`, category, block, floor, severity, status, department, ai_flagged, `confidence`, `embedding vector(768)`, `possible_duplicate_of`, `status_note`, `media_url`, `media_type` (image|video), created_at, updated_at.
- **complaint_reporters** — (complaint_id, user_id) PK, `raw_text` — the de-duplication join (M:N); each reporter's original wording is kept so an unmerge can rebuild their complaint.
- **notifications** — id, user_id, complaint_id, title, body, unread, created_at.
- **workers** — id, name, phone, role, department, is_available, created_at.
- **assignments** — id, complaint_id, worker_id, assigned_by, eta_start, eta_end, note, assigned_at (latest row = current assignment).
- **classification_corrections** — audit log of admin edits to AI classification.
- **schema_migrations** — applied-migration tracker.

Enumerations — category: `plumbing | wifi | electrical | cleaning | other`; severity: `critical | high | normal`; status: `pending | in-progress | waiting | done | rejected`; department (auto-routed): Maintenance | IT | Housekeeping | Front Office.

---

## 6. Features (all built unless noted)

| # | Feature | Notes |
|---|---|---|
| F1 | **One-box intake** | Free text → Gemini extracts category/location/severity/title/confidence (rule-based fallback). |
| F2 | **AI severity scoring** | Derived from text; uncertain → defaults `normal` + `needs_review`. Students can't set severity. |
| F3 | **Duplicate clustering** | Semantic (embeddings + pgvector): cosine ≥0.85 merges; 0.70–0.85 flags a possible duplicate; exact-match fallback. |
| F4 | **Auto-routing** | Category → department. |
| F5 | **Status pipeline + loop closure** | pending→in-progress→waiting→done; every change notifies all reporters. |
| F6 | **SLA timers** | On create, target by severity (critical 2h, high 24h, normal 72h); overdue flagged + sorted to top. Response targets, not fix guarantees. |
| F7 | **Admin dashboard** | Clusters pre-sorted by severity then report count; overdue/critical/needs-review/possible-duplicate flags; no personal data in list view. |
| F8 | **Identity & privacy** | Verified login attaches identity silently; no GPS; contact data access-controlled. |
| F9 | Status chatbot | *Not built* (optional). |
| **F10** | **Worker assignment** | Admin assigns a department worker + ETA window → status auto-moves to in-progress → all reporters notified; student sees worker name, role, **tappable phone**, ETA. Supports reassignment. |
| **F11** | **Multilingual intake** | English / Hindi / Gujarati / Hinglish input → normalized English output (Gemini prompt + rule-based keyword maps). |
| **F12** | **Admin classification feedback** | Admin corrects category/severity/block/floor; every change logged. |
| **F13** | **Unmerge / detach** | Admin splits a wrongly-merged reporter into their own complaint (using their original wording). |
| **F14** | **Reject + reopen** | Reject with reason; reopen done/rejected → pending. |
| **F15** | **Optional media** | One photo OR one ≤15s video, physical categories only (plumbing/electrical/cleaning). Signed direct upload to Cloudinary; server verifies format/size/duration. Camera-capable on mobile. *(Backend built; frontend in progress.)* |

### Deliberately rejected — AI-generated-image detection
Detectors have high false-positive rates (a **real photo of a real leak gets rejected** — a catastrophic failure mode), depend on unverifiable third-party APIs, and defend against fraud that verified identity already prevents. Chosen mitigation instead: **in-app camera capture** (`capture="environment"`) as structural prevention. *Demo line: "We chose the reliable mechanism over the impressive-sounding one."*

---

## 7. API reference

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | DB health |
| POST | `/api/auth/register` \| `/login` \| `/google` | public | Auth (role forced to student) |
| GET | `/api/auth/me` | auth | Current user |
| POST | `/api/complaints` | student | Create (AI classify + dedup) |
| GET | `/api/complaints/mine` | student | Own complaints |
| POST | `/api/complaints/media/signature` | student | Signed Cloudinary upload params |
| PATCH | `/api/complaints/:code/media` | student (owner) | Attach + server-verify media |
| GET | `/api/admin/complaints` | **admin** | All clusters, sorted, paginated |
| GET | `/api/admin/complaints/:code/reporters` | **admin** | Reporters (for unmerge) |
| POST | `/api/admin/complaints/:code/detach/:userId` | **admin** | Unmerge a reporter |
| PATCH | `/api/admin/complaints/:code/classification` | **admin** | Correct AI fields (logged) |
| GET | `/api/admin/workers` | **admin** | Worker roster (by department) |
| POST | `/api/admin/complaints/:code/assign` | **admin** | Assign worker + ETA |
| PATCH | `/api/complaints/:code/status` | **admin** | Status / reject / reopen + notify |
| GET | `/api/notifications` · POST `/read-all` | auth | Notifications |

`/api/admin/*` rejects non-admins server-side (HTTP 403). Contact data is never in list responses.

---

## 8. Security & privacy
- bcrypt password hashing; JWT sessions (7-day).
- Roles in DB only; never self-assignable.
- `helmet` headers, `cors` (env-driven origin), `express-rate-limit` (auth + per-user complaint limits), `zod` validation on every body, 20 KB payload cap.
- No personal data in URLs; no GPS.
- Media: never base64 in Postgres; server verifies real file metadata via Cloudinary before storing the URL.

---

## 9. Non-functional
- Mobile-first; thumb-friendly intake.
- Submission feedback within a few seconds even with an AI call (shows an analyzing state).
- AI failure never blocks submission (rule-based fallbacks).
- Auditability: classification corrections logged; assignments keep history.

---

## 10. Quality & testing
- **Vitest + Supertest** suite (Gemini stubbed): role forcing, 401/403, 400 validation, rule-based classifier cases, dedup merge, rate limiting.
- **`npm run eval`** — 63-item labeled dataset (incl. Hinglish/Hindi/Gujarati + ambiguous) reporting per-field accuracy for the classifier.

---

## 11. Design system
Locked in PRD Section 12 (see prior spec) and implemented as Tailwind theme tokens / CSS variables: deep-indigo primary `#2A3A8F`, teal accent `#1EC6B6`, cool light background, 16px card radius, soft shadows, Space Grotesk headings + Inter body, severity/status color scales, the 4-step progress stepper, split-screen login. Light theme, mobile-first.

---

## 12. Roadmap
- Media upload frontend (backend done).
- Real Google OAuth consent-screen publish; email notifications.
- Status chatbot (F9).
- Analytics dashboard (resolution times, category/block heatmaps).

---

*See [USER_GUIDE.md](USER_GUIDE.md) for step-by-step student and admin workflows, and [DEPLOYMENT.md](DEPLOYMENT.md) for hosting.*

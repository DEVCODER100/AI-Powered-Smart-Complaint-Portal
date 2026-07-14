# Deployment Guide

Architecture: **Vercel** (React frontend) + **Render** (Express API) + **Neon** (Postgres, already provisioned).

The frontend calls the API with relative `/api/...` paths. In production, a
Vercel rewrite proxies those to the Render service, so no frontend code changes
are needed and cookies/CORS stay simple.

---

## 0. Prerequisites

- The GitHub repo is pushed (this repo).
- Your Neon `DATABASE_URL` (already exists).
- Optional: Google OAuth Client ID, Gemini API key.

## 1. API on Render

1. Render dashboard → **New → Web Service** → connect the GitHub repo.
2. Settings:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm run start`
   - **Instance type:** free tier is fine for a demo
3. Environment variables (Render → Environment):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string |
   | `JWT_SECRET` | long random string (generate a fresh one for prod) |
   | `GOOGLE_CLIENT_ID` | your OAuth client id (optional) |
   | `GEMINI_API_KEY` | your Gemini key (optional — rules fallback without it) |
   | `GEMINI_MODEL` | `gemini-2.0-flash` (optional) |
   | `FRONTEND_ORIGIN` | your Vercel URL, e.g. `https://your-app.vercel.app` |
   | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | only needed if you run the seed from Render |

4. First deploy, then run the migration once (Render → Shell, or locally
   against the same `DATABASE_URL`):

   ```bash
   npm run migrate     # applies schema.sql + server/migrations/*.sql
   npm run seed        # optional demo data (requires SEED_ADMIN_*)
   ```

5. Verify: `https://YOUR-RENDER-SERVICE.onrender.com/api/health` →
   `{"ok":true,"db":"connected"}`.

## 2. Frontend on Vercel

1. Vercel dashboard → **Add New → Project** → import the same repo.
2. Framework preset: **Vite** (auto-detected). Build command `npm run build`,
   output directory `dist`.
3. Edit [vercel.json](vercel.json): replace `YOUR-RENDER-SERVICE.onrender.com`
   with your actual Render hostname. This rewrite forwards `/api/*` to the API.
4. Environment variables:

   | Variable | Value |
   |---|---|
   | `VITE_GOOGLE_CLIENT_ID` | your OAuth client id (optional) |

5. Deploy. The app is served at `https://your-app.vercel.app`.

## 3. Post-deploy wiring

- **Render:** set `FRONTEND_ORIGIN=https://your-app.vercel.app` (exact origin,
  no trailing slash) and redeploy — this is the production CORS allowlist.
- **Google OAuth** (if used): in Google Cloud Console → Credentials → your
  client → add `https://your-app.vercel.app` to **Authorized JavaScript
  origins**. Publish the OAuth consent screen (or add all users as test users).
- **Neon:** nothing to change; consider rotating the DB password and updating
  `DATABASE_URL` on Render.

## 4. Environment variable reference

| Variable | Used by | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | API | ✅ | Neon Postgres connection |
| `JWT_SECRET` | API | ✅ | Signs session tokens |
| `PORT` | API | auto | Render injects this; the app reads it |
| `FRONTEND_ORIGIN` | API | prod | CORS allowlist for the deployed frontend |
| `GOOGLE_CLIENT_ID` | API | optional | Verifies Google ID tokens |
| `GEMINI_API_KEY` | API | optional | AI classification + embeddings (rules fallback without) |
| `GEMINI_MODEL` / `GEMINI_EMBED_MODEL` | API | optional | Model overrides |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | seed script | seed only | Admin account creation |
| `SEED_STUDENT_EMAIL` / `SEED_STUDENT_PASSWORD` | seed script | optional | Demo student |
| `VITE_GOOGLE_CLIENT_ID` | frontend build | optional | Renders the real Google button |

## 5. Smoke test after deploy

1. `GET /api/health` → ok.
2. Register a fresh account → lands on the report page.
3. Submit a complaint → appears under My Complaints.
4. Log in as admin → complaint visible; move status → student gets a notification.
5. Confirm a student token gets **403** on `/api/admin/complaints`.

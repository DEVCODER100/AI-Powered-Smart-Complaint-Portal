-- AI-Powered Complaint Management Portal — database schema
-- Postgres (Neon). Run via `npm run migrate`.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  room          TEXT,
  block         TEXT,
  phone         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaints (
  id          SERIAL PRIMARY KEY,
  code        TEXT GENERATED ALWAYS AS ('C-' || lpad(id::text, 3, '0')) STORED,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text    TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('plumbing','wifi','electrical','cleaning','other')),
  block       TEXT NOT NULL,
  floor       TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('critical','high','normal')),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in-progress','waiting','done')),
  department  TEXT NOT NULL,
  ai_flagged  BOOLEAN NOT NULL DEFAULT false, -- severity defaulted/uncertain -> admin review
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Who reported each complaint (de-duplication: many students -> one complaint).
CREATE TABLE IF NOT EXISTS complaint_reporters (
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (complaint_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaint_id INTEGER REFERENCES complaints(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  unread       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Open clusters are matched by (category, block, floor); index speeds the dedup lookup.
CREATE INDEX IF NOT EXISTS idx_complaints_cluster
  ON complaints (category, block, floor) WHERE status <> 'done';
CREATE INDEX IF NOT EXISTS idx_reporters_user ON complaint_reporters (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);

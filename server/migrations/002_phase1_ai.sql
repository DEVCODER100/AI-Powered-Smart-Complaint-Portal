-- Phase 1 + 2c: richer AI classification, semantic dedup, feedback loop,
-- rejected status. Additive only — never destructive to applied schema.

-- Semantic dedup needs pgvector (available on Neon).
CREATE EXTENSION IF NOT EXISTS vector;

-- 1a: short human-readable summary of the complaint.
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS title TEXT;

-- 1b: embedding of the raw text (Gemini text-embedding-004 → 768 dims).
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 1b: near-duplicate (0.70–0.85 similarity) flagged for admin review.
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS possible_duplicate_of INTEGER REFERENCES complaints(id) ON DELETE SET NULL;

-- 2c: optional reason recorded on reject/reopen.
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS status_note TEXT;

-- 1b: keep each reporter's original wording so unmerge/detach is possible.
ALTER TABLE complaint_reporters ADD COLUMN IF NOT EXISTS raw_text TEXT;

-- 2c: allow the 'rejected' status.
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
ALTER TABLE complaints ADD CONSTRAINT complaints_status_check
  CHECK (status IN ('pending','in-progress','waiting','done','rejected'));

-- 1d: audit log of admin corrections to AI classification.
CREATE TABLE IF NOT EXISTS classification_corrections (
  id           SERIAL PRIMARY KEY,
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  field        TEXT NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  corrected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_corrections_complaint ON classification_corrections (complaint_id);

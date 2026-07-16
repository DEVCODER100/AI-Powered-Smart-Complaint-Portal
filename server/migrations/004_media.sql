-- Optional media on a complaint: exactly one photo OR one short video.
-- Stored as a Cloudinary secure URL (never base64 in Postgres).

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS media_url TEXT;

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS media_type TEXT;

-- media_type may only be 'image' or 'video' (or NULL when there is no media).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'complaints' AND constraint_name = 'complaints_media_type_check'
  ) THEN
    ALTER TABLE complaints
      ADD CONSTRAINT complaints_media_type_check
      CHECK (media_type IN ('image', 'video'));
  END IF;
END $$;

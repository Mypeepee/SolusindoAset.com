-- Additive editorial workspace migration. Apply before deploying this feature.
BEGIN;
ALTER TABLE berita ADD COLUMN IF NOT EXISTS meta_description VARCHAR(160);
ALTER TABLE berita ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;
ALTER TABLE berita ADD COLUMN IF NOT EXISTS requested_publish_at TIMESTAMPTZ;
COMMIT;

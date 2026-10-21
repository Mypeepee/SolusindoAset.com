BEGIN;
ALTER TABLE public.klien ADD COLUMN IF NOT EXISTS chatbot_preferensi_meta jsonb;
-- The searchbar and chatbot accept precise walking distances, including 100m.
ALTER TABLE public.preferensi_klien DROP CONSTRAINT IF EXISTS preferensi_dekat_radius_wajar;
ALTER TABLE public.preferensi_klien ADD CONSTRAINT preferensi_dekat_radius_wajar
  CHECK (dekat_radius IS NULL OR dekat_radius BETWEEN 1 AND 20000);
COMMIT;

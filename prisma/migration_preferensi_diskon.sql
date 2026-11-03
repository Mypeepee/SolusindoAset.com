-- Optional client discount criterion. Existing preferences retain their behavior.
BEGIN;
ALTER TABLE preferensi_klien
  ADD COLUMN IF NOT EXISTS diskon_jenis varchar(20),
  ADD COLUMN IF NOT EXISTS diskon_persen integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preferensi_diskon_valid' AND conrelid = 'preferensi_klien'::regclass) THEN
    ALTER TABLE preferensi_klien ADD CONSTRAINT preferensi_diskon_valid CHECK (
      (diskon_jenis IS NULL AND diskon_persen IS NULL) OR
      (diskon_jenis IS NOT NULL AND diskon_persen IS NOT NULL AND
       diskon_jenis IN ('KELURAHAN', 'TURUN_LELANG', 'KEDUANYA') AND
       diskon_persen BETWEEN 1 AND 99)
    );
  END IF;
END $$;
COMMIT;

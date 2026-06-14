-- ============================================================
-- Migration: Penawaran (offer) leads
-- Tambah source "penawaran" + kolom untuk menyimpan nominal
-- tawaran, catatan, dan link ke akun pengguna yang mengajukan.
-- ============================================================

ALTER TYPE lead_source_enum ADD VALUE IF NOT EXISTS 'penawaran';

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS offer_amount BIGINT,
  ADD COLUMN IF NOT EXISTS notes        VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS id_pengguna  VARCHAR(20);

DO $$ BEGIN
  ALTER TABLE leads
    ADD CONSTRAINT leads_pengguna_fk
    FOREIGN KEY (id_pengguna) REFERENCES pengguna(id_pengguna) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_leads_pengguna ON leads(id_pengguna) WHERE id_pengguna IS NOT NULL;

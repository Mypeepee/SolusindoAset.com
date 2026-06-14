-- ============================================================
-- Migration: Lifecycle keputusan penawaran (pending/diterima/ditolak)
-- ============================================================

CREATE TYPE status_penawaran_enum AS ENUM ('pending', 'diterima', 'ditolak');

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS status_penawaran status_penawaran_enum,
  ADD COLUMN IF NOT EXISTS catatan_agent VARCHAR(500),
  ADD COLUMN IF NOT EXISTS tanggal_keputusan TIMESTAMPTZ;

-- Backfill penawaran lama jadi "pending" supaya konsisten
UPDATE leads SET status_penawaran = 'pending'
WHERE source = 'penawaran' AND status_penawaran IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_penawaran_status
  ON leads (id_pengguna, id_property, status_penawaran)
  WHERE source = 'penawaran';

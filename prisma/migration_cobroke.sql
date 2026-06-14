-- ============================================================
-- Migration: Co-Broke (agent lain ajukan klaim co-broking pada listing)
-- ============================================================

ALTER TYPE lead_source_enum ADD VALUE IF NOT EXISTS 'cobroke';

ALTER TYPE tipe_notifikasi_enum ADD VALUE IF NOT EXISTS 'CO_BROKE_SUBMITTED';
ALTER TYPE tipe_notifikasi_enum ADD VALUE IF NOT EXISTS 'CO_BROKE_ACCEPTED';
ALTER TYPE tipe_notifikasi_enum ADD VALUE IF NOT EXISTS 'CO_BROKE_REJECTED';

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS id_agent_cobroke VARCHAR(20) REFERENCES agent(id_agent) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_agent_cobroke
  ON leads (id_agent_cobroke);

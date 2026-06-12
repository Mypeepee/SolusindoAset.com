-- ============================================================
-- Migration: Hot Leads System
-- Tabel untuk capture lead saat klien klik WhatsApp / Telepon / Survei
-- di detail listing properti.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. ENUM: status & source
-- ----------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE lead_status_enum AS ENUM (
    'new',           -- segera follow up (baru klik, belum dihubungi)
    'contacted',     -- sudah di-followup / dikontak agent
    'hot',           -- hot buyer (serius)
    'closing',       -- menuju tahap akhir / closing
    'cold'           -- lost / tidak respon
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_source_enum AS ENUM (
    'whatsapp',
    'telepon',
    'survei',
    'titip_jual',
    'form_inquiry'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- 2. TABEL: leads
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  -- core
  id_lead          BIGSERIAL PRIMARY KEY,
  id_property      BIGINT NOT NULL,
  id_agent         VARCHAR(20) NOT NULL,
  source           lead_source_enum NOT NULL DEFAULT 'whatsapp',
  status           lead_status_enum NOT NULL DEFAULT 'new',

  -- tracking (auto-filled saat klik)
  ip_address       INET,
  user_agent       TEXT,
  device_type      VARCHAR(20),
  referrer         TEXT,
  session_id       VARCHAR(64),

  -- identity (filled saat WA reply / form submit)
  client_name      VARCHAR(150),
  client_phone     VARCHAR(20),
  client_email     VARCHAR(150),

  -- engagement
  last_activity    TIMESTAMPTZ,

  -- timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leads_property_fk
    FOREIGN KEY (id_property) REFERENCES listing(id_property) ON DELETE CASCADE,
  CONSTRAINT leads_agent_fk
    FOREIGN KEY (id_agent) REFERENCES agent(id_agent) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leads_agent_status ON leads(id_agent, status);
CREATE INDEX IF NOT EXISTS idx_leads_property     ON leads(id_property);
CREATE INDEX IF NOT EXISTS idx_leads_created      ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone        ON leads(client_phone) WHERE client_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_session      ON leads(session_id) WHERE session_id IS NOT NULL;

-- ----------------------------------------------------------------
-- 3. TRIGGER: auto-update updated_at
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION leads_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION leads_set_updated_at();

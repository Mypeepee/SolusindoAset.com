-- ════════════════════════════════════════════════════════════════════
-- migration_target_agent.sql
-- Menambah tabel target_agent untuk menyimpan target komisi bulanan
-- per agent. Dipakai oleh card "Target vs Realisasi" di dashboard.
--
-- Unique per (id_agent, tahun, bulan) → satu agent satu target per bulan.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS target_agent (
  id_target        BIGSERIAL PRIMARY KEY,
  id_agent         VARCHAR(20)  NOT NULL,
  tahun            INT          NOT NULL CHECK (tahun BETWEEN 2020 AND 2100),
  bulan            INT          NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  target_komisi    NUMERIC(20,2) NOT NULL CHECK (target_komisi >= 0),
  dibuat_oleh      VARCHAR(20)  NOT NULL,
  dibuat_pada      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  diperbarui_pada  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT target_agent_unique UNIQUE (id_agent, tahun, bulan),
  CONSTRAINT target_agent_agent_fk
    FOREIGN KEY (id_agent) REFERENCES agent(id_agent) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS target_agent_agent_period_idx
  ON target_agent (id_agent, tahun DESC, bulan DESC);

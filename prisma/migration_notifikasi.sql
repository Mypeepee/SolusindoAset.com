-- ============================================================
-- Migration: Notifikasi sistem (bell di topbar dashboard)
-- ============================================================

CREATE TYPE tipe_notifikasi_enum AS ENUM ('AGENT_BARU', 'AGENT_REFERRAL');

CREATE TABLE IF NOT EXISTS notifikasi (
  id_notifikasi BIGSERIAL PRIMARY KEY,
  id_pengguna   VARCHAR(20) NOT NULL REFERENCES pengguna(id_pengguna) ON DELETE CASCADE,
  tipe          tipe_notifikasi_enum NOT NULL,
  judul         VARCHAR(255) NOT NULL,
  pesan         VARCHAR(500) NOT NULL,
  link          VARCHAR(255),
  id_agent_ref  VARCHAR(20),
  dibaca        BOOLEAN NOT NULL DEFAULT FALSE,
  dibuat_pada   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifikasi_pengguna_dibaca
  ON notifikasi (id_pengguna, dibaca);

CREATE INDEX IF NOT EXISTS idx_notifikasi_tanggal
  ON notifikasi (dibuat_pada DESC);

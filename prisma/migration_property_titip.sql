-- ============================================================
-- Migration: Property Titip (Konsinyasi / Titip Jual)
-- Tabel untuk menampung submission dari publik (form titip-jual)
-- + distribusi otomatis ke agent berdasarkan kota_area.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. ENUM
-- ----------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE jenis_properti_titip_enum AS ENUM (
    'RUMAH',
    'APARTEMEN',
    'RUKO',
    'TANAH',
    'GUDANG',
    'PABRIK',
    'HOTEL_DAN_VILLA',
    'TOKO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_kepemilikan_titip_enum AS ENUM (
    'PRIBADI',
    'ORANG_LAIN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_titip_enum AS ENUM (
    'pending',
    'terklaim',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_titip_distribution_enum AS ENUM (
    'pending',
    'diterima',
    'ditolak'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- 2. TABEL: property_titip
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS property_titip (
  id_titip            BIGSERIAL PRIMARY KEY,

  -- properti
  jenis_properti      jenis_properti_titip_enum NOT NULL,
  alamat_lengkap      TEXT          NOT NULL,
  provinsi            VARCHAR(100)  NOT NULL,
  kota                VARCHAR(100)  NOT NULL,
  kecamatan           VARCHAR(100),
  kelurahan           VARCHAR(100),
  latitude            DECIMAL(10,8),
  longitude           DECIMAL(11,8),
  estimasi_harga      NUMERIC(20,2),

  -- pengirim
  pengirim_nama       VARCHAR(150)  NOT NULL,
  pengirim_phone      VARCHAR(20)   NOT NULL,
  status_kepemilikan  status_kepemilikan_titip_enum NOT NULL,

  -- state
  status              status_titip_enum NOT NULL DEFAULT 'pending',
  diklaim_oleh_agent  VARCHAR(20),
  diklaim_pada        TIMESTAMPTZ,
  kedaluwarsa_pada    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),

  -- tracking
  ip_address          INET,
  user_agent          TEXT,
  session_id          VARCHAR(64),
  referrer            TEXT,

  dibuat_pada         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diperbarui_pada     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT property_titip_agent_fk
    FOREIGN KEY (diklaim_oleh_agent) REFERENCES agent(id_agent) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_property_titip_status    ON property_titip(status);
CREATE INDEX IF NOT EXISTS idx_property_titip_kota      ON property_titip(LOWER(kota));
CREATE INDEX IF NOT EXISTS idx_property_titip_expires   ON property_titip(kedaluwarsa_pada);
CREATE INDEX IF NOT EXISTS idx_property_titip_created   ON property_titip(dibuat_pada DESC);
CREATE INDEX IF NOT EXISTS idx_property_titip_phone     ON property_titip(pengirim_phone);
CREATE INDEX IF NOT EXISTS idx_property_titip_agent     ON property_titip(diklaim_oleh_agent);

-- ----------------------------------------------------------------
-- 3. TABEL: property_titip_distribution
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS property_titip_distribution (
  id              BIGSERIAL PRIMARY KEY,
  id_titip        BIGINT       NOT NULL,
  id_agent        VARCHAR(20)  NOT NULL,
  status          status_titip_distribution_enum NOT NULL DEFAULT 'pending',
  direspon_pada   TIMESTAMPTZ,
  dibuat_pada     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT property_titip_distribution_titip_fk
    FOREIGN KEY (id_titip) REFERENCES property_titip(id_titip) ON DELETE CASCADE,
  CONSTRAINT property_titip_distribution_agent_fk
    FOREIGN KEY (id_agent) REFERENCES agent(id_agent) ON DELETE CASCADE,
  CONSTRAINT property_titip_distribution_unique
    UNIQUE (id_titip, id_agent)
);

CREATE INDEX IF NOT EXISTS idx_titip_dist_agent_status ON property_titip_distribution(id_agent, status);
CREATE INDEX IF NOT EXISTS idx_titip_dist_titip       ON property_titip_distribution(id_titip);

-- ----------------------------------------------------------------
-- 4. TRIGGER: auto-update diperbarui_pada
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION property_titip_set_diperbarui_pada()
RETURNS TRIGGER AS $$
BEGIN
  NEW.diperbarui_pada = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_titip_diperbarui_pada ON property_titip;
CREATE TRIGGER trg_property_titip_diperbarui_pada
  BEFORE UPDATE ON property_titip
  FOR EACH ROW
  EXECUTE FUNCTION property_titip_set_diperbarui_pada();

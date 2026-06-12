-- ============================================================
-- Migration: Klien CRM System
-- Tabel klien untuk CRM — menyimpan data kontak & preferensi
-- properti klien yang masuk melalui hot leads atau sumber lain.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. SEQUENCE untuk ID klien
-- ----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS klien_code_seq START 1;

-- ----------------------------------------------------------------
-- 2. ENUM baru
-- ----------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE status_klien_enum AS ENUM (
    'lead_baru',
    'sudah_dikontak',
    'hot_buyer',
    'closing',
    'lost_iseng'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sumber_klien_enum AS ENUM (
    'wa_organik',
    'iklan',
    'referral',
    'website',
    'walk_in',
    'titip_jual',
    'lainnya'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE metode_pembayaran_enum AS ENUM (
    'cash',
    'kpr',
    'cash_bertahap'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tujuan_beli_enum AS ENUM (
    'ditempati',
    'investasi',
    'disewakan'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- 3. Tambah CESSIE ke jenis_transaksi_enum yang sudah ada
-- ----------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE jenis_transaksi_enum ADD VALUE IF NOT EXISTS 'CESSIE';
EXCEPTION WHEN others THEN NULL; END $$;

-- ----------------------------------------------------------------
-- 4. TABEL: klien
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS klien (
  id_klien              VARCHAR(20) PRIMARY KEY
                          DEFAULT ('KL' || LPAD(nextval('klien_code_seq')::TEXT, 5, '0')),

  id_agent              VARCHAR(20) NOT NULL,
  id_pengguna           VARCHAR(20),
  id_lead_asal          BIGINT UNIQUE,
  id_properti_asal      BIGINT,

  nama                  VARCHAR(150) NOT NULL,
  nomor_whatsapp        VARCHAR(20),
  email                 VARCHAR(150),

  sumber                sumber_klien_enum      NOT NULL DEFAULT 'wa_organik',
  metode_pembayaran     metode_pembayaran_enum,
  bank_kpr              VARCHAR(50),
  tenor_kpr             SMALLINT,

  tanggal_masuk           DATE        NOT NULL DEFAULT CURRENT_DATE,
  tanggal_kontak_terakhir TIMESTAMPTZ,
  tanggal_follow_up       TIMESTAMPTZ,

  status                status_klien_enum NOT NULL DEFAULT 'lead_baru',
  catatan               TEXT,

  dibuat_pada           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diperbarui_pada       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT klien_agent_fk
    FOREIGN KEY (id_agent) REFERENCES agent(id_agent) ON DELETE RESTRICT,
  CONSTRAINT klien_pengguna_fk
    FOREIGN KEY (id_pengguna) REFERENCES pengguna(id_pengguna) ON DELETE SET NULL,
  CONSTRAINT klien_lead_fk
    FOREIGN KEY (id_lead_asal) REFERENCES leads(id_lead) ON DELETE SET NULL,
  CONSTRAINT klien_properti_fk
    FOREIGN KEY (id_properti_asal) REFERENCES listing(id_property) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_klien_agent      ON klien(id_agent);
CREATE INDEX IF NOT EXISTS idx_klien_status     ON klien(id_agent, status);
CREATE INDEX IF NOT EXISTS idx_klien_wa         ON klien(nomor_whatsapp) WHERE nomor_whatsapp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_klien_follow_up  ON klien(tanggal_follow_up) WHERE tanggal_follow_up IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_klien_masuk      ON klien(tanggal_masuk DESC);

-- ----------------------------------------------------------------
-- 5. TABEL: preferensi_klien
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS preferensi_klien (
  id_preferensi     BIGSERIAL PRIMARY KEY,
  id_klien          VARCHAR(20) NOT NULL,

  tipe_properti     kategori_properti_enum NOT NULL,
  jenis_transaksi   jenis_transaksi_enum,
  lokasi_dicari     VARCHAR(255),
  budget_min        DECIMAL(20, 2),
  budget_max        DECIMAL(20, 2),
  luas_min          DECIMAL(12, 2),
  luas_max          DECIMAL(12, 2),
  tujuan_beli       tujuan_beli_enum,
  catatan           TEXT,

  dibuat_pada       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diperbarui_pada   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT preferensi_klien_fk
    FOREIGN KEY (id_klien) REFERENCES klien(id_klien) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_preferensi_klien ON preferensi_klien(id_klien);

-- ----------------------------------------------------------------
-- 6. TRIGGER: auto-update diperbarui_pada
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_diperbarui_pada()
RETURNS TRIGGER AS $$
BEGIN
  NEW.diperbarui_pada = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_klien_updated ON klien;
CREATE TRIGGER trg_klien_updated
  BEFORE UPDATE ON klien
  FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();

DROP TRIGGER IF EXISTS trg_preferensi_klien_updated ON preferensi_klien;
CREATE TRIGGER trg_preferensi_klien_updated
  BEFORE UPDATE ON preferensi_klien
  FOR EACH ROW EXECUTE FUNCTION set_diperbarui_pada();

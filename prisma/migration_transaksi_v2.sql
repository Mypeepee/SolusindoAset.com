-- Migration: rename kode_transaksi -> id_transaksi, resize, add new columns
-- Run on: public.transaksi

-- 1. Rename column
ALTER TABLE public.transaksi RENAME COLUMN kode_transaksi TO id_transaksi;

-- 2. Increase varchar size to accommodate new format (e.g. 001/MOU/SPT-SBY/MEI/2026)
ALTER TABLE public.transaksi ALTER COLUMN id_transaksi TYPE varchar(50);

-- 3. Drop old unique index and create new one
DROP INDEX IF EXISTS transaksi_kode_transaksi_key;
CREATE UNIQUE INDEX IF NOT EXISTS transaksi_id_transaksi_key ON public.transaksi USING btree (id_transaksi);

-- 4. Add new columns
ALTER TABLE public.transaksi
  ADD COLUMN IF NOT EXISTS gambar_ktp_klien        text NULL,
  ADD COLUMN IF NOT EXISTS nama_lengkap_klien       varchar(200) NULL,
  ADD COLUMN IF NOT EXISTS nik_klien                varchar(20) NULL,
  ADD COLUMN IF NOT EXISTS alamat_klien             text NULL,
  ADD COLUMN IF NOT EXISTS termasuk_balik_nama      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS termasuk_biaya_eksekusi  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_biaya              int8 NOT NULL DEFAULT 0;

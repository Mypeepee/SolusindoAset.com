-- Migration: Konversi status_transaksi dari VARCHAR ke enum status_transaksi_enum
-- Jalankan di PostgreSQL database

-- 1. Buat enum type baru
CREATE TYPE "status_transaksi_enum" AS ENUM (
  'uang_tanda_jaminan',
  'closing',
  'kalah',
  'batal',
  'pengurusan_kuitansi',
  'kuitansi_selesai',
  'pengurusan_risalah_lelang',
  'risalah_lelang_selesai',
  'pengurusan_balik_nama',
  'balik_nama_selesai',
  'mediasi',
  'mediasi_gagal',
  'permohonan_eksekusi',
  'aanmaning',
  'penetapan',
  'rakor',
  'pelaksanaan_eksekusi',
  'serah_terima_kunci',
  'selesai'
);

-- 2. Tambah kolom baru dengan tipe enum
ALTER TABLE transaksi ADD COLUMN status_transaksi_new "status_transaksi_enum";

-- 3. Map nilai lama ke enum baru
UPDATE transaksi SET status_transaksi_new = CASE
  WHEN UPPER(status_transaksi) = 'SELESAI'              THEN 'selesai'::status_transaksi_enum
  WHEN UPPER(status_transaksi) = 'BATAL'                THEN 'batal'::status_transaksi_enum
  WHEN UPPER(status_transaksi) = 'VERIFIKASI_DOKUMEN'   THEN 'pengurusan_kuitansi'::status_transaksi_enum
  WHEN UPPER(status_transaksi) = 'AJB'                  THEN 'kuitansi_selesai'::status_transaksi_enum
  WHEN UPPER(status_transaksi) = 'PENGURUSAN_DOKUMEN'   THEN 'pengurusan_risalah_lelang'::status_transaksi_enum
  WHEN UPPER(status_transaksi) = 'EKSEKUSI_PENGOSONGAN' THEN 'pelaksanaan_eksekusi'::status_transaksi_enum
  ELSE 'uang_tanda_jaminan'::status_transaksi_enum  -- CLOSING dan lainnya → uang_tanda_jaminan
END;

-- 4. Hapus kolom lama, rename kolom baru
ALTER TABLE transaksi DROP COLUMN status_transaksi;
ALTER TABLE transaksi RENAME COLUMN status_transaksi_new TO status_transaksi;

-- 5. Set NOT NULL dan default
ALTER TABLE transaksi ALTER COLUMN status_transaksi SET NOT NULL;
ALTER TABLE transaksi ALTER COLUMN status_transaksi SET DEFAULT 'uang_tanda_jaminan';

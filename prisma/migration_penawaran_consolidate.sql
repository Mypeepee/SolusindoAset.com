-- ============================================================
-- Migration: Konsolidasi penawaran ke tabel "leads"
-- - Hapus tabel "penawaran" (digabung ke leads)
-- - Rename leads.offer_amount -> leads.penawaran
-- - Rename leads.notes        -> leads.catatan
-- - Tambah leads.diskon (persen di bawah harga listing)
-- - Tambah leads.pembayaran (cash/kpr)
-- ============================================================

DROP TABLE IF EXISTS penawaran;

ALTER TABLE leads RENAME COLUMN offer_amount TO penawaran;
ALTER TABLE leads RENAME COLUMN notes TO catatan;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS diskon     DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS pembayaran metode_pembayaran_enum;

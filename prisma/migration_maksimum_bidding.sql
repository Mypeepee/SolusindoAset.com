-- Migration: Tambah kolom maksimum_bidding ke tabel transaksi
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS maksimum_bidding DECIMAL(20, 2) NULL;

-- Migration: Drop kolom yang tidak digunakan dari tabel transaksi
ALTER TABLE transaksi DROP COLUMN IF EXISTS harga_promo_deal;
ALTER TABLE transaksi DROP COLUMN IF EXISTS total_biaya;

-- Migration: Tambah flag mou_generated dan invoice_utm_generated ke tabel transaksi
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS mou_generated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS invoice_utm_generated BOOLEAN NOT NULL DEFAULT false;

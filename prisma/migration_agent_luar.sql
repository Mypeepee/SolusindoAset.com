-- ============================================================
-- Migration: Agent Luar / Cobroke
-- Jalankan script ini sekali di database.
-- ============================================================

-- 1. Sentinel pengguna untuk agent luar
INSERT INTO pengguna (id_pengguna, nama_lengkap, peran, status_akun, wa_terverifikasi)
VALUES ('COBROKE_SYS', 'Agent Luar / Cobroke', 'AGENT', 'AKTIF', false)
ON CONFLICT (id_pengguna) DO NOTHING;

-- 2. Sentinel agent untuk agent luar (linked ke pengguna di atas)
INSERT INTO agent (id_agent, id_pengguna, nama_kantor, kota_area, nomor_whatsapp, jabatan, status_keanggotaan)
VALUES ('COBROKE', 'COBROKE_SYS', 'Luar Kantor', '-', '-', 'AGENT', 'AKTIF')
ON CONFLICT (id_agent)     DO NOTHING;

-- 3. Tambah kolom info agent luar di tabel transaksi
ALTER TABLE transaksi
  ADD COLUMN IF NOT EXISTS agent_luar_nama     varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS agent_luar_kantor   varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS agent_luar_telepon  varchar(20)  NULL;

-- Additive: legacy clients retain their data and NULL chatbot identity.
BEGIN;
ALTER TABLE public.klien
  ADD COLUMN IF NOT EXISTS chatbot_nomor_whatsapp varchar(20),
  ADD COLUMN IF NOT EXISTS chatbot_lokasi varchar(150),
  ADD COLUMN IF NOT EXISTS chatbot_kota varchar(150),
  ADD COLUMN IF NOT EXISTS chatbot_wilayah varchar(20),
  ADD COLUMN IF NOT EXISTS chatbot_budget_min numeric(20,2),
  ADD COLUMN IF NOT EXISTS chatbot_budget_max numeric(20,2),
  ADD COLUMN IF NOT EXISTS chatbot_jenis_aset public.kategori_properti_enum[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS chatbot_jenis_transaksi public.jenis_transaksi_enum[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS chatbot_luas_tanah_min numeric(12,2),
  ADD COLUMN IF NOT EXISTS chatbot_luas_tanah_max numeric(12,2),
  ADD COLUMN IF NOT EXISTS chatbot_kriteria jsonb,
  ADD COLUMN IF NOT EXISTS chatbot_terakhir_pada timestamptz(6);
CREATE UNIQUE INDEX IF NOT EXISTS klien_chatbot_wa_unik
  ON public.klien(id_agent, chatbot_nomor_whatsapp);
COMMIT;

-- Pembayaran investor tidak lagi biner. Status parsial dipakai ketika modal
-- sudah mulai diterima, tetapi masih ada sisa komitmen yang perlu ditagih.
ALTER TYPE status_pembayaran_project_enum
  ADD VALUE IF NOT EXISTS 'dibayar_sebagian';

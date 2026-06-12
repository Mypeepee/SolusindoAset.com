-- Migration: Tabel undangan_acara untuk fitur peserta/invite di kalender.
-- ──────────────────────────────────────────────────────────────────────
-- Tujuan:
--   Acara di kalender hanya tampil ke agent yang punya hubungan dengan
--   acara tersebut: dia ownernya (acara.id_agent) ATAU dia di-invite
--   sebagai peserta (lewat tabel ini).
--
-- Kenapa tabel terpisah dari `peserta_acara` (yang sudah ada)?
--   peserta_acara di-design untuk konteks PEMILU dengan status seperti
--   TERDAFTAR, MENUNGGU_GILIRAN, SEDANG_MEMILIH, SUDAH_MEMILIH — semantic
--   memilih. Kita tidak mau ngotori model itu dengan invite/RSVP
--   semantic. Jadi `undangan_acara` adalah model terpisah dengan
--   status DIUNDANG / DITERIMA / DITOLAK.
--
-- Idempotent: pakai IF NOT EXISTS supaya aman jalanin ulang.
-- ──────────────────────────────────────────────────────────────────────

-- Enum status undangan
DO $$ BEGIN
  CREATE TYPE public.status_undangan_enum AS ENUM ('DIUNDANG', 'DITERIMA', 'DITOLAK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tabel undangan_acara
CREATE TABLE IF NOT EXISTS public.undangan_acara (
  id_undangan      bigserial NOT NULL,
  id_acara         int8 NOT NULL,
  id_agent         varchar(20) NOT NULL,
  status_undangan  public.status_undangan_enum NOT NULL DEFAULT 'DIUNDANG',
  diundang_pada    timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  direspon_pada    timestamptz(6) NULL,

  CONSTRAINT undangan_acara_pkey PRIMARY KEY (id_undangan),

  -- Satu agent hanya boleh diundang sekali per acara
  CONSTRAINT undangan_acara_unique_per_agent UNIQUE (id_acara, id_agent),

  -- Cascade dari acara: hapus acara → hapus semua undangan-nya
  CONSTRAINT undangan_acara_acara_fk
    FOREIGN KEY (id_acara) REFERENCES public.acara(id_acara)
    ON DELETE CASCADE ON UPDATE CASCADE,

  -- Cascade dari agent: hapus agent → hapus semua undangan-nya
  CONSTRAINT undangan_acara_agent_fk
    FOREIGN KEY (id_agent) REFERENCES public.agent(id_agent)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Index supaya filter "acara yang melibatkan agent X" cepat di kalender
CREATE INDEX IF NOT EXISTS idx_undangan_agent ON public.undangan_acara USING btree (id_agent);
CREATE INDEX IF NOT EXISTS idx_undangan_acara ON public.undangan_acara USING btree (id_acara);

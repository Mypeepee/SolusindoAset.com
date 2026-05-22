-- ============================================================
-- Migration: Restructure transaksi → pisah jadi mou + transaksi
-- ============================================================

-- 1. Buat tabel mou
CREATE TABLE mou (
  id                    bigserial           PRIMARY KEY,
  id_transaksi          varchar(50)         UNIQUE,
  id_listing            bigint              NOT NULL,
  id_agent              varchar(20)         NOT NULL,
  id_klien              varchar(20),
  jenis_transaksi       "jenis_transaksi_enum" NOT NULL,
  tipe_komisi           varchar(50)         NOT NULL,
  gambar_ktp_klien      text,
  nama_lengkap_klien    varchar(200),
  nik_klien             varchar(20),
  alamat_klien          text,
  harga_deal            bigint,
  harga_limit           numeric(20,2),
  persentase_komisi     numeric(10,6),
  biaya_baliknama       bigint,
  biaya_pengosongan     bigint,
  termasuk_baliknama    boolean             NOT NULL DEFAULT false,
  termasuk_pengosongan  boolean             NOT NULL DEFAULT false,
  maksimum_bidding      numeric(20,2),
  status                varchar(30)         NOT NULL DEFAULT 'pending',
  mou_generated         boolean             NOT NULL DEFAULT false,
  invoice_utm_generated boolean             NOT NULL DEFAULT false,
  dibuat_pada           timestamptz         NOT NULL DEFAULT now(),
  diperbarui_pada       timestamptz         NOT NULL DEFAULT now(),
  CONSTRAINT mou_listing_fk  FOREIGN KEY (id_listing) REFERENCES listing(id_property) ON DELETE RESTRICT,
  CONSTRAINT mou_agent_fk    FOREIGN KEY (id_agent)   REFERENCES agent(id_agent)       ON DELETE RESTRICT,
  CONSTRAINT mou_klien_fk    FOREIGN KEY (id_klien)   REFERENCES pengguna(id_pengguna) ON DELETE SET NULL
);

CREATE INDEX mou_listing_idx ON mou(id_listing);
CREATE INDEX mou_agent_idx   ON mou(id_agent);

-- 2. Migrasi data dari transaksi ke mou
INSERT INTO mou (
  id_transaksi, id_listing, id_agent, id_klien,
  jenis_transaksi, tipe_komisi,
  gambar_ktp_klien, nama_lengkap_klien, nik_klien, alamat_klien,
  harga_deal, harga_limit, persentase_komisi,
  biaya_baliknama, biaya_pengosongan,
  termasuk_baliknama, termasuk_pengosongan,
  maksimum_bidding,
  status, mou_generated, invoice_utm_generated,
  dibuat_pada, diperbarui_pada
)
SELECT
  id_transaksi,
  id_listing,
  id_agent,
  id_klien,
  jenis_transaksi,
  tipe_komisi,
  gambar_ktp_klien,
  nama_lengkap_klien,
  nik_klien,
  alamat_klien,
  CASE WHEN tipe_komisi = 'PERSENTASE' THEN NULL ELSE harga_deal END,
  harga_limit,
  CASE WHEN tipe_komisi = 'PERSENTASE' THEN persentase_komisi ELSE NULL END,
  biaya_baliknama,
  biaya_pengosongan,
  termasuk_balik_nama,
  termasuk_biaya_eksekusi,
  CASE WHEN tipe_komisi = 'PERSENTASE' THEN maksimum_bidding ELSE NULL END,
  CASE
    WHEN status_transaksi::text = 'kalah'              THEN 'kalah'
    WHEN status_transaksi::text = 'batal'              THEN 'batal'
    WHEN status_transaksi::text = 'uang_tanda_jaminan' THEN 'pending'
    ELSE 'closing'
  END,
  mou_generated,
  invoice_utm_generated,
  dibuat_pada,
  diperbarui_pada
FROM transaksi;

-- 3. Handle transaksi yang id_transaksi NULL (beri kode sementara)
UPDATE mou SET id_transaksi = 'TMP-' || id::text WHERE id_transaksi IS NULL;

-- 4. Buat tabel transaksi baru (simpan data lama dulu)
ALTER TABLE transaksi RENAME TO transaksi_old;

CREATE TABLE transaksi (
  id                       bigserial            PRIMARY KEY,
  id_transaksi             varchar(50)          NOT NULL UNIQUE,
  harga_bidding            numeric(20,2),
  selisih                  bigint,
  kenaikan_dari_limit      numeric(10,6),
  biaya_baliknama          bigint,
  biaya_pengosongan        bigint,
  cobroke_fee              bigint               NOT NULL DEFAULT 0,
  tanggal_transaksi        date                 NOT NULL,
  rating                   int,
  comment                  varchar(250),
  catatan                  text,
  pendapatan_bersih_kantor bigint               NOT NULL DEFAULT 0,
  thc_agent                bigint               NOT NULL DEFAULT 0,
  agent_luar_nama          varchar(100),
  agent_luar_kantor        varchar(100),
  agent_luar_telepon       varchar(20),
  status_transaksi         "status_transaksi_enum" NOT NULL DEFAULT 'closing',
  dibuat_pada              timestamptz          NOT NULL DEFAULT now(),
  diperbarui_pada          timestamptz          NOT NULL DEFAULT now(),
  CONSTRAINT transaksi_mou_fk FOREIGN KEY (id_transaksi) REFERENCES mou(id_transaksi) ON DELETE RESTRICT
);

CREATE INDEX transaksi_date_idx ON transaksi(tanggal_transaksi);

-- 5. Migrasi data dari transaksi_old ke transaksi (hanya yang sudah closing/pipeline)
INSERT INTO transaksi (
  id_transaksi, harga_bidding, selisih, kenaikan_dari_limit,
  biaya_baliknama, biaya_pengosongan, cobroke_fee,
  tanggal_transaksi, rating, comment, catatan,
  pendapatan_bersih_kantor, thc_agent,
  agent_luar_nama, agent_luar_kantor, agent_luar_telepon,
  status_transaksi, dibuat_pada, diperbarui_pada
)
SELECT
  COALESCE(t.id_transaksi, 'TMP-' || t.id::text),
  t.harga_bidding,
  CASE WHEN t.tipe_komisi = 'PERSENTASE' THEN NULL ELSE t.selisih END,
  t.kenaikan_dari_limit,
  t.biaya_baliknama,
  t.biaya_pengosongan,
  t.cobroke_fee,
  t.tanggal_transaksi,
  t.rating,
  t.comment,
  t.catatan,
  t.pendapatan_bersih_kantor,
  t.thc_agent,
  t.agent_luar_nama,
  t.agent_luar_kantor,
  t.agent_luar_telepon,
  CASE
    WHEN t.status_transaksi::text IN ('uang_tanda_jaminan','kalah','batal') THEN 'closing'::status_transaksi_enum
    ELSE t.status_transaksi
  END,
  t.dibuat_pada,
  t.diperbarui_pada
FROM transaksi_old t
-- hanya buat record transaksi jika bukan terminal/pending
WHERE t.status_transaksi::text NOT IN ('kalah', 'batal');

-- 6. Migrasi DetailTransaksi — update FK ke tabel transaksi baru
-- DetailTransaksi referensi id bigint dari transaksi, perlu remap
-- Tambah kolom id_transaksi_kode sementara di detail
ALTER TABLE detail_transaksi ADD COLUMN id_transaksi_kode varchar(50);
UPDATE detail_transaksi dt
SET id_transaksi_kode = COALESCE(t.id_transaksi, 'TMP-' || t.id::text)
FROM transaksi_old t
WHERE dt.id_transaksi = t.id;

-- Update FK — drop constraint lama, tambah yang baru
ALTER TABLE detail_transaksi DROP CONSTRAINT detail_transaksi_trans_fk;
ALTER TABLE detail_transaksi DROP COLUMN id_transaksi;
ALTER TABLE detail_transaksi RENAME COLUMN id_transaksi_kode TO id_transaksi;
ALTER TABLE detail_transaksi ALTER COLUMN id_transaksi SET NOT NULL;
ALTER TABLE detail_transaksi ADD CONSTRAINT detail_transaksi_trans_fk
  FOREIGN KEY (id_transaksi) REFERENCES transaksi(id_transaksi) ON DELETE CASCADE;
CREATE INDEX detail_transaksi_trans_idx ON detail_transaksi(id_transaksi);
ALTER TABLE detail_transaksi DROP CONSTRAINT detail_transaksi_unique_per_role;
ALTER TABLE detail_transaksi ADD CONSTRAINT detail_transaksi_unique_per_role
  UNIQUE (id_transaksi, id_agent, role);

-- 7. Migrasi Invoice — sama seperti detail
ALTER TABLE invoice ADD COLUMN id_transaksi_kode varchar(50);
UPDATE invoice i
SET id_transaksi_kode = COALESCE(t.id_transaksi, 'TMP-' || t.id::text)
FROM transaksi_old t
WHERE i.id_transaksi = t.id;

ALTER TABLE invoice DROP CONSTRAINT invoice_transaksi_fk;
ALTER TABLE invoice DROP COLUMN id_transaksi;
ALTER TABLE invoice RENAME COLUMN id_transaksi_kode TO id_transaksi;
ALTER TABLE invoice ALTER COLUMN id_transaksi SET NOT NULL;
ALTER TABLE invoice ADD CONSTRAINT invoice_transaksi_fk
  FOREIGN KEY (id_transaksi) REFERENCES transaksi(id_transaksi) ON DELETE RESTRICT;
CREATE INDEX idx_invoice_transaksi ON invoice(id_transaksi);

-- 8. Hapus tabel lama
DROP TABLE transaksi_old;

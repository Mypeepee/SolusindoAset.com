-- Confirmed correction: auction #173010 took place on 7 September 2026.
-- Preserve the source time; only correct the mistaken year. Safe to rerun.
UPDATE listing
SET tanggal_lelang = (
  (tanggal_lelang AT TIME ZONE 'Asia/Jakarta') - INTERVAL '1 year'
) AT TIME ZONE 'Asia/Jakarta'
WHERE id_property = 173010
  AND jenis_transaksi = 'LELANG'
  AND tanggal_lelang >= TIMESTAMPTZ '2027-09-07 00:00:00+07'
  AND tanggal_lelang < TIMESTAMPTZ '2027-09-08 00:00:00+07'
RETURNING id_property, tanggal_lelang;

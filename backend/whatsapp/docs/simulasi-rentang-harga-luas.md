# Simulasi rentang budget dan luas tanah

Verifikasi 17 Oktober 2026 melalui Playground Owner dan database proyek. Pengujian ini tidak mengirim WhatsApp nyata atau menambah klien percobaan. Hasil listing mengikuti data saat pengujian.

## Perilaku yang diverifikasi

- `500 sampai 1m` dalam jawaban budget → Rp 500 juta–Rp 1 miliar.
- `300 - 900 juta` → minimal Rp 300 juta dan maksimal Rp 900 juta.
- `100 sampai 200 m2` → minimal 100 m² dan maksimal 200 m².
- Satuan bersama, satuan berbeda, desimal, rupiah lengkap, angka terbilang, serta urutan harga/luas yang berbeda diproses terpisah.
- `1M` pada budget berarti miliar; `m` pada jawaban luas berarti meter persegi sesuai konteks.
- Rentang nominal tanpa satuan yang cukup jelas, seperti `300–900`, meminta satuan. Rentang terbalik/tidak valid meminta koreksi, mempertahankan kriteria lama, dan tidak memicu pencarian dengan salah satu batas saja.
- Kedua batas diteruskan ke filter database dan payload preferensi klien (`budget_min`, `budget_max`, `luas_min`, `luas_max`).

## Transkrip Playground aktual

### Percakapan 1: Pakuwon Mall dan 500 sampai 1m

**Pelanggan:** halo

**Bot:**

Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

_Status: context_required_

**Pelanggan:** saya jason, pak, saya tertarik dengan aset lelang, cuman apakah ada yang dekat dengan pakuwon mall?

**Bot:**

Siap, saya cari aset lelang dekat pakuwon mall. Tempat tersebut di kota atau kabupaten mana ya?

_Status: qualifying_

**Pelanggan:** surabaya pak

**Bot:**

Oke, pencariannya di seluruh wilayah Surabaya, dekat pakuwon mall ya.

Budget-nya sampai berapa?
Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.

_Status: qualifying_

**Pelanggan:** hmmm mungkin di angka 500 sampai 1m pak

**Bot:**

Oke, pencariannya di seluruh wilayah Surabaya, dekat pakuwon mall, budget Rp 500.000.000–Rp 1.000.000.000 ya.

Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.
Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** rumah

**Bot:**

Oke, rumah di seluruh wilayah Surabaya, dekat pakuwon mall, budget Rp 500.000.000–Rp 1.000.000.000 ya.

Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** luas tanah 100 sampai 200 m2

**Bot:**

Belum ketemu rumah lelang yang cocok di seluruh wilayah Surabaya, dekat pakuwon mall, budget Rp 500.000.000–Rp 1.000.000.000, luas tanah 100–200 m². Data tempat terdekat belum mencakup semua aset, jadi hasil ini mengikuti data yang sudah tercatat.

Mau coba ubah radius, perluas area, sesuaikan budget, atau ubah batas luas tanah?

_Status: not_found_

### Percakapan 2: Rentang 300–900 juta sejak awal

**Pelanggan:** saya Nara, saya cari aset lelang di Surabaya Barat budget 300 - 900 juta pak

**Bot:**

Siap, Nara. Saya bantu cari aset lelang di Surabaya Barat, budget Rp 300.000.000–Rp 900.000.000 ya.

Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.
Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** rumah

**Bot:**

Oke, rumah di Surabaya Barat, budget Rp 300.000.000–Rp 900.000.000 ya.

Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** luas tanah 100–200 m2

**Bot:**

Saya cari rumah lelang di Surabaya Barat, budget Rp 300.000.000–Rp 900.000.000, luas tanah 100–200 m².

Belum ada jadwal lelang mendatang yang sesuai kriteria Bapak/Ibu. Berikut pilihan yang masih ditayangkan sebagai *Tersedia*, diurutkan dari jadwal tercatat terbaru; hasil lelang atau jadwal ulang perlu dikonfirmasi tim.

1. *Kelurahan Tanjungsari, Kecamatan Sukomanunggal, Kota Surabaya, Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 450.000.000* · LT 102 m² · SHM
  Lelang tercatat: 9 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-tanjungsari-sukomanunggal-kota-surabaya-jawa-timur-surabaya-123322-120172
2. *Jalan Balongsari Tama Blok 9-b/5 Kelurahan Balongsari Kecamatan Tandes Kota Surabaya*
  Transaksi: lelang
  Harga limit: *Rp 300.000.000* · LT 100 m² · SHM
  Lelang tercatat: 3 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-balongsari-tama-9-b-5-balongsari-tandes-surabaya-120350-117200
3. *Perumahan Green Ambasador No. 17, Kelurahan Benowo, Kecamatan Pakal, Kota Surabaya, Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 655.000.000* · LT 112 m² · SHM
  Lelang tercatat: 2 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-green-ambasador-17-benowo-pakal-kota-surabaya-119718-116568
4. *Kelurahan Sememi, Kecamatan Benowo, Kota Surabaya, Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 500.000.000* · LT 140 m² · SHM
  Lelang tercatat: 2 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-sememi-benowo-kota-surabaya-jawa-timur-surabaya-119401-116251
5. *Kelurahan Babat Jerawat, Kecamatan Pakal, Kota Surabaya, Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 313.900.000* · LT 113 m² · SHM
  Lelang tercatat: 20 Mei 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-babat-jerawat-pakal-kota-surabaya-jawa-surabaya-123177-120027

Ada yang menarik? Sebutkan nomor pilihannya, nanti saya bantu cek detailnya.

_Status: recommendations_

### Percakapan 3: Satuan belum disebut, lalu diperjelas

**Pelanggan:** Saya Vera, cari rumah lelang di Surabaya Barat

**Bot:**

Siap, Vera. Saya bantu cari rumah lelang di Surabaya Barat ya.

Budget-nya sampai berapa?
Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** budget 300-900

**Bot:**

Rentang budgetnya dalam juta atau miliar rupiah, ya? Boleh tulis lengkap, misalnya “300–900 juta” atau “500 juta–1 miliar”. Kriteria lainnya tetap saya simpan.

_Status: qualifying_

**Pelanggan:** budget 300-900 juta

**Bot:**

Oke, rumah di Surabaya Barat, budget Rp 300.000.000–Rp 900.000.000 ya.

Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** luas tanah antara 100 dan 200 m2

**Bot:**

Saya cari rumah lelang di Surabaya Barat, budget Rp 300.000.000–Rp 900.000.000, luas tanah 100–200 m².

Belum ada jadwal lelang mendatang yang sesuai kriteria Bapak/Ibu. Berikut pilihan yang masih ditayangkan sebagai *Tersedia*, diurutkan dari jadwal tercatat terbaru; hasil lelang atau jadwal ulang perlu dikonfirmasi tim.

1. *Kelurahan Tanjungsari, Kecamatan Sukomanunggal, Kota Surabaya, Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 450.000.000* · LT 102 m² · SHM
  Lelang tercatat: 9 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-tanjungsari-sukomanunggal-kota-surabaya-jawa-timur-surabaya-123322-120172
2. *Jalan Balongsari Tama Blok 9-b/5 Kelurahan Balongsari Kecamatan Tandes Kota Surabaya*
  Transaksi: lelang
  Harga limit: *Rp 300.000.000* · LT 100 m² · SHM
  Lelang tercatat: 3 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-balongsari-tama-9-b-5-balongsari-tandes-surabaya-120350-117200
3. *Perumahan Green Ambasador No. 17, Kelurahan Benowo, Kecamatan Pakal, Kota Surabaya, Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 655.000.000* · LT 112 m² · SHM
  Lelang tercatat: 2 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-green-ambasador-17-benowo-pakal-kota-surabaya-119718-116568
4. *Kelurahan Sememi, Kecamatan Benowo, Kota Surabaya, Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 500.000.000* · LT 140 m² · SHM
  Lelang tercatat: 2 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-sememi-benowo-kota-surabaya-jawa-timur-surabaya-119401-116251
5. *Kelurahan Babat Jerawat, Kecamatan Pakal, Kota Surabaya, Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 313.900.000* · LT 113 m² · SHM
  Lelang tercatat: 20 Mei 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-babat-jerawat-pakal-kota-surabaya-jawa-surabaya-123177-120027

Ada yang menarik? Sebutkan nomor pilihannya, nanti saya bantu cek detailnya.

_Status: recommendations_

## Simulasi otomatis

- `npm run check`: **820 tes backend lulus**, tanpa kegagalan.
- 300 skenario melalui MessageProcessor: 15 variasi budget × 10 variasi luas × dua urutan jawaban. Semuanya lulus; inventory, WhatsApp dan capture CRM memakai tiruan.
- Tes tambahan memeriksa filter inklusif database, pemetaan kolom preferensi, koreksi batas yang diberikan terpisah, rentang salah/tidak lengkap, dan pemulihan setelah riwayat percakapan dipangkas.
- Simulasi: dari `backend/whatsapp`, jalankan `npm run simulate:ranges`. JSON: `/private/tmp/kosku-quantity-ranges.json`.

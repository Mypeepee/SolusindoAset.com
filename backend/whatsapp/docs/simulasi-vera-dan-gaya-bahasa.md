# Simulasi Vera dan variasi bahasa pelanggan

## Pengujian otomatis

- 514 skenario sintetis, 2.527 giliran: seluruhnya lulus melalui MessageProcessor, MemoryStore, dan capture klien dengan inventory/WhatsApp mock.
- Enam kontak chatting bersamaan: nama, wilayah, budget, luas, dan payload CRM tetap terpisah.
- 807 tes backend: seluruhnya lulus.
- Tidak ada pesan WhatsApp nyata atau klien percobaan yang ditambahkan.

## Verifikasi Playground dengan database proyek

Tiga percakapan di bawah dijalankan melalui endpoint Playground Owner dan pencarian database aktual. Nama pelanggan dalam skenario adalah data uji sintetis. Hasil listing mengikuti persediaan saat pengujian; tidak ada listing buatan.

### Percakapan 1

**Pelanggan:** halo

**Bot:**

Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

_Status: context_required_

**Pelanggan:** saya vera, sedang cari aset di sidoarjo, waru sana

**Bot:**

Siap, Vera. Saya bantu cari properti di Waru, Sidoarjo ya.

Mau beli atau sewa? Kalau beli, lebih tertarik lelang, properti baru dari developer (primary), atau secondary?

_Status: qualifying_

**Pelanggan:** lelang

**Bot:**

Oke, kita cari aset lelang di Waru, Sidoarjo ya.

Budget-nya sampai berapa?
Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.

_Status: qualifying_

**Pelanggan:** budget 500 juta mentok

**Bot:**

Oke, pencariannya di Waru, Sidoarjo, budget maksimal Rp 500.000.000 ya.

Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.
Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** rumah

**Bot:**

Oke, rumah di Waru, Sidoarjo, budget maksimal Rp 500.000.000 ya.

Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** luas tanah minimal 150 m2

**Bot:**

Belum ada jadwal lelang mendatang yang sesuai kriteria Bapak/Ibu. Berikut pilihan yang masih ditayangkan sebagai *Tersedia*, diurutkan dari jadwal tercatat terbaru; hasil lelang atau jadwal ulang perlu dikonfirmasi tim.

1. *Tropodo Indah Blok K-10 Desa Tropodo Kecamatan Waru Kabupaten Sidoarjo*
  Transaksi: lelang
  Harga limit: *Rp 500.000.000* · LT 160 m² · SHM
  Lelang tercatat: 3 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-tropodo-indah-k-10-tropodo-waru-sidoarjo-sidoarjo-120499-117349
2. *Tropodo Indah Blok K-11 Desa Tropodo Kecamatan Waru Kabupaten Sidoarjo*
  Transaksi: lelang
  Harga limit: *Rp 500.000.000* · LT 160 m² · SHM
  Lelang tercatat: 3 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-tropodo-indah-k-11-tropodo-waru-sidoarjo-sidoarjo-120457-117307
3. *Desa Tropodo, Kecamatan Waru, Kabupaten Sidoarjo, Propinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 500.000.000* · LT 153 m² · SHM
  Lelang tercatat: 27 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-tropodo-waru-sidoarjo-jawa-timur-sidoarjo-88878-85822
4. *Perumahan Griyo Mapan Sentosa Blok EB, No. 02, Ds. Tambaksawah, Kec. Waru, Kab. Sidoarjo, Prov. Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 467.000.000* · LT 165 m² · SHM
  Lelang tercatat: 19 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-griyo-mapan-sentosa-eb-02-tambaksawah-sidoarjo-83995-81794
5. *DESA : PEPELEGI KECAMATAN : WARU KABUPATEN : SIDOARJO PROVINSI JAWA TIMUR.*
  Transaksi: lelang
  Harga limit: *Rp 316.950.000* · LT 286 m² · SHM
  Lelang tercatat: 18 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-pepelegi-waru-sidoarjo-jawa-timur-sidoarjo-83845-81644

Ada yang menarik? Sebutkan nomor pilihannya, nanti saya bantu cek detailnya.

_Status: recommendations_

### Percakapan 2

**Pelanggan:** halo

**Bot:**

Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

_Status: context_required_

**Pelanggan:** ini Vera, rencananya cari rmh di Sidoarjo, daerah Waru

**Bot:**

Siap, Vera. Saya bantu cari rumah di Waru, Sidoarjo ya.

Mau beli atau sewa? Kalau beli, lebih tertarik lelang, properti baru dari developer (primary), atau secondary?

_Status: qualifying_

**Pelanggan:** lelang

**Bot:**

Oke, kita cari rumah lelang di Waru, Sidoarjo ya.

Budget-nya sampai berapa?
Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** budget 500 juta mentok

**Bot:**

Oke, rumah di Waru, Sidoarjo, budget maksimal Rp 500.000.000 ya.

Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** rumah

**Bot:**

Oke, rumah di Waru, Sidoarjo, budget maksimal Rp 500.000.000 ya.

Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** luas tanah minimal 150 m2

**Bot:**

Belum ada jadwal lelang mendatang yang sesuai kriteria Bapak/Ibu. Berikut pilihan yang masih ditayangkan sebagai *Tersedia*, diurutkan dari jadwal tercatat terbaru; hasil lelang atau jadwal ulang perlu dikonfirmasi tim.

1. *Tropodo Indah Blok K-10 Desa Tropodo Kecamatan Waru Kabupaten Sidoarjo*
  Transaksi: lelang
  Harga limit: *Rp 500.000.000* · LT 160 m² · SHM
  Lelang tercatat: 3 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-tropodo-indah-k-10-tropodo-waru-sidoarjo-sidoarjo-120499-117349
2. *Tropodo Indah Blok K-11 Desa Tropodo Kecamatan Waru Kabupaten Sidoarjo*
  Transaksi: lelang
  Harga limit: *Rp 500.000.000* · LT 160 m² · SHM
  Lelang tercatat: 3 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-tropodo-indah-k-11-tropodo-waru-sidoarjo-sidoarjo-120457-117307
3. *Desa Tropodo, Kecamatan Waru, Kabupaten Sidoarjo, Propinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 500.000.000* · LT 153 m² · SHM
  Lelang tercatat: 27 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-tropodo-waru-sidoarjo-jawa-timur-sidoarjo-88878-85822
4. *Perumahan Griyo Mapan Sentosa Blok EB, No. 02, Ds. Tambaksawah, Kec. Waru, Kab. Sidoarjo, Prov. Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 467.000.000* · LT 165 m² · SHM
  Lelang tercatat: 19 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-griyo-mapan-sentosa-eb-02-tambaksawah-sidoarjo-83995-81794
5. *DESA : PEPELEGI KECAMATAN : WARU KABUPATEN : SIDOARJO PROVINSI JAWA TIMUR.*
  Transaksi: lelang
  Harga limit: *Rp 316.950.000* · LT 286 m² · SHM
  Lelang tercatat: 18 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-pepelegi-waru-sidoarjo-jawa-timur-sidoarjo-83845-81644

Ada yang menarik? Sebutkan nomor pilihannya, nanti saya bantu cek detailnya.

_Status: recommendations_

### Percakapan 3

**Pelanggan:** halo

**Bot:**

Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

_Status: context_required_

**Pelanggan:** Vera 😊, lagi cari rumah di Waru Sidoarjo

**Bot:**

Siap, Vera. Saya bantu cari rumah di Waru, Sidoarjo ya.

Mau beli atau sewa? Kalau beli, lebih tertarik lelang, properti baru dari developer (primary), atau secondary?

_Status: qualifying_

**Pelanggan:** lelang

**Bot:**

Oke, kita cari rumah lelang di Waru, Sidoarjo ya.

Budget-nya sampai berapa?
Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** budget 500 juta mentok

**Bot:**

Oke, rumah di Waru, Sidoarjo, budget maksimal Rp 500.000.000 ya.

Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** rumah

**Bot:**

Oke, rumah di Waru, Sidoarjo, budget maksimal Rp 500.000.000 ya.

Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

_Status: qualifying_

**Pelanggan:** luas tanah minimal 150 m2

**Bot:**

Belum ada jadwal lelang mendatang yang sesuai kriteria Bapak/Ibu. Berikut pilihan yang masih ditayangkan sebagai *Tersedia*, diurutkan dari jadwal tercatat terbaru; hasil lelang atau jadwal ulang perlu dikonfirmasi tim.

1. *Tropodo Indah Blok K-10 Desa Tropodo Kecamatan Waru Kabupaten Sidoarjo*
  Transaksi: lelang
  Harga limit: *Rp 500.000.000* · LT 160 m² · SHM
  Lelang tercatat: 3 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-tropodo-indah-k-10-tropodo-waru-sidoarjo-sidoarjo-120499-117349
2. *Tropodo Indah Blok K-11 Desa Tropodo Kecamatan Waru Kabupaten Sidoarjo*
  Transaksi: lelang
  Harga limit: *Rp 500.000.000* · LT 160 m² · SHM
  Lelang tercatat: 3 Juni 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-tropodo-indah-k-11-tropodo-waru-sidoarjo-sidoarjo-120457-117307
3. *Desa Tropodo, Kecamatan Waru, Kabupaten Sidoarjo, Propinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 500.000.000* · LT 153 m² · SHM
  Lelang tercatat: 27 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-tropodo-waru-sidoarjo-jawa-timur-sidoarjo-88878-85822
4. *Perumahan Griyo Mapan Sentosa Blok EB, No. 02, Ds. Tambaksawah, Kec. Waru, Kab. Sidoarjo, Prov. Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 467.000.000* · LT 165 m² · SHM
  Lelang tercatat: 19 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-griyo-mapan-sentosa-eb-02-tambaksawah-sidoarjo-83995-81794
5. *DESA : PEPELEGI KECAMATAN : WARU KABUPATEN : SIDOARJO PROVINSI JAWA TIMUR.*
  Transaksi: lelang
  Harga limit: *Rp 316.950.000* · LT 286 m² · SHM
  Lelang tercatat: 18 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-pepelegi-waru-sidoarjo-jawa-timur-sidoarjo-83845-81644

Ada yang menarik? Sebutkan nomor pilihannya, nanti saya bantu cek detailnya.

_Status: recommendations_

## Mengulang simulasi offline

Dari `backend/whatsapp`, jalankan `npm run simulate:customers`. Laporan lengkap tersimpan di `/private/tmp/kosku-customer-language.json`. Simulasi ini memakai kontak, WhatsApp, dan inventory tiruan; tidak memerlukan AI eksternal.

# Pengecualian transaksi — 20 Oktober 2026

Versi: `2026-10-20-transaction-exclusions-v23`.

“Kecuali sewa” sekarang menghapus SEWA dari pilihan sebelumnya. Lelang, primary dan secondary tetap berlaku. Frasa “selain sewa”, “tanpa sewa”, “sewanya dikecualikan”, “exclude sewa”, dan perintah menghapus pilihan memakai operasi pengurangan yang sama. Penolakan bertahan ketika budget diubah atau klien kembali menyebut transaksi bebas; klien dapat menerima sewa kembali dengan pilihan eksplisit.

Menghapus sewa dari pencarian gabungan mempertahankan budget pembelian, lokasi, nama, jenis aset dan batas luas. Periode sewa dihapus karena tidak lagi berlaku. Beralih dari pencarian yang hanya berisi sewa ke pembelian tetap meminta budget pembelian yang baru. Menghapus pilihan terakhir meminta klarifikasi transaksi, tanpa memilih pengganti secara otomatis.

Pertanyaan tentang pengecualian dan kalimat ragu tidak menjadi perubahan filter. “Jangan kecualikan sewa” menerima sewa kembali. Pernyataan pengecualian yang sudah jelas tidak dikirim ke AI untuk ditebak sebagai jenis properti.

## Verifikasi

- **81/81 simulasi lulus**, 594 giliran: 27 ungkapan × tiga konteks (periode sewa belum diketahui, periode sudah diketahui, pencarian sudah menghasilkan rekomendasi).
- **240 pemeriksaan kombinasi pilihan**: empat bentuk pengecualian pada empat transaksi di setiap subset pilihan yang tidak kosong.
- **967 tes backend lulus**, termasuk pengecualian daftar, pembatalan pengecualian, memori setelah riwayat dipangkas, payload CRM, serta HTTP Playground dan predikat database asli dengan inventori sintetis.
- Type-check terfokus modul pencarian dan preferensi CRM lulus.
- Lima giliran transkrip berikut diuji pada Playground lokal aktif dengan API inventori proyek; hasilnya lima rekomendasi di Benowo, tanpa sewa. Tidak mengirim WhatsApp atau membuat klien CRM.

## Transkrip persis pada Playground aktif

**Klien:** selamat siang

**Bot:** Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

**Klien:** saya dengan kartini, ingin cari aset di benowo situ

**Bot:** Siap, Kartini. Saya bantu cari properti di Benowo, Surabaya ya.

Mau beli atau sewa? Pilihannya lelang, primary (baru dari developer), secondary, atau sewa. Boleh pilih beberapa atau jawab “bebas” untuk semua jenis transaksi.

**Klien:** bebas sih pak, budget saya di angka dibawah 300 juta pak

**Bot:** Oke, semua jenis transaksi boleh: lelang, primary, secondary, dan sewa. Saya bantu cari properti di Benowo, Surabaya, budget maksimal Rp 300.000.000 ya.

Untuk pilihan sewa, budget tadi per bulan, per tahun, atau periode lain?
Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.

**Klien:** oh kecuali sewa pak...

**Bot:** Oke, sewa saya kecualikan. Pilihannya lelang, primary, dan secondary. Saya bantu cari properti di Benowo, Surabaya, budget maksimal Rp 300.000.000 ya.

Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.
Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

**Klien:** rumah, luas tanah bebas

**Bot:** Belum ada jadwal lelang mendatang yang sesuai kriteria Bapak/Ibu. Berikut pilihan yang masih ditayangkan sebagai *Tersedia*, diurutkan dari jadwal tercatat terbaru; hasil lelang atau jadwal ulang perlu dikonfirmasi tim.

1. *Perumahan Driming Land Blok D1 No. 03, Kelurahan Sememi, Kecamatan Benowo, Kota Surabaya*
  Transaksi: lelang
  Harga limit: *Rp 293.100.000* · LT 98 m² · HGB
  Lelang tercatat: 15 April 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-driming-land-d1-03-sememi-benowo-surabaya-107094-103969
2. *Jl Kandangan Gang II RT 002 RW 001 Kelurahan Kandangan Kecamatan Benowo Kota Surabaya Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 130.000.000* · LT 74 m² · SHM
  Lelang tercatat: 9 April 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-kandangan-gang-ii-rt-002-rw-surabaya-101628-98509
3. *KELURAHAN KANDANGAN KECAMATAN BENOWO KOTA SURABAYA PROVINSI JAWA TIMUR*
  Transaksi: lelang
  Harga limit: *Rp 250.000.000* · LT 120 m² · SHM
  Lelang tercatat: 8 April 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-kandangan-benowo-kota-surabaya-jawa-timur-surabaya-97689-94608
4. *Jl Wisma Tengger Pipa No 11 Kelurahan Kandangan Kecamatan Benowo Kota Surabaya Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 250.000.000* · LT 120 m² · SHM
  Lelang tercatat: 11 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-wisma-tengger-pipa-11-kandangan-benowo-surabaya-81718-79523
5. *Kelurahan Kandangan Kecamatan Benowo Kota SUrabaya Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 175.000.000* · LT 74 m² · SHM
  Lelang tercatat: 10 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-kandangan-benowo-kota-surabaya-jawa-timur-surabaya-81437-79242

Ada yang menarik? Sebutkan nomor pilihannya, nanti saya bantu cek detailnya.

## Menjalankan ulang

Dari direktori `backend/whatsapp`:

```sh
npm run simulate:exclusions
npm run check
```

Laporan simulasi: `/private/tmp/kosku-transaction-exclusions.json`. Transkrip Playground: `/private/tmp/kosku-kartini-exclusion-live-v23.json`. Corpus: `scripts/lib/transaction-exclusion-dialogues.js`. Tes: `test/transaction_exclusions.test.js`.

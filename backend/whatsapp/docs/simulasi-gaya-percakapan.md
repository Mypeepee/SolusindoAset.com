# Simulasi gaya percakapan — 20 Oktober 2026

Versi: `2026-10-20-conversation-styles-v22`.

Jawaban transaksi sekarang memakai pembaca jawaban preferensi yang sama dengan jenis properti dan luas tanah. Partikel seperti “sih”, “kok”, “deh”, sapaan, emoji, dan penulisan memanjang dipisahkan dari inti jawaban. “Apa saja” tetap utuh; penolakan dan keraguan tidak berubah menjadi persetujuan. “Jenisnya bebas” mengikuti pertanyaan yang sedang dijawab, sehingga jawaban transaksi tidak menghapus jenis rumah atau batas luas yang sudah disebut. “Saya fleksibel” juga tidak mengganti nama klien.

Satuan budget dan jawaban periode pendek (“juta sih”, “tahun aja”) memakai normalisasi yang sama. Angka, lokasi, penolakan, dan identitas tetap disimpan saat riwayat dipangkas.

## Hasil pengujian

| Kelompok | Skenario lulus | Cakupan |
| --- | ---: | --- |
| Gaya percakapan baru | 263/263 | 1529 giliran; urutan jawaban, partikel, singkatan, emoji, bidang preferensi, koreksi dan kontrol negatif |
| Bahasa klien | 514/514 | Nama, sapaan, gabungan kebutuhan, kota/kecamatan dan domisili |
| Pilihan transaksi | 172/172 | Empat jenis transaksi, penolakan dan pergantian pilihan dengan predikat database |
| Preferensi informal | 151/151 | Bahasa sehari-hari, harga termurah, jenis dan luas |
| **Total simulasi** | **1.100/1.100** | Pemroses pesan dan kriteria pencarian/CRM |

Seluruh **960 tes backend lulus**. Type-check terfokus pada modul pencarian dan preferensi CRM juga lulus. Simulasi menggunakan transport WhatsApp, capture CRM dan inventori tiruan. Tes HTTP Playground tambahan memeriksa enam gaya jawaban terhadap filter database asli dengan inventori sintetis berisi empat jenis transaksi.

## Percakapan persis pada Playground lokal aktif

Delapan giliran berikut memakai endpoint Playground lokal dan API inventori proyek yang terkonfigurasi. Hasil akhirnya dua rekomendasi Benowo dalam rentang Rp100–200 juta. Tidak mengirim WhatsApp atau membuat klien CRM. Harga dan jadwal di bawah adalah hasil pembacaan saat pengujian; jadwal lelang yang sudah lewat ditandai oleh backend.

**Klien:** selamat siang pak

**Bot:** Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

**Klien:** saya kartini

**Bot:** Salam kenal, Kartini. Lagi cari properti di daerah mana? Kalau sudah ada aset yang diminati, boleh kirim kode atau link-nya ya.

**Klien:** saya cari aset di benowo pak budget 100 - 200 mentok

**Bot:** Budget tadi dalam juta atau miliar rupiah, ya? Cukup sebutkan satuannya; angka dan kriteria sebelumnya tetap saya simpan.

**Klien:** juta pak

**Bot:** Mau beli atau sewa? Pilihannya lelang, primary (baru dari developer), secondary, atau sewa. Boleh pilih beberapa atau jawab “bebas” untuk semua jenis transaksi.

**Klien:** bebas sih

**Bot:** Oke, semua jenis transaksi boleh: lelang, primary, secondary, dan sewa. Saya bantu cari properti di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000 ya.

Untuk pilihan sewa, budget tadi per bulan, per tahun, atau periode lain?
Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.

**Klien:** tahun aja

**Bot:** Oke, pencariannya di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000 ya.

Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.
Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

**Klien:** rumah

**Bot:** Oke, rumah di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000 ya.

Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

**Klien:** luas tanah bebas

**Bot:** Saya cari rumah di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000.

Belum ada jadwal lelang mendatang yang sesuai kriteria Bapak/Ibu. Berikut pilihan yang masih ditayangkan sebagai *Tersedia*, diurutkan dari jadwal tercatat terbaru; hasil lelang atau jadwal ulang perlu dikonfirmasi tim.

1. *Jl Kandangan Gang II RT 002 RW 001 Kelurahan Kandangan Kecamatan Benowo Kota Surabaya Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 130.000.000* · LT 74 m² · SHM
  Lelang tercatat: 9 April 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-kandangan-gang-ii-rt-002-rw-surabaya-101628-98509
2. *Kelurahan Kandangan Kecamatan Benowo Kota SUrabaya Provinsi Jawa Timur*
  Transaksi: lelang
  Harga limit: *Rp 175.000.000* · LT 74 m² · SHM
  Lelang tercatat: 10 Februari 2026 WIB (sudah lewat).
  Lihat detail: https://solusindoaset.com/Lelang/rumah-kandangan-benowo-kota-surabaya-jawa-timur-surabaya-81437-79242

Ada yang menarik? Sebutkan nomor pilihannya, nanti saya bantu cek detailnya.

## Contoh simulasi tambahan

### budget dulu / kalau saya bebas aja

**Klien:** selamat siang pak

**Bot:** Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

**Klien:** saya Kartini

**Bot:** Salam kenal, Kartini. Lagi cari properti di daerah mana? Kalau sudah ada aset yang diminati, boleh kirim kode atau link-nya ya.

**Klien:** saya cari aset di benowo pak budget 100 - 200 mentok

**Bot:** Budget tadi dalam juta atau miliar rupiah, ya? Cukup sebutkan satuannya; angka dan kriteria sebelumnya tetap saya simpan.

**Klien:** juta ya 😊

**Bot:** Mau beli atau sewa? Pilihannya lelang, primary (baru dari developer), secondary, atau sewa. Boleh pilih beberapa atau jawab “bebas” untuk semua jenis transaksi.

**Klien:** kalau saya bebas aja

**Bot:** Oke, semua jenis transaksi boleh: lelang, primary, secondary, dan sewa. Saya bantu cari properti di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000 ya.

Untuk pilihan sewa, budget tadi per bulan, per tahun, atau periode lain?
Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.

**Klien:** untuk setahun pak

**Bot:** Oke, pencariannya di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000 ya.

Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.
Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

**Klien:** rumah

**Bot:** Oke, rumah di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000 ya.

Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

**Klien:** luas tanah minimal 72 m2

**Bot:** Belum ketemu rumah yang cocok di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000, luas tanah minimal 72 m².

Mau coba perluas area, sesuaikan budget, atau ubah batas luas tanah?

### transaksi dulu / apa aja boleh

**Klien:** selamat siang pak

**Bot:** Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

**Klien:** saya Dwi

**Bot:** Salam kenal, Dwi. Lagi cari properti di daerah mana? Kalau sudah ada aset yang diminati, boleh kirim kode atau link-nya ya.

**Klien:** lagi cari aset di Benowo, Surabaya

**Bot:** Siap, Dwi. Saya bantu cari properti di Benowo, Surabaya ya.

Mau beli atau sewa? Pilihannya lelang, primary (baru dari developer), secondary, atau sewa. Boleh pilih beberapa atau jawab “bebas” untuk semua jenis transaksi.

**Klien:** apa aja boleh

**Bot:** Oke, semua jenis transaksi boleh: lelang, primary, secondary, dan sewa. Saya bantu cari properti di Benowo, Surabaya ya.

Budget-nya sampai berapa?
Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.

**Klien:** budgetnya 100 sampai 200 juta

**Bot:** Oke, pencariannya di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000 ya.

Untuk pilihan sewa, budget tadi per bulan, per tahun, atau periode lain?
Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.

**Klien:** per tahun 😊

**Bot:** Oke, pencariannya di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000 ya.

Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.
Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

**Klien:** rumah

**Bot:** Oke, rumah di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000 ya.

Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.

**Klien:** luas tanah minimal 72 m2

**Bot:** Belum ketemu rumah yang cocok di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000, luas tanah minimal 72 m².

Mau coba perluas area, sesuaikan budget, atau ubah batas luas tanah?

### jenis properti / saya fleksibel kok

**Klien:** selamat siang pak

**Bot:** Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

**Klien:** saya Kartini

**Bot:** Salam kenal, Kartini. Lagi cari properti di daerah mana? Kalau sudah ada aset yang diminati, boleh kirim kode atau link-nya ya.

**Klien:** cari lelang aset di Benowo Surabaya budget 100–200 juta luas tanah minimal 72m2

**Bot:** Siap, Kartini. Saya bantu cari aset lelang di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000 ya.

Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.

**Klien:** saya fleksibel kok

**Bot:** Belum ketemu aset lelang yang cocok di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000, luas tanah minimal 72 m².

Mau coba perluas area, sesuaikan budget, atau ubah batas luas tanah?

### koreksi pilihan / bebas sih, tapi jangan lelang

**Klien:** selamat siang pak

**Bot:** Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

**Klien:** saya Kartini

**Bot:** Salam kenal, Kartini. Lagi cari properti di daerah mana? Kalau sudah ada aset yang diminati, boleh kirim kode atau link-nya ya.

**Klien:** cari rumah di Benowo Surabaya budget 100–200 juta luas tanah minimal 72m2

**Bot:** Siap, Kartini. Saya bantu cari rumah di Benowo, Surabaya ya.

Mau beli atau sewa? Pilihannya lelang, primary (baru dari developer), secondary, atau sewa. Boleh pilih beberapa atau jawab “bebas” untuk semua jenis transaksi.

**Klien:** bebas sih, tapi jangan lelang

**Bot:** Oke, pilihannya: primary, secondary, dan sewa. Saya bantu cari rumah di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000 ya.

Untuk pilihan sewa, budget tadi per bulan, per tahun, atau periode lain?

**Klien:** tahun aja

**Bot:** Belum ketemu rumah yang cocok di Benowo, Surabaya, budget Rp 100.000.000–Rp 200.000.000, luas tanah minimal 72 m².

Mau coba perluas area, sesuaikan budget, atau ubah batas luas tanah?

## Menjalankan ulang

Dari direktori `backend/whatsapp`:

```sh
npm run simulate:styles
npm run simulate:customers
npm run simulate:transactions
npm run simulate:informal
npm run check
```

Laporan lengkap gaya baru: `/private/tmp/kosku-conversation-styles.json`. Transkrip Playground aktif: `/private/tmp/kosku-kartini-live-v22.json`. Corpus regresi: `scripts/lib/conversation-style-dialogues.js`; tes: `test/conversation_styles.test.js`.

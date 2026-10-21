# Perkenalan dengan keterangan asal — 20 Oktober 2026

Versi: `2026-10-20-introduction-origin-v24`.

## Penyebab pesan Tkzin tidak dibalas

Parser sudah membaca nama `tkzin`, tetapi meninggalkan `dari banten` sebagai kebutuhan properti. Sisa kalimat membuat respons perkenalan dilewati. Pemeriksaan topik belum menemukan permintaan pencarian, sementara sapaan sebelumnya sudah dikirim, sehingga backend mengembalikan `reply: null`, `suppressed: true` dan status `waiting_for_property`.

## Perubahan

Keterangan asal dalam perkenalan dipisahkan dari kebutuhan pencarian. Bot mengakui nama dan mengundang klien menyebut area yang dicari. Banten tidak otomatis menjadi lokasi properti. Nama asli dipertahankan tanpa kamus nama atau inferensi gender.

Varian `dari`, `asal`, `berasal dari`, `asli`, `domisili`, dan `tinggal di` didukung. Permintaan yang menyusul, misalnya `cari rumah di Benowo Surabaya`, tetap diproses. Kota yang ditolak sebelum koreksi juga tetap dipertahankan sebagai penolakan. Jawaban `dari owner langsung` atau `dari developer` tetap menjadi pilihan transaksi.

Saat pencarian sudah berjalan, perkenalan dengan asal melanjutkan pertanyaan pencarian yang tertunda dan mempertahankan area sebelumnya. Ketika hanya asal yang disebut setelah undangan perkenalan, bot tetap memberi undangan mencari properti tanpa mengarang nama.

## Verifikasi

- **121/121 simulasi lulus**, 363 giliran melalui pemroses pesan asli: pengenalan nama/asal, pemangkasan riwayat, pencarian area berbeda, validasi API dan payload CRM. Katalog, WhatsApp dan CRM menggunakan tiruan.
- **975 tes backend lulus**, termasuk kasus persis Tkzin, nama menyerupai label asal, asal berbeda dari area pencarian, kualifikasi yang sudah berjalan, serta HTTP Playground.
- Type-check terfokus modul pencarian dan preferensi CRM lulus.
- Dua pesan berikut diuji melalui Playground lokal aktif. Tidak menjalankan pencarian aset, meminta AI, mengirim WhatsApp, atau membuat klien CRM.

## Transkrip persis pada Playground aktif

**Klien:** selamat siang

**Bot:** Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

**Klien:** saya tkzin dari banten

**Bot:** Salam kenal, Tkzin. Lagi cari properti di daerah mana? Kalau sudah ada aset yang diminati, boleh kirim kode atau link-nya ya.

Hasil perkenalan: `suppressed: false`, status `client_identified`.

## Menjalankan ulang

Dari direktori `backend/whatsapp`:

```sh
npm run simulate:introductions
npm run check
```

Laporan: `/private/tmp/kosku-introduction-origins.json`. Transkrip Playground aktif: `/private/tmp/kosku-tkzin-introduction-live-v24.json`. Corpus: `scripts/lib/introduction-origin-dialogues.js`. Tes: `test/introduction_origin.test.js`.

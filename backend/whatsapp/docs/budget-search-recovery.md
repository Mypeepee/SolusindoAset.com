# Koreksi budget dan hasil kosong — 22 Oktober 2026

Versi pemahaman: `2026-10-22-budget-search-recovery-v29`.

## Akar masalah

Pada percakapan Jason, profil sudah berubah dari maksimal Rp100 juta menjadi
Rp300 juta. Namun `planPropertyLookup` membaca pesan `300000000` sebagai ID
properti eksplisit sehingga API mengabaikan filter budget, lokasi, dan jenis.
Bot kemudian menyebut budget baru sambil menyampaikan hasil pencarian ID yang
kosong. Jika ID itu kebetulan ada, properti yang tidak sesuai kriteria juga bisa
terpilih.

Sekarang angka tanpa label mengikuti kriteria pencarian tervalidasi yang
dikirim percakapan. `Kode 812345` dan tautan detail tetap memilih aset tertentu;
angka tanpa konteks pencarian tetap dapat menjadi kode. Nominal rupiah setelah
kartu hasil dapat memperbarui budget tanpa menghilangkan Surabaya Timur,
transaksi lelang, jenis rumah, dan preferensi luas.

## Listing di situs dengan jadwal lama

Sesuai pilihan pemilik pada percakapan ini, lelang dengan tanggal lebih lama
dari satu bulan kalender WIB atau tanpa tanggal tetap tidak masuk rekomendasi
otomatis. Pemeriksaan database lokal pada 22 Oktober menemukan 73 listing rumah
lelang di Surabaya Timur dengan harga efektif maksimal Rp300 juta, seluruhnya
di luar batas jadwal tersebut. Ini observasi database lokal, bukan jaminan
persediaan produksi saat pembaca membuka situs.

Jika hasil rekomendasi kosong, API kini memeriksa keberadaan satu listing publik
yang cocok dengan **semua filter yang sama**, tetapi tersaring karena jadwal.
Pemeriksaan hanya membaca ID; hasilnya mengirim penanda
`diagnostics.reason=auction_schedule_unverified`, tanpa memasukkan aset lama
ke daftar rekomendasi. Harga, area, kategori, transaksi, luas, legalitas,
kedekatan tempat, dan pengecualian ID tetap berlaku. Pencarian yang secara
eksplisit meminta jadwal mendatang tidak dilonggarkan.

Bot lalu menjelaskan bahwa ada listing di situs yang perlu dikonfirmasi status
dan jadwalnya. Klien dapat mengirim kode/tautan untuk membaca detail listing
tersebut. Bot tidak mengatakan aset pasti tersedia atau telah terjual.
Jawaban singkat `boleh` meminta kode atau pilihan perubahan kriteria, tanpa
mengulang query atau mengubah budget.

## Celah percakapan yang ditutup

- Angka budget setelah hasil kosong maupun sesudah kartu hasil tidak salah
  membuka kode aset; pemilihan nomor kartu dan kode eksplisit tetap berlaku.
- `coba 300` setelah tawaran mengubah budget tidak menjadi pilihan nomor 300.
- `300.000.000,00`, `300,000,000.00`, angka tertulis, `Rp`, `IDR`, serta nominal
  dengan `million`/`billion`/`thousand` diproses sebagai jumlah uang yang sesuai.
- Nominal ditolak seperti `budget tidak jadi 500 juta` tidak menaikkan budget.
  Koreksi positif `budget bukan 100 juta, 300 juta saja` memakai Rp300 juta.
- Pilihan belum jelas seperti `300/500 juta` atau `300 juta atau 500 juta`
  meminta batas maksimal/rentang yang pasti sebelum mencari.
- `tambah 100 juta` meminta batas akhir, karena dapat berarti tambahan dana
  maupun plafon baru. Bot tidak menebak operasi hitungnya.
- Kriteria tetap tersimpan saat riwayat WhatsApp dipangkas dan pada percakapan
  Playground; sinkronisasi CRM memakai budget yang sama.

## Verifikasi

`test/budget_search_recovery.test.js` menguji alur lengkap memakai konektor
database dan planner Prisma asli dengan inventori terkontrol. Data pembanding
mencakup properti di kota/kawasan lain, aset terjual, nonproperti, jenis atau
transaksi berbeda, harga satu rupiah di atas budget, serta ID yang sama dengan
nominal budget. WhatsApp dan Playground diuji melalui entry point masing-masing.

```sh
cd backend/whatsapp
npm test
```

Probe database lokal dari root repository, tanpa pengiriman WhatsApp, akses
LLM, perubahan CRM, atau operasi tulis database:

```sh
node scripts/verify-chatbot-budget-recovery.mjs
```

Probe tersebut memastikan pencarian angka murni dan budget berlabel menghasilkan
status, kandidat, dan diagnostik yang sama. Pada snapshot lokal, Rp100 juta
menghasilkan hasil kosong biasa; Rp300 juta dan Rp500 juta menghasilkan
penjelasan listing yang perlu konfirmasi jadwal.

Seluruh tes backend: 1.192 lulus, ditambah 55 tes pencarian situs dan aturan
umur lelang yang lulus pada pemeriksaan pengembangan. Pemeriksaan
TypeScript khusus modul pencarian juga lulus. Pemeriksaan TypeScript seluruh
aplikasi masih melaporkan error di modul lain; hasilnya bukan build produksi
yang lulus. Empat ekspektasi tes lama mengenai `boleh`/`baik` sesudah pertanyaan
draf MOU diselaraskan dengan perilaku yang telah berlaku: meminta pertanyaan
klien sambil mempertahankan persiapan pembelian, tanpa mengulang penawaran DP.

## Penerapan

Perubahan memerlukan pembaruan API properti Next.js dan backend WhatsApp,
kemudian restart proses backend yang digunakan WhatsApp/Playground.
`GET /health` harus melaporkan versi pemahaman di atas. Perubahan ini belum
dideploy ke produksi dari workspace pengembangan.

Tes menutup kasus yang diuji; bahasa pelanggan yang belum jelas harus tetap
diklarifikasi. Angka kelulusan bukan jaminan memahami semua bahasa tanpa bug.

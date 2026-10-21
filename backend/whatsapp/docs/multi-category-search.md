# Pencarian beberapa jenis properti — 13 Oktober 2026

Versi kode: `2026-10-13-multi-category-v3`.

Klien dapat memilih beberapa dari sembilan kategori yang tersedia dalam satu
pencarian. Contoh “gudang, pabrik, tanah, atau ruko” menghasilkan:

```json
{"category": null, "categories": ["GUDANG", "PABRIK", "TANAH", "RUKO"]}
```

API memvalidasi daftar dan menerapkan `kategori: { in: categories }`. Artinya
properti dengan salah satu kategori dapat cocok, dengan lokasi, anggaran,
batas luas, transaksi, dan status publik tetap menjadi syarat. Tidak perlu
tersedia stok untuk setiap kategori agar hasil yang cocok dapat ditampilkan.
Hasil mengikuti batas lima rekomendasi serta urutan jadwal aplikasi; tidak
menjamin setiap jenis terwakili bila stok lebih dari lima.

## Perubahan

Daftar awal beberapa jenis sudah didukung. Perbaikan ini menangani cakupan
perintah pada daftar dan urutan perubahan. Sebelumnya “hapus gudang, pabrik,
tanah” justru menyimpan pabrik dan tanah, sedangkan penggantian dengan daftar
sumber berkoma dapat memasukkan kembali jenis yang ingin diganti.

| Pesan klien | Hasil, dengan pilihan awal gudang, pabrik, tanah, ruko |
| --- | --- |
| “hapus gudang, pabrik, tanah” | Ruko |
| “tambahkan rumah dan toko” | Kelima dan keenam jenis ditambahkan |
| “ganti dari gudang, pabrik, tanah, ruko ke rumah dan toko” | Rumah atau toko |
| “ganti pilihan gudang dan pabrik dengan tanah atau ruko” | Tanah atau ruko |
| “gudang dan juga pabrik” | Gudang atau pabrik |
| “hapus gudang dan pabrik lalu tambahkan rumah” | Tanah, ruko, atau rumah |
| “hapus gudang, tambahkan gudang” | Gudang kembali masuk pilihan |
| “hapus gudang, pabrik, tanah, ruko” | Jenis belum terjawab; tanyakan jenis saja |
| “jenis bebas” | Hapus batas kategori secara eksplisit |

Kata tanah dalam “luas tanah” tidak menjadi kategori baru. Daftar menerima
penghubung dan/atau/maupun, koma, garis miring, tanda tambah, ampersand, dan
baris baru. Nama gabungan “rumah toko” tetap berarti RUKO. Balasan memakai
daftar yang mudah dibaca, misalnya “gudang, pabrik, tanah, atau ruko”. Jika
baru jenis yang dijawab, bot menanyakan batas luas yang belum diberikan.

## Hasil pengujian

`npm run simulate:categories`: **747/747 skenario lulus**.

| Kelompok | Lulus |
| --- | ---: |
| Percakapan dan perubahan pilihan | 28/28 |
| Semua kriteria dalam pesan pertama | 1/1 |
| Seluruh kombinasi 2–9 kategori | 502/502 |
| 24 urutan empat kategori × 8 pemisah | 192/192 |
| Penghapusan daftar pada 24 urutan | 24/24 |

Setiap skenario memeriksa profil serta kriteria yang diteruskan ke pencarian,
termasuk lokasi, anggaran, dan luas. Katalog simulasi kosong. Tes terpisah
menggunakan data properti tiruan untuk menjalankan pembentukan filter Prisma
dan memeriksa hasil empat kategori, penghapusan/penambahan/penggantian daftar,
stok sebagian, serta penolakan properti di luar kriteria.

`npm run check`: **463/463 tes backend lulus**, mencakup corpus bahasa
sebelumnya, proses WhatsApp tiruan dan HTTP Playground lokal. Laporan:

- `/tmp/kosku-multi-category-simulations.json` — hasil dan transkrip simulasi.
- `/tmp/kosku-multi-category-check.log` — seluruh tes backend.

Ini pengujian sintetis dengan kombinasi yang ditentukan, bukan pengukuran
probabilitas memahami semua bahasa pelanggan. Tidak ada panggilan AI,
database produksi, atau pengiriman pesan WhatsApp pada pengujian ini.

## Penerapan

Perubahan tersedia di workspace; deployment/restart layanan produksi belum
dilakukan. Sesudah memperbarui dan merestart backend yang digunakan WhatsApp,
`GET /health` harus menampilkan
`understanding_version: "2026-10-13-multi-category-v3"`. API pencarian Next.js
harus mendukung `criteria.categories`; dukungan tersebut sudah ada di workspace.

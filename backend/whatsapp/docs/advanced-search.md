# Pencarian wilayah dan landmark — 16 Oktober 2026

Versi pemahaman: `2026-10-16-landmark-language-v14`.

Chatbot menyimpan informasi yang disampaikan sekaligus; urutan funnel adalah
prioritas untuk mengisi informasi kosong, bukan urutan wajib untuk customer.

| Pesan customer | Perilaku |
| --- | --- |
| Cari rumah di Surabaya Barat budget 500 juta | Simpan jenis, wilayah, budget. Tanyakan transaksi yang belum jelas; jangan meminta kecamatan/kelurahan. |
| Secondary, luas tanah minimal 72 m2 | Lengkapi informasi dan cari langsung. |
| Dekat sekolah radius 500 meter | Tambahkan filter relasi tempat; pertahankan wilayah, budget, jenis dan luas. |
| Hmmm, ada yang dekat dengan sekolah kah pak? | Tafsirkan sebagai kategori sekolah; kata percakapan dan sapaan bukan bagian nama tempat. Tetap pakai area, budget, transaksi dan luas sebelumnya. |
| Dekat sekolahkah / sekolah bisa nggak pak? | Bentuk terikat “-kah” pada kategori fasilitas dan ekor pertanyaan dikenali. Radius eksplisit tetap dipakai ketika landmark yang sama ditanyakan ulang. |
| Dekat SD Harapan Ibu bisa nggak pak? | Cari nama SD Harapan Ibu secara spesifik; pertahankan Ibu sebagai bagian nama. Nama Berkah / Al Barokah juga tidak dipotong menjadi partikel. |
| Budget jadi 450 juta | Ubah budget saja. |
| Ganti ke Surabaya Selatan | Ubah cakupan kecamatan; pertahankan landmark dan kebutuhan lainnya. |
| Dekat Stasiun Gubeng tanpa kota yang sudah diketahui | Klarifikasi kota; jangan menjadikan Gubeng sebagai kecamatan. |
| Dekat Hotel Majapahit | Nama hotel adalah landmark, bukan permintaan aset HOTEL. |
| Dekat sekolah dan rumah sakit | Kedua kedekatan wajib dipenuhi. Kata “atau” menerima salah satu. |
| Tambahkan dekat rumah sakit juga | Pertahankan syarat landmark sebelumnya dan tambahkan yang baru. |
| Tidak harus dekat sekolah | Lepaskan syarat kedekatan atas permintaan eksplisit. |
| Ada yang lain? | Pakai kriteria yang sama dan kecualikan rekomendasi yang telah diberikan. |

`services/search_scope.js` menyimpan pembagian kecamatan Surabaya bersama
searchbar. `buyer_profile.js` memisahkan nama landmark dan jarak sebelum
menafsirkan wilayah, harga dan luas. `region_group` serta `nearby` diteruskan
ke endpoint properti yang memvalidasi bentuk, nama kelas dan radius 1–20.000 m.
Nama/alias dan kelas tempat memakai normalisasi kamus searchbar. Kueri memakai
relasi `listing.tempatDekat.some`, sekaligus filter wilayah, harga, transaksi,
jenis, luas dan status publik. Nama tempat tidak ditemukan tetap menghasilkan
filter wajib; tidak ada fallback ke properti tanpa landmark.

Radius bawaan mengikuti kelas kamus: 5 km untuk landmark dan 1,2 km untuk
fasilitas harian. Radius eksplisit tidak diperlebar secara otomatis. Jarak
indeks merupakan garis lurus/perkiraan sesuai sumbernya; jangan menyebutnya
jarak berkendara. Data kedekatan belum mencakup seluruh listing; hasil kosong
tidak berarti tidak ada properti fisik di area tersebut. Pintu tol didukung
sebagai kategori; hasilnya mengikuti indeks gerbang yang tersedia.

Jalankan `npm run simulate:advanced` untuk 55 skenario dengan inventori
sintetis, tetapi parser, balasan, DatabaseCatalog, validasi dan filter Prisma
asli. Inventori sengaja memuat properti di luar wilayah, melampaui budget,
tanpa kedekatan, jenis/luas keliru, dan sudah terjual untuk mendeteksi filter
yang hilang. Laporan lengkap beserta percakapan disimpan di
`/tmp/kosku-advanced-chat-simulations.md` dan JSON di lokasi yang sama.

`test/landmark_language.test.js` mengulang kasus Surabaya Utara, lelang rumah,
budget Rp200 juta, lalu pertanyaan sekolah. Pengujian memakai relasi POI dan
filter Prisma asli, inventori sintetis yang juga berisi aset tanpa sekolah,
di luar radius, melampaui budget, salah wilayah dan salah jenis. Jalur WhatsApp
tiruan turut memeriksa bahwa kriteria yang dikirim ke CRM sudah bersih.
Playground diuji berurutan dari sekolah ke radius, nama sekolah, lalu gabungan
sekolah dan rumah sakit. Hasil kosong tetap dimungkinkan jika indeks tempat
untuk aset yang memenuhi kriteria belum tersedia; normalisasi bahasa tidak
menambahkan data kedekatan atau melonggarkan syarat pencarian.

`npm test` turut memeriksa jalur MessageProcessor dengan transport tiruan dan
Playground dengan server HTTP lokal. Tidak ada pesan WhatsApp, pemanggilan AI,
pemindaian peta atau perubahan data database dalam pengujian ini.

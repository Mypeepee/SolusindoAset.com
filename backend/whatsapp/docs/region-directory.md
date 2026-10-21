# Referensi wilayah chatbot

Bot memakai **provinsi → kota atau kabupaten → kecamatan → desa/kelurahan**.
Kota dan kabupaten adalah cabang pada tingkat yang sama.

Sumbernya sama dengan `/api/regions/wilayah` yang dipakai LocationPicker:
[ibnux/data-indonesia](https://github.com/ibnux/data-indonesia), revisi
`b14111a0b2ef4b0d1eb850b3d59011a164090c2b` (28 April 2026).
Salinan `data/regions.json` berisi 38 provinsi, 514 kota/kabupaten, 7.285
kecamatan, serta 83.762 desa/kelurahan, lengkap dengan kode yang menghubungkan
setiap wilayah ke induknya. Ini adalah cakupan snapshot sumber tersebut;
perubahan administrasi setelah revisi itu memerlukan pembaruan snapshot.

`services/region_directory.js` mengindeks nama secara lokal saat backend mulai.
Tidak ada unduhan per pesan, pembacaan seluruh listing untuk menebak kota,
atau pengiriman seluruh direktori ke LLM. Docker menyertakan file data yang sama.
SearchHero, LocationPicker, dan API wilayah website tetap memakai perilakunya
semula; perubahan ini hanya memberikan referensi kepada chatbot.

Aturan percakapan:

- Nama dicocokkan sebagai kata utuh; nama terpanjang diprioritaskan. “Jakarta
  Selatan, apa adakah Pak?” menjadi kota Jakarta Selatan. “Pamanukan” tidak
  dianggap Manukan. Label Kota/Kab./Kec./Kel. membantu menentukan tingkat.
- Induk yang unik boleh diisi dari direktori. “Kelurahan Tebet Barat” memberi
  Kecamatan Tebet, Jakarta Selatan. Pertanyaan yang sudah terjawab dilewati.
- Nama berulang ditampilkan dengan tingkat, kota/kabupaten, dan provinsinya,
  maksimal lima pilihan. Preferensi yang lain tetap disimpan sampai jelas.
  Sukamaju di Kabupaten Bogor ditanyakan kecamatannya, bukan kotanya lagi.
- Varian menyambung dan terpisah, seperti Banyuurip/Banyu Urip, memakai kunci
  nama yang sama. Jika varian tersebut menunjuk kecamatan dan kelurahan di kota
  berbeda, bot meminta induknya. Penulisan menyambung tidak otomatis memilih
  Kecamatan Banyuurip di Purworejo. Kota yang diberikan menentukan kandidatnya.
- Nama kawasan yang benar-benar disebut klien disimpan di
  `buyer.continuation.requestedArea`, terpisah dari kecamatan/kota hasil inferensi.
  Ralat kota saja, seperti “bukan, di Surabaya pak”, mencocokkan ulang nama
  kawasan tersebut di kota yang benar. Klien tidak perlu mengulangi Banyuurip.
  Label administratif yang eksplisit tetap dihormati, dan perintah pindah kota
  atau pencarian baru menghapus kawasan lama. Setelah jelas, bot melanjutkan
  pertanyaan transaksi atau budget yang belum dijawab.
- Pasangan kota/kabupaten bernama sama dalam satu provinsi boleh dipilih
  bersama. “Boleh kota, boleh kabupaten”, “keduanya”, “dua-duanya”, atau
  “bebas” setelah pertanyaan pilihan menerima keduanya. Jawaban budget,
  jenis, luas, atau ketidakpastian tidak memperluas wilayah. “Kotanya saja”
  dan “kabupatennya saja” mempersempit pilihan saat pasangan sudah diketahui.
  Aturan ini tidak menggabungkan kecamatan ambigu atau nama berbeda.
- Wilayah yang bertentangan dengan kota pilihan meminta konfirmasi, bukan
  mengganti kota diam-diam. Kota Bandung berbeda dari Kabupaten Bandung.
- Nama kawasan informal tetap didukung. Satu kata yang juga kebetulan nama desa
  di tempat lain, seperti Manukan, tidak otomatis dipindahkan ke desa tersebut.
  Singkatan Jaksel/Jakbar/Jakut/Jakpus/Jaktim dan singkatan provinsi umum dikenali.
- Setelah lokasi jelas, lanjutkan jenis properti, anggaran, dan batas luas tanah yang
  belum dijawab. Memilih “seluruh kota” atau seluruh kawasan tetap diperbolehkan.

`buyer.profile.province` menyimpan konteks induk; filter listing memakai kota,
`district` jika sudah diverifikasi, serta `village` jika dipilih. Kecamatan
dan kelurahan disaring dengan varian nama yang sama persis agar nama/alamat
mirip di kecamatan lain tidak ikut masuk. Preferensi luas tanah, harga, kategori,
dan status publik tetap diterapkan oleh API properti.

Pilihan gabungan disimpan sebagai `buyer.city_scope` berisi nama dasar, kedua
nama administratif, dan provinsi dari direktori. Filter `buyer.profile.city`
dan `location` memakai nama dasar, misalnya `Mojokerto`, tanpa kecamatan atau
kelurahan sampai pengguna mempersempitnya. `regionValueVariants` sudah memetakan
nama dasar ke varian kota dan kabupaten dengan pencocokan sama persis di kolom
`listing.kota`. Karena itu `Bandung Barat`, `Tangerang Selatan`, atau nama dengan
tambahan lain tidak ikut. Saat pengguna memilih Kecamatan Puri, direktori
mempersempit induk menjadi Kabupaten Mojokerto dan menghapus cakupan gabungan.

`npm run simulate:regions` menjalankan 133 simulasi dari 23 pasangan nama,
memeriksa filter query, serta menulis transkrip Markdown dan JSON di
`/tmp/kosku-city-scope-simulations.*`. Inventori tiruan kosong; hasil asli tetap
bergantung pada listing publik. Tes tambahan memeriksa kartu dari dua wilayah
bersama serta konsistensi alur WhatsApp tiruan dan Playground.

Pembaruan dari root repository (pilih commit sumber yang akan dipakai):

```sh
node backend/whatsapp/scripts/sync-regions.js <commit-40-karakter>
```

Untuk arsip yang sudah diunduh, tambahkan path `.tar.gz` sebagai argumen kedua.
Skrip hanya membaca berkas JSON bertingkat yang sama dengan picker, memvalidasi
kelengkapan, kode unik dan seluruh induk, lalu mengganti snapshot secara atomik.
Arsip tidak diekstrak atau dijalankan. Jangan gunakan ekspor SQL sumber karena
beberapa nama panjang terpotong di dalamnya. Revisi dan SHA-256 arsip disimpan
di metadata. Restart backend setelah memperbarui data pada produksi.

Uji dengan percakapan baru di Playground:

```text
halo pak, saya ingin cari aset di daerah jakarta selatan, apa adakah pak?
Tebet pak
Tebet Barat
700 juta untuk investasi
100–200 m2
```

Bot meminta kecamatan dan anggaran pada pesan pertama, kemudian kelurahan.
Setelah semua preferensi terkumpul, rekomendasi hanya berasal dari database.

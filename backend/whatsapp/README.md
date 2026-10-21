# Solusindo Aset — WhatsApp dengan Baileys

[Rekomendasi listing baru otomatis](docs/automatic-recommendations.md) mengirim
aset sesuai preferensi CRM melalui WhatsApp agen, empat aset per pesan jika tersedia.
Antrean, jeda, batas frekuensi dan pemeriksaan kiriman tersedia di panel integrasi.

[Kondisi aset, rincian biaya, dan pengajuan survei](docs/asset-consultation.md)
membedakan viewing mandiri dari luar untuk lelang dan survei dengan pendampingan
agen untuk primary/secondary/sewa. Booking tersimpan sebagai permohonan pending
beserta agenda agen, dengan pengecekan bentrok dan pencegahan booking ganda.
Jalankan `npm run simulate:consultation` untuk
[simulasi percakapan formal, santai, dan Jawa](docs/simulasi-kondisi-biaya-survei.md).

Backend sekarang memakai **Baileys** sebagai koneksi default. Pasangkan WhatsApp melalui QR atau kode pairing di halaman lokal. Pengaturan Meta Developers, webhook publik, dan ngrok tidak diperlukan. Pilihan OpenAI/Gemini, prompt konsultan lelang, kalkulasi ROI, konteks percakapan, dan handover CS tetap tersedia.

Modul [Conversion to Purchase](docs/conversion-to-purchase.md) menambahkan
`Search_State` → `Closing_State`, penjelasan SOP satu tahap per balasan, prompt
closing dengan few-shot, kalkulasi DP di backend, objection refund, penyimpanan
cursor SQLite, dan event hasil lelang terautentikasi. WhatsApp dan Playground
memakai alur yang sama.
Journey Solusindo Premier mengikuti kepastian stok dan maksud pertanyaan terakhir.
Untuk jadwal lewat, komitmen DP menunggu konfirmasi aset belum terjual. Setelah
itu alurnya DP → pengajuan jadwal ulang bila perlu → akun klien → jaminan melalui
VA resmi → bidding dengan batas klien → dokumen/balik nama → mediasi. “Boleh”
mengikuti tawaran yang benar-benar dikirim, dan tidak otomatis membuka tahap lain.
Balasan DP hanya menyebut nominal hasil perhitungan dan bantuan akun atas nama
klien setelah DP; rumus 10% dengan batas Rp20 juta tidak ditampilkan ke pelanggan.
Jawaban “tidak ada” untuk pertanyaan seputar DP menutup bahasan tersebut dan
berlanjut ke informasi akun, termasuk pada sesi lama, tanpa mengulang DP.

## Kebijakan aktif: konsultatif dan responsif

Pencarian kompleks memakai [Smart Search](docs/smart-search.md): Structured
Outputs untuk beberapa lokasi, patokan koridor, syarat legalitas, dan kebutuhan
khusus. Pesan beruntun digabung melalui memori per kontak; "hitung tanah" tidak
mengubah ruko menjadi tanah dan "Ok" tidak menjadi daerah. Preferensi pencarian
aktif serta sapaan klien tersimpan di SQLite agar restart tidak menghapusnya.

Pemahaman percakapan versi `2026-10-20-smart-multi-location-search-v28` menanyakan pilihan transaksi
yang belum jelas: lelang, primary, secondary, atau sewa. “Nggak mau lelang”
menyaring primary/secondary; “rumah baru dari developer” menyaring primary;
“ngontrak” menyaring sewa. Penolakan tetap berlaku saat kriteria lain berubah.
Sewa memakai anggaran dan harga sesuai periode, bukan anggaran pembelian.
Balasan memakai bahasa percakapan yang sopan, tanpa sapaan “Bapak/Ibu” berulang,
label “Pilihan transaksi”, atau bold pada pertanyaan biasa. Bot menanyakan
maksimal dua kriteria yang belum diketahui dalam satu giliran.
Pada konteks beli yang sudah dipilih (lelang, primary, atau secondary), angka
ratusan tanpa satuan seperti “budget saya 400–600 mentok” atau “600 mentok”
dipahami sebagai Rp400–600 juta atau batas Rp600 juta. Bot menyebut kembali
nominal lengkap lalu menanyakan kriteria yang belum dijawab. Satuan eksplisit
selalu diutamakan; angka luas tanah tidak menjadi budget. Konteks sewa,
transaksi yang belum dipilih, serta angka seperti “1–2” tetap meminta satuan.
Jawaban “semua boleh” mengikuti kriteria yang sedang ditanyakan. Jika jenis dan
luas ditanyakan bersama, keduanya menjadi bebas; lokasi, transaksi, dan budget
yang sudah diketahui tetap disimpan. “Rumah kalau ada tanah gapapa” memilih
rumah/tanah tanpa menjadikan sisa kata percakapan sebagai daerah baru.
Jalankan `npm run simulate:transactions` untuk simulasi bahasa dan filter
database dengan inventori sintetis, tanpa mengirim WhatsApp atau memakai AI.
Lihat [alur transaksi dan contoh percakapan](docs/transaction-search.md).

Jika rekomendasi hanya memuat satu aset, “boleh aset tersebut pak”, “rumah tadi”,
“yang ini”, atau “boleh” pada tawaran melihat detail membuka aset tersebut.
Bot membaca ulang data publik berdasarkan ID, menyimpan aset pilihan dan
kriteria pencarian, serta memasukkan aset dengan jadwal lewat ke antrean
pengecekan stok. Daftar tidak dikirim ulang sebagai jawaban atas pemilihan.
Untuk satu aset, CTA menjadi “Mau saya bantu cek detail aset ini?”; untuk beberapa
aset, rujukan yang belum jelas meminta pilihan. Jawaban pendek setelah detail
atau closing tetap mengikuti pertanyaan terakhir, bukan membuka daftar lama.
Jalankan `npm run simulate:single-asset` untuk
[simulasi Sumberpasir dan kelanjutan chat](docs/simulasi-single-asset.md), dengan
katalog dan WhatsApp tiruan serta SQLite sementara.

Minat singkat seperti “wow... saya tertarik pak”, “saya minat”, “mau lanjut”,
“oke pak, saya serius”, “sy serius pak”, atau “saya sudah mantap”
setelah detail/rincian biaya memakai aset pilihan yang disimpan server untuk
masuk `Closing_State`. Bot membaca ulang aset tersebut dan menjelaskan langkah
berikutnya. Jadwal lewat tetap menunggu kepastian stok; minat bukan persetujuan
membayar atau menandatangani MOU. Minat pada area lain, pertanyaan, atau keraguan
tidak dianggap persetujuan membeli aset lama. Jalankan
`npm run simulate:purchase-interest` untuk
[simulasi rincian biaya → minat → closing](docs/simulasi-interest-setelah-biaya.md)
dan [reproduksi chat nomor 4 → biaya → serius → DP](docs/simulasi-klien-serius.md).
Sapaan boleh berada di tengah kalimat tanpa menghilangkan maksud serius.
Konteks tetap memerlukan aset pilihan yang tersimpan; daftar baru, “belum serius”,
“serius?” atau “masih mau pikir dulu” tidak menutup pembelian aset lama.

Klien yang sudah menerima detail/biaya dan masuk closing dapat menerima PDF
draf MOU sesuai aset pilihan. Draf diisi dari template perusahaan dan listing
publik terbaru, dikirim sekali, lalu percakapan tetap mengikuti pertanyaan
terakhir. “Kirim ulang PDF MOU” mengirim ulang saat diminta. Playground juga
menampilkan unduhan PDF. Lihat [alur, isi template, dan integrasi PDF](docs/mou-pdf.md).

Jawaban klarifikasi wilayah ditafsirkan di dalam kandidat yang sudah ditawarkan.
Contoh: setelah dua Kecamatan Pakis di Kabupaten Magelang dan Kabupaten Malang,
“malang pak” langsung memilih Pakis, Kabupaten Malang; “magelang” memilih Pakis,
Kabupaten Magelang. Parser tidak membuka ulang pasangan Kota/Kabupaten nasional.
Aturan yang sama menyaring kelurahan berdasarkan kecamatan/kabupaten/provinsi,
termasuk kandidat sah di luar lima entri pertama yang ditampilkan. Wilayah induk
yang tidak cocok tetap diklarifikasi sebelum pencarian. Permintaan eksplisit
mengganti kota menghapus pilihan wilayah lama. Jalankan
`npm run simulate:region-choices` untuk [transkrip Pakis](docs/simulasi-pilihan-pakis.md).

Pemilihan nomor membaca bahasa percakapan di sekitar referensi daftar, termasuk
“coba pak nomor 4”, “yang bu nomor empat”, “boleh gak no.4”, “coba, pak, 4”, serta
singkatan `bs`, `cb`, `nmr`, dan `yg`. Sapaan, emoji, dan tanda baca dinormalisasi
hanya untuk membaca maksud pemilihan; pesan asli tetap dipakai untuk menjawab
detail atau biaya. Nomor mengacu ke urutan seluruh daftar terakhir, termasuk
beberapa bubble. Penolakan, jumlah kamar/luas, nomor dokumen/rekening, dan budget
tetap dibedakan dari pilihan aset; dua pilihan meminta klarifikasi. Data aset
dibaca ulang dari katalog sebelum ditampilkan. Jalankan `npm run simulate:selections`
untuk [simulasi variasi bahasa dan perjalanan Menganti](docs/simulasi-pilihan-nomor.md).

Sapaan awal mengundang klien menyebut nama dan cara disapa, misalnya Pak Budi,
Bu Rina, Kak Alex, atau nama saja. Bot mengikuti pilihan eksplisit, tanpa
menebak gender dari nama atau sapaan yang ditujukan kepada bot. Klien boleh
melewati perkenalan dan langsung mencari properti. `client_identity` disimpan
terpisah dari filter properti dan tetap ada saat riwayat dipangkas atau konteks
pencarian kedaluwarsa; penyimpanannya masih mengikuti umur sesi di memori proses.
Lihat [perkenalan dan pilihan sapaan](docs/transaction-search.md#perkenalan-dan-pilihan-sapaan).

Jika pesan pertama langsung mencari properti dan masih perlu klarifikasi,
bot menambahkan ajakan perkenalan di akhir balasan, satu kali saja. Jawaban
nama melanjutkan pertanyaan pencarian yang tertunda; jawaban lokasi, transaksi,
budget, atau “keduanya” tetap diproses sebagai kriteria. Rekomendasi sekarang
bernomor, sehingga “saya tertarik yang nomor 2 pak”, “nomor dua”, dan “yang no. 2”
membuka detail aset kedua. Pilihan juga bisa dibaca dari daftar lama berbentuk
bullet; data aset diambil ulang sebelum ditampilkan.

Pemahaman percakapan memisahkan pembacaan pesan,
perubahan kriteria, dan pemilihan balasan. “Toko juga boleh” menambah pilihan;
“hapus toko” menghapus satu pilihan; “budget bukan 400 juta, tapi 350 juta”
mengganti angka yang ditolak. Pertanyaan arti istilah dijawab sebagai pertanyaan,
bukan dianggap sebagai kriteria baru. Arah luas yang belum jelas dapat dijawab
dengan “minimal”/“maksimal” pada giliran berikutnya tanpa mengulang angkanya.

Jika jenis atau pilihan luas bebas masih belum dipahami, backend dapat memakai
provider AI yang sudah dikonfigurasi untuk mengusulkan tafsiran. Usulan harus
menyertakan bukti dari pesan klien dan **dikonfirmasi klien** sebelum menjadi
filter. Jalur ini dibatasi delapan detik; kegagalan model/kuota menghasilkan
klarifikasi lokal yang tetap menyimpan kriteria sebelumnya. Pesan yang sudah
jelas tidak membutuhkan panggilan model tambahan.

Lihat [rancangan dan hasil uji pemahaman](docs/conversation-understanding.md).
Pencarian berdasarkan wilayah Surabaya dan landmark memakai versi
`2026-10-15-detail-search-memory-v12`. “Surabaya Barat” langsung menjadi cakupan
tujuh kecamatan yang sama dengan searchbar, tanpa meminta kelurahan lagi.
“Dekat sekolah di Surabaya” juga sudah cukup untuk menentukan lokasi;
nama landmark tanpa kota hanya diklarifikasi kotanya. Budget, transaksi,
jenis dan luas yang sudah disebut tetap disimpan saat kriteria lain berubah.
`npm run simulate:advanced` menjalankan 55 percakapan sintetis melewati
validasi API dan filter database asli, tanpa pengiriman WhatsApp atau AI.
Lihat [pencarian wilayah dan landmark](docs/advanced-search.md).
`npm run simulate:understanding` menjalankan 524 skenario tambahan secara offline.
`npm run simulate:understanding:ai` sengaja memanggil model yang dikonfigurasi
untuk lima contoh sintetis, dengan katalog kosong dan tanpa kiriman WhatsApp.
`GET /health` menampilkan `understanding_version` untuk memastikan proses yang
aktif sudah memuat kode baru. Perubahan file backend memerlukan restart proses
jika backend dijalankan dengan `npm start`/service, bukan mode watch.

Untuk Playground lokal, website dan backend harus sama-sama berjalan. Dari
terminal kedua jalankan `npm --prefix backend/whatsapp run start:playground`.
Perintah ini menjalankan HTTP backend tanpa otomatis membuka atau memulihkan
koneksi WhatsApp; pairing tidak diperlukan. Biarkan proses berjalan selama
Playground digunakan. Untuk pengembangan, gunakan
`npm --prefix backend/whatsapp run dev:playground` agar perubahan kode dimuat
ulang otomatis tanpa membuka koneksi WhatsApp. `WHATSAPP_BACKEND_URL` website harus menuju alamat backend
(default `http://127.0.0.1:3100`). `npm start` di folder backend tetap menjalankan
layanan biasa beserta pemulihan sesi WhatsApp.

`services/interaction_policy.js` memeriksa pesan **sebelum** pencarian database
atau LLM. Sapaan, stiker/media, dan pesan di luar konteks mendapat template
standar satu kali; pesan berikutnya di luar konteks tidak menghasilkan kiriman.
Kode/template/link atau permintaan natural seperti “bisa tolong carikan saya
aset di Manukan kah pak?” membuka layanan. Sapaan/partikel di akhir kalimat
tidak menjadi filter lokasi. Pernyataan “saya tertarik di Manukan” juga membuka
pencarian: bot memastikan kota/kabupaten terlebih dahulu, tanpa menebak Surabaya.
Jika klien baru menyebut “Kota Surabaya”, bot menanyakan kawasan/kecamatan dan
anggaran. Jawaban lanjutan seperti “saya tertarik di daerah Tandes pak” mempersempit
Surabaya ke Tandes; kata “tertarik”/“cari” tidak menghapus kota. Label daerah,
kawasan, dan kecamatan dibersihkan dari nama kawasan. Hanya kota baru yang
eksplisit atau permintaan mulai ulang pencarian yang mengganti konteks kota.
Setelah kawasan diketahui, bot memperjelas kelurahan; klien boleh memilih
seluruh kawasan. Sebelum rekomendasi, bot juga meminta luas tanah minimal,
maksimal, atau rentang (m²), atau menerima “bebas/tidak ada batasan”.
Jawaban singkat “tidak ada”, “nggak ada”, atau “gak ada pak” setelah pertanyaan
batas luas tanah juga diterima sebagai tanpa batasan luas. Bot langsung mencari
jika lokasi, jenis dan budget sudah lengkap; jawaban ini tidak menghapus filter lain.
Mengulang kecamatan saat ditanya kelurahan, misalnya “intinya di Waru”, berarti
seluruh Kecamatan Waru. Kelurahan bernama sama hanya dipilih jika klien
menyebut kelurahan/desa secara eksplisit.
Bot menanyakan jenis properti jika belum disebutkan: rumah, ruko, gudang, tanah,
apartemen, toko, pabrik, kos, atau hotel/vila. `services/property_category.js`
memetakan jawaban ke enum `listing.kategori`; filter ini wajib dipenuhi dalam
query database. “Jenis bebas” menghapus filter kategori. Jenis yang disebut
sejak pesan pertama diingat dan tidak ditanyakan lagi.
Beberapa jenis juga diterima: “rumah dan toko”, “rumah atau toko”, “rmh sama
toko”, dan “rumah/toko” menyaring `RUMAH` atau `TOKO`. “Rumah toko” tetap
berarti `RUKO`. Profil memakai `categories` untuk beberapa jenis dan `category`
untuk satu jenis; API memvalidasi enum lalu memakai Prisma `kategori.in`.
Koreksi seperti “ganti dari rumah ke toko dan gudang” mengganti daftar jenis
tanpa menghapus lokasi, anggaran atau luas. “Jenis bebas” menghapus keduanya.
Daftar tidak dibatasi dua jenis: “gudang, pabrik, tanah, atau ruko” mencari
keempat kategori sebagai alternatif. “Hapus gudang, pabrik, tanah” menyisakan
ruko; “tambahkan gudang dan pabrik” menambah kedua jenis. Perintah berurutan
diterapkan sesuai urutan pesan. Menghapus semua pilihan meminta jenis lagi,
tanpa menganggap klien memilih jenis bebas. Lihat
[simulasi beberapa jenis](docs/multi-category-search.md); jalankan
`npm run simulate:categories` untuk 747 skenario tanpa layanan eksternal.
“Tidak ada batasan luasan”, “luasan ga ada batasan”, “bebas luasnya”, dan
“ukuran tanah terserah” menerima luas bebas. Jenis dan luas dapat diberikan
dalam satu pesan, dengan urutan, tanda baca, kapitalisasi, atau sapaan berbeda.
Jawaban yang belum jelas, luas bangunan, dan “luas tidak bebas” tidak dianggap
sebagai persetujuan luas tanah tanpa batas.

Jalankan `npm run simulate:language` untuk 515 skenario bahasa: kasus Menganti,
500 kombinasi acak dengan seed tetap, 10 jawaban yang perlu klarifikasi, serta
4 koreksi. Laporan JSON dan transkrip ditulis ke
`/tmp/kosku-language-simulations.json`. Hasil dan batas interpretasi probabilitas
ada di [laporan simulasi bahasa](docs/language-simulation.md). Simulasi memakai
katalog kosong, tanpa AI, database nyata, atau pengiriman WhatsApp. Tes terpisah
memeriksa filter Prisma, WhatsApp tiruan, dan server Playground lokal.

`services/land_area.js` memisahkan luas tanah dari anggaran dan luas bangunan,
mendukung desimal, hektar/are, serta meminta koreksi untuk rentang tidak valid.
`village`, `min_land_area_m2`, dan `max_land_area_m2` diteruskan ke API properti;
Prisma menyaring kolom `kelurahan` dan `luas_tanah` bersama kota, harga, status,
dan kategori. Aset tanpa luas tanah yang memenuhi batas tidak direkomendasikan.
Kota, kawasan, kelurahan, jenis, anggaran, dan luas yang sudah dijawab tidak
ditanyakan ulang. Bot tidak menanyakan tujuan pembelian (dihuni/investasi);
tujuan yang disampaikan sukarela hanya menjadi konteks, bukan syarat pencarian.
“Saya cari rumah sih pak, budget saya di angka 350 juta” hanya memperbarui jenis
dan anggaran; frasa nominal “di angka/di kisaran” tidak mengganti lokasi.
Kecamatan dan kelurahan yang sudah dipilih tetap menjadi filter pencarian.
“Seluruh Surabaya”/“mana saja” menerima pencarian seluruh kota.
Jika bot sudah menanyakan kawasan/kecamatan, pengulangan kota seperti
“pokoknya di Gresik pak, budget saya 1m” menerima seluruh wilayah Gresik.
Bot mengonfirmasi cakupan serta anggaran Rp 1 miliar lalu hanya menanyakan
luas tanah yang belum dijawab. “Gresik aja”, “semua Gresik”, “kecamatannya
terserah”, dan “dimana aja boleh” memiliki arti yang sama pada konteks ini.
Pilihan seluruh kecamatan tidak dipaksakan saat klien baru menyebut kota pertama
kali, belum tahu, atau masih bertanya. “Kelurahannya terserah” mempertahankan
kecamatan yang sudah dipilih. Koreksi “bukan Gresik, ganti ke Sidoarjo” mengubah
lokasi sambil mempertahankan jenis, anggaran, dan luas yang tidak diubah klien.
`services/buyer_language.js` mengenali pertanyaan aktif per kalimat, memisahkan
pilihan lokasi dari jawaban bebas untuk jenis/luas, serta menormalkan nominal
“satu miliar”, “enam ratus juta”, “satu setengah miliar”, dan luas tertulis.
Jika dua pertanyaan diajukan, jawaban singkat “bebas” menyelesaikan pertanyaan
pertama saja. Nama lokasi ambigu atau angka luas tanpa arah tetap diklarifikasi.

Saat pertanyaan jenis dan luas diajukan bersama, jawaban “saya mencari rumah
pak, luasnya ya 100 - 120 m lah” mengisi kedua kriteria. Frasa “luasnya”,
“tanahnya”, dan rentang tanpa label diterima sebagai jawaban pertanyaan luas
meskipun pertanyaan itu kedua. Kecamatan Rungkut, cakupan seluruh kelurahan,
dan budget Rp1 miliar dari giliran sebelumnya tetap dipertahankan; bot langsung
mencari RUMAH dengan LT 100–120 m². Klausa ukuran dan anggaran dipisahkan sebelum
resolusi wilayah: “100–120 m” bukan harga miliar atau nama kawasan. Rentang
tertulis, “sampe”, “s/d”, dan urutan luas sebelum jenis juga didukung.
Luas tanpa arah, rentang terbalik, atau luas bangunan tidak menetapkan batas
tanah; bot memperjelas luas saja tanpa menanyakan ulang lokasi. Nama wilayah
baru yang benar seperti Medokan Ayu tetap dapat mempersempit lokasi.

Jalankan `npm run simulate:buyers` untuk 153 simulasi percakapan (variasi bahasa,
urutan kriteria, scope kota/kecamatan, koreksi, dan ambiguitas) tanpa AI maupun
pengiriman WhatsApp. Skrip menjalankan alur balasan sebenarnya, memeriksa filter
query, dan menyimpan transkrip di `/tmp/kosku-buyer-simulations.json`.
Inventori dalam simulasi tersebut kosong; hasil pencarian nyata dapat diperiksa
secara terpisah melalui Playground.

Rujukan lanjutan seperti “area tersebut”, “daerah yang sama”, “di sana”, dan
“di situ” mempertahankan lokasi pencarian atau lokasi aset pilihan yang dibaca
ulang dari database. Contohnya, setelah Kode 114108 di Tandes, Surabaya,
“di area tersebut, budget maksimal 500 juta, ada yang lain?” memakai Tandes,
Surabaya dan batas Rp500 juta, serta mengecualikan aset 114108. Jawaban itu
mengonfirmasi cakupan area yang sudah dibahas; bot menanyakan hanya kriteria
yang belum diketahui. Lokasi baru yang disebut eksplisit tetap mengubah filter.
Tanpa konteks lokasi sebelumnya, bot meminta lokasi, bukan membuat nama “Tersebut”.
Pertanyaan detail dan penolakan alternatif tetap membahas aset pilihan.

Konteks aset asal dipertahankan sesudah daftar rekomendasi maupun hasil kosong,
sehingga perubahan anggaran, jenis, dan luas tidak menghilangkan lokasi atau
pengecualian aset asal. “Ada yang lain?”, “adakah selain ketiga ini”, dan
“selain kelimanya” mengecualikan semua kartu yang sudah ditampilkan dalam
riwayat aktif (maksimal 64 ID publik). Memilih kartu
baru membaca ulang listing dan mengganti acuan percakapan. Kode berformat
`*114108*` maupun `**114108**` dikenali; harga/luas pada template tidak otomatis
menjadi budget atau preferensi pembeli.

Jalankan `npm run simulate:context` untuk 28 simulasi tambahan, termasuk kasus
di atas, koreksi kriteria, hasil kosong, pilihan kartu, serta konteks tanpa kode.
Skrip memakai inventori contoh dengan tautan `.example`, tanpa AI atau pengiriman
WhatsApp. Transkrip lengkap tersedia di `/tmp/kosku-context-simulations.md` dan
data hasil di `/tmp/kosku-context-simulations.json`. Skenario yang sama beserta
tes alur WhatsApp tiruan dan Playground juga dijalankan oleh `npm run check`.

Setiap pencarian menampilkan hingga **5 properti** yang sesuai. Jika hasilnya
kurang dari lima, bot menampilkan jumlah yang ada; jika alternatif habis,
bot menjelaskannya tanpa mengulang daftar lama. Lokasi, jenis, budget dan batas
luas tetap berlaku. Pilihan “yang keempat”, “yang kelima”, serta nomor 4/5
membuka detail listing terbaru. Daftar dengan alamat/tautan panjang dibagi
menjadi beberapa pesan maksimal 4000 karakter, tanpa membuang kartu atau
memotong alamat/tautan. WhatsApp dan Playground menyimpan semua bagian.

Jalankan `npm run simulate:recommendations` untuk 39 simulasi daftar alternatif,
termasuk daftar lama tiga properti dan urutan hasil 5 → 5 → 2 → habis.
Inventori simulasi; tidak mengecek ketersediaan asli atau mengirim WhatsApp.
Laporan: `/tmp/kosku-recommendation-simulations.md` dan `.json`.
Penanganan kalimat “adakah selain property tersebut?” dan hasil pengujian
database asli dijelaskan di [permintaan properti lain](docs/recommendation-alternatives.md).
Membuka detail, membahas biaya, lalu meminta “hmmm, adakah yang lain?” kini
melanjutkan wilayah, budget, jenis, luas dan landmark pencarian sebelumnya.
Alamat, harga dan luas aset yang dilihat tidak mengganti preferensi customer.
Jalankan `npm run simulate:detail-alternatives` untuk 26 simulasi alur ini;
lihat [memori pencarian setelah detail](docs/detail-search-memory.md).

`services/region_directory.js` memakai salinan JSON dari sumber pemilih lokasi:
38 provinsi, 514 kota/kabupaten, 7.285 kecamatan, dan 83.762 desa/kelurahan.
“Jakarta Selatan, apa adakah pak?” dikenali sebagai kota administrasi; kalimat
tambahan tidak menjadi nama lokasi. Kecamatan unik seperti Tandes memberikan
induk Surabaya dari referensi, tanpa menebak dari stok listing. Nama berulang
seperti Taman atau Bandung diperjelas dengan pilihan induk/jenis wilayah.
Kelurahan yang sudah jelas memberikan kecamatan dan kota; nama kawasan informal
seperti Manukan/Citraland tetap memerlukan kota jika belum diketahui.
Jika pilihan ambigu merupakan pasangan kota dan kabupaten bernama sama,
“boleh kota, boleh kabupaten”, “keduanya”, “dua-duanya”, atau jawaban “bebas”
pada pertanyaan pilihan wilayah menerima kedua wilayah. Bot mengonfirmasi
“Kota dan Kabupaten Mojokerto”, mempertahankan jenis pabrik serta budget
Rp50 miliar, lalu menanyakan hanya batas luas yang belum dijawab. “Kota saja”
dan “kabupatennya saja” memilih satu wilayah tanpa wajib mengulang namanya.
Budget, luas, jenis, atau “belum tahu” tidak otomatis menyetujui kedua wilayah.
Kecamatan yang disebut kemudian mempersempit ke induknya yang terverifikasi.
Filter database mencakup nama kota/kabupaten yang sama persis; Bandung Barat
tidak ikut pencarian Bandung. Lihat `npm run simulate:regions` untuk 133 skenario
di 23 pasangan nama, koreksi, penolakan, dan konteks baru. Transkrip tersimpan
di `/tmp/kosku-city-scope-simulations.md` dan `.json`, memakai inventori tiruan
tanpa panggilan AI atau pengiriman WhatsApp nyata.
SearchHero dan pemilih wilayah tidak diubah. Lihat [referensi dan pembaruan
wilayah](docs/region-directory.md). Backend lalu merender rekomendasi dari database
melalui `services/search_reply.js`. Langkah pencarian ini tidak menunggu LLM.
Aset pilihan mengunci percakapan. Pengecualian: untuk aset Tersedia dengan
jadwal lelang terlewat, bot menjelaskan perlunya konfirmasi lalu menanyakan area
pencarian. Jawaban klien membuka kualifikasi opsi cadangan (area, jenis, budget, luas),
bukan langsung menampilkan daftar. Pertanyaan detail/penolakan alternatif tetap
membahas aset awal. Status dan tanggal aset divalidasi ulang sebelum pencarian.

Pilihan juga dapat berupa alamat yang disalin dari kartu rekomendasi, termasuk
“boleh minta detail terhadap aset yang ini pak? [alamat]”. Alamat persis
diutamakan sebelum normalisasi singkatan/spasi. Jika beberapa listing cocok,
bot meminta nomor pilihan atau tautan; bot tidak memilih sembarang jadwal/harga.
ID pilihan dibaca ulang melalui API publik sebelum detail ditampilkan oleh
`services/property_details.js`. Harga, spesifikasi, dan tanggal tidak diambil
dari percakapan lama. Permintaan detail langsung membahas satu aset, termasuk
catatan jadwal lewat, tanpa mengulang daftar atau kualifikasi. Pertanyaan
berikutnya tetap mengacu pada aset pilihan sampai klien meminta pencarian baru.
Detail menampilkan jenis transaksi secara spesifik: Primary, Secondary, Sewa,
atau Lelang. Jumlah lantai tidak ditampilkan maupun diteruskan sebagai fakta
ke AI karena kolom database masih berisi nilai bawaan yang belum terverifikasi.
Jika pengguna menanyakan jumlah lantai, bot meminta konfirmasi informasi itu.

Negosiasi, survei/viewing, serta dokumen spesifik SHM/HGB/Grosse menghentikan bot
dan mengirim satu pesan handoff Jason yang tetap. Bahasa lanjutan yang belum
dipahami mendapat klarifikasi singkat; bot tetap aktif dan konteks dipertahankan.
Model juga dapat mengembalikan action `handoff` atau `out_of_scope`; backend
mengganti teks model dengan template resmi dan menerapkan status percakapannya.
Bot tidak berwenang mengubah limit, menerima transaksi, atau memastikan legalitas.

Grup, broadcast/status, dan pesan sendiri diabaikan sebelum membaca isi pesan,
baik pada adapter maupun pemroses utama. `SESSION_IDLE_MINUTES=45` (rentang
30–60) membersihkan riwayat, aset dan kualifikasi ketika pesan berikutnya datang
setelah tidak ada balasan pelanggan selama batas tersebut. Hasil AI lama yang
masih berjalan dibuang. **Handoff tidak aktif kembali karena timeout**; hanya
resume eksplisit CS yang mengaktifkannya. TTL retensi memori berbeda dari timeout
konteks ini; batasan restart state memori tetap berlaku seperti dijelaskan di bawah.

Playground mengikuti aturan yang sama memakai `conversationId` UUID terpisah per
tab/Reset Conversation dan agent. Balasan yang sengaja dibungkam memakai
`suppressed:true, reply:null`; UI tidak membuat bubble kosong. Handoff hanya
disimulasikan, ditandai pada UI, dan tidak mengubah sesi WhatsApp live. Saat
handoff, kolom input Playground dinonaktifkan dengan tombol **Mulai percakapan
baru**, supaya kondisi dijeda tidak terlihat sebagai kegagalan mengirim respons.
Riwayat sesi dengan `conversationId` disimpan secara terbatas di server; riwayat
lama kiriman browser tidak bisa memulihkan konteks yang sudah kedaluwarsa.

Chatbot juga terhubung ke database properti website melalui API internal yang
dibatasi ke kolom publik. **Dashboard → AI Bot Playground** memakai AI dan data
nyata untuk menguji detail aset/fasilitas tanpa mengirim WhatsApp. Lihat
[konfigurasi database dan batas privasi](docs/property-database.md).

## Menyambungkan WhatsApp

Gunakan Node.js **22.13+**, disarankan Node.js 24 seperti pada Dockerfile.

```bash
cd backend/whatsapp
npm ci
# Instalasi baru saja: cp .env.example .env
# Jika .env sudah ada, edit tanpa menimpa credential yang tersimpan.
npm start
```

Untuk pengembangan lokal, gunakan `npm run dev` agar perubahan kode backend
dimuat ulang otomatis. `npm start` tidak memuat perubahan file secara otomatis:
proses backend harus direstart setelah perubahan, termasuk ketika Playground
Next.js masih berjalan. Mulai percakapan uji baru setelah restart agar konteks
aset dipilih kembali.

Playground membutuhkan dua proses yang tetap aktif: Next.js (biasanya port 3000)
dan backend ini (biasanya port 3100), masing-masing di terminal tersendiri.
`ExperimentalWarning: SQLite` adalah peringatan runtime. `logged_out, code: 401`
menandakan sesi WhatsApp perlu dipasangkan ulang; Playground tidak membutuhkan
pairing dan `/health` tetap harus merespons 200 selama server berjalan.

Jika Playground gagal, respons API dan log `[chatbot.playground]` membedakan:

- `CHATBOT_BACKEND_UNREACHABLE`: proses backend berhenti atau alamat tidak terjangkau.
- `CHATBOT_BACKEND_AUTH_ERROR`: token website dan backend tidak cocok.
- `CHATBOT_BACKEND_ENDPOINT_MISSING`: alamat/versi backend tidak menyediakan endpoint Playground.
- `CHATBOT_BACKEND_INVALID_RESPONSE` / `INVALID_PROPERTY_CONTEXT`: format/versi respons tidak cocok.
- `PROPERTY_LOOKUP_UNAVAILABLE`: layanan data properti gagal.

Log hanya memuat tahap, kode error dan status; tidak mencetak token atau isi chat.

Di terminal kedua:

```bash
cd backend/whatsapp
npm run connect
```

Untuk agent pengguna platform, gunakan menu **Dashboard → Chatbot Integration**. Halaman ini menyediakan QR, kode pairing, status koneksi dan metrik tanpa URL/token teknis. Lihat [panduan integrasi dashboard](../../src/app/dashboard/chatbot-integration/README.md). Setiap agent mendapat sesi tersendiri; token backend hanya berada di server Next.js.

Perintah `npm run connect` tetap tersedia untuk operator lokal: browser membuka `http://127.0.0.1:3100/connect` dengan akses admin lokal. Sesi operator ini terpisah dari sesi agent. Token diteruskan melalui fragment, tidak dikirim sebagai query HTTP, tidak dicetak di terminal, dan segera dihapus dari address bar oleh halaman.

1. Pada ponsel, buka WhatsApp yang akan dipakai bisnis.
2. Pilih **Setelan → Perangkat tertaut → Tautkan perangkat**.
3. Scan QR pada halaman lokal. QR diperbarui otomatis.
4. Tunggu status **Tersambung** beserta nomor akun Anda.
5. Dari nomor lain, kirim “Halo, saya mencari rumah untuk investasi”. Periksa balasan bot dan penghitung pesan pada halaman koneksi.

Untuk kode pairing, buka **Gunakan kode pairing**, isi nomor internasional seperti `6281234567890`, lalu buat kode. Pada ponsel pilih **Tautkan dengan nomor telepon** dan masukkan kode yang ditampilkan. Permintaan kode baru tersedia setelah QR muncul dan dibatasi satu kali per menit.

Halaman yang dibuka langsung tanpa `npm run connect` meminta token admin dari `.env`. Pada server remote gunakan SSH tunnel/VPN; QR dan kode pairing merupakan credential pemasangan perangkat. Setelah berhasil tersambung, server tetap harus berjalan untuk menerima pesan.

## Konfigurasi

`.env` dibaca dari folder layanan ini, bukan dari root aplikasi utama. Konfigurasi lokal yang sudah disiapkan menggunakan Baileys dan credential Gemini proyek yang tersedia; nilai secret tidak dicetak.

| Variabel | Fungsi |
| --- | --- |
| `WA_TRANSPORT=baileys` | Pilihan default |
| `BAILEYS_AUTH_FILE=./.auth/session.sqlite` | Penyimpanan credential dan Signal keys |
| `HOST=127.0.0.1`, `PORT=3100` | Alamat server lokal |
| `LLM_PROVIDER` | `gemini` atau `openai` |
| `LLM_MODEL` | Model yang mendukung structured JSON output |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | Key provider yang dipakai |
| `ADMIN_API_TOKEN` | Token acak minimal 32 karakter untuk pairing dan CS |
| `ASSETS_FILE=./data/assets.json` | Katalog aset terverifikasi |
| `DEFAULT_ASSET_ID` | Opsional; aset awal percakapan |

Membuat token baru secara lokal:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Variabel Meta `WA_API_VERSION`, `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`, dan `WA_VERIFY_TOKEN` tidak diperlukan Baileys. Adapter Cloud API tersedia hanya jika `WA_TRANSPORT=cloud`; panduan lama dipindahkan ke [CLOUD_API.md](CLOUD_API.md).

## Struktur kode

```text
backend/whatsapp/
├── index.js                    # Server dan lifecycle koneksi
├── app.js                      # Express, health, halaman pairing, API CS
├── config.js                   # Validasi konfigurasi sesuai transport
├── services/
│   ├── baileys.js              # QR/pairing, reconnect, chat pribadi, PN/LID
│   ├── ai_controller.js        # OpenAI/Gemini dan system_prompt Indonesia
│   ├── message_processor.js    # Antrean, deduplikasi dan handover
│   ├── catalog.js              # Data aset, kalkulasi ROI dan tenggat
│   └── whatsapp.js             # Adapter Cloud API opsional
├── state/
│   ├── baileys_auth.js         # Auth SQLite dengan transaksi
│   └── memory_store.js         # Konteks dan status bot sementara
├── routes/admin.js             # Status koneksi, pairing dan antrean CS
├── routes/webhook.js           # Hanya aktif dalam mode Cloud API
├── public/connect.*            # Halaman pengaturan koneksi
├── scripts/open-connect.js     # Membuka halaman tanpa menyalin token
├── data/assets.json
├── data/assets.example.json
├── Dockerfile
├── deploy/solusindo-whatsapp.service
└── test/
```

## Perilaku koneksi

- Hanya event `messages.upsert` bertipe `notify` untuk chat pribadi yang diproses. Riwayat sinkronisasi, grup, status, pesan sendiri, reaction, dan pesan protokol diabaikan. Media tidak diunduh ke LLM; pengguna diminta menuliskan pertanyaannya.
- Identitas nomor (`@s.whatsapp.net`) dan LID (`@lid`) didukung. LID tidak dianggap nomor telepon. Bila nomor belum diketahui, ID percakapan berbentuk `lid:123456`; gunakan ID dari API CS.
- Disconnect sementara dicoba kembali dengan jeda bertambah, maksimal delapan kali. Logout, sesi rusak, atau sesi digantikan memerlukan tindakan operator; tidak ada loop reconnect tanpa batas.
- **Pasangkan ulang** tersedia pada sesi bermasalah. Setelah konfirmasi, credential sesi lokal serta konteks/lead sementara dihapus. Aplikasi ini tidak menghapus perangkat tertaut lain pada ponsel.
- Seluruh kategori Signal keys dan credential ditulis ke SQLite memakai transaksi serta `BufferJSON`. File memiliki izin `600`, folder auth baru `700`. Database auth tidak dienkripsi oleh aplikasi; lindungi disk/volume. Auth dikecualikan dari Git dan Docker build context.
- Satu file auth hanya boleh dipakai satu proses. Lock mencegah dua instance lokal memakai credential yang sama. Jalankan satu replica, bukan PM2 cluster. Volume auth persisten memungkinkan restart tanpa scan ulang.
- Keberhasilan kirim Baileys bukan bukti pesan sudah dibaca. Timeout tidak otomatis di-retry karena pesan mungkin telah terkirim.

## AI dan funnel lelang

Prompt lengkap ada di `services/ai_controller.js`. Persona: **asisten virtual Jason Christopher Liendo, Solusindo Aset**. Respons pembuka mengantar prospek dari awareness ke consideration: sapaan/validasi, alasan nilai peluang, edukasi proses resmi, lalu satu pertanyaan yang membuka diskusi. Maksimal empat paragraf pendek, bold WhatsApp dengan satu asterisk, dan maksimal tiga emoji.

Keluaran model juga melalui `formatSalesReply`: sapaan/validasi digabung bila paragraf berlebih, pertanyaan tambahan setelah CTA terakhir dibuang, bold dinormalisasi, dan emoji dibatasi tiga. Respons biasa dibatasi 1800 karakter; pertanyaan penutup tidak diwajibkan. Template biaya lengkap di bawah dirender terpisah oleh backend.

### Rincian biaya dan pertanyaan all-in

Pertanyaan seperti `harga sudah all-in?`, `breakdown biaya`, `biaya pengosongan`,
`pajak dan balik nama`, atau `total modal` dijawab oleh
`services/property_costs.js` setelah aset dibaca ulang dari database. Jenis
transaksi diperiksa dari `transaction_type` (pemetaan `jenis_transaksi`), lalu
path URL **aset hasil database** jika metadata kosong. Teks/URL/harga dari
pengguna tidak boleh menggantikan jenis transaksi atau harga database. Katalog
operator perlu mengisi `transaction_type: "LELANG"` untuk estimasi lelang.

Untuk lelang, backend menghitung dan merender template lengkap WhatsApp, tanpa
bergantung pada aritmetika model atau batas empat paragraf/1800 karakter. Skenario
standar ini mengikuti asumsi layanan yang diminta, bukan tarif pajak universal:

| Komponen | Asumsi ilustrasi |
| --- | --- |
| Bea Lelang / BPHTB / PPN Lelang / Roya & Balik Nama | 2% / 5% / 1,1% / 0,4% dari limit |
| Jasa pengurusan | Rp10.000.000 |
| Mediasi | Rp75.000.000 kerohiman + Rp25.000.000 advokat = Rp100.000.000 |
| Eksekusi worst case | Rp175.000.000 pengosongan + Rp6.800.000 transportasi/kuli + Rp3.000.000 konsumsi + Rp25.000.000 advokat = Rp209.800.000 |
| Fee Agent | 5% dari limit |

Total tiap skenario = limit + balik nama + **salah satu** skenario pengosongan +
fee agent. Uang jaminan tidak ditambahkan lagi; tempat perpindahan barang masih
tentatif dan di luar total. Harga dari Prisma/API boleh mengandung sen (misalnya
`417128521.13`); persentase dihitung sebelum pembulatan harga. Limit dan setiap
komponen ditampilkan serta dijumlahkan dalam rupiah bulat. Harga menang
diasumsikan sama dengan limit dan harus disesuaikan
dengan hasil lelang. Angka pengosongan adalah ilustrasi tetap; kalkulator website
`src/lib/lelangBiaya.ts` tetap memakai wilayah/luas/band harga untuk estimasinya.

Primary/secondary/jual biasa mendapatkan penjelasan harga jual standar, BPHTB
5% dengan dasar pengenaan yang perlu dikonfirmasi, Notaris/PPAT untuk AJB & Balik
Nama, serta provisi bank jika KPR. Tidak ada komponen biaya lelang. Sewa mengikuti
ketentuan sewa. Jenis transaksi/harga yang belum tersedia diminta konfirmasinya,
bukan dianggap nol. Jadwal lelang lampau tetap diberi catatan konfirmasi.

CTA viewing/diskusi minggu ini ada pada jawaban biaya. Ajakan ini tidak langsung
mematikan bot; permintaan viewing, negosiasi atau pekerjaan hukum dari klien
tetap memicu handover. WhatsApp dan Playground menggunakan renderer yang sama.

Pesan template dari tombol WhatsApp listing dikenali melalui `services/property_inquiry.js`. Kode, lokasi, spesifikasi, dan harga dalam template adalah konteks pengguna yang belum terverifikasi; nama Jason pada salam adalah nama agent tujuan, bukan nama klien. Kode yang belum dikenal tidak memakai fakta aset sebelumnya. Bot tidak menambahkan hitungan ROI atau pertanyaan dana secara otomatis pada respons pembuka.

Analisis ROI tetap tersedia ketika diminta, dengan angka dari katalog. Kesiapan dana digali bertahap setelah kebutuhan dipahami; jaminan dibedakan dari pelunasan. Klasifikasi dana adalah self-report dengan kutipan pengguna, bukan verifikasi saldo.

Untuk mengonfirmasi status, isi `availability_status` (`available`, `scheduled`, `sold`, `withdrawn`, atau `unknown`), `availability_source`, `availability_verified_at`, dan `availability_valid_until`. Status selain `unknown` memerlukan sumber serta rentang verifikasi yang valid. Setelah batas validitas lewat, bot harus meminta konfirmasi terbaru. Frasa “siap dilelang” juga memerlukan tanggal lelang yang masih akan datang dan pendaftaran yang belum ditutup. `origin` opsional: `bank`, `state`, `private`, atau `unknown`; isi berdasarkan dokumen terverifikasi. Jangan menyalin harga, status, dan asal aset dari contoh percakapan sebagai fakta.

```text
Selisih kotor = estimasi pasar - harga limit
ROI kotor = selisih kotor / harga limit × 100%
Basis biaya = harga limit + estimasi biaya tambahan
Estimasi net = estimasi pasar - basis biaya
ROI net = estimasi net / basis biaya × 100%
```

Angka mengasumsikan menang tepat di limit; harga akhir dapat naik. Uang jaminan tidak dihitung lagi sebagai biaya tambahan. Estimasi bersih hanya dihitung jika biaya tersedia. Harga pasar dan tenggat yang belum diketahui tidak dikarang. `data/assets.json` awalnya kosong; file contoh adalah simulasi dan ditolak di production. Tanggal harus ISO 8601 dengan zona waktu.

Pendampingan Solusindo Aset dijelaskan sesuai cakupan layanan yang disepakati, tanpa menjamin aset bebas sengketa atau langsung kosong. Pembayaran mengikuti kanal resmi dan pengumuman KPKNL. [Rujukan DJKN](https://www.djkn.kemenkeu.go.id/faq/faq_detail/pelayanan-lelang/3).

## Handover dan API CS

`minta rekening`, `mau transfer`, `ketemu agen`, `lokasi kantor`, `survei lokasi`, negosiasi, permintaan dokumen legal spesifik, serta `hubungkan CS` mematikan bot secara langsung. Bahasa yang belum dipahami dalam sesi properti mendapat klarifikasi dan tidak mematikan bot. Pencocokan konservatif: “belum mau transfer” tetap dialihkan. Lead dengan aset, tujuan, kesiapan jaminan dan pelunasan juga dialihkan berdasarkan self-report.

Bot mengirim persis:

> Untuk proses lanjutan seperti jadwal survei lokasi, dokumen legalitas, dan teknis lelang, agen kami (Jason) akan segera mengambil alih chat ini dan menghubungi Bapak/Ibu secepatnya. Mohon ditunggu ya.

Sesudahnya pesan pengguna tetap dicatat, tetapi AI berhenti membalas. Hasil AI yang masih berjalan dibuang setelah trigger. Pengiriman yang sudah dimulai sebelum trigger tidak bisa ditarik kembali. Kegagalan notifikasi tidak mengaktifkan bot kembali.

Semua endpoint `/admin` memerlukan `Authorization: Bearer <ADMIN_API_TOKEN>`:

| Endpoint | Fungsi |
| --- | --- |
| `GET /health` | Proses hidup dan `whatsapp_connected`; tanpa QR/credential |
| `GET /admin/whatsapp/status` | Status akun, penghitung pesan dan reconnect |
| `GET /admin/whatsapp/pairing` | QR/kode yang masih berlaku |
| `POST /admin/whatsapp/pairing-code` | Body `{"phone":"6281234567890"}` |
| `POST /admin/whatsapp/reconnect` | Body `{}` untuk retry; `{"reset":true}` untuk sesi bermasalah |
| `GET /admin/leads` | Antrean percakapan yang sudah dialihkan |
| `GET /admin/asset-checks` | Permintaan cek aset yang jadwal lelangnya terlewat |
| `PATCH /admin/asset-checks/:id` | Body `{"status":"completed"}` setelah ditindaklanjuti |
| `GET /admin/conversations/:phone` | Riwayat dan kualifikasi; mendukung ID `lid:...` |
| `PATCH /admin/conversations/:phone/bot` | Body `{"is_bot_active":true}` untuk resume, `false` untuk pause |
| `POST /admin/conversations/:phone/messages` | Body `{"text":"Pesan Senior Agent"}`; bot harus pause |

Antrean CS tersedia melalui API, tanpa notifikasi ke nomor CS lain. Balasan manual dari ponsel memberi jeda sementara lima menit; pesan klien tidak memperpanjang jeda. Dari WhatsApp agen yang ditautkan, kirim `#boton nomor_klien` ke **6282266100102** untuk melanjutkan, atau `#botoff nomor_klien` untuk jeda tanpa batas waktu. Konfirmasi masuk ke chat kontrol. Jeda eksplisit dashboard dan handover khusus tetap memerlukan aktivasi manual. Lihat [kendali percakapan, konfigurasi, dan pemulihan status](docs/conversation-control.md). Batas 24 jam pada adapter Cloud API tidak diterapkan pada balasan Baileys.

## Deployment

Gunakan satu proses dan volume auth persisten:

```bash
docker build -t solusindo-whatsapp .
docker run -d --name solusindo-whatsapp \
  --env-file .env \
  -e NODE_ENV=production -e HOST=0.0.0.0 -e PORT=3100 \
  -e BAILEYS_AUTH_FILE=/app/.auth/session.sqlite \
  -v solusindo-wa-auth:/app/.auth \
  -p 127.0.0.1:3100:3100 \
  --restart unless-stopped --stop-timeout 50 \
  solusindo-whatsapp
```

Untuk VPS, unit `deploy/solusindo-whatsapp.service` menggunakan user `solusindo-wa` dan `StateDirectory` untuk auth. Sesuaikan `/opt/solusindo-whatsapp` serta lokasi binary Node, jalankan `npm ci --omit=dev`, siapkan `.env` milik user layanan (mode `600`), lalu pasang unit systemd. Akses pairing melalui `ssh -L 3100:127.0.0.1:3100 user@server`. Port tetap di localhost; tidak perlu endpoint publik.

Auth SQLite dan kepemilikan percakapan oleh manusia bertahan setelah restart. `conversation-control.sqlite` menyimpan pause per tenant/kontak dan ID pesan bot, tanpa isi chat. Konteks chat dan antrean pesan masih di memori; overload/crash dapat kehilangan pekerjaan. Bot hanya dilanjutkan melalui kontrol Owner, tidak otomatis karena TTL atau restart.

Pengecualian: **antrean pengecekan jadwal lelang** disimpan dalam `asset-checks.sqlite`
di direktori auth dan bertahan setelah restart, termasuk saat memasangkan ulang WA.
Dashboard Owner → Chatbot Integration menampilkan antrean integrasi pusat AG108;
endpoint agent memakai `/agents/:agentId/admin/asset-checks`. Konfirmasi hasil
lelang/retender dikerjakan manusia, bukan panggilan otomatis ke KPKNL.
Lihat [alur jadwal terlewat](docs/property-database.md#aset-tersedia-dengan-jadwal-terlewat).

### Konfirmasi stok otomatis ke stoker

Saat prospek memilih aset publik **TERSEDIA**, berjenis **LELANG**, dan waktu
lelangnya sudah lewat, backend mengirim SOP **Konfirmasi Stok Properti** ke
`STOKER_WHATSAPP_NUMBER` (default `6285707379606`). Isinya ID, alamat lengkap,
tanggal dalam zona Asia/Jakarta, pertanyaan TERSEDIA/TERJUAL, dan tautan detail
Solusindo Aset dari database. Emoji dikirim sebagai Unicode UTF-8 asli.
Balasan awal kepada prospek menampilkan detail aset publik terbaru terlebih
dahulu, lalu menerangkan jadwal yang sudah lewat dan status permintaan
konfirmasi stok, kemudian menanyakan area opsi cadangan. Spesifikasi yang kosong
tetap ditandai belum tercatat; angka dari template chat tidak menggantikan data
listing. Detail dan konfirmasi memakai satu pertanyaan akhir, tanpa CTA ganda.
Nomor tujuan berasal dari konfigurasi server; klien maupun model AI tidak bisa
menggantinya. Pesan dikirim melalui WhatsApp agent yang menerima pertanyaan.

Permintaan dan outbox disimpan **dalam satu transaksi** di `asset-checks.sqlite`.
Satu tenant/aset/jadwal/tujuan hanya mempunyai satu pesan, sekalipun beberapa
klien bertanya bersamaan. Catatan tiap klien tetap terlihat di dashboard.
Jadwal lelang yang berbeda menghasilkan permintaan baru. Pesan terkirim tidak
diulang saat proses restart atau klien bertanya lagi. Catatan selesai disimpan
30 hari; setelah seluruh referensinya dibersihkan, permintaan baru dapat dikirim.
Tenant yang berbeda mempunyai akun pengirim dan deduplikasi masing-masing.

Worker memeriksa antrean setiap lima detik. Koneksi belum siap dicoba lagi dengan
backoff hingga lima menit. Jika hasil pengiriman ambigu (timeout/koneksi putus
saat mengirim atau proses terhenti di tengah kiriman), status menjadi
**Pengiriman belum dapat dipastikan**. Periksa chat WhatsApp sebelum memakai
**Coba kirim lagi**; pengiriman ulang memakai ID pesan tersimpan yang sama.
ID ini membantu mencegah duplikasi, tetapi tidak menjamin exactly-once dari
jaringan WhatsApp. Kiriman yang berhasil baru diakui kepada klien sebagai
“sudah dikirim ke bagian stoker”; itu belum berarti pesan dibaca atau stok
dikonfirmasi. Balasan stoker tidak diproses sebagai percakapan pelanggan dan
tidak otomatis mengubah listing atau mengirim hasil konfirmasi ke prospek.
Operator mencatat hasil dan sumber konfirmasi di panel antrean. Hasil tersedia
atau terjual berlaku 24 jam pada kode/ronde yang sama dan digunakan saat prospek
membalas lagi. Menutup catatan dengan stok belum pasti tidak mengizinkan DP.
Sebelum kiriman tertunda dicoba kembali, data publik dibaca ulang; aset yang
sudah terjual/ditarik atau berubah jadwal ditandai untuk diperiksa, bukan dikirim
dengan jadwal lama. Kegagalan sementara membaca database dicoba lagi otomatis.

Pengiriman proaktif ini memakai **Baileys**. Transport Cloud ditandai gagal
secara eksplisit karena pesan proaktif memerlukan approved template tersendiri.
WhatsApp pengirim harus terhubung dan berbeda dari nomor stoker. Playground
tetap simulasi dan tidak mengirim pesan. Catatan lama tidak dikirim massal saat
migrasi; pertanyaan baru dapat menambahkan pengiriman pada catatan pending lama.
`POST /agents/:agentId/admin/asset-checks/:id/retry` memakai token admin dan
body `{}`; BFF Owner memakai `POST /api/dashboard/chatbot/checks` dengan `{id}`.
Status versi tersedia di `/health` sebagai `stock_confirmation_version`.

Jalankan `node --test test/stock_confirmation.test.js` untuk uji tanpa WhatsApp
nyata, atau `npm test` untuk seluruh regresi backend. SQLite pada volume auth
ditingkatkan otomatis; PostgreSQL tidak memerlukan migrasi untuk fitur ini.

## Penyimpanan otomatis klien WhatsApp

Setelah funnel mencapai `recommendations` tanpa pertanyaan wajib yang belum
terjawab, MessageProcessor mengantrekan nama, nomor pengirim terverifikasi,
dan kriteria terstruktur. Tidak perlu memilih aset atau mendapatkan hasil
pencarian dulu. Area Surabaya, landmark/radius, budget, jenis transaksi,
jenis aset dan batas luas tanah disimpan utuh; pilihan bebas tetap kosong.
Nomor Baileys LID menunggu pemetaan PN resmi, bukan dianggap nomor telepon.
Playground tidak membuat klien dan tidak mengisi antrean ini.

Terapkan `prisma/migration_chatbot_klien_funnel.sql` dari root proyek, lalu
`prisma generate` dan restart Next.js. Isi `CHATBOT_CLIENT_TOKEN` yang sama
pada environment server Next.js dan backend WhatsApp, serta `CLIENT_API_URL`
menuju `/api/internal/chatbot/clients`. Token minimal 32 karakter, berbeda
dari token admin dan token baca properti. Backend tidak memegang akses DB.

Semua klien ditugaskan ke **AG108** di server. Nomor yang sama memperbarui
klien tersebut; nomor lama dengan awalan 0/+62 juga dikenali. Status pipeline,
sumber, catatan dan preferensi manual tetap dipertahankan. Kolom `chatbot_*`
menyimpan funnel terbaru; `chatbot_kriteria` mempertahankan JSON lengkap.
CRM menampilkan bagian **Kebutuhan dari WhatsApp**, sumber Chatbot WhatsApp,
dan budget funnel dalam ringkasan pipeline.

Antrean `client-outbox.sqlite` berada di volume auth, berizin 600. Penulisan
yang gagal dicoba kembali dengan jeda sampai 5 menit, bertahan saat restart.
Revisi terbaru menggantikan revisi lama dan retry lama tidak menimpa data
yang lebih baru. Arsip percakapan tidak disalin ke antrean atau tabel klien.
Menu, halaman, dan API Chatbot Integration/Playground hanya untuk **Owner aktif**;
role diverifikasi dari DB setiap permintaan, terlepas dari isi JWT lama.

Pengujian khusus dari root: `node --test scripts/test-chatbot-clients.cjs`.
Verifikasi DB opsional: `node scripts/verify-chatbot-clients-db.cjs`;
seluruh klien uji berada dalam transaksi yang dibatalkan (rollback).

## Pengujian dan rujukan

Cadangan LLM opsional: isi `LLM_FALLBACK_MODEL` dengan model JSON terstruktur pada
provider yang sama. Konfigurasi lokal saat ini mempertahankan Gemini 2.5 Flash
sebagai utama dan memakai Gemini 3.5 Flash-Lite saat utama dibatasi/gangguan.
Satu pesan mencoba setiap model paling banyak sekali. Kuota harian, rate limit,
model tidak tersedia, dan gangguan sementara menyimpan jeda per model/kredensial
di memori proses, dibagikan oleh seluruh koneksi agent dan sandbox. Batas dari
provider dihormati; tidak ada retry berulang saat kuota harian habis. Reset atau
restart tidak menaikkan kuota provider; restart hanya menghapus cache jeda lokal.

Sandbox: 30 permintaan per agent per 5 menit; satu proses aktif per agent dan
10 secara global. `SANDBOX_BUSY` memakai HTTP 409, `SANDBOX_RATE_LIMIT` memakai
429 dengan sisa jeda, dan kapasitas global memakai 503. Error provider tetap
dibedakan (`AI_QUOTA_EXHAUSTED`, `AI_RATE_LIMIT`, dll.), tanpa meneruskan body
rahasia dari provider. Pembatalan melalui
`DELETE /sandbox/:agentId/messages/:requestId` hanya berlaku pada request milik
agent tersebut. Permintaan sandbox dibatasi 55 detik dan meneruskan abort ke
API data properti serta LLM.

Jalankan `npm run check`. Tes memakai socket/provider tiruan: filter pesan, PN/LID, QR, pairing, reconnect/logout, SQLite, deduplikasi, handover, autentikasi admin dan kedua LLM. Tes otomatis tidak memasangkan nomor atau mengirim chat nyata.

`npm run simulate:styles` menguji 263 percakapan dengan variasi partikel,
sapaan, emoji, singkatan, urutan jawaban, koreksi dan bidang preferensi.
“Bebas sih” menerima seluruh jenis transaksi saat pertanyaan transaksi tertunda;
jawaban yang sama untuk jenis properti atau luas hanya mengubah bidang tersebut.
Lihat [hasil 1.100 simulasi dan transkrip Kartini pada Playground aktif](docs/simulasi-gaya-percakapan.md).

`npm run simulate:exclusions` menguji 81 percakapan pengecualian transaksi.
“Kecuali sewa” menghapus sewa sambil mempertahankan pilihan beli dan budget
sebelumnya. Lihat [simulasi pengecualian dan transkrip Playground aktif](docs/simulasi-pengecualian-transaksi.md).

Baileys adalah klien WhatsApp Web **tidak resmi**; protokol dapat berubah dan penggunaan tetap mengikuti ketentuan WhatsApp. Dependency dipatok pada `7.0.0-rc14`, versi yang tersedia saat implementasi. Rujukan: [Baileys](https://baileys.wiki/), [penyimpanan sesi](https://baileys.wiki/authentication/session-management), [PN/LID](https://baileys.wiki/migration/v7).

### Bukti penyimpanan dan uji sebelum pairing

Owner dapat melihat panel **Penyimpanan klien otomatis** di Chatbot Integration.
Antrean dan retry berasal dari SQLite aktual; jumlah klien berasal dari PostgreSQL.
`GET /agents/AG108/admin/client-capture` hanya mengembalikan konfigurasi, angka
antrean, waktu acknowledgment terakhir, dan hasil uji, tanpa payload/nomor kontak.
`POST .../client-capture/check` dengan body `{}` menguji endpoint `/check` pada
`CLIENT_API_URL` menggunakan token tulis yang sama. Endpoint Next.js menjalankan
fungsi persistensi asli dalam transaksi yang selalu rollback; klien uji tidak
menjadi data nyata. Penulisan/baca/update/deduplikasi/cleanup harus seluruhnya
terbukti agar hasil dinyatakan lulus. Token salah atau bukti tidak lengkap gagal.

Hasil uji tersimpan setelah restart, dibatasi sekali per 30 detik, dan tidak
mengubah penghitung klien sukses. Metadata baru `stored_at`/`last_error` serta
`client_checks` pada SQLite ditambahkan otomatis; antrean lama dipertahankan.
Probe menguji jalur database; penerimaan nomor pengirim tetap perlu percakapan
WhatsApp setelah pairing. UI menampilkan perbedaan ini secara eksplisit.

### Perbaikan percakapan dan preferensi (17 Oktober 2026)

- Kecamatan/kawasan yang sudah disebut cukup untuk lokasi; kelurahan boleh diberikan sukarela. Ungkapan seperti “waduh gatau” tidak menjadi nama wilayah.
- Saat hasil kosong, “boleh” memperjelas pilihan, “perluas area” melonggarkan satu tingkat wilayah, “ubah radius” meminta jarak, dan “sesuaikan budget” meminta batas baru. Budget/landmark/jenis/luas lain tetap dipertahankan. Tidak ada kenaikan budget atau penghapusan landmark tanpa permintaan klien.
- `REPLY_DELAY_MS=2000` memberi jeda sebelum setiap balasan otomatis dan membatalkan respons tertunda jika Owner mengambil alih. Pesan masuk beruntun membatalkan respons lama. Jeda bukan jaminan terhadap pembatasan WhatsApp; Baileys bukan WhatsApp Business Platform resmi.
- Pesan manual dari WhatsApp memberi jeda sementara sesuai `MANUAL_REPLY_PAUSE_SECONDS` (default 300). Kirim `#boton nomor_klien` / `#botoff nomor_klien` ke **6282266100102** (`BOT_CONTROL_WHATSAPP_NUMBER`) dari akun agen tertaut; konfirmasi masuk ke chat kontrol, dan `#botoff` bertahan sampai diaktifkan lagi. ID kiriman bot dan event Owner ditandai agar echo tidak menjeda ulang. Owner juga dapat memakai **Kendali percakapan** di dashboard.
- Jalankan migrasi aditif `prisma/migration_chatbot_preferensi_sync.sql` dan `npx prisma generate` dari root. Capture klien menulis PreferensiKlien dalam transaksi yang sama. Wilayah Surabaya dipecah ke kecamatan yang tepat, luas bebas menjadi NULL, dan metadata sinkronisasi menjaga edit/hapus manual.
- Backfill klien lama: `node scripts/sync-chatbot-preferences.cjs` dari root. Uji database dengan rollback: `node scripts/verify-chatbot-clients-db.cjs`. Tidak mengirim pesan WhatsApp.

### Nama dan kebutuhan dalam satu pesan

Versi `2026-10-20-introduction-origin-v24` membalas perkenalan seperti
“saya tkzin dari banten” dan memisahkan asal dari area properti yang dicari.
`npm run simulate:introductions` menguji 121 percakapan sampai kriteria
pencarian dan CRM; lihat [perkenalan dengan keterangan asal](docs/simulasi-perkenalan-asal.md).

`saya vera, sedang cari aset di sidoarjo, waru sana` dipisahkan menjadi nama
Vera dan kebutuhan di Waru, Sidoarjo. Pertanyaan nama hanya memberi kesempatan
untuk jawaban nama pertama, bukan seluruh potongan setelah koma. Nama yang
sudah disebut tidak ditimpa potongan lokasi/budget; koreksi eksplisit seperti
`panggil saya Bu Vera` tetap bisa mengubah sapaan. Kata ragu, lokasi yang
dikenal, serta singkatan penolakan tidak dijadikan nama. Tidak ada inferensi
gender dari nama. Kapitalisasi sapaan tidak mengubah ejaan nama yang disimpan.

Jalankan `npm run simulate:customers` untuk 514 skenario dan 2.527 giliran
melalui pemroses pesan asli dengan WhatsApp, inventory, dan capture CRM tiruan.
Pengujian mencakup nama/kebutuhan dalam satu kalimat, urutan kota/kecamatan,
singkatan, emoji, nama mirip wilayah, domisili berbeda dari area pencarian,
budget/luas, serta perkenalan di akhir pesan. Uji tambahan mengirim enam kontak
bersamaan untuk memastikan konteks dan payload CRM tidak bercampur. Jawaban
budget yang jelas tidak meminta interpretasi AI; kalimat dengan kebutuhan
tambahan yang belum dipahami tetap bisa diinterpretasi.

Transkrip verifikasi Playground dengan database proyek tersedia di
`docs/simulasi-vera-dan-gaya-bahasa.md`. Simulasi tidak mengirim WhatsApp nyata
atau menambah klien percobaan. Hasil tes menunjukkan cakupan skenario yang
diuji, bukan jaminan memahami setiap kemungkinan kalimat.

### Memilih nomor dari daftar rekomendasi

`coba nomor 1`, `buka no. 2`, `pilih 3`, `yang keempat`, dan `5 dulu` membuka
detail ID properti sesuai urutan daftar terakhir. Detail membaca ulang listing
publik; harga pada percakapan lama tidak menjadi sumber data terbaru. Pilihan
nomor tetap mengacu ke daftar tersebut setelah melihat detail atau memperjelas
pilihan. Daftar alternatif baru mengganti urutan nomor. Nomor rumah, jumlah
kamar, budget, dan pilihan yang ditolak tidak dijadikan nomor rekomendasi.
Pilihan ambigu atau di luar daftar diperjelas; tanpa daftar acuan, bot meminta
link/kode properti.

Jalankan `npm run simulate:selections` untuk 465 skenario (31 ungkapan × lima
posisi × tiga format daftar), memakai inventory tiruan tanpa AI atau WhatsApp
nyata. Laporan JSON tersimpan di `/private/tmp/kosku-selection-language.json`.
Tes juga menjalankan kasus Sukodono dengan jeda 12 menit melalui pemroses pesan
asli, lalu mengganti pilihan dan meminta alternatif tanpa mengulang funnel.
Transkrip Playground dengan database proyek: `docs/simulasi-pilihan-nomor.md`.

### Rentang harga dan luas tanah

Versi `2026-10-17-quantity-ranges-v18` membaca kedua ujung rentang secara
terpisah, termasuk satuan bersama (`300–900 juta`), satuan berbeda
(`500 juta–1 miliar`), `Rp300.000.000–Rp900.000.000`, desimal, dan angka
terbilang. Pada jawaban budget properti, `500 sampai 1m` memakai Rp500 juta
sebagai batas bawah dan Rp1 miliar sebagai batas atas; `1–2M` tetap Rp1–2 miliar.
Satuan `m` pada jawaban luas memakai konteks tanah, sehingga tidak menjadi harga.
Pemisah meliputi tanda hubung/dash, `sampai`, `sampai dengan`, `sampe`, `hingga`,
`s/d`, `s.d.`, serta `antara … dan …`. Luas menerima m², are, dan hektar.

Balasan, pencarian, serta preferensi CRM memakai kedua batas inklusif. Rentang
nominal kecil tanpa satuan (`300–900`), rentang terbalik, nol, negatif, atau
terlalu besar meminta klarifikasi; bot tidak memakai sebagian rentangnya untuk
mencari. Kriteria valid sebelumnya tetap disimpan sampai koreksi diterima.
Batas minimal/maksimal juga dapat dijawab dalam giliran terpisah.

`npm run simulate:ranges` menjalankan 300 percakapan melalui pemroses pesan asli,
dengan inventory, WhatsApp dan capture CRM tiruan. Tes tambahan memeriksa
predikat database, kolom preferensi, koreksi, dan memori setelah riwayat dipangkas.
Transkrip tiga percakapan Playground dengan database proyek tersedia di
`docs/simulasi-rentang-harga-luas.md`.

Sesudah pertanyaan luas (termasuk `Luas berapa?` atau `Luasnya berapa?`),
jawaban `300–900` langsung menjadi luas tanah minimal 300 m² dan maksimal
900 m². Bot tidak menanyakan satuan lagi. Satuan yang disebut eksplisit tetap
dipakai; pertanyaan luas bangunan tidak dijadikan pertanyaan luas tanah.

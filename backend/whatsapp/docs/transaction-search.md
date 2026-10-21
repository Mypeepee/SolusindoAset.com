# Pilihan transaksi dalam pencarian properti

Versi pemahaman: `2026-10-14-selection-introduction-v8`.

Pencarian baru yang belum menyebut transaksi menanyakan beli/sewa dan pilihan
lelang, primary, atau secondary sebelum mengambil rekomendasi. Kriteria lokasi,
jenis properti, anggaran, dan luas yang sudah disampaikan tetap disimpan.

| Contoh bahasa pengguna | Filter pencarian |
| --- | --- |
| “nggak mau lelang”, “non-lelang”, “nggak mau beli rumah lelang” | PRIMARY atau SECONDARY |
| “rumah yang baru dibangun”, “rumah dari developer/pengembang” | PRIMARY |
| “rumah bekas”, “seken”, “beli langsung dari pemilik” | SECONDARY |
| “ngontrak”, “nyewa”, “nggak jadi beli, maunya sewa” | SEWA |
| “sewa rumah baru” | SEWA; kata baru tidak mengubahnya menjadi pembelian primary |
| “lelang boleh”, “nggak keberatan lelang” | LELANG |
| “rumah siap huni”, “yang murah”, “belum tahu” | Klarifikasi transaksi |
| “primary itu apa?” | Penjelasan; tidak mengubah pilihan |
| “saya mau tahu harga lelang” | Pertanyaan informasi; tidak membuka pencarian lelang |

Primary berarti penjualan baru dari developer. Secondary mencakup jual beli
di luar penjualan perdana developer; bukan jaminan rumah tersebut tua atau bekas.
“Baru renovasi” dan “siap huni” tidak cukup untuk menentukan transaksi.
Bot tidak menyatakan kondisi spesifik sebuah listing berdasarkan kategori saja.

Penolakan lelang bertahan saat pengguna mengubah budget, lokasi, jenis, dan luas.
Hasil kosong tidak menyebabkan filter dilepas. Pengguna boleh mengubah pikiran
dengan pilihan eksplisit seperti “sekarang lelang boleh”. Pilihan beberapa
transaksi pembelian memakai `transaction_types`; satu pilihan memakai
`transaction_type`. API memvalidasi enum dan menerapkan filter Prisma
`jenis_transaksi.in` atau nilai tunggal. Kriteria terstruktur mengalahkan kata
transaksi dalam pesan mentah. Alternatif aset pilihan menggunakan metadata
transaksi dari database, kemudian menerima perubahan dari pengguna.

Untuk sewa, bot menanyakan periode anggaran. `3jt/bln` dan `30 juta/tahun`
didukung. Harga disaring dari `sewaDetail.harga_sewa_*` untuk periode yang
diminta, dan harga/periode yang sama ditampilkan pada kartu. Listing tanpa harga
untuk periode tersebut tidak lolos filter budget; nominal bulanan tidak
dikalikan sendiri untuk menebak harga tahunan. Deposit dan minimum durasi tetap
mengikuti data listing. Beralih dari beli ke sewa atau mengganti periode tanpa
menyebut anggaran baru meminta anggaran kembali. Jika semua jenis transaksi
boleh, bot mempertahankan lelang, primary, secondary, dan sewa, lalu menanyakan
periode budget untuk pilihan sewa. Filter harga beli dan harga sewa sesuai
periode diterapkan dalam cabang terpisah; kartu sewa menampilkan periode tersebut.

### Jawaban bebas dan budget Kartini (20 Oktober 2026)

Versi `2026-10-20-transaction-exclusions-v23` memahami pengecualian sebagai
penghapusan pilihan. “Oh kecuali sewa pak...” mempertahankan lelang, primary,
secondary dan budget pembelian yang sudah diberikan. Periode sewa tidak
ditanyakan lagi. Penolakan bertahan saat budget dikoreksi atau transaksi bebas
dipilih kembali. “Jangan kecualikan sewa” menerima sewa kembali.
Lihat [81 simulasi pengecualian dan transkrip Playground aktif](simulasi-pengecualian-transaksi.md).

Versi lanjutan `2026-10-20-conversation-styles-v22` menyatukan pembacaan
preferensi transaksi, jenis properti, dan luas. “Bebas sih”, “kalau saya bebas”,
“apa saja”, “saya fleksibel”, dan jawaban beremoji dipahami sesuai pertanyaan
yang sedang ditanyakan. “Jenisnya bebas” sesudah pertanyaan transaksi tidak
menghapus jenis rumah atau batas luas sebelumnya. Jawaban seperti “juta sih”
dan “tahun aja” juga dapat melengkapi pertanyaan satuan/periode.
Lihat [hasil 1.100 simulasi dan transkrip Playground aktif](simulasi-gaya-percakapan.md).

Versi `2026-10-20-unrestricted-transactions-v21` menghapus pertanyaan berulang
“beli atau sewa dulu” setelah klien memilih bebas. Bot mengakui keempat jenis
transaksi dan melanjutkan kebutuhan yang belum diketahui. Penolakan sebelumnya,
misalnya tidak mau lelang, tetap berlaku ketika klien kemudian menjawab bebas.

“Budgetnya 100–400 pak” dalam pencarian gabungan meminta satuan juta atau miliar,
karena budget sewa juga dapat memakai skala lain. Angkanya disimpan; jawaban
“juta pak” melengkapinya menjadi Rp100–400 juta tanpa mengulang angka atau pilihan
transaksi. Pilihan periode berikutnya hanya berlaku untuk cabang sewa. Nama,
Benowo/Surabaya, dan kedua batas budget bertahan ketika riwayat chat dipangkas.
Chat lama dengan balasan berulang juga dibaca ulang menggunakan aturan ini.

Regresi `test/unrestricted_transactions.test.js` mencakup percakapan Kartini
melalui pemroses WhatsApp tiruan dan HTTP Playground, filter database, harga
tahunan pada kartu, serta empat preferensi CRM. Pengujian memakai inventori
sintetis dan tidak mengirim WhatsApp atau menulis klien ke database nyata.

## Contoh alur

**User:** selamat siang pak, saya sedang cari aset property di surabaya

**Bot:** Siap, saya bantu cari properti di Surabaya ya.

Mau beli atau sewa? Kalau beli, lebih tertarik lelang, properti baru dari
developer (primary), atau secondary?

**User:** saya nggak mau lelang pak

**Bot:** Mencatat primary atau secondary, lalu menanyakan kawasan dan anggaran
yang belum diberikan.

**User:** rumah yang baru dibangun dari developer aja

**Bot:** Mempersempit ke rumah PRIMARY sambil mempertahankan Surabaya.

**User:** seluruh Surabaya, budget 800 juta, luas tanah bebas

**Bot:** Mencari rumah PRIMARY di Surabaya, harga maksimal Rp800 juta.

**User:** nggak jadi beli, maunya ngontrak aja

**Bot:** Mengubah transaksi ke SEWA dan meminta anggaran serta periode sewa.
Lokasi, jenis rumah, dan pilihan luas bebas tetap disimpan.

**User:** budget 30 juta per tahun

**Bot:** Mencari rumah SEWA di Surabaya dengan harga tahunan maksimal Rp30 juta.

## Validasi

Hasil 14 Oktober 2026: **172/172 simulasi transaksi** dan **588/588 tes backend lulus**.
Corpus pemahaman tambahan **524/524 simulasi** juga lulus.
Type-check terfokus `src/lib/chatbot/property-knowledge.ts` beserta dependensinya
juga lulus. Type-check seluruh workspace masih melaporkan error pada modul lain,
antara lain `src/actions/getProperties.ts` dan komponen apartemen; pemeriksaan
tersebut tidak dinyatakan lulus.

```sh
npm --prefix backend/whatsapp run simulate:transactions
npm --prefix backend/whatsapp run check
```

Simulasi menggunakan inventori sintetis keempat transaksi dan menjalankan
`generatePropertyReply` serta filter Prisma yang dipakai aplikasi. Variasi
meliputi pembuka, jawaban lanjutan, kapitalisasi, bahasa informal, pergantian
pilihan, dan penolakan. Kartu hasil diperiksa: transaksi yang ditolak tidak boleh
muncul. Ini cakupan regresi terenumerasi, bukan ukuran akurasi pada semua bahasa
pengguna di dunia nyata. Bahasa yang belum jelas tetap memerlukan klarifikasi.

Transkrip lengkap: `/tmp/kosku-transaction-simulations.md`; data terstruktur:
`/tmp/kosku-transaction-simulations.json`. Tes tambahan memeriksa periode sewa,
validasi API, konteks listing, WhatsApp tiruan, dan HTTP Playground lokal.
Tidak ada koneksi WhatsApp, panggilan provider AI, atau database produksi.
Fixture regresi pencarian lama sekarang menyebut lelang secara eksplisit;
pencarian tanpa pilihan transaksi diuji terpisah dan harus diklarifikasi.

Restart proses backend untuk memuat versi ini bila dijalankan tanpa watch.
`GET /health` menampilkan `understanding_version`; mulai percakapan Playground
baru untuk mencoba alur dari awal.

### Pesan minat tidak dibalas setelah sapaan

Pada 14 Oktober 2026, proses lokal port 3100 masih menjalankan versi
`2026-10-13-multi-category-v3`, sementara file di workspace sudah versi v4.
Urutan “selamat siang pak” → “saya tertarik beli aset lelang di surabaya pak”
berhasil direproduksi pada proses lama: HTTP 200, `reply: null`,
`suppressed: true`, status `waiting_for_property`. Jadi pesan sengaja dibungkam
oleh kebijakan versi lama, bukan sedang menunggu jawaban AI.

Proses Playground dimuat ulang ke v4 dengan mode watch dan tanpa koneksi
WhatsApp. Gunakan `npm --prefix backend/whatsapp run dev:playground` untuk
pengembangan berikutnya. Kasus persis beserta lima variasi bahasa diuji lewat
WhatsApp tiruan dan sesi Playground: setelah sapaan, bot wajib membalas,
mencatat Surabaya dan pilihan transaksi, lalu menanyakan kawasan dan anggaran.
Alur ini tidak membutuhkan database atau AI.

### Gaya percakapan

Versi v5 memakai kalimat singkat dan sopan, dengan maksimal dua pertanyaan
kualifikasi per giliran. Sapaan “Bapak/Ibu” tidak diulang, transaksi disebut
sebagai bagian kalimat, dan pertanyaan biasa tidak memakai bold. Jawaban
lanjutan tetap menyimpan kriteria yang sudah jelas. Prompt AI mengikuti gaya
yang sama, sementara sapaan tetap memperkenalkan bot sebagai asisten virtual.

Contoh ini sudah diperiksa melalui endpoint Playground lokal pada versi v5:

**User:** saya tertarik beli aset lelang di surabaya pak

**Bot:** Siap, saya bantu cari aset lelang di Surabaya ya.

Incar daerah mana? Kalau fleksibel, seluruh Surabaya juga boleh.
Budget-nya sampai berapa?

### Jawaban bebas dan perubahan jenis mempertahankan lokasi

Versi v6 memperbaiki percakapan Surabaya → lelang di Tandes, budget mentok
Rp350 juta → “intinya tandes” → “semua boleh” → “rumah kalau ada tanah gapapa”.
Sebelumnya “semua boleh” tidak menyelesaikan pertanyaan jenis/luas, kemudian
sisa kata “kalau gapapa” keliru diperlakukan sebagai daerah baru.

Sekarang jawaban kolektif seperti “semua boleh”, “semuanya bebas”, dan
“dua-duanya boleh” hanya berlaku pada pertanyaan preferensi yang sedang
ditampilkan. Jika jenis dan luas ditanyakan bersama, keduanya menjadi bebas;
jika hanya satu yang ditanyakan, kriteria lain tidak ikut dihapus. “Bebas” tanpa
penanda kolektif tetap menjawab pertanyaan pertama. Negasi dan pertanyaan seperti
“nggak semua boleh” atau “semua boleh?” tidak memperluas filter.

Pilihan “rumah kalau ada tanah gapapa” menjadi RUMAH/TANAH. Lokasi Tandes,
Surabaya dan budget Rp350 juta tetap berlaku. Kata penerimaan jenis seperti
“tanah gpp” tidak sekaligus berarti luas tanah bebas. Koreksi di klausa lain,
misalnya “semua boleh, budget jadi 300 juta”, tetap diproses.

Nama administratif tanpa penanda lokasi diverifikasi terhadap direktori;
sisa kata hasil penghapusan jenis properti tidak otomatis menjadi nama tempat.
Nama kawasan informal tetap didukung dengan penanda lokasi, jawaban lokasi,
atau singkatan pencarian langsung seperti “cari rumah Citraland”. Nama desa yang
berbenturan dengan kata umum seperti “bagus” memerlukan penanda lokasi.

Regresi `test/contextual_preferences.test.js` memeriksa profil, filter query
database, variasi bahasa, pembacaan ulang chat lama, serta alur WhatsApp tiruan
dan HTTP Playground. Percakapan lengkap juga diuji pada backend lokal aktif:
“semua boleh” dan perubahan jenis menghasilkan rekomendasi tanpa mengulang
pertanyaan daerah. Pemeriksaan ini membaca listing melalui API terkonfigurasi;
tidak mengirim pesan WhatsApp. Jadwal lelang yang sudah lewat tetap ditandai.

### Perkenalan dan pilihan sapaan

Versi v7 mengundang perkenalan satu kali saat klien membuka dengan sapaan:

**Bot:** Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan
siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?

**User:** Bu Rina pak

**Bot:** Salam kenal, Bu Rina. Lagi cari properti di daerah mana? Kalau sudah ada
aset yang diminati, boleh kirim kode atau link-nya ya.

**User:** saya cari rumah lelang di Surabaya

**Bot:** Siap, Bu Rina. Saya bantu cari rumah lelang di Surabaya ya.

Incar daerah mana? Kalau fleksibel, seluruh Surabaya juga boleh.
Budget-nya sampai berapa?

Sapaan adalah preferensi yang disebut sendiri, bukan atribut gender hasil
tebakan. “Rina aja pak” hanya menetapkan nama Rina; kata “pak” di akhir ditujukan
kepada bot. “Panggil saya Bu Dwi” memperbarui pilihan, sedangkan “panggil Dwi aja”
atau “cukup nama saja” melepas sapaan sebelumnya. Bot tidak mengambil sapaan
dari nama kontak, foto, nama orang lain, atau nama agen pada template listing.

Nama bukan syarat pencarian: permintaan properti langsung diproses meskipun
klien mengabaikan pertanyaan, menjawab “skip dulu”, atau “nggak usah nama”.
Perkenalan dan permintaan properti boleh digabung dalam satu pesan. Bagian
perkenalan dipisahkan sebelum membaca filter lokasi; nama/sapaan tidak dikirim
sebagai kriteria database. Sapaan personal dipakai pada pengakuan awal dan
disediakan sebagai konteks untuk jawaban AI, bukan ditambahkan ke setiap kalimat.

State `client_identity` terpisah per kontak WhatsApp atau percakapan Playground.
Nama dan sapaan bertahan saat riwayat dipangkas atau konteks pencarian idle
direset. Penyimpanan masih di memori: sesi yang dihapus oleh TTL, reset seluruh
state, atau restart proses akan menghapusnya. Ini bukan memori lintas restart.

Regresi `test/client_identity.test.js` mencakup nama saja, pilihan sapaan,
koreksi, penolakan, pesan gabungan, isolasi sesi, dan kedua jalur pengiriman.
Contoh Bu Rina di atas juga diverifikasi melalui backend Playground lokal aktif.

### Memilih nomor dan berkenalan saat pencarian langsung

Versi v8 memberi nomor 1–5 pada rekomendasi, termasuk saat daftar dibagi menjadi
beberapa pesan. “Saya tertarik yang nomor 2 pak”, “nomor dua”, “yang no. 2 aja”,
dan “pilihan ke-2” memilih ID aset kedua dari daftar terakhir. Daftar lama dengan
bullet atau tautan Markdown tetap terbaca. Detail mengambil data publik terbaru;
harga dan status dalam riwayat chat bukan sumber fakta terbaru.

Nomor di luar daftar diklarifikasi, dua pilihan dalam satu pesan diminta
diperjelas, dan nomor jalan, harga, jumlah kamar, serta pilihan yang ditolak
tidak dianggap sebagai nomor rekomendasi. Pertanyaan biaya berikutnya tetap
menggunakan aset yang dipilih. Kode atau link aset eksplisit tetap diutamakan.

Jika klien langsung mencari properti tanpa salam terpisah, ajakan perkenalan
ditambahkan pada balasan klarifikasi pertama. Contoh dari Playground lokal:

**User:** siang pak, saya tertarik dengan aset lelang di daerah manukan apakah ada pak?

**Bot:** Siap, saya bantu cari aset lelang di Manukan. Area Manukan ini di kota
atau kabupaten mana ya?

Tapi sebelum itu, boleh tahu dengan Pak atau Bu siapa saya berbicara? Kalau
lebih nyaman disapa nama saja juga boleh.

**User:** Pak Budi

**Bot:** Siap, Pak Budi. Saya bantu cari aset lelang di Manukan. Area Manukan ini
di kota atau kabupaten mana ya?

**User:** Surabaya pak

**Bot:** Oke, kita cari aset lelang di Manukan, Surabaya.

Di kelurahan mana? Kalau fleksibel, seluruh kawasan Manukan juga boleh.

Perkenalan tidak diulang jika sudah ditanyakan, ditolak, atau nama sudah dikenal.
Pencarian lengkap langsung memberikan rekomendasi. Klien boleh menjawab kriteria
lebih dahulu: “Surabaya”, “seluruh Tandes”, “keduanya”, “seken”, dan “dana satu
miliar” tidak menjadi nama klien setelah pertanyaan gabungan.

Validasi v8 meliputi 588 tes backend serta HTTP Playground lokal aktif. Kalimat
“saya tertarik yang nomor 2 pak” diuji terhadap daftar lama yang dilaporkan dan
membuka ID 119497, Jalan Manukan Lor VII H No.16. Daftar baru juga sudah menampilkan
nomor berurutan. Uji transport WhatsApp memakai pengiriman tiruan; pemeriksaan
Playground membaca listing tanpa mengirim pesan WhatsApp.

# Kondisi aset, biaya pembelian, dan pengajuan survei

WhatsApp dan Playground membaca jenis transaksi serta harga dari listing terbaru.
Riwayat percakapan menyimpan maksud pertanyaan dan ID pilihan, bukan sumber harga.
Bot tidak mengarang kondisi interior yang belum dicatat pada listing.

## Percakapan

- Lelang: viewing mandiri dari luar untuk mengecek eksterior, jalan, dan lingkungan.
  Tidak diperkenankan masuk dan tidak dibuatkan appointment pendampingan.
- Primary/secondary/sewa: bot dapat memandu pengajuan survei bersama agen.
  Akses dan pendampingan masih mengikuti konfirmasi agen serta pemilik/pengelola.
- Kondisi → tawarkan biaya. Setelah rincian biaya lelang, bot menanyakan
  `Dengan estimasi total tersebut, apakah masih sesuai dengan anggaran yang Anda siapkan?`
  Konfirmasi anggaran seperti “oke cocok” langsung menyiapkan draf MOU untuk
  dibaca, memakai alur persiapan pembelian dan pengiriman PDF yang sudah ada.
  Keberatan seperti “terlalu tinggi” menanyakan
  `Baik, kisaran budget total yang Anda siapkan berapa, termasuk biaya pembeliannya?`
  Setelah nominal/rentang tercatat, bot merangkum daerah dan jenis properti dari
  listing asal bersama budget klien, lalu meminta konfirmasi. Jawaban “iya”
  langsung mencari; koreksi seperti “oh saya apartemen saja” langsung mencari
  dengan jenis baru sambil mempertahankan daerah dan budget tersebut.
  Jawaban nominal dibandingkan dengan estimasi total, bukan harga limit, dan
  disimpan terpisah dari batas harga listing untuk pencarian. Kecocokan anggaran
  tidak dianggap persetujuan tanda tangan, pembayaran, atau bukti dana siap.
  Untuk nonlelang, biaya → tawarkan kondisi. Jika keduanya telah dijelaskan,
  lanjut ke survei untuk nonlelang atau pertanyaan klien berikutnya untuk lelang.
- “Boleh”, “nggih”, “gas”, dan jawaban pendek mengikuti pertanyaan terakhir yang
  benar-benar dikirim. Jawaban mengenai MOU atau alamat tidak menghidupkan CTA lama.
- Memilih kode/link lain membaca ulang aset baru dan memisahkan konteks konsultasinya.
  Permintaan survei tanpa pilihan aset meminta klien memilih dahulu.

Contoh bahasa yang diuji: “bangunane piye?”, “iso mlebu ta?”, “all in brp?”,
“nambah piro buat biaya beli?”, “sesuk jam 1 siang”, “besok pukul 10 pagi”, dan
“Sabtu jam sebelas”. Waktu ambigu atau bertentangan diklarifikasi; misalnya
“Sabtu besok” ketika besok sebenarnya Kamis. Semua waktu menggunakan WIB.

Lihat [42 giliran simulasi](simulasi-kondisi-biaya-survei.md). Fixture memakai
Rabu, 21 Oktober 2026, pukul 09.00 WIB dan tidak mengirim pesan nyata.

## Pemahaman jawaban budget

`services/budget_response.js` membaca jawaban sesuai pertanyaan terakhir:
kecocokan estimasi total atau pengumpulan kisaran budget. Aturan lokal menangani
bahasa Indonesia, singkatan, bahasa Jawa, bahasa Inggris, angka, dan emoji yang
jelas. “400–500 juta”, “500”, serta “I have 400 to 500 million” dibaca sebagai
budget total pada fase pengumpulan; “oke” pada fase itu meminta nominal,
bukan mengirim MOU. Rentang dan batas maksimal disimpan pada konsultasi.

Ungkapan lain dapat dibaca oleh `interpretBudget` dari provider yang telah
dikonfigurasi. Permintaan terstruktur hanya memuat pertanyaan terakhir dan
jawaban klien, dibatasi delapan detik, serta memerlukan kutipan persis dan
keyakinan minimal 0,9. Nominal tetap divalidasi parser backend. Bahasa yang
belum dipahami, tafsiran meragukan, kegagalan provider, atau keraguan klien
meminta klarifikasi; tidak dianggap persetujuan MOU. Pertanyaan biaya,
kondisi, minat membeli, pergantian aset, atau pencarian eksplisit tetap
mengikuti alur masing-masing.

Budget total tidak otomatis menjadi batas bidding. Saat alternatif dicari,
`max_total_budget` menyaring harga aset beserta estimasi biaya yang sama
dengan balasan bot; listing dengan limit di bawah budget tetapi total biaya
di atas budget tidak direkomendasikan.

## Kriteria dari link dan koreksi klien

`services/linked_search.js` menyusun usulan dari kelurahan, kecamatan, kota/kabupaten,
dan jenis properti pada listing asal. Wilayah diperiksa pada direktori daerah;
nilai tidak valid seperti kecamatan “Indonesia” diabaikan. Jika kelurahan belum
tercantum, bot menjelaskannya tanpa menebak dari nama gedung atau jalan.
Harga serta luas listing tidak menjadi budget atau minimum luas yang diminta klien.

Sesudah klien menyebut “400–500 juta”, contoh rangkumannya:

> Dari properti yang Anda kirim, saya tangkap Anda mencari apartemen di Kab. Badung,
> dengan budget total Rp 400.000.000–Rp 500.000.000, termasuk biaya pembelian.
> Kelurahan belum tercantum pada listing; Anda bisa menyebutkannya jika ingin
> mempersempit daerah pencarian.
>
> Apakah kriteria ini sudah betul? Jika iya, saya carikan aset yang cocok.

“Bukan” meminta bagian yang perlu dikoreksi dan belum menyimpan kriteria tersebut.
Konfirmasi atau koreksi yang jelas membuka pencarian serta penyimpanan CRM melalui
outbox yang sudah ada. Koreksi berikutnya memperbarui satu klien yang sama,
termasuk JSON kriteria, rentang budget total, jenis properti, wilayah, serta
preferensi luas tanah. Budget total minimum disimpan sebagai preferensi; filter
keterjangkauan memakai batas maksimal termasuk biaya pembelian.

“Oh saya cari minim luasan 100”, “luasan minimal 100”, dan “minimal luas 100 m2”
berarti luas tanah minimal 100 m². Bot langsung mengulang pencarian dengan batas
tersebut sambil mempertahankan kriteria lainnya. Luas bangunan yang disebut secara
eksplisit tidak diam-diam dijadikan luas tanah. Rentang yang bertentangan meminta
klarifikasi sebelum pencarian atau penyimpanan baru.

Jalankan `npm run simulate:linked-search` untuk enam skenario offline melalui
pemroses pesan dan outbox asli, memakai katalog serta receipt CRM tiruan. Untuk
menguji katalog dan penyimpanan database sebenarnya:

```sh
npm run simulate:linked-search -- --database --property=31551 --output=/tmp/kosku-linked-search-database
```

Mode database membaca listing, mencari kandidat, dan memeriksa hasil penyimpanan
klien serta preferensinya dalam satu transaksi uji. Seluruh data klien uji
di-rollback dan kontak uji diperiksa kembali setelahnya. Kedua mode tidak
mengirim WhatsApp atau memanggil AI eksternal. Hasil pencarian nyata boleh kosong;
simulasi tidak mengarang alternatif agar terlihat berhasil.

## Simulasi jawaban budget

Jalankan `npm run simulate:budget` untuk sepuluh skenario offline. Opsi
`--context=/path/proyeksi-publik.json` memakai snapshot proyeksi katalog,
`--output=/path/hasil` memilih direktori transkrip, dan `--pdf` membuat PDF
dengan template serta LibreOffice lokal. Simulasi tidak membaca kredensial
atau memanggil AI, WhatsApp, database, booking, maupun antrean stok nyata.
Uji adapter bahasa lain memakai respons provider tiruan, bukan ukuran
akurasi model produksi pada seluruh bahasa.

## Biaya

Perhitungan lelang tetap menggunakan `auction_cost_policy.js`; yang berubah
hanya ajakan akhir untuk memastikan kecocokan anggaran sebelum melanjutkan konsultasi.

Untuk primary/secondary, cadangan anggaran pembeli mengikuti asumsi operator:
BPHTB 5%, AJB 0,5%, dan notaris 0,5%–1%. Dengan harga Rp1 miliar, tambahan
cadangan Rp60–65 juta dan total anggaran Rp1,060–1,065 miliar. Persentase dihitung
di backend, dibulatkan per komponen, lalu dijumlahkan agar nominal konsisten.

Cadangan BPHTB 5% dari harga bukan tagihan pajak final. Dasar pajak, NPOPTKP,
dan keringanan harus diperiksa sesuai daerah dan kondisi perolehan. Sebagai
rujukan lokal, [Perda Surabaya 7/2023](https://pbb.surabaya.go.id/Content/assets/doc/Perda%20Surabaya%207%20th%202023%20pajak%20retribusi%20daerah.pdf)
mengatur tarif serta pengurang BPHTB. Bot tidak menganggap klien otomatis
memenuhi syarat pengurangan tertentu.

AJB/notaris adalah estimasi anggaran operator, bukan pernyataan tarif wajib.
Honorarium PPAT diatur dalam [PP 24/2016](https://peraturan.bpk.go.id/Download/27324/PP%20Nomor%2024%20Tahun%202016.pdf).
Komponen yang sudah tercakup dalam satu paket tidak ditambahkan dua kali.
Untuk primary, periksa apakah harga developer sudah mencakup PPN/pengurusan;
biaya bank/KPR mengikuti penawaran bank. Sewa memakai harga sesuai periode,
deposit, layanan, dan utilitas; estimasi biaya jual beli tidak diterapkan.

## Penyimpanan dan jadwal

1. Klien menyebut hari/tanggal, jam, dan nama. Nama yang sudah tersimpan digunakan.
   Nomor berasal dari metadata WhatsApp terverifikasi, bukan teks yang diketik klien.
2. Bot mengecek slot agen. Slot satu jam tersedia pada pukul 08, 09, 10, 11,
   13, 14, 15, 16, dan 17 WIB, sampai 92 hari ke depan.
3. Bot menyebut ulang aset, nama, tanggal, dan jam lalu meminta konfirmasi klien.
4. Setelah disetujui, transaksi database menyimpan `booking_survei` berstatus
   `PENDING` dan `Acara` bertipe `SITE_VISIT` pada agen WhatsApp yang melayani.
   `Acara` memakai `SCHEDULED` untuk memblokir slot; pendampingan belum dianggap final.
5. Balasan baru menyebut “tersimpan” setelah mendapat receipt API yang cocok.
   Notifikasi dashboard dikirim setelah commit. Playground memakai mock dan
   menampilkan label simulasi tanpa menyimpan booking sungguhan.

Booking tidak menaruh ID CRM pada kolom `BookingSurvei.id_klien`, karena kolom
tersebut merujuk akun `Pengguna`. Jika kontak ditemukan di CRM, referensinya
dicatat pada `Acara.id_klien_ref`.

`chatbot_request_id` unik menyatukan retry dengan pengajuan yang sama. State
`submitting/retry/booked` serta ID tersebut disimpan di SQLite sebelum/selesai
memanggil API, sehingga timeout atau restart tidak membuat pengajuan ganda.
Penguncian transaksi per agen dan pengecekan overlap melindungi bentrokan
antara chat dan formulir website. Kalender yang dibatalkan tidak memblokir slot.
Pembatalan setelah booking sudah tersimpan diteruskan ke agen; bot tidak
mengklaim telah membatalkan atau menjadwal ulang tanpa penyimpanan yang sesuai.

## Konfigurasi dan verifikasi

Endpoint baru `POST /api/internal/chatbot/surveys` memakai `CHATBOT_CLIENT_TOKEN`
yang sama dengan penyimpanan CRM. Backend menyusun URL dari `CLIENT_API_URL`.
Identitas agen diteruskan dari koneksi WhatsApp; caller tidak bisa mengirim
status booking, ID akun pengguna, atau ID acara sendiri.

Migrasi tambahan: `prisma/migration_chatbot_survei.sql`. Kolom boleh null,
sehingga formulir survei website tetap dapat digunakan. Terapkan migrasi di
setiap database deployment sebelum menggunakan booking dari bot.

```sh
# Dari root repository: uji API, konflik jadwal, dan formulir website
node --test scripts/test-chatbot-surveys.cjs scripts/test-property-contact.cjs

# Verifikasi database nyata; seluruh booking/acara uji di-rollback
node scripts/verify-chatbot-surveys-db.cjs

# Opsional saat menerapkan kolom/index pada database target
node scripts/verify-chatbot-surveys-db.cjs --apply

# Simulasi lewat MessageProcessor, tanpa WhatsApp/database nyata
npm --prefix backend/whatsapp run simulate:consultation
```

Verifikasi database tidak memanggil API, Pusher, maupun WhatsApp. Uji ini
memeriksa write/read booking dan agenda, retry idempoten, konflik slot, dan
ketiadaan data fixture setelah rollback.

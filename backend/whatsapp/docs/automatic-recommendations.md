# Rekomendasi aset otomatis dan pemeriksaan pagi

Klien dengan preferensi CRM yang menyebut area dan budget maksimal akan dikabari
melalui WhatsApp agen pemiliknya ketika ada listing baru yang cocok. Mulai pukul
08.00 WIB setiap hari, stok yang sudah ada juga dicocokkan kembali dengan
preferensi tersimpan untuk menemukan aset yang belum pernah dikirim. Berlaku pada
Baileys dan koneksi agen `/agents/AG…`; koneksi operator tidak dipakai untuk
mewakili agen. Aktif otomatis jika `CLIENT_API_URL` dan `CHATBOT_CLIENT_TOKEN`
telah dikonfigurasi. `AUTO_RECOMMENDATIONS=0` mematikan layanan secara global.
Token yang sama harus tersedia pada aplikasi Next.js. Tidak perlu migrasi tabel
Postgres baru; histori terkirim menggunakan `kiriman_rekomendasi` yang ada.

Di halaman **Integrasi WhatsApp → Rekomendasi aset otomatis**, agen dapat menjeda
atau mengaktifkan pengiriman serta melihat antrean, waktu pemeriksaan dan jumlah
aset terkirim. Pengaturan disimpan pada volume autentikasi, bertahan setelah restart.
Klien dapat mengetik **berhenti rekomendasi** dan **aktifkan rekomendasi**; keputusan
ini tersimpan per agen dan nomor, termasuk saat percakapan sedang dijeda.

## Perilaku

- Setiap menit, maksimal 200 listing baru per agen diproses; backlog dilanjutkan
  pada menit berikutnya. Pemindaian pertama menyimpan ID listing terakhir sebagai
  titik awal untuk pemindai listing baru. Pemindai pagi terpisah memeriksa stok
  lama sesuai kriteria; stok lama tidak diklaim sebagai listing yang baru masuk.
- Listing memakai PK `id_property` autoincrement. Perubahan harga, perubahan status
  tidak dianggap listing baru. Preferensi baru/perubahan preferensi dan stok
  lama diperiksa pada putaran pagi berikutnya. Import yang secara eksplisit
  memakai ID di bawah cursor juga dapat ditemukan oleh pemindai pagi.
- Putaran pagi memakai WIB secara eksplisit, menyimpan cursor klien dan hasil
  pencocokan secara atomik, serta melanjutkan pekerjaan setelah restart. Jika
  server mati pukul 08.00, putaran dikejar saat server kembali aktif pada
  08.00–20.00 WIB. Pemindaian berlangsung bertahap, bukan satu query seluruh stok
  untuk setiap menit. WhatsApp yang offline tetap menahan pengiriman.
- Semua gerbang di `klienMatch.ts` berlaku: jenis, maksud/transaksi, area, budget,
  luas tanah, sertifikat, bentuk tanah/bangunan, patokan dan status tersedia.
  Tidak ada toleransi budget atau luas. Properti terkirim, ditolak, milik klien,
  klien closing/lost, dan lelang tanpa tanggal atau lebih dari satu bulan sejak
  tanggal lelang dilewati. Batas satu bulan memakai bulan kalender dan tanggal
  WIB secara inklusif: pemeriksaan 21 Oktober menerima sejak 21 September.
  Jadwal yang sudah lewat tetapi masih dalam batas ini diberi tanggal dan
  keterangan bahwa stok serta jadwal ulang perlu dikonfirmasi.
- Preferensi yang ditulis bot sekarang menyimpan setiap alternatif area dan
  sertifikat. Syarat bebas seperti nol jalan, hitung tanah atau rute antarmarkah
  yang belum bisa diverifikasi dari kolom listing ditahan untuk pemeriksaan agen,
  alih-alih dianggap pasti cocok. Preferensi manual tetap dikelola agen.
- Empat aset per pesan jika tersedia (lebih sedikit bila memang hanya itu yang cocok), satu pesan per nomor per 24 jam, 08.00–20.00 WIB.
  Batas ini juga berlaku jika dua kartu klien memakai nomor yang sama. Antrean
  yang belum terkirim kedaluwarsa tujuh hari dan diperiksa ulang sebelum kirim.
- Pengiriman menunggu WhatsApp terhubung dan bot aktif untuk kontak tersebut.
  Kontak internal/stoker, nomor WhatsApp pengirim sendiri, percakapan aktif dalam
  sepuluh menit terakhir dan proses closing tidak mendapat pesan otomatis.
  Pengecualian kontak internal hanya untuk satu nomor uji klien yang diizinkan
  secara eksplisit melalui `BOT_TEST_CLIENT_PHONE`. Nomor pengirim sendiri tetap
  tidak boleh menjadi penerima. Pengecualian berlaku juga pada balasan klien uji.
- Isi pesan berasal dari data publik, menyapa nama klien, menampilkan harga
  (harga limit untuk lelang), lokasi, LT/LB, URL dengan kode agen pengirim, ajakan
  survei dan nama agen. Tidak ada generasi fakta/harga oleh LLM.
- Balasan “nomor 2” merujuk daftar yang dikirim, termasuk setelah restart dan
  saat WhatsApp menggunakan alias LID. Pengiriman tidak memalsukan waktu chat
  klien atau mengaktifkan ulang percakapan yang sedang ditangani manusia.
- Kriteria CRM ikut disimpan sebagai memori pencarian, termasuk pilihan area,
  budget dan batas luas. “Ada yang lain?” membuka sampai empat alternatif baru,
  memakai kriteria yang sama dan mengecualikan ID yang telah ditawarkan. Nomor
  pilihan selalu mengacu daftar terakhir. Jika tidak ada alternatif lagi, bot
  meminta arahan sebelum memperluas area/budget/luas. Link detail tetap memakai
  kode agen pengirim.

## Ketahanan pengiriman

`recommendations.sqlite` di sebelah berkas autentikasi menyimpan cursor, pasangan
klien/aset, pengaturan, pilihan berhenti dan bukti kiriman. Simpan seluruh folder
`.auth` pada volume persisten; jangan berbagi sesi yang sama antarproses aktif.
Cursor dan kandidat dicatat dalam satu transaksi. Deduplikasi unik pada
`(agent,client,property)` mencegah kiriman ulang saat restart/pemindaian ulang.
Kiriman yang sudah diterima nomor yang sama juga tidak diulang melalui kartu
klien CRM lain pada hari berikutnya. Cadangan harga yang memuat pecahan rupiah
tetap dicocokkan dari nilai asli; pembulatan hanya dilakukan saat ditampilkan
dan dicatat pada snapshot pesan.

Panel menampilkan status koneksi WhatsApp, jadwal pagi berikutnya, jumlah klien
yang diperiksa dan yang memiliki aset memenuhi syarat. Status logout tidak
ditampilkan seolah layanan siap mengirim. Lelang yang sudah lewat tidak
diklaim masih bisa diikuti; yang lebih dari satu bulan dilewati sepenuhnya.
Aturan yang sama berlaku untuk pencarian aset CRM, hasil pencarian chatbot,
dan pemeriksaan terakhir kiriman manual dari CRM/email.

Sebelum menyentuh WhatsApp, status `sending` disimpan. Jika proses mati atau
transport melaporkan hasil tidak pasti, kiriman menjadi `uncertain`, tidak diulang.
Panel menyediakan **Periksa chat**, **Sudah terkirim** dan **Lewati kiriman**.
Pilih hasil setelah memeriksa WhatsApp; kedua tindakan tersebut tidak mengirim
pesan baru. Tindakan ini mengakhiri penahanan nomor tersebut.

Setelah WhatsApp menerima pesan, tanda terima bertanda tangan HMAC dikirim ke
endpoint internal untuk mencatat snapshot harga dan status pada CRM. ACK dapat
diulang tanpa mengirim ulang pesan. Status ini membuktikan transport menerima
pesan, bukan bukti bahwa klien sudah membaca pesan. Isi pesan dan tanda terima
dihapus dari antrean sesudah pencatatan CRM selesai; ID deduplikasi tetap disimpan.

## Validasi tanpa menghubungi klien

```
node --test scripts/test-chatbot-recommendations.cjs
cd backend/whatsapp
node --test test/new_property_notifications.test.js
node --test test/notification_followups.test.js
node scripts/simulate-notification-followups.js
```

Endpoint internal `POST /api/internal/chatbot/recommendations` hanya menerima
token `CHATBOT_CLIENT_TOKEN` dan aksi tetap `initialize`, `scan`, `daily`,
`prepare`, `acknowledge`. Empat aksi pertama hanya membaca database. Jangan memanggil ACK
untuk draf yang belum benar-benar dikirim. Playground tidak menjalankan worker.

Transkrip hasil eksekusi tersimpan di
[simulasi-rekomendasi-otomatis.md](simulasi-rekomendasi-otomatis.md).

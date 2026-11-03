# Pemasaran perusahaan

Menu OWNER aktif: **Dashboard → Pemasaran**. Mulai dalam keadaan jeda.
Submenu **Campaign** mengatur periode, filter dan pilihan aset Worth-it Investor,
intensitas harian serta jam tayang, tanpa AI. Jadwal ditinjau sebelum diterapkan ke Planner. Riwayat kiriman berada di
**Planner → Riwayat konten dan pengiriman**. Lihat [Campaign](./campaigns.md).
Submenu **Instagram** menyediakan perpustakaan akun langsung, analitik per konten,
balasan/moderasi komentar, dan hapus media sesuai izin Meta. Lihat
[Pengelolaan konten Instagram](./instagram-content.md) untuk fungsi dan batasnya.
Pengaturan awal adalah tiga aset BELI berbeda per hari, pukul 09.00, 13.00,
dan 18.00 Asia/Jakarta; Worth-it memakai mesin dan ambang 25% Investor,
dengan jeda tujuh hari per identitas aset.

Konfigurasi lokal yang terverifikasi pada 28 Oktober 2026 WIB memakai
**Facebook Login** (`INSTAGRAM_LOGIN_MODE=facebook`). Profil dan kuota publikasi
`@solusindopremier` berhasil dibaca; credential berumur panjang telah disimpan
terenkripsi dan dashboard menampilkan Terhubung. Otomatisasi tetap dijeda.
[Konfigurasi Facebook Login dan pemeliharaan](./instagram-facebook-login-test.md)
menjelaskan mode ini. Unified Login tetap menjadi mode bawaan bila variabel
tersebut tidak diatur; contoh Configuration ID di bawah berlaku untuk mode itu.

## Persiapan server

1. Jalankan `npx prisma generate` dan `npm run db:marketing` pada deployment.
   Migrasi menambah tabel Pemasaran; tidak mengubah data listing.
   `node scripts/install-marketing.cjs` melakukan uji rollback tanpa menyimpan.
2. Isi konfigurasi berikut di environment server Next.js:

   ```dotenv
   MARKETING_PUBLIC_ORIGIN=https://solusindoaset.com
   MARKETING_ENCRYPTION_KEY=<32 byte acak dalam base64>
   META_APP_ID=<App ID dari Meta App settings → Basic>
   META_APP_SECRET=<App Secret dari halaman Basic yang sama>
   INSTAGRAM_CONFIG_ID=<Configuration ID Unified Login>
   INSTAGRAM_API_VERSION=v26.0
   # Opsional jika beberapa akun Instagram dibagikan:
   # INSTAGRAM_ACCOUNT_ID=<ID akun Instagram perusahaan>
   CRON_SECRET=<secret cron yang sudah digunakan aplikasi>
   WHATSAPP_BACKEND_URL=http://127.0.0.1:3100
   WHATSAPP_BACKEND_TOKEN=<ADMIN_API_TOKEN backend WhatsApp>
   ```

   Buat kunci enkripsi satu kali, misalnya dengan
   `node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64"))'`.
   Simpan kunci bersama secret deployment dan backup. Mengganti/menghilangkannya
   membuat token yang tersimpan tidak bisa dibuka; akun perlu dihubungkan ulang.
   Nilai contoh di atas harus disesuaikan dengan deployment.

3. Daftarkan callback OAuth pada aplikasi Meta:
   `https://<domain-publik>/api/dashboard/pemasaran/instagram/callback`.
   Gunakan **Instagram API → API setup with Unified login** dan konfigurasi
   berlabel **Instagram Login Compatible**. Pertahankan izin wajib
   `instagram_basic` dan `instagram_manage_messages`; aktifkan juga
   `instagram_content_publish`, `instagram_manage_comments`, serta
   `instagram_manage_insights`. Akun harus Business/Creator dan dibagikan dari
   portofolio bisnis yang dipilih saat login.
4. Direktori `uploads/marketing` harus persisten dan dapat ditulis oleh proses
   Next.js. Untuk beberapa instance, gunakan volume bersama yang sama.
   Media diakses Meta melalui URL bertanda tangan, berlaku 48 jam; endpoint
   admin untuk pratinjau tetap memerlukan sesi OWNER aktif.
5. Restart Next.js dan backend WhatsApp setelah deployment. Jalankan server
   produksi lewat `node server.js` agar scheduler berjalan. `next dev` dan
   `next start` sendiri tidak menjalankan scheduler aplikasi.

Backend Baileys memakai sesi perusahaan terpusat yang sama dengan integrasi
Chatbot (AG108). Bukti Status dan kontak tersinkron tersimpan dalam
`marketing-status.sqlite` di direktori sesi tersebut. Tidak ada koneksi WA baru
yang dibuat oleh menu Pemasaran.

## Aktivasi

1. Buka Pengaturan; isi nama dan nomor WhatsApp perusahaan.
2. Hubungkan Instagram melalui tombol Hubungkan. Token disimpan dengan
   AES-256-GCM; OAuth state diperiksa dan callback memerlukan OWNER aktif.
   Tombol **Hubungkan Instagram** di bagian atas memulai login jika konfigurasi
   siap. Gunakan domain HTTPS yang terdaftar; dari localhost, tombol membuka
   domain itu terlebih dahulu agar sesi OWNER dan cookie OAuth tetap sesuai.
   Kegagalan login ditampilkan pada kartu koneksi tanpa membocorkan data rahasia.
3. Atur wilayah, kategori/jenis, harga, ambang, jeda, dan jadwal; simpan.
4. Buat pratinjau. Feed 1080×1350 dan Status 1080×1920 memakai foto asli,
   renderer poster bersama, Plus Jakarta Sans lokal, dan palet katalog Solusindo.
   Carousel selalu dimulai dengan poster, diikuti 1–3 foto detail dari listing
   yang sama, termasuk foto pertama aslinya (total 2–4 slide, semuanya 4:5).
   Status WhatsApp mengirim satu poster 9:16. Caption memuat pembuka sesuai jenis
   properti, judul listing, spesifikasi yang tersedia, harga/limit, jadwal lelang,
   tautan detail absolut, kode properti dan kontak perusahaan. QR dibuat lokal
   menuju tautan yang sama. Data yang tidak tersedia tidak ditambahkan.
5. Jika memakai WA, hubungkan sesi perusahaan melalui menu Chatbot, pilih
   audiens Status, simpan, dan kirim uji ke satu nomor yang Anda tentukan.
   Periksa tampilannya dari ponsel kontak uji. Kanal WA memerlukan bukti
   penerimaan uji pada akun WA yang sedang terhubung.
6. Aktifkan. Instagram juga memerlukan pemeriksaan bahwa media pratinjau benar
   dapat diambil dari domain HTTPS publik yang dikonfigurasi.

Konfirmasi aktivasi berlaku untuk jadwal tersimpan; publikasi berikutnya tidak
memerlukan persetujuan per posting. Tombol Jeda menghentikan kiriman berikutnya.

## Pertama kali menghubungkan Instagram

Jika belum punya aplikasi Meta, ini perlu disiapkan sebelum tombol Hubungkan
dapat digunakan. Menu **Siapkan Instagram** menampilkan lima pemeriksaan
konfigurasi server tanpa menampilkan nilai secret.

1. Pastikan akun Instagram perusahaan sudah Business atau Creator. Akun pribadi
   dapat diubah ke akun profesional melalui pengaturan Instagram.
2. Buka [Meta for Developers](https://developers.facebook.com/apps/) dan buat
   aplikasi untuk Instagram API yang dimiliki portofolio bisnis. Pilih
   **API setup with Unified login**. Buat/pilih konfigurasi dengan variasi
   **General**, token **System-user access token (SUAT)**, masa berlaku
   **Never**, dan aset **Instagram account**. Akun iklan opsional; aplikasi
   Pemasaran saat ini menerbitkan konten organik, bukan iklan berbayar.
3. Ambil **Meta App ID** dan **App Secret** dari **App settings → Basic**.
   Isi `META_APP_ID`, `META_APP_SECRET`, dan `INSTAGRAM_CONFIG_ID` pada
   environment server (`.env.local` untuk lokal). Configuration ID berasal
   dari konfigurasi Unified Login yang dipilih. Instagram App ID/Secret dari
   jalur legacy tidak dipakai untuk pertukaran kode Unified Login.
   Simpan secret langsung pada server; jangan mengirimkannya melalui chat.
4. Aplikasi harus tersedia melalui domain HTTPS. Isi `MARKETING_PUBLIC_ORIGIN`
   dengan origin domain itu, tanpa path. Daftarkan alamat berikut sebagai OAuth
   **Redirect URL** pada konfigurasi Unified Login:

   ```text
   https://<domain-anda>/api/dashboard/pemasaran/instagram/callback
   ```

   Placeholder `<domain-anda>` harus diganti. Domain harus menuju deployment
   yang menjalankan menu ini; domain pada redirect URI harus sama dengan
   `MARKETING_PUBLIC_ORIGIN`.

5. Pastikan `MARKETING_ENCRYPTION_KEY` sudah berisi kunci 32 byte dalam base64.
   Jangan mengganti kunci jika token sudah tersimpan; pulihkan kunci aslinya.
6. Melalui **Edit permissions**, pastikan `instagram_manage_insights` sudah
   ditambahkan; izin ini tidak ada pada konfigurasi bawaan Meta. Pertahankan
   izin basic/pesan yang diwajibkan konfigurasi dan aktifkan publikasi serta
   komentar. Untuk aplikasi dalam pengujian, beri akun penguji akses/peran
   yang diminta Meta dan terima undangan Instagram Tester dari akun tersebut.
   Akses akun di luar peran penguji mengikuti persyaratan app access/review Meta.
7. Restart aplikasi setelah mengubah environment. Buka domain HTTPS tersebut,
   masuk sebagai OWNER aktif, lalu buka **Pemasaran → Pengaturan → Hubungkan**.
   Selesaikan login Instagram atau Facebook. Pilih portofolio bisnis yang
   memiliki akun perusahaan, lalu bagikan hanya akun Instagram perusahaan.
   Jika beberapa akun dibagikan, server memerlukan `INSTAGRAM_ACCOUNT_ID`
   agar akun penerbitan tidak dipilih secara sembarang. Akun pada halaman
   kedua dan berikutnya tetap dapat dipilih melalui ID ini.

Tombol dashboard membangun URL `facebook.com/dialog/oauth` dengan Meta App ID,
Configuration ID, redirect URI, `response_type=code`, `prompt=login`, dan state
acak untuk setiap sesi. Placeholder `<STATE>` dalam URL contoh Meta bukan
state yang boleh ditempel tetap. Izin ditentukan oleh konfigurasi, sehingga
URL tidak mengirim scope legacy. Callback menukar kode melalui server dengan
`graph.facebook.com/v26.0/oauth/access_token`. Server memeriksa token, app ID,
izin publikasi/komentar/insights, portofolio dari `/me?fields=client_business_id`,
dan akun dari `/me/assigned_instagram_accounts` sebelum menyimpan koneksi.

Penemuan akun juga membaca target `instagram_basic` dari `granular_scopes`
hasil inspeksi token. Jika daftar assignment kosong, server dapat membaca edge
dengan system-user ID yang eksplisit, lalu mencoba ulang daftar satu kali.
Profil langsung dibaca melalui `id,username`, lalu diverifikasi dengan endpoint
Instagram `content_publishing_limit`. Field `ig_id` dari referensi Graph lama
tidak dipakai pada API profil saat ini. Target untuk Page, iklan, atau bisnis
tidak diperlakukan sebagai akun Instagram. Target
granular untuk publikasi, komentar, dan insights tetap membatasi akun yang
dapat dipilih, termasuk saat ada koneksi lama pada portofolio yang sama.
Jika `INSTAGRAM_ACCOUNT_ID` diatur dan izin tidak memiliki pembatas target akun,
server dapat memeriksa ID perusahaan itu langsung. Fallback ini hanya diterima
setelah profil Instagram dan akses baca `content_publishing_limit` berhasil;
menentukan ID tidak melewati pemeriksaan akses Meta atau membuat posting.
Log kegagalan hanya berisi jumlah kandidat, langkah pembacaan, tipe token yang
diizinkan, kode/subkode numerik, dan klasifikasi statis kesalahan penyedia bila
tersedia. Pesan penyedia diklasifikasikan dalam memori lalu dibuang.
Token, kode OAuth, respons mentah, dan identitas akun
tidak dicetak. Daftar akun yang kosong tidak langsung dianggap bukti bahwa
pengguna belum memilih akun pada layar persetujuan.

Jika token dan portofolio valid tetapi penemuan akun gagal, server mempertahankan
otorisasi itu dalam memori proses selama maksimal 15 menit. Payload dienkripsi,
terikat pada App ID, Configuration ID, ID akun yang dikonfigurasi, dan portofolio;
masa berlaku token yang lebih pendek tetap membatasi sesi ini. Sesi dibuang saat
kedaluwarsa, proses berhenti, konfigurasi berubah, atau token dinyatakan tidak
valid. Sesi ini memakai prefix berbeda dan tidak dapat dipakai worker sebagai
koneksi penerbitan. Koneksi lama tetap dipertahankan sampai semua pemeriksaan
pengganti berhasil.

Endpoint internal `GET /api/dashboard/pemasaran/instagram/diagnostics` hanya
melaporkan ketersediaan sesi. `POST` dengan JSON `{"action":"inspect"}` membaca
izin token, assignment melalui `me` dan system-user ID, identitas, profil, serta
kuota publikasi secara terpisah. Respons hanya untuk OWNER aktif, tidak di-cache,
dan tidak memuat token, ciphertext, kode OAuth, atau pesan mentah Meta. ID bisnis
dan system user tersedia hanya dalam respons diagnosis privat untuk mencocokkan
aset pada pengaturan Meta. Diagnosis juga membandingkan header Bearer dengan
parameter token pada tiga permintaan baca yang sama seperti contoh Meta, dan
mengembalikan trace ID penyedia yang formatnya telah dibatasi untuk penelusuran
dukungan. URL permintaan dan credential tidak dicetak. Pembanding ini tidak
mengubah transport koneksi utama atau mencoba ulang publikasi.
Pembacaan pembanding melalui `node:https` melewati helper Graph dan `fetch`
Next.js, memakai host resmi `graph.facebook.com/v26.0`, serta membandingkan
profil dengan/tanpa appsecret proof. Dua permintaan baca tambahan membandingkan
profil dan daftar assignment pada v25.0 tanpa mengubah versi API koneksi utama.
Hanya GET dengan tujuan tetap; redirect
tidak diikuti, durasi maksimal 25 detik, ukuran respons maksimal 128 KiB.
Hasil tetap dibatasi ke status HTTP, jumlah akun, kecocokan profil, kode error,
dan trace ID. Pembanding ini membantu memisahkan penolakan API dari kesalahan
transport/parsing website. Persetujuan bisnis di Meta belum dianggap koneksi
dashboard yang dapat dipakai sampai profil akun benar-benar dapat dibaca.
`POST` dengan `{"action":"retry"}` memeriksa ulang
otorisasi yang sama dan hanya menyimpan koneksi setelah seluruh validasi lolos;
tidak menukar kode OAuth lagi, memperpanjang token, atau menerbitkan konten.
Kedua aksi POST memerlukan origin yang sesuai. Fasilitas diagnosis ini berlaku
untuk satu proses server; pada deployment dengan beberapa instance, sesi dapat
tidak tersedia pada instance lain dan koneksi utama tetap tersimpan di database.

Untuk membandingkan token pengujian dari **API setup with Unified login →
Generate access tokens**, simpan sementara `INSTAGRAM_DIAGNOSTIC_ACCESS_TOKEN`
di `.env.local`, lalu jalankan `npm run diagnose:instagram`. Perintah operator ini
hanya melakukan GET ke host resmi, memeriksa kecocokan Meta App ID, dan
membandingkan akses profil pada host Facebook dan Instagram. Token yang
dihasilkan setup berbeda dapat memiliki tipe/host berbeda; hasil baca tersebut
tidak otomatis menjadi koneksi Unified Login. Token tidak dicetak, tidak
disimpan dalam koneksi, dan tidak dipakai untuk menerbitkan konten. Hapus baris
token diagnostik dari `.env.local` setelah pemeriksaan selesai.

Token, client business ID, account ID, Meta App ID, dan Configuration ID
disimpan dalam envelope AES-256-GCM versi `meta-unified-v1` pada `tokenCipher`.
Ini tidak memerlukan perubahan skema database. SUAT yang benar-benar tidak
kedaluwarsa disimpan dengan `expiresAt=null`; masa berlaku positif dari
inspeksi token tetap dihormati. Tidak menggunakan refresh token Instagram
60 hari. Token yang dicabut atau kedaluwarsa memerlukan koneksi ulang.
Token legacy dipertahankan sampai pertukaran baru berhasil, tetapi tidak
dipakai pada Graph host baru. Pergantian akun/portofolio menjeda otomatisasi
dalam transaksi penyimpanan koneksi yang sama. Respons pemeriksaan koneksi
hanya berisi status, username, dan waktu kedaluwarsa; credential tetap di server.

Menu Pemasaran mengambil metrik publikasi, termasuk jumlah komentar, melalui
polling. Callback OAuth di atas memiliki fungsi terpisah dari webhook.

### Penerima webhook Instagram

Endpoint publik `GET/POST /api/pemasaran/instagram/webhook` menerima challenge
dan notifikasi Meta. Isi **Configure webhooks → Callback URL** dengan origin
HTTPS publik ditambah path tersebut. Isi **Verify token** dengan nilai
`INSTAGRAM_WEBHOOK_VERIFY_TOKEN` dari environment server, bukan access token.
Verify token minimal 32 karakter; instalasi lokal membuat nilai acak 32 byte.
Kolom client certificate tetap nonaktif kecuali mTLS memang dipasang tersendiri.

GET memeriksa mode, token, dan challenge lalu mengembalikan challenge sebagai
teks. POST memeriksa `X-Hub-Signature-256` terhadap byte asli menggunakan
`META_APP_SECRET` sebelum memproses JSON. Body maksimal 2 MiB dan 1000 event,
dengan batas baca 10 detik. Tanda tangan salah ditolak 401. Event akun lain
diakui tanpa menyimpan isinya; contoh Test dari Meta dapat memakai ID akun
berbeda sehingga tidak masuk inbox perusahaan.

Payload akun perusahaan disimpan terenkripsi AES-256-GCM pada
`marketing_instagram_webhook_events`. Notifikasi identik (termasuk waktu
provider) memiliki satu record dengan penghitung pengiriman ulang. Database
harus berhasil menyimpan sebelum server membalas 200; kegagalan penyimpanan
menghasilkan 503 agar Meta mencoba lagi. Event diberi masa simpan 30 hari dan
dibersihkan pada penerimaan berikutnya maupun tick cron Pemasaran. Migrasi
bersifat tambahan dan dapat dipasang dengan `npm run db:marketing`; tidak
memerlukan restart untuk regenerasi Prisma karena akses tabel memakai SQL
berparameter. Inbox webhook ini belum menyediakan UI DM atau balasan otomatis.
Moderasi dan balasan komentar manual tersedia melalui tab Instagram; tab
tersebut membaca komentar terbaru langsung melalui API.

Status privat `GET /api/dashboard/pemasaran/instagram/webhook` hanya untuk OWNER.
Respons berisi URL callback, jumlah event, serta waktu challenge dan delivery;
tidak memuat verify token atau payload. Waktu tersebut juga bisa berasal dari
simulasi teknis dan tidak membuktikan aplikasi sudah Published atau field Meta
sudah terdaftar. Status webhook tidak mengubah status koneksi Instagram.

Meta membatasi pendaftaran webhook Instagram ke Dasbor Aplikasi; endpoint
umum App Subscriptions tidak mendukung konfigurasi Instagram. Setelah callback
diverifikasi, pilih field sesuai kebutuhan pada halaman Meta. Untuk mulai
menerima notifikasi akun asli, aplikasi perlu Published/Live dan izin yang
sesuai. Setelah koneksi akun dapat dibaca, OWNER dapat memanggil
`POST /api/dashboard/pemasaran/instagram/webhook` dengan JSON
`{"action":"subscribe","fields":["comments"]}` dan origin yang sama untuk
mendaftarkan akun pada `/INSTAGRAM_ACCOUNT_ID/subscribed_apps`. Operasi ini
memerlukan koneksi aktif, token SYSTEM_USER valid dan izin sesuai field;
token diagnosis yang gagal membaca profil tidak digunakan. Registrasi callback
tingkat aplikasi dan subscription tingkat akun merupakan dua langkah terpisah.

Validasi: `npm run test:marketing`, `node scripts/verify-instagram-webhook-db.cjs`
dan `node scripts/verify-instagram-webhook-http.cjs`. Dua pemeriksaan terakhir
memakai database/alamat HTTPS yang dikonfigurasi. Uji DB menghapus record QA
setelah selesai; uji HTTP mencatat challenge dan delivery sintetis dengan akun
contoh yang diabaikan. Panduan pengisian dan bahan review:
[Instagram App Review](./instagram-app-review.md).

Alternatif penemuan akun melalui Facebook Page dapat diuji secara terpisah
dengan Facebook User Access Token. Panduan dan pemeriksaan baca saja tersedia
di [Uji Facebook Login](./instagram-facebook-login-test.md). Persiapan diagnosis
awal tidak mengganti mode aktif. Setelah token USER terbukti dapat membaca
profil dan kuota publikasi pada 28 Oktober 2026 WIB, konfigurasi lokal beralih
ke `INSTAGRAM_LOGIN_MODE=facebook` dan koneksi terenkripsi berhasil disimpan.
Lihat panduan tersebut untuk envelope credential, expiry, serta batas fitur
webhook Page yang belum diaktifkan. Mode default tanpa variabel tetap Unified.

Login yang dimulai di `localhost` tidak dapat membawa cookie state/sesi ke
domain HTTPS lain. Saat dibuka dari origin berbeda, menu mengarahkan Anda untuk
membuka domain HTTPS yang benar terlebih dahulu. Menghubungkan akun tidak
mengaktifkan otomatisasi.

Panduan resmi: [Instagram API with Unified Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started),
[token dan autentikasi](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication),
dan [izin](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions).

## Perilaku antrean

- Ranking dihitung atas seluruh scope sebelum pemilihan batch. Foto diambil
  dari referensi asli database, bukan URL proxy galeri browser.
- Sebelum mengirim, baca ulang status, harga/promo/limit, luas, alamat, foto,
  kategori, serta jadwal lelang dari listing publik. Valuasi yang tertinggal
  dari perubahan sumber tidak boleh menghasilkan iklan dengan harga lama.
- Aset tidak layak diganti kandidat berikutnya sebelum ada kanal yang terbit.
  Jika salah satu kanal sudah terbit, perubahan sumber membatalkan kanal
  berikutnya untuk aset tersebut.
- Tidak ada pelonggaran kriteria untuk memenuhi kuota. Slot tanpa kandidat
  atau foto valid dilewati dengan alasan yang terlihat.
- Worker memiliki lease PostgreSQL, heartbeat, dan pemeriksaan kepemilikan
  sebelum pengiriman. ID slot unik; hasil masing-masing kanal dicatat terpisah.
- Kegagalan eksplisit yang dapat diulang diberi maksimal tiga percobaan.
  Hasil pengiriman ambigu menjadi “Perlu diperiksa”, tanpa kirim ulang.
  Tombol Periksa pengiriman hanya mencari bukti penerbitan yang sudah ada.
- Slot yang tertinggal lebih dari dua menit saat layanan mati dilewati.
  Slot selama pemadaman beberapa hari juga dicatat dari pemeriksaan terakhir.
  Pekerjaan yang telah berjalan dibatasi satu jam dari jadwal; tidak ada
  ledakan kiriman untuk mengejar backlog lama.
- Persiapan materi dibatasi empat menit per usaha. Data kontak WA yang tidak
  diperbarui selama 90 hari dibuang; pergantian akun membersihkan pilihan kontak
  tersinkron pada backend dan tidak mewarisi kelulusan uji akun sebelumnya.

Endpoint scheduler eksternal: `POST /api/cron/pemasaran`, header
`Authorization: Bearer <CRON_SECRET>`, sekali per menit. Rahasiakan header.
OAuth menggunakan token exchange server-ke-server sesuai API Meta; URL token,
respons token, dan credential tidak dicetak pada log atau dikirim ke browser.

## Analitik dan batas data

Instagram: views, reach, likes, comments, saved, shares, dan komentar dengan
username/waktu jika tersedia. Tidak menyediakan daftar lengkap pemberi like
atau penonton. Metrik tidak tersedia disimpan sebagai null, bukan nol.

Sinkronisasi otomatis menargetkan 30 menit untuk posting Instagram hingga 30
hari; maksimal empat publikasi diperbarui setiap tick. Permintaan metrik
digabung, dengan fallback terpisah bila metrik tidak didukung. Rate limit dan
kegagalan layanan dapat menunda pembaruan; waktu pembaruan terakhir ditampilkan.
Posting lama dapat diperbarui manual.

WA: penerbitan melalui Baileys merupakan jalur tidak resmi. Hanya receipt
penonton, reaksi, dan balasan yang benar-benar diterima yang dihitung. Bukti
tersimpan setelah restart, dengan deduplikasi event. Setelah 24 jam tampilkan
data terakhir. Privasi kontak/read receipts dan dukungan WA dapat membuat data
tidak lengkap. Isi balasan dan daftar penonton tidak disimpan; partisipan event
dihash untuk penghitungan. Balasan Status tidak masuk sebagai prompt chatbot.

## Verifikasi

- `npm run test:marketing`: jadwal WIB, validasi, OR Investor, enkripsi, akses,
  pemilihan setelah halaman pertama, cooldown, perubahan sumber, kegagalan
  sebagian, hasil ambigu, dan kontrak metrik/API Instagram dengan provider tiruan.
- `node scripts/verify-marketing-db.cjs`: lease atomik, konflik revisi, metrik
  kosong, dan jeda tujuh hari sejak terbit sebenarnya. Fixture antrean di-rollback.
- Backend: `node --test test/marketing_status.test.js test/baileys.test.js`
  dari `backend/whatsapp`; tidak mengirim WhatsApp sungguhan.
- `node scripts/verify-marketing-browser.mjs`: Chrome lokal, sesi OWNER QA,
  tampilan desktop/320px, dialog dan perubahan belum disimpan. Tidak menyimpan
  data contoh, mengaktifkan otomatisasi, atau menghubungkan layanan eksternal.
- Build terisolasi:
  `NEXT_BUILD_DIR=.next-marketing node node_modules/next/dist/bin/next build`.
  Ini melindungi output server pengembangan yang sedang aktif.

Keberhasilan tes provider tiruan tidak membuktikan penerbitan live. OAuth Meta,
akses media publik, dan uji ke kontak WA yang dipilih harus diselesaikan pada
deployment sebelum aktivasi.

Referensi integrasi: [Instagram API Meta](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
dan [Baileys: broadcast dan stories](https://github.com/WhiskeySockets/Baileys#broadcast-lists--stories).

## Planner konten

Menu dibuka pada **Planner**. Kalender bulanan menampilkan materi yang sudah
tersimpan dan slot otomatis yang belum dipilih asetnya. Pilih tanggal untuk
melihat jam, kanal, status dan materi setiap slot. Di ponsel, kalender memakai
penanda ringkas dan daftar konten berada di bawahnya. Periode campaign yang sudah
diterapkan menampilkan jam campaign dan menahan slot otomatis reguler; pengaturan
draf belum mengubah kalender.

- Gunakan **Siapkan materi** pada jam yang dipilih untuk membuat rencana nyata
  dari ranking Investor. Rencana tersimpan di slot tersebut dan dapat dibuka
  kembali lewat **Lihat materi**. Ini tidak menghubungkan akun atau menerbitkan
  konten; otomatisasi tetap mengikuti status aktif/jeda di Pengaturan.
- Penyiapan mendukung jadwal tersimpan hingga 90 hari ke depan. Lelang harus
  masih berlangsung setelah waktu publikasi yang dipilih. Kelayakan dan harga
  tetap diperiksa lagi saat pengiriman.
- Jeda aset memperhitungkan tanggal target dan rencana lain di sekitarnya.
  Rencana jauh di masa depan tidak mengunci aset sepanjang seluruh horizon.
- Riwayat masa lalu hanya berasal dari pekerjaan tersimpan, bukan slot buatan.
- Bulan dan tanggal tersimpan pada URL. Tombol panah keyboard berpindah sehari
  atau seminggu pada kalender. **Hari ini** kembali ke tanggal WIB saat ini.
- **Planner → Riwayat konten dan pengiriman** menampilkan hasil per kanal. **Analitik** memakai
  seluruh data bulan yang dipilih, terpisah dari halaman antrean, dengan
  ringkasan dan grafik views berdasarkan tanggal konten. Grafik tidak mengklaim
  trafik harian; metrik kosong tetap “Belum tersedia”.

`node scripts/verify-marketing-browser.mjs` memeriksa planner, izin, navigasi,
analitik, dialog dan empat lebar layar. Secara default tidak menyiapkan rencana
baru. Opsi `MARKETING_QA_PREPARE=1` membuat paling banyak satu rencana dari aset
nyata untuk tanggal berikutnya, hanya ketika otomatisasi dijeda; tidak membuat
publikasi atau mengirim WhatsApp.

# Pengaturan rencana per konten

Setiap slot yang belum dicoba dikirim dapat diatur dari Planner: properti
otomatis atau pilihan manual, subset kanal Instagram/Status WA yang aktif,
serta tanggal/jam WIB mendatang hingga 90 hari. Pilihan disimpan pada JSONB
`marketing_jobs.plan`; jalankan kembali installer Pemasaran untuk menambah
kolom ini secara aditif, lalu generate Prisma dan restart aplikasi.

`GET /api/dashboard/pemasaran?mode=candidates&when=...&query=...&offset=...&job=...`
mengambil pilihan properti dengan ranking Investor, cooldown dan kelayakan
sesuai tanggal. `POST action=configure-plan` menerima plan dengan sumber slot,
jadwal baru, ID properti/null, kanal, serta ID/waktu pembaruan slot untuk
kontrol konflik. Keduanya tetap OWNER aktif; write memeriksa Origin.

Simpan rencana tidak mengirim atau mengaktifkan otomatisasi. Materi disiapkan
terpisah atau oleh worker sebelum jadwal. Pilihan manual mengunci identitas
properti, bukan kelayakannya: jika tidak lagi layak, slot tidak dialihkan ke
aset lain. Pemindahan waktu menyimpan penanda RESCHEDULED pada slot asal dalam
transaksi yang sama agar proyeksi/scheduler tidak membuat unggahan ganda.
Riwayat yang sudah dicoba dikirim tidak dapat diedit. Pengaturan global tidak
menghapus rencana manual, dan global pause/penonaktifan kanal tetap berlaku.

Verifikasi editor: `node scripts/verify-marketing-plan-browser.mjs` pada server
lokal dengan otomatisasi dijeda. Uji menggunakan satu properti nyata pada
slot jauh di masa depan, tidak menerbitkan konten, dan membersihkan rencana
uji setelah pemeriksaan.

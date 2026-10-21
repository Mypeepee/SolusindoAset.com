Perbaikan lokal selesai pada 22 Oktober 2026 (WIB).

Database yang dipakai aplikasi: PostgreSQL 18, database `solusindoaset`,
`127.0.0.1:5432`. Seluruh 57 model Prisma telah diperiksa. Tidak ada tabel,
kolom, atau nilai enum yang dibutuhkan model yang masih hilang.

Migrasi yang diterapkan:

- `migration_berita_workspace.sql`
- `migration_chatbot_klien_funnel.sql`
- `migration_chatbot_preferensi_sync.sql`
- `migration_chatbot_survei.sql`
- `migration_listing_pembersihan.sql`
- `migration_surat_debitur_care.sql`
- `migration_project_investor_pembayaran_sebagian.sql`
- `migration_harga_efektif.sql`
- `migration_lelang_harga_efektif.sql`

Foreign key `rekomendasi_disingkirkan` diselaraskan dengan skema dalam transaksi.
Default kedaluwarsa `property_titip` dipertahankan 48 jam. Perbandingan Prisma
terakhir hanya menyebut indeks khusus mesin urut, tabel backup lama yang memang
dipertahankan, dan perbedaan penulisan default interval yang setara. Tidak ada
perintah DROP TABLE atau DROP COLUMN yang diterapkan. Total 185.526 listing
tetap tersedia, seluruh harga efektif konsisten dan trigger pengisi harga aktif.

Backup logis sebelum perubahan berhasil dibuat dan daftar isinya diperiksa.
Lokasinya `.local-backups/2026-10-21T16-56-24-801Z/database.dump`.
Salinan fisik sebelum pemulihan berada di subfolder `postgres-original` pada
direktori backup yang sama. Semua 1.808 file salinan fisik diverifikasi SHA-256
terhadap sumber sebelum PostgreSQL dijalankan dari lokasi baru.

Saat backfill harga pertama, koneksi PostgreSQL terputus dan layanan berhenti.
Pemeriksaan menunjukkan drive C tidak memiliki ruang kosong. Transaksi harga
tidak ter-commit. Data dipindahkan dengan penyalinan terverifikasi ke
`D:\PostgreSQL\18\data`, lalu PostgreSQL dipulihkan dan migrasi harga diulang
hingga sukses. Konfigurasi di direktori PostgreSQL lama menunjuk ke lokasi data
baru. Akun Windows NETWORK SERVICE diberi akses ke lokasi baru agar layanan
PostgreSQL tetap dapat memakai data tersebut.

Layanan PostgreSQL saat ini berjalan sebagai proses lokal yang dimulai melalui
`pg_ctl`; memulai Windows Service memerlukan hak administrator. Startup aplikasi
dapat memulai database ini kembali memakai `.runtime/postgres.json` bila port
5432 belum tersedia. Jangan menjalankan salinan database lama sebagai server lain.

Penghapusan penyimpanan lama di C ditolak pemeriksaan otomatis. Salinan tersebut
tetap dipertahankan. Percobaan kompresi tidak menambah ruang kosong yang berarti;
drive C masih penuh. Database aktif dan seluruh log aplikasi memakai drive D.

Backend memakai Node.js 24.22.1 portable dari situs resmi Node.js, dengan checksum
paket diverifikasi. Node.js global 20 tetap digunakan website. Dependensi backend
terpasang dan lockfile diperbarui agar paket opsional yang hilang ikut tercatat.
Konfigurasi website dan bot disiapkan pada file environment yang diabaikan Git;
token admin/properti/klien dibuat terpisah. Kunci Gemini yang sudah tersedia
dipakai dengan model `gemini-2.5-flash`, yang berhasil menjawab probe nyata.

`npm start` dan konfigurasi PM2 sekarang menjalankan website dan chatbot bersama.
Pemeriksaan database baca-saja berjalan sebelum startup. Untuk pemeriksaan manual,
gunakan `npm run db:check`. Petunjuk operasional ada di `OPERASIONAL-CHATBOT.md`.

Hasil verifikasi:

- Website lokal dan endpoint sesi website publik merespons HTTP 200.
- Backend `/health` merespons HTTP 200.
- Audit 57 model, enum, harga dan trigger lulus.
- 38 tes integrasi otorisasi/dashboard/klien/survei/percakapan lulus.
- Uji transaksi klien, preferensi dan survei terhadap database nyata lulus;
  seluruh data uji di-rollback.
- Pencarian melalui API nyata menghasilkan lima properti yang memenuhi kriteria;
  pemulihan timeout dan HTTP 503 juga lulus.
- Probe dashboard memakai sesi Owner lokal, membaca properti nyata, dan menerima
  jawaban detail serta konsultasi dari backend. Tidak mengirim WhatsApp.
- Probe transport AI nyata menghasilkan JSON tervalidasi dari Gemini.
- Pemeriksaan sintaks script dan `git diff --check` lulus.

Suite backend penuh: 1.154 dari 1.168 tes lulus. Sepuluh kegagalan berkaitan
dengan asumsi izin POSIX atau urutan menutup SQLite sebelum menghapus file pada
Windows. Empat kegagalan lain adalah perbedaan ekspektasi `purchase_preparation`
versus `clarify` pada alur MOU yang sudah tercatat sebelum perbaikan ini di
`backend/whatsapp/docs/smart-search.md`. Dua tes root tambahan juga gagal karena
loader pengujian mengasumsikan pemisah path `/` pada Windows. Log lengkap backend
berada di `.service-logs/backend-tests.log`. Tidak ada perubahan perilaku alur MOU
yang dibuat dalam perbaikan database/runtime ini.

WhatsApp AG108 sudah menyediakan QR, tetapi belum terhubung karena pengguna
belum melakukan pemindaian. Buka Dashboard -> Chatbot Integration dan pindai QR
dengan WhatsApp -> Perangkat tertaut. Status ini tidak menghalangi Playground.
Tidak ada pesan WhatsApp nyata yang dikirim selama pengujian.

Lanjutan pada 22 Oktober 2026: permintaan pairing dari akun Owner melalui
domain publik awalnya gagal HTTP 403 walaupun GET status berhasil HTTP 200.
Penyebabnya perbandingan langsung Origin browser dengan URL internal Next.js.
Endpoint WhatsApp, percakapan dan konfirmasi stok sekarang memakai helper
validasi origin yang sama dengan Playground. Hak Owner dan autentikasi backend
tetap diberlakukan; origin asing dan header forwarding palsu tetap ditolak.

Perbaikan lulus 21 tes regresi, build produksi berhasil, dan build baru sudah
dipasang. Pemeriksaan nyata melalui `https://solusindoaset.com` membuktikan
POST koneksi berhasil HTTP 202, tampilan QR merespons HTTP 200, dan permintaan
pairing mencapai validasi nomor. Probe ini tidak meminta kode untuk nomor nyata.
Pemeriksaan dapat diulang dengan `CHATBOT_CHECK_ORIGIN` menunjuk domain publik
dan `node scripts/verify-chatbot-live.cjs --pairing-only`.

Pemeriksaan percakapan menemukan kuota harian free tier Gemini 2.5 Flash habis.
Model cadangan `gemini-3.5-flash-lite` tersedia dengan kunci yang sama dan telah
dikonfigurasi melalui `LLM_FALLBACK_MODEL`. Transport AI nyata berhasil memakai
fallback serta menghasilkan JSON tervalidasi. Uji lengkap dashboard, pairing,
pembacaan properti dan percakapan melalui domain publik kembali lulus. Akun
WhatsApp masih menunggu pemindaian QR atau penautan dengan nomor oleh pengguna.

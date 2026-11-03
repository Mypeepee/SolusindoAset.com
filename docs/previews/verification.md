# Pemasaran dan email pengingat campaign · 1 November 2026 WIB

- Menu OWNER memakai urutan Dashboard → Pemasaran → Tugas pada kedua sidebar.
  Ikon `volume-loud-linear` Solar berasal dari paket terpasang dan dibundel lokal.
- Pengingat memakai campaign `running` dan periode yang sudah diterapkan.
  Mulai 08.00 WIB pada H-1, masing-masing penerima mendapatkan satu email untuk
  setiap campaign/tanggal akhir. Tombol membawa tujuan Campaign melewati login.
- `node --test scripts/test-campaign-reminders.cjs`: **8 lulus**; mencakup WIB,
  tanggal berganti, draf/jeda, duplikasi, periode baru, kegagalan per penerima,
  respons SMTP ambigu, HTML escaping, deep link dan keamanan tujuan login.
- `node scripts/verify-campaign-reminders-db.cjs`: **lulus**, menggunakan
  transaksi PostgreSQL nyata dengan fixture yang di-rollback dan SMTP mock.
- `node scripts/preview-campaign-reminder.cjs --render`: **lulus** pada lebar
  800, 390, dan 320px; tidak ada overflow horizontal. Screenshot diperiksa.
- Komponen sidebar asli diperiksa terpisah di Chrome pada 1024/390px dengan
  seluruh jaringan diblokir dan sesi OWNER/routing stub. Ikon Solar, urutan
  menu, dan Escape pada ponsel lulus; tidak ada error JavaScript. Bukti ada di
  `campaign-menu-component-verification.json` dan screenshot terkait.
- Prisma schema validate/generate, migrasi aditif tabel reminder, formatter
  file baru, dan audit UI strict Pemasaran lulus. Audit ada di
  `campaign-reminder-ui-audit.json`. Lint DESIGN.md: nol error, tiga peringatan
  token lama. Typecheck terfokus hanya melaporkan dua error autentikasi lama
  di `src/app/api/auth/[...nextauth]/authOptions.ts:366`.
- Percobaan suite Pemasaran penuh menghasilkan 144/159 lulus. Lima belas tes
  pada worker/penyiapan terkait perubahan workspace lain gagal karena mock
  tidak menyediakan `marketingJob.findMany` yang dipakai `marketedAssetKeys`.
  Hasil ini tidak dinyatakan lulus.
- Build produksi dan browser aplikasi penuh belum selesai diverifikasi:
  kompilasi lokal sangat lambat dan percobaan navigasi browser mencapai batas
  waktu. Pemeriksaan komponen menu terpisah serta renderer email lulus seperti
  dicatat di atas; hasil tersebut tidak menggantikan build aplikasi penuh.
- Contoh berlabel **[PRATINJAU]** diterima Gmail SMTP untuk
  `closingsystem@gmail.com` dan `jasoncliendo@gmail.com`. Contoh memakai data
  yang jelas ditandai sebagai contoh, tanpa mengubah campaign atau Planner.

`campaign-reminder.html` dan screenshot memakai renderer yang sama dengan email
produksi. Teks alternatif tersedia di `campaign-reminder.txt`. Pengiriman contoh
tidak mengaktifkan publikasi sosial. Perubahan aplikasi perlu dijalankan melalui
versi server yang memuat kode ini; jadwal produksi tetap memakai cron yang ada.

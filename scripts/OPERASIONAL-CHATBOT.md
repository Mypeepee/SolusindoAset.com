Website dan backend WhatsApp dijalankan bersama dengan `npm start` dari folder
utama. Launcher `Jalankan-Website.bat` dan konfigurasi PM2 memakai startup yang
sama. `npm run start:website` hanya menjalankan website untuk diagnosis.

Startup memeriksa BUILD_ID, manifest dan berkas server produksi. Jika build
hilang atau tidak lengkap, `npm start` membangun ulang secara otomatis sebelum
memulai layanan. `npm run build` menyiapkan hasil di direktori sementara, lalu
mengganti `.next` sesudah validasi; build lama disimpan di `.local-backups`.
Hentikan proses website sebelum melakukan build ulang. Proses build yang gagal
tidak menghapus build sebelumnya.

`npm run dev` memakai port 3001 dan direktori `.next-dev`. Development tidak
menimpa `.next` yang digunakan produksi pada port 3000.

Startup memeriksa semua tabel, kolom dan enum yang dibutuhkan Prisma, serta
konsistensi harga dan trigger. Periksa tanpa menjalankan layanan dengan
`npm run db:check`. Pemeriksaan ini tidak mengubah database. Migrasi SQL tetap
harus diterapkan sesuai hasil audit; hindari reset database produksi.

Backend membutuhkan Node.js minimal 22.13. Startup memakai runtime lokal dari
`.runtime/node-path.txt`, atau `CHATBOT_NODE_EXECUTABLE`, atau Node.js saat ini.
Runtime lokal dan konfigurasi rahasia tidak disimpan ke Git. Di server lain,
siapkan Node.js yang sesuai, jalankan `npm ci` di `backend/whatsapp`, lalu isi
`backend/whatsapp/.env` dan koneksi website di `.env.local` sesuai dokumentasi
`backend/whatsapp/docs/property-database.md`. Token admin, properti dan klien
harus terpisah dan cocok pada kedua layanan.

Pada perbaikan lokal Oktober 2026, PostgreSQL 18 dipindahkan ke
`D:\PostgreSQL\18\data` karena drive C penuh. Konfigurasi PostgreSQL yang lama
menunjuk ke direktori data baru. `.runtime/postgres.json` memungkinkan launcher
memulai PostgreSQL lokal bila port belum tersedia. Launcher tidak menghentikan
database saat website ditutup. Backup logis dan salinan fisik sebelum pemindahan
tersimpan di `.local-backups`; lokasi backup terakhir ada di
`.local-backups/latest.txt`.

Setelah startup, `http://127.0.0.1:3100/health` harus merespons HTTP 200.
`whatsapp_connected: false` berarti proses bot hidup dan belum terhubung ke
WhatsApp. Buka Dashboard -> Chatbot Integration, tekan hubungkan, lalu pindai QR
dari menu Perangkat tertaut di ponsel. Playground tidak memerlukan pairing.

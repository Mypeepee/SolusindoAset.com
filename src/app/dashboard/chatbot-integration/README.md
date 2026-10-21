# Chatbot Integration

Implementasi React + TypeScript + Tailwind CSS yang dipasang di `/dashboard/chatbot-integration`. Menu desktop dan mobile berasal dari `../components/list-menu.tsx`.

## Wireframe

```text
DESKTOP (1024 px+)
┌────────────────────────────────┬───────────────────┐
│ WhatsApp Connection            │ Jarvis Mode       │
│ Judul + nomor + live pulse     │ Ringkasan aktivitas│
│ [Hubungkan / Uji koneksi]      │ Estimasi waktu    │
│ [Putuskan Koneksi]             │ [Lihat perhatian] │
├────────────┬────────────┬───────┴─────┬─────────────┤
│ Masuk      │ Balasan    │ Waktu       │ Rasio balas │
│ Sparkline  │ Sparkline  │ ≈ Estimasi  │ Radial      │
├────────────┴────────────┴─────────────┴─────────────┤
│ Membutuhkan perhatian agent · filter + tindakan    │
├────────────────────────────────────────────────────┤
│ Antrean pengecekan aset                            │
│ ▸ Penyimpanan klien otomatis                       │
│ ▸ Panduan uji koneksi                              │
└────────────────────────────────────────────────────┘
```

Pada 320 px semuanya bertumpuk satu kolom; metrik menjadi dua kolom mulai
480 px dan empat kolom mulai 1024 px. Hero dan insight berdampingan mulai
1024 px. Di bawah 640 px, ilustrasi ponsel menjadi dekorasi samar di latar
sisi kanan tanpa mengambil tinggi tambahan; label ilustrasi disembunyikan,
dan dekorasi tidak menerima klik. Mulai 640 px, ilustrasi kembali menjadi
elemen di samping konten sesuai ruang tersedia. Tombol utama setinggi
48 px, kontrol percakapan minimal 44 px, dan dialog mengikuti lebar viewport.
Halaman langsung dimulai dari koneksi WhatsApp, tanpa header tambahan.
Modal QR memakai panduan di kiri dan QR di kanan mulai 640 px, dengan
lebar maksimal 720 px dan jarak vertikal ringkas. Pada layar kecil, isi
bertumpuk dan scroll tetap tersedia jika dibutuhkan.

## Jarvis dan kebenaran data

Ikon petir ditempatkan di kiri judul dan subjudul agar pembuka lebih ringkas.
Tiga ikon berlabel menjelaskan fungsi nyata: menjawab pertanyaan, mengenali
kebutuhan prospek, dan mengalihkan percakapan ke agent. Ringkasan aktivitas
dan tindakan perhatian tetap berada sebelum penjelasan fungsi. Kartu Jarvis
mengikuti tinggi isinya sendiri; catatan estimasi langsung di bawah fungsi,
tanpa spacer. Saat belum ada pesan, ringkasan menampilkan panduan singkat
untuk memulai. Kartu **Kesiapan Asisten** terpisah di bawah Jarvis melengkapi
kolom kanan sehingga bagian bawahnya sejajar dengan kartu WhatsApp.

- Ringkasan memakai angka nyata dari layanan WhatsApp. Periode pesan adalah
  **sejak layanan dimulai**, bukan statistik harian. Tidak ada angka demo
  dalam UI produksi.
- Waktu yang terbantu adalah **estimasi 2 menit per balasan**, dengan asumsi
  ditampilkan langsung. Ini bukan pengukuran produktivitas aktual.
- Sparkline menyimpan maksimal 20 sampel saat halaman terbuka. Grafik baru
  digambar setelah dua sampel tersedia; saat penghitung direset, seri diulang.
  Riwayat sampel tidak disimpan ke storage browser.
- Radial menampilkan rasio volume balasan terkirim terhadap pesan masuk,
  bukan persentase kontak yang sudah dibalas atau closing. Nilai dapat
  melebihi 100% jika satu pesan memicu beberapa balasan; cincin dibatasi
  100% dan angka/penjelasannya tetap ditampilkan utuh.
- Backend menghitung total dan kebutuhan perhatian sebelum membatasi daftar
  ke 100 kontak. Percakapan dengan bot dijeda ditempatkan pertama.
- Jarvis dan daftar percakapan menggunakan satu controller/polling setiap
  5 detik saat tab terlihat. Error menonaktifkan klaim status terkini.

## Kesiapan Asisten

Kartu hanya menampilkan status, tanpa tombol atau link Playground.

- **WhatsApp** memakai hasil pemeriksaan koneksi; status layanan yang gagal
  dibaca ditampilkan sebagai belum terverifikasi, bukan terputus atau aktif.
- **Layanan bot** memakai boolean `bot_accepting` dari proses penerima pesan
  backend. `true` berarti proses menerima pesan baru, `false` tidak aktif,
  dan nilai yang belum tersedia tetap belum terverifikasi. Ini bukan probe
  terhadap provider AI atau jaminan setiap balasan akan berhasil.
- **Penyimpanan prospek** baru hijau dengan label **Uji lulus** ketika layanan
  dikonfigurasi, CRM dapat dibaca, probe terakhir lulus, tidak ada antrean,
  dan pembaruan status tidak gagal. Konfigurasi tanpa probe ditandai belum
  diuji; retry, antrean, uji gagal, dan data yang tidak terbaca ditandai terpisah.

`useClientCapture` berbagi satu sumber data dan polling 30 detik antara kartu
ringkas dan panel detail penyimpanan. Memperluas panel tidak memicu request
ganda. Semua pemeriksaan otomatis hanya GET; probe tulis hanya berjalan
ketika pengguna memilih **Uji penyimpanan** di panel detail. Hasil lama tidak
ditampilkan sebagai kesiapan terkini setelah pembaruan gagal. Backend perlu
memuat ulang perubahan agar field `bot_accepting` tersedia; backend lama
akan ditampilkan sebagai belum terverifikasi.

## Alur pengalaman

1. Hanya Owner aktif dapat membuka halaman dan API. Owner mengelola integrasi pusat AG108; jabatan dan status diperiksa langsung dari database setiap permintaan.
2. **Hubungkan WhatsApp** membuka modal. Tiga langkah: buka WhatsApp, pilih Perangkat tertaut, scan QR. QR diperbarui otomatis; tidak ada URL backend atau token yang perlu disalin agent.
3. Alternatif **Gunakan nomor telepon** memakai prefix tetap **+62** dan input nomor nasional tanpa angka 0 di awal. Input hanya menerima digit; nomor yang ditempel dengan awalan `0` atau `+62` dinormalisasi otomatis. Tombol **Dapatkan kode** aktif setelah nomor valid, dan API menerima nomor lengkap `628…`. Kode yang muncul dikonfirmasi di aplikasi WhatsApp.
4. Status berubah menjadi **Terhubung** hanya setelah backend menerima koneksi WhatsApp yang berhasil. Modal menampilkan konfirmasi dan nomor; halaman menampilkan metrik nyata.
5. Jika sesi dicabut, **Hubungkan kembali** menjelaskan penghapusan konteks sementara sebelum agent memilih **Pasangkan ulang**. Kegagalan layanan tidak ditampilkan sebagai koneksi aktif.
6. **Uji koneksi** membuka panduan pengujian menggunakan nomor WhatsApp lain. Halaman tidak mengirim pesan percobaan secara otomatis.
7. **Putuskan Koneksi** membuka dialog dengan fokus awal pada **Tetap terhubung**. Logout hanya dikirim setelah konfirmasi; dialog tetap terbuka ketika proses gagal. Backend menolak logout saat percakapan/pengecekan masih berjalan, mencabut sesi perangkat, menghentikan socket dan reconnect, lalu menghapus kredensial lokal. Menghubungkan kembali memerlukan pairing baru. CRM dan pesan di ponsel tetap tersedia.
8. Daftar **Kendali percakapan** menunjukkan alasan jeda, jam bot kembali aktif, dan pesan yang menunggu. Balasan manual biasa memberi jeda lima menit; `#bot on/off` dapat digunakan dari WhatsApp. Aktivasi dari dashboard menyelaraskan semua alias nomor/LID dan melanjutkan pesan tertunda. Nomor internal tidak masuk hitungan perhatian atau memiliki tombol aktivasi. Data yang belum berhasil dimuat tidak ditampilkan sebagai angka nol. Lihat [panduan kendali](../../../../backend/whatsapp/docs/conversation-control.md).

## Aturan visual

| Elemen | Aturan |
| --- | --- |
| Warna utama | Emerald `#6EE7B7` untuk CTA, nomor terhubung, dan keberhasilan |
| Latar | `#050608`; kartu onyx `#0C0E10`; hero `#13201A` → `#0B0E0C` |
| Aksen | Amber khusus proses pairing/peringatan; slate untuk elemen sekunder |
| Radius | Kartu utama/modal 24 px; metrik 16 px; tombol/input 12 px |
| Spacing | Skala 4/8 px; padding kartu 24–32 px; jarak section 24–32 px |
| Tipografi | Mewarisi DM Sans bawaan dashboard, termasuk portal modal; angka 30–34 px; isi 12–14 px |
| Shadow | Bayangan gelap lembut; highlight inset 1 px; glow mint hanya pada CTA/hero |
| Motion | Framer Motion spring untuk hover; fade/slide 200–350 ms; pulse hanya transform/opacity; menghormati reduced motion |
| Aksesibilitas | Status berbentuk teks, focus ring, focus trap, Escape, pengembalian fokus, area sentuh 44–48 px |

## File implementasi

- `page.tsx`: halaman Next.js dan metadata.
- `components/ChatbotIntegration.tsx`: shell halaman dan susunan modul.
- `components/AssistantReadiness.tsx`: status kesiapan WhatsApp, proses bot, dan penyimpanan prospek.
- `components/useClientCapture.ts`: polling dan probe yang dipakai bersama panel ringkas dan detail.
- `components/WhatsAppConnection.tsx`: hero, status global, QR/pairing code, konfirmasi disconnect.
- `components/JarvisAnalytics.tsx`: insight, sparkline SVG, estimasi waktu, radial rasio balasan.
- `components/ConversationControls.tsx` dan `useConversations.ts`: daftar prioritas dan kontrol bot bersama.
- `components/integration-ui.ts`: token tombol dengan focus ring dan ukuran sentuh.
- `components/useWhatsAppConnection.ts`: polling, pembatalan request, aksi koneksi, dan error handling.
- `components/integration.module.css`: animasi terisolasi.
- `src/lib/chatbot/types.ts`: kontrak data.
- `src/app/api/dashboard/chatbot/whatsapp/route.ts`: penghubung server yang memeriksa login, status agent dari DB, dan asal request.
- `backend/whatsapp/services/agent_connections.js`: sesi Baileys, penyimpanan auth dan konteks percakapan terpisah per agent.

Dependensi UI sudah tersedia di proyek: React, Tailwind CSS, Framer Motion, `lucide-react`, dan `@radix-ui/react-dialog`. Dialog mengikuti [pola aksesibilitas Radix](https://www.radix-ui.com/primitives/docs/components/dialog). Autentikasi server memakai [getServerSession NextAuth](https://next-auth.js.org/configuration/nextjs).

## Menjalankan

Konfigurasi **server Next.js** (`.env.local` untuk pengembangan, environment deployment untuk produksi):

```dotenv
WHATSAPP_BACKEND_URL=http://127.0.0.1:3100
WHATSAPP_BACKEND_TOKEN=<nilai ADMIN_API_TOKEN dari backend WhatsApp>
```

Jangan gunakan prefix `NEXT_PUBLIC_`. Nilai ini tidak dikirim ke browser. Konfigurasi lokal telah dihubungkan saat implementasi. Pada deployment terpisah, URL harus menuju layanan backend privat yang dapat dijangkau server Next.js.

Jalankan layanan di `backend/whatsapp` dengan `npm start`, lalu aplikasi Next.js dengan `npm run dev`. Login sebagai Owner aktif dan buka **Chatbot Integration**. Tidak perlu mengakses halaman koneksi teknis. Backend harus tetap hidup dan volume `.auth` harus persisten.

Sesi dashboard disimpan di `.auth/agents/AG…/session.sqlite`; sesi pengujian lama `/connect` tetap terpisah. Sesi dashboard yang tersimpan dimuat lagi saat backend dimulai. Jalankan satu instance backend untuk satu volume SQLite; batas default 50 sesi (`MAX_AGENT_CONNECTIONS`). Fitur simpan klien menggunakan migrasi tambahan `prisma/migration_chatbot_klien_funnel.sql` dan kolom `chatbot_*` pada tabel `klien`.

Metrik pesan dihitung sejak proses backend terakhir dimulai, bukan statistik harian. Konteks percakapan dan handover masih berada di memori sebagaimana backend awal; restart meresetnya. Katalog aset perlu diisi dengan data terverifikasi sebelum asisten dapat menyajikan estimasi ROI spesifik aset.

## Verifikasi

Bagian **Perlu cek status lelang** menampilkan permintaan prospek integrasi
pusat AG108 ketika aset masih Tersedia tetapi jadwalnya lewat. Antrean tersimpan
persisten di SQLite backend, diperbarui setiap 30 detik saat halaman terlihat,
dan tidak diisi oleh percakapan Playground. Setelah status/jadwal listing
dikonfirmasi, pilih hasil **masih tersedia**, **sudah terjual**, atau **stok belum
pasti** dan isi sumber konfirmasi untuk hasil pasti, lalu pilih **Tandai selesai**.
Hasil tersedia/terjual menentukan tindak lanjut bot pada pesan prospek berikutnya;
menutup tanpa kepastian tidak membuka tahap DP. Hasil berlaku 24 jam untuk kode,
ronde lelang, dan tenant yang sama. Tetap perbarui listing secara terpisah.
Aksi ini tidak mengirim pesan proaktif. Backend tidak menghubungi KPKNL otomatis.

Sekarang antrean juga mengirim SOP konfirmasi stok ke WhatsApp stoker
`+62 822-6610-0102` melalui akun WhatsApp agent. Status kirim ditampilkan pada
setiap permintaan. Saat belum tersambung, pengiriman dicoba lagi otomatis;
timeout yang ambigu perlu diperiksa di WhatsApp sebelum **Coba kirim lagi**.
Beberapa klien untuk aset/jadwal sama berbagi satu pesan ke stoker. Balasan
stoker ditindaklanjuti manusia, lalu listing diperbarui dan catatan ditutup.
Lihat [ketentuan pengiriman dan pemulihan](../../../../backend/whatsapp/README.md#konfirmasi-stok-otomatis-ke-stoker).

UI berada di `components/AssetCheckQueue.tsx`, dengan BFF terautentikasi
`src/app/api/dashboard/chatbot/checks/route.ts`. Akses diperiksa dari sesi dan role Owner di DB; tujuan integrasi ditetapkan ke AG108 di server; kontak prospek/antrean agent lain tidak tersedia melalui AI.

`npm test` di `backend/whatsapp` mencakup routing agent, isolasi penyimpanan/QR, autentikasi, pairing, handover, dan provider AI. Pengujian UI menggunakan preview terisolasi dengan respons tiruan; keberhasilan UI tidak berarti nomor WhatsApp nyata sudah dipasangkan.

## Funnel ke CRM

Setelah kriteria lengkap, percakapan WhatsApp nyata menyimpan kontak dan funnel otomatis ke klien AG108. Nomor diambil dari metadata WhatsApp, bukan teks yang diketik. Klien lama dikenali berdasarkan nomor; revisi budget/area memperbarui data yang sama. CRM menampilkan **Kebutuhan dari WhatsApp**. Playground tidak membuat klien.

Konfigurasi server: `CHATBOT_CLIENT_TOKEN` pada Next.js dan backend harus sama; backend memakai `CLIENT_API_URL` ke `/api/internal/chatbot/clients`. Token tulis ini terpisah dari token admin dan properti. Antrean penyimpanan persisten ada pada volume `.auth`. Lihat [dokumentasi backend](../../../../backend/whatsapp/README.md#penyimpanan-otomatis-klien-whatsapp).

## Memeriksa penyimpanan sebelum WhatsApp ditautkan

Panel **Penyimpanan klien otomatis** menampilkan jumlah klien chatbot yang benar-benar dibaca dari tabel `klien` milik AG108, antrean belum tersimpan, serta antrean yang menunggu retry. Nilai yang tidak dapat diperiksa ditampilkan sebagai “—”. Nomor terakhir disamarkan dan tautan CRM hanya ditampilkan untuk pemilik data AG108.

Tombol **Uji penyimpanan** dapat digunakan tanpa koneksi WhatsApp. Alurnya melewati BFF Owner → backend WhatsApp → endpoint internal yang dikonfigurasi dengan token tulis, lalu memakai fungsi penyimpanan produksi untuk membuat, membaca, dan memperbarui satu klien sintetis dalam transaksi yang selalu dibatalkan. Setelah rollback, ID klien uji diperiksa kembali agar bukti pembersihan nyata. Hasil lulus memerlukan semua bukti: tulis, baca, update, satu record untuk nomor yang sama, dan cleanup. Pemeriksaan ini tidak dimasukkan ke antrean kontak nyata.

Hasil terakhir disimpan dalam `client-outbox.sqlite` dan tetap terlihat sesudah restart. Pemeriksaan dibatasi sekali per 30 detik; permintaan bersamaan memakai satu proses yang sama. Status antrean dan jumlah klien dimuat ulang setiap 30 detik saat halaman terlihat. Salah token, endpoint tidak tersedia, hasil tidak lengkap, atau kegagalan database menghasilkan status gagal.

**Uji database lulus belum membuktikan penerimaan pesan WhatsApp nyata.** Panel menampilkan batas ini ketika belum ada klien. Setelah WhatsApp ditautkan, kirim kebutuhan lengkap dari nomor lain; keberhasilannya dapat dilihat dari jumlah klien, kontak terakhir tersimpan, serta data di CRM. Playground tetap tidak membuat klien; tersedia tautan dari Playground ke panel pengujian ini.

Endpoint baru hanya untuk Owner aktif: `GET/POST /api/dashboard/chatbot/clients`. Probe internal `POST /api/internal/chatbot/clients/check` memakai `CHATBOT_CLIENT_TOKEN`, menolak data klien dari pemanggil, dan hanya menerima body `{}`. Tidak ada migrasi tambahan pada database PostgreSQL; kolom diagnostik SQLite ditambahkan otomatis tanpa menghapus antrean lama.

## Verifikasi redesign

- TypeScript khusus komponen integrasi lulus. Typecheck seluruh proyek masih
  menemukan error pada bagian aplikasi lain; build produksi penuh belum
  dinyatakan lulus.
- 25 tes backend terarah (Baileys, isolasi agent, pemulihan percakapan) dan
  4 tes BFF di `scripts/test-chatbot-integration.cjs` lulus.
- Browser Chromium dengan API tiruan terisolasi: 320, 375, 768, 1024,
  dan 1440 px tanpa overflow horizontal; dialog memiliki fokus awal aman,
  Escape membatalkan, error busy dapat dicoba ulang, pairing QR tersedia,
  dan kontrol bot memperbarui jumlah perhatian. Reduced motion dan kondisi
  layanan offline diperiksa; tidak ditemukan error runtime browser.
- Kesiapan Asisten diperiksa pada 320–1440 px: susunan kanan sejajar
  dengan WhatsApp di desktop; tanpa tombol; unknown, offline, layanan
  dijeda, konfigurasi belum lengkap, antrean, retry, probe gagal, dan error
  CRM tidak menjadi status hijau. Gagal refresh menonaktifkan hasil sukses
  lama. Panel detail berbagi polling dan probe manual memperbarui kedua panel.
- Pengujian UI tidak memakai atau memutuskan sesi WhatsApp nyata.

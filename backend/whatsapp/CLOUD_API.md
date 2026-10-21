# Referensi koneksi Meta Cloud API (opsional)

Backend sekarang memakai Baileys secara default. Untuk memakai panduan lama ini, set `WA_TRANSPORT=cloud` pada `.env`.

# Solusindo Aset — WhatsApp pre-sales backend

Layanan Node.js + Express untuk WhatsApp Cloud API dengan pilihan OpenAI Responses API atau Gemini. Bot membandingkan harga dengan estimasi pasar, menggali tujuan pembelian dan kesiapan dana, lalu menyerahkan percakapan kepada Senior Agent. Layanan ini berdiri sendiri dari aplikasi Next.js dan backend Python di direktori induk.

## Struktur folder

```text
backend/whatsapp/
├── index.js                      # Konfigurasi, server, graceful shutdown
├── app.js                        # Express dan error handling
├── config.js                     # Validasi environment
├── package.json
├── package-lock.json
├── .env.example
├── Dockerfile
├── data/
│   ├── assets.json               # Katalog operasional; awalnya kosong
│   └── assets.example.json       # Ilustrasi, ditolak di production
├── lib/
│   ├── http.js                   # HTTP client, timeout, error aman
│   └── security.js               # HMAC, token, normalisasi teks
├── routes/
│   ├── webhook.js                # GET verifikasi / POST pesan WhatsApp
│   └── admin.js                  # Antrean lead dan API CS
├── services/
│   ├── ai_controller.js          # System prompt, kedua provider, deteksi handover
│   ├── catalog.js                # Pemilihan aset, perhitungan margin dan tenggat
│   ├── message_processor.js      # Antrean, konteks, handover dan pengiriman
│   └── whatsapp.js               # Pengiriman lewat Graph API
├── state/memory_store.js         # State sementara dan deduplikasi
├── deploy/solusindo-whatsapp.service
└── test/
    ├── backend.test.js
    └── providers.test.js
```

## Menjalankan secara lokal

1. Gunakan Node.js 22 atau lebih baru, lalu jalankan dari root proyek:

   ```bash
   cd backend/whatsapp
   npm ci
   cp .env.example .env
   ```

2. Isi `.env`. File ini dibaca dari folder layanan, bukan dari root proyek. Jangan memasukkan credential dalam source code.

   | Variabel | Isi |
   | --- | --- |
   | `WA_API_VERSION` | Versi Graph API yang masih didukung dan dipakai aplikasi Meta Anda, dengan format `vXX.0` |
   | `WA_PHONE_NUMBER_ID` | ID nomor bisnis dari Meta, bukan nomor telepon |
   | `WA_ACCESS_TOKEN` | Token bisnis dengan akses mengirim pesan pada nomor tersebut |
   | `WA_APP_SECRET` | App Secret Meta untuk memeriksa tanda tangan webhook |
   | `WA_VERIFY_TOKEN` | Token acak pilihan Anda, sama dengan konfigurasi callback di Meta |
   | `LLM_PROVIDER` | `openai` atau `gemini` |
   | `LLM_MODEL` | ID model yang tersedia pada akun Anda dan mendukung structured JSON output |
   | `OPENAI_API_KEY` | Wajib jika provider `openai` |
   | `GEMINI_API_KEY` | Wajib jika provider `gemini` |
   | `ADMIN_API_TOKEN` | Token acak minimal 32 karakter untuk CS |

   Buat token berbeda untuk admin dan verifikasi webhook. Perintah ini menghasilkan satu token baru, bukan membaca secret yang ada:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Model dan versi Graph sengaja wajib diisi agar tidak terikat pada versi yang sudah tidak didukung. Gunakan ID model tanpa awalan `models/` untuk Gemini. API key provider yang tidak dipakai boleh kosong. Dependensi runtime hanya `express` dan `dotenv`; request API menggunakan `fetch` bawaan Node.js.

3. Isi `data/assets.json` dengan data aset yang telah diverifikasi. Struktur field dicontohkan dalam `data/assets.example.json`. File contoh ditandai `is_demo: true`, sehingga tidak dapat dipakai dengan `NODE_ENV=production`.

   Untuk simulasi lokal saja, set `ASSETS_FILE=./data/assets.example.json` dan `DEFAULT_ASSET_ID=DEMO-001`. Untuk penggunaan nyata, isi katalog operasional dengan angka, sumber estimasi pasar, waktu verifikasi, dan jadwal sebenarnya. Jangan sekadar mengganti tanda demo pada angka ilustrasi.

   `DEFAULT_ASSET_ID` boleh kosong: calon pembeli perlu menyebut kode aset, misalnya `Berapa harga AST-001?`. Setelah dipilih, kode itu diingat selama sesi. Jika dua kode disebut bersama, bot meminta klarifikasi. Setelah katalog diubah, restart layanan untuk memuatnya kembali; ingat bahwa restart juga menghapus state sementara.

4. Jalankan pengujian dan server:

   ```bash
   npm test
   npm start
   ```

   Health check: `GET http://127.0.0.1:3100/health`. Untuk pengembangan, gunakan `npm run dev`. Semua pengujian memakai API tiruan; tidak ada biaya LLM atau pengiriman WhatsApp nyata.

## Menghubungkan webhook WhatsApp

Jika credential Meta belum lengkap tetapi Anda perlu memverifikasi Callback URL,
isi `WA_VERIFY_TOKEN` pada `.env`, lalu gunakan `npm run setup:webhook`.
Mode ini hanya menjawab challenge verifikasi, tidak mengirim chat dan tidak
menandakan WhatsApp sudah tersambung. POST mendapat 503 agar pesan belum dianggap
berhasil diproses. Setelah credential lengkap, hentikan proses setup dan jalankan
`npm start` pada port yang sama. Tunnel HTTPS perlu tetap berjalan selama pengujian.

1. Sediakan URL HTTPS publik dengan reverse proxy menuju `127.0.0.1:3100`.
2. Pada konfigurasi WhatsApp di aplikasi Meta, gunakan callback URL `https://wa.domain-anda.id/webhook` dan Verify Token yang sama dengan `WA_VERIFY_TOKEN`.
3. Subscribe field `messages` dan pastikan aplikasi terhubung ke WhatsApp Business Account yang benar.
4. Kirim pesan ke nomor bisnis. Pada mode pengujian Meta, gunakan penerima yang sudah diizinkan pada konfigurasi aplikasi Anda.

`GET /webhook` memvalidasi token dan mengembalikan `hub.challenge`. `POST /webhook` memeriksa `X-Hub-Signature-256` dengan HMAC SHA-256 atas **raw request body** memakai App Secret. Header wajib; tidak ada opsi melewati pemeriksaan pada production maupun development.

Handler menelusuri semua `entry`, `changes`, dan `messages`, menyaring `phone_number_id`, serta mengabaikan delivery/status receipts. Pesan baru direservasi pada antrean memori lalu segera di-ACK dengan HTTP 200 sebelum menunggu LLM. Jika kapasitas penuh, seluruh batch baru ditolak dengan 503 agar dapat dikirim ulang oleh Meta. Pesan invalid di dalam envelope valid dilewati.

Input yang didukung: teks, judul balasan tombol/list interaktif, dan quick reply. Media tidak diunduh atau dianalisis; bot meminta pertanyaan teks. Riwayat satu nomor tidak dikirim ke sesi nomor lain.

## Prompt marketing dan perhitungan

`system_prompt` dalam `services/ai_controller.js` memuat identitas, aturan data, ROI First, kualifikasi dana, urgensi, trust building, urutan percakapan, dan keluaran terstruktur. System prompt dikirim pada setiap request. Untuk OpenAI, `store: false` menonaktifkan penyimpanan objek Response; ini bukan janji bahwa seluruh logging atau retensi provider menjadi nol.

Saat pengguna menanyakan harga, backend menambahkan ringkasan perhitungan sendiri agar jawaban tidak hanya berisi harga limit. Jika belum ada aset atau estimasi pasar, bot meminta data yang belum tersedia dan tidak menebak keuntungan.

```text
Selisih kotor = estimasi pasar - harga limit
ROI kotor    = selisih kotor / harga limit × 100%
Basis biaya  = harga limit + estimasi biaya tambahan
Estimasi net = estimasi pasar - basis biaya
ROI net      = estimasi net / basis biaya × 100%
```

Semua skenario mengasumsikan menang tepat di harga limit. Harga akhir penawaran bisa lebih tinggi. Estimasi biaya harus mencakup komponen yang relevan seperti pajak/bea, balik nama, renovasi, pengosongan, holding, dan penjualan; tidak ada tarif pajak yang dikarang atau ditanam sebagai tarif universal. Uang jaminan tidak dihitung dua kali sebagai tambahan biaya pembelian. ROI ini bukan angka tahunan atau jaminan keuntungan.

Contoh **simulasi**: limit Rp800 juta, estimasi pasar Rp1,1 miliar menghasilkan selisih kotor Rp300 juta / ROI kotor 37,5%. Dengan estimasi tambahan biaya Rp90 juta, estimasi hasil bersih Rp210 juta dan ROI 23,6% atas biaya Rp890 juta.

Gunakan tanggal ISO 8601 dengan zona waktu, misalnya `2026-10-11T15:00:00+07:00`. `registration_closes_at`, `deposit_due_at`, dan `auction_at` mewakili tiga hal berbeda. Deadline kosong tidak menghasilkan countdown; deadline lewat ditandai tutup. Countdown dihitung pada saat pesan diproses, dan ditampilkan dalam WIB. Bot tidak mengarang kalimat “pendaftaran ditutup 3 hari lagi”.

Untuk trust building, prompt menyebut pendampingan Solusindo Aset hingga serah terima sesuai cakupan layanan yang disepakati. Kalimat “pelunasan langsung ke kas negara” disesuaikan menjadi pembayaran melalui kanal resmi sesuai pengumuman/instruksi KPKNL. Prosedur dan aliran pembayaran harus mengikuti aset terkait; status lelang resmi juga tidak membuktikan bahwa aset bebas penghuni atau sengketa. Lihat [FAQ pelayanan lelang DJKN](https://www.djkn.kemenkeu.go.id/faq/faq_detail/pelayanan-lelang/3) dan [contoh rekening penampungan lelang KPKNL](https://www.djkn.kemenkeu.go.id/kpknl-yogyakarta/baca-pengumuman/2644/Pengumuman-Dana-Mengendap-Lelang-pada-Rekening-Penampungan-Bendahara-Penerimaan-KPKNL-Yogyakarta-Periode-Triwulan-II-Tahun-2025.html).

## Handover yang benar-benar menghentikan bot

Pemicu berikut diperiksa oleh kode, sebelum pemanggilan LLM: `minta rekening`, `mau transfer`, `ketemu agen`, `lokasi kantor`, dan `survei lokasi`. Ada tambahan `survey lokasi`, `hubungkan CS`, `bicara dengan CS`, `bicara dengan manusia`, `hubungkan agen`, dan `minta agen`. Kapitalisasi, spasi, serta tanda baca dinormalisasi. Ini pencocokan frasa; kalimat negasi yang memuat frasa, misalnya “belum mau transfer”, juga masuk CS sebagai pilihan konservatif.

Ketika terpicu, `is_bot_active` langsung menjadi `false`, lead muncul di antrean CS, dan sistem mengirim persis:

> Baik, untuk tahap finalisasi ini, Bapak/Ibu akan langsung dibantu oleh Senior Agent kami. Mohon tunggu sebentar ya, chat Anda sedang dialihkan.

Pesan pengguna berikutnya tetap masuk riwayat, tetapi tidak memanggil AI atau dibalas otomatis. Hasil AI yang masih berjalan dibuang bila handover sudah terjadi. Request pengiriman WhatsApp yang telah terlanjur dimulai sebelum trigger tidak dapat ditarik kembali oleh backend.

Bot juga mengalihkan lead ketika kode aset sudah diketahui serta tujuan, kesiapan jaminan, dan kesiapan pelunasan telah dinyatakan. Klasifikasi ini **self-report**, bukan verifikasi saldo. Model harus menyertakan kutipan dari pesan terakhir; backend menolak perubahan tanpa kutipan tersebut. Bukti dan riwayat tersedia bagi CS untuk penilaian akhir. Jika aset berganti, kesiapan dana untuk aset lama dihapus.

Status pause bertahan selama proses berjalan dan tidak berakhir karena TTL. Kegagalan pengiriman notifikasi juga tidak mengaktifkan bot kembali. Antrean disediakan melalui API admin; sistem ini tidak mengirim notifikasi ke nomor pribadi CS dan tidak menyediakan UI inbox. Sambungkan inbox/CRM milik tim ke endpoint berikut, atau akses melalui operator tepercaya.

## API untuk CS

Semua endpoint `/admin` memerlukan `Authorization: Bearer <ADMIN_API_TOKEN>`. Batasi akses di reverse proxy/VPN karena response memuat nomor telepon, riwayat, dan kualifikasi. Jangan menaruh token admin pada JavaScript frontend publik.

| Metode | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/admin/leads?limit=50&offset=0` | Antrean semua percakapan yang botnya sudah berhenti |
| GET | `/admin/conversations/6281234567890` | Riwayat, aset, kualifikasi, alasan handover dan error pengiriman |
| PATCH | `/admin/conversations/6281234567890/bot` | `{"is_bot_active": false}` untuk mengambil alih; `true` untuk resume |
| POST | `/admin/conversations/6281234567890/messages` | `{"text": "Selamat siang, saya Senior Agent ..."}` untuk balasan manual |

Contoh dari terminal operator, dengan `ADMIN_API_TOKEN` tersedia sebagai environment variable terminal tersebut:

```bash
curl http://127.0.0.1:3100/admin/leads \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"

curl -X POST http://127.0.0.1:3100/admin/conversations/6281234567890/messages \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"text":"Selamat siang, saya Senior Agent Solusindo Aset. Mari kita bahas surveinya."}'
```

Nomor harus format internasional tanpa tanda `+`. Balasan CS mensyaratkan bot sudah nonaktif, agar tidak saling menimpa. Resume ditolak dengan 409 saat masih ada pekerjaan untuk nomor itu; setelah antrean selesai, resume menghapus konteks dan kualifikasi lama untuk memulai sesi baru. Pengguna WhatsApp tidak dapat mengaktifkan bot melalui pesan.

Baik AI maupun CS hanya mengirim pesan bebas dalam 24 jam sejak pesan pengguna terakhir. Setelah itu, endpoint mengembalikan `SERVICE_WINDOW_CLOSED`; gunakan alur template yang disetujui Meta melalui sistem terpisah. Respons kirim yang sukses hanya menunjukkan pesan diterima API WhatsApp, belum menjamin sampai ke penerima. Delivery receipts di-ACK tetapi tidak disimpan sebagai status pengiriman pada versi ini.

## Deployment

**Docker** — jalankan dari folder layanan setelah `.env` dan katalog nyata diisi:

```bash
docker build -t solusindo-whatsapp .
docker run -d --name solusindo-whatsapp \
  --env-file .env \
  -e NODE_ENV=production -e HOST=0.0.0.0 -e PORT=3100 \
  -p 127.0.0.1:3100:3100 \
  --restart unless-stopped \
  --stop-timeout 50 \
  solusindo-whatsapp
```

Layanan berjalan sebagai user non-root. `.env` dikecualikan dari image. `HOST` dan `PORT` di-override karena `.env` development memakai loopback. Image menggunakan salinan katalog saat build; rebuild jika katalog diganti, atau mount katalog operasional read-only.

**VPS tanpa Docker** — salin folder layanan ke `/opt/solusindo-whatsapp`, pasang Node.js, jalankan `npm ci --omit=dev`, buat user layanan `solusindo-wa`, lalu beri akses baca ke folder dan `.env` (mode `600`, pemilik user layanan). Sesuaikan lokasi binary Node dan user pada `deploy/solusindo-whatsapp.service`, pasang unit ke `/etc/systemd/system/`, lalu:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now solusindo-whatsapp
sudo systemctl status solusindo-whatsapp
```

Contoh potongan **Nginx** di dalam server HTTPS yang sudah memiliki sertifikat:

```nginx
location = /webhook {
    proxy_pass http://127.0.0.1:3100;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 15s;
    client_max_body_size 256k;
}

# Akses CS lokal/VPN harus disediakan terpisah; jangan buka token/data CS ke publik.
location /admin { return 404; }
location = /health { proxy_pass http://127.0.0.1:3100; }
```

Pada contoh ini CS memakai akses localhost melalui SSH tunnel atau proxy privat sendiri. Jangan mencatat query string verifikasi webhook atau header Authorization pada access log. Rotasi token serta isi ulang katalog melalui prosedur operasional tim.

## Batas memori dan operasi

- Jalankan **satu proses / satu replica**, termasuk tanpa PM2 cluster, sesuai permintaan state sementara. Riwayat dibatasi 24 pesan / 24.000 karakter. Sesi aktif kedaluwarsa setelah 24 jam tidak aktif; pause dan ringkasan lead tetap ada selama proses berjalan, sementara riwayat sesi pause dibersihkan setelah TTL.
- Deduplikasi ID pesan berlaku tujuh hari dalam proses yang sama. Antrean dan jumlah sesi memiliki batas; sistem memberi 503 ketika penuh, tidak membuang sesi pause untuk membuka kapasitas. Batas dapat diatur pada `.env`.
- **Restart/crash menghapus riwayat, deduplikasi, antrean, dan status handover.** Nomor yang sebelumnya ditangani CS dapat dianggap sesi baru setelah restart. Gunakan Redis/database untuk status bot, lead, serta deduplikasi sebelum operasi yang memerlukan persistensi atau beberapa replica.
- ACK dilakukan setelah reservasi memori, bukan setelah penulisan durable. Crash setelah ACK dapat menghilangkan pesan yang belum selesai. Untuk produksi dengan tuntutan keandalan, terima webhook ke antrean durable seperti Redis/BullMQ terlebih dahulu, lalu ACK; worker memproses dan mencatat hasil pada storage bersama.
- Pengiriman gagal disimpan pada `delivery_error`; notifikasi handover mempunyai status `sent`/`failed`. Tidak ada retry kirim otomatis karena timeout dapat berarti Meta sudah menerima pesan. CS dapat memeriksa inbox/status dan mengirim ulang secara sadar. Kegagalan delivery asynchronous dari Meta belum masuk catatan ini.
- Prompt dan validasi JSON tidak menjamin setiap kalimat LLM selalu benar. Margin/deadline berasal dari backend dan prompt membatasi klaim, tetapi operator tetap perlu meninjau katalog serta sampel percakapan. Tidak ada pemanggilan live ke provider selama pengujian otomatis.

## Referensi integrasi

- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) dan [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
- [Gemini generateContent](https://ai.google.dev/api/generate-content) dan [structured output](https://ai.google.dev/gemini-api/docs/structured-output).
- [Koleksi resmi Meta WhatsApp Business Platform di Postman](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference).

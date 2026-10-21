# Kendali bot dari WhatsApp dan dashboard

Balasan manual biasa memberi jeda sementara **5 menit sejak pesan manual
terakhir**. Pesan klien tetap diterima dan tidak memperbarui waktu jeda.
Ketika jeda selesai, worker melanjutkan satu pesan teks terbaru yang belum
dijawab. Bila agent sudah membalasnya, pesan tertunda dibatalkan. Tidak ada
pesan lanjutan tanpa pesan klien yang menunggu.

| Tindakan | Hasil |
| --- | --- |
| Membalas manual di WhatsApp | Jeda sementara; otomatis kembali setelah 5 menit |
| Mengirim `#boton nomor_klien` ke **6282266100102** dari akun WhatsApp agen yang ditautkan | Mengaktifkan bot untuk klien tersebut dan melanjutkan pesan tertunda |
| Mengirim `#botoff nomor_klien` ke **6282266100102** dari akun agen | Jeda klien tersebut tanpa batas waktu, sampai diaktifkan lagi |
| Tombol **Aktifkan bot / Aktifkan & lanjutkan** | Mengaktifkan semua identitas kontak tersebut dan melanjutkan pesan tertunda |
| Tombol **Jeda bot** di dashboard | Jeda eksplisit sampai diaktifkan lagi |
| Pengalihan ke CS, negosiasi, atau pemeriksaan dokumen | Tetap dijeda sampai aktivasi eksplisit |

## Perintah melalui kontak kontrol

Dari WhatsApp agen yang terhubung ke bot, kirim satu nomor klien per pesan ke
**6282266100102**:

```text
#botoff 6288888888888
#boton 6288888888888
```

`#botoff` tidak kedaluwarsa setelah lima menit dan tetap berlaku setelah restart.
Balasan manual selanjutnya tidak mengubah jeda eksplisit menjadi jeda sementara.
`#boton` mengaktifkan klien itu saja. Konfirmasi dikirim ke chat kontrol yang sama;
bot tidak mengirim perintah atau konfirmasi ke klien. Pesan klien terbaru yang
masih menunggu dapat dibalas ketika diaktifkan, sesuai batas umur di bawah.

Nomor lokal `08…` dan format `+62…` juga diterima. Format `#bot on nomor` /
`#bot off nomor` didukung. Bila nomor tidak valid atau kosong, bot mengirim petunjuk
di chat kontrol tanpa mengubah status klien. Nomor kontrol, stoker, dan akun
WhatsApp pengirim tidak dapat menjadi target. Nomor kontrol dikecualikan dari
percakapan AI maupun rekomendasi otomatis, termasuk bila pernah menjadi nomor uji.

Perintah hanya dikenali pada event `fromMe` milik akun tertaut, setelah
mengecualikan echo pesan bot. Teks yang sama dari klien atau pesan masuk dari
kontak kontrol tidak memberi wewenang mengubah status. Status dan deduplikasi
perintah terpisah per agen. ID yang diputar ulang dan perintah lebih lama tidak
mengalahkan perubahan status yang lebih baru. Konfirmasi tidak dihitung sebagai
balasan pelanggan.

Format lama `#bot on/off` tanpa nomor di chat klien masih didukung untuk
kompatibilitas dan terlihat di chat klien, dengan reaksi konfirmasi.

Dashboard menampilkan alasan jeda, jam kembali aktif dalam WIB, pesan tertunda,
proses pembuatan balasan, koneksi yang ditunggu, dan kegagalan pengiriman.
Nomor kontrol, petugas stok, dan akun WhatsApp sendiri diberi penjelasan pengecualian,
tanpa tombol aktivasi yang memberi kesan bot bisa menjawab nomor tersebut.

## Perbaikan status yang tersangkut

Sebelumnya, setiap pesan masuk dari nomor yang memiliki catatan pause memanggil
`takeOver()` lagi. Waktu pause pun berubah menjadi waktu pesan klien terbaru.
Sekarang pemulihan ownership hanya membaca catatan tersebut dan mempertahankan
waktu, alasan, serta deadline semula.

Aktivasi menghapus catatan pause di semua alias nomor telepon/LID yang diketahui,
termasuk session lama di memori. Jika pemetaan LID baru diketahui setelah
aktivasi, watermark aktivasi mengalahkan pause yang lebih lama. ID event Owner
dan waktu aktivasi disimpan per tenant, sehingga echo lama tidak menjeda ulang
bot setelah restart. Balasan manual baru tetap dapat menjeda bot.

Aktivasi saat proses lama belum selesai membatalkan generasi lama. Pesan terbaru
yang masih menunggu diproses sekali; hasil generasi lama tidak dikirim kemudian.
Aktivasi tidak memerlukan disconnect, reset credential, QR baru, atau penghapusan
riwayat pencarian karena jeda manual.

## Konfigurasi dan penyimpanan

`BOT_CONTROL_WHATSAPP_NUMBER=6282266100102` menentukan kontak tujuan perintah.
Nomor ini terpisah dari `STOKER_WHATSAPP_NUMBER=6285707379606` untuk
petugas cek stok. Backend memvalidasi kedua nomor berbeda. Bot harus terhubung
agar menerima perintah dan mengirim konfirmasi; jeda klien tidak memerlukan
disconnect/reconnect WhatsApp.

Jika nomor kontrol sebelumnya dipakai sebagai `BOT_TEST_CLIENT_PHONE`, hapus
pengecualian uji itu. Peran kontrol selalu didahulukan, sehingga nomor tersebut
tidak lagi menerima listing sebagai klien.

`MANUAL_REPLY_PAUSE_SECONDS` pada `.env` backend:

- `300` (default): jeda 5 menit dari balasan manual terakhir.
- `0`: bot kembali melayani pesan klien berikutnya.
- `-1`: semua balasan manual menunggu aktivasi eksplisit.

Worker memeriksa deadline setiap 5 detik. Saat WhatsApp belum terhubung,
pesan tertunda tidak dikonsumsi; proses dilanjutkan setelah koneksi kembali.
Satu pesan tertunda disimpan maksimum 15 menit. Pesan privat, lampiran pembelian,
dan pesan pemicu handover tidak diputar ulang. Pesan lama yang telah diabaikan
oleh versi backend sebelumnya tidak otomatis dibuat menjadi kiriman baru.

Migrasi SQLite aditif menambahkan `human_ownership.resume_at`, `bot_resumes`,
dan `owner_messages`. Catatan pause lama tanpa deadline tetap memerlukan
aktivasi sekali, karena versi sebelumnya tidak membedakan jeda WhatsApp dari
jeda eksplisit dashboard. Tabel preferensi juga menyimpan satu teks klien yang
aman dan tertunda, berikut ID serta umurnya, agar restart tidak menghilangkannya.
Riwayat percakapan mentah seluruhnya tidak disimpan di tabel ini.

## Pengujian

```sh
cd backend/whatsapp
node --test test/bot_control.test.js test/conversation_ownership.test.js test/baileys.test.js test/conversation_recovery.test.js
node --test --test-concurrency=2
```

Dari root repository:

```sh
node --test scripts/test-chatbot-conversations.cjs
```

Semua kiriman WhatsApp pada tes memakai tiruan. Kasus meliputi urutan chat yang
dilaporkan, balasan tertunda, alias, restart, echo, jeda eksplisit, koneksi putus,
perintah Owner, penolakan kontrol dari klien, serta metadata dashboard.

Verifikasi kendali terpusat, 21 Oktober 2026:

- 86 tes kontrol, transport, ownership, pemulihan, dan konfirmasi stok lulus.
- 25 tes rekomendasi lulus, termasuk jeda dari `#botoff` dan pengecualian nomor
  kontrol meskipun pernah menjadi klien uji.
- 4 tes BFF/dashboard lulus; pemeriksaan tipe komponen UI lulus.
- Regresi backend terakhir: 1.144/1.148 lulus. Empat kegagalan MOU/closing sama
  dengan hasil sebelum perubahan kendali ini. Dua tes rekomendasi tambahan
  kemudian dijalankan bersama seluruh suite rekomendasi, semuanya lulus.
- Pemeriksaan tipe jalur API masih menemukan dua error lama pada
  `authOptions.ts:366` (definisi `events.error` dan parameter `message`).
- Konfigurasi aktif: kontrol **6282266100102**, stoker **6285707379606**, tanpa
  pengecualian klien uji. Tidak ada pesan uji dikirim ke nomor sungguhan.
- Koneksi AG108 sudah dimulai kembali tanpa reset sesi; pemeriksaan terakhir
  menunjukkan `awaiting_scan`, `qr_ready: true`, `bot_accepting: true`. Pemilik
  akun perlu menyelesaikan scan QR sebelum perintah WhatsApp bisa diterima.

Verifikasi 20 Oktober 2026:

- 60 tes kendali, transport WhatsApp, pemulihan, dan Smart Search lulus.
- 7 tes BFF/dashboard dan koneksi lulus; pemeriksaan tipe komponen UI lulus.
- Pemeriksaan tipe jalur API masih menemukan dua error pada definisi
  `events.error` dan parameter `message` di `authOptions.ts:366`, konfigurasi
  autentikasi yang tidak diubah pada perbaikan ini.
- Seluruh regresi backend: 1.038/1.042 lulus. Empat kegagalan pada alur
  MOU/closing sama dengan kegagalan yang telah dicatat sebelum perubahan ini.
- Kontak uji berakhiran 2305 dan 5859 dipulihkan ke status aktif, dengan
  `replay_pending: false`. Tidak ada pesan uji dikirim ke klien. Status akun
  WhatsApp berakhiran 7313 terhubung, `bot_accepting: true`, tanpa error.

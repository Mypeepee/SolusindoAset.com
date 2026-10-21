# AI Bot Playground

Halaman `/dashboard/chatbot-playground` ada di sidebar Dashboard Owner pada desktop
maupun ponsel. UI memakai React, TypeScript, Tailwind dan Lucide React, dengan font
Inter lokal. Sekarang sandbox memakai **LLM sungguhan dan database properti publik**.

Untuk pengembangan lokal, jalankan website dengan `npm run dev` dan backend
di terminal kedua dengan `npm --prefix backend/whatsapp run dev:playground`.
Backend harus tetap hidup selama Playground digunakan. Perintah Playground
memuat ulang perubahan kode otomatis dan tidak menghubungkan atau memulihkan
sesi WhatsApp. Untuk menjalankan tanpa watch tersedia `start:playground`;
mode tersebut perlu restart manual setelah perubahan backend. Health check default:
`http://127.0.0.1:3100/health`; website memakai `WHATSAPP_BACKEND_URL` dan token
backend dari `.env.local`.

## Alur

1. Login sebagai Owner aktif dan buka **AI Bot Playground**.
2. Kartu konteks mengambil contoh aset nyata dari database. **Quick Inject** mengisi
   composer dengan judul, lokasi, harga dan kode aset tersebut; tidak mengirim otomatis.
3. Tekan Kirim/Enter atau ketik kode aset lain. Server mengambil fakta properti,
   lalu AI menjawab. Pertanyaan lanjutan mempertahankan kode aset yang sedang dibahas.
4. **Reset Conversation** menghapus riwayat lokal dan membatalkan respons yang sedang
   ditunggu. Respons terlambat tidak masuk ke percakapan baru.

Shift + Enter membuat baris baru. Input IME tidak terkirim sebelum komposisi selesai.
Jika layanan gagal, pesan dikembalikan ke composer untuk dicoba lagi. Pada ponsel,
tab konfigurasi/chat menggantikan dua kolom. Pesan dirender sebagai teks React dengan
`*bold*`, tanpa HTML mentah; animasi menghormati reduced motion.

## Implementasi

- `components/BotPlayground.tsx`: UI, draft, riwayat lokal, indikator typing dan reset.
- `src/lib/chatbot/playground.ts`: tipe respons dan pembuatan template dari data nyata.
- `src/app/api/dashboard/chatbot/playground/route.ts`: API yang memverifikasi sesi,
  jabatan Owner dan status aktif dari database, origin, ukuran body dan daftar role pesan.
- `backend/whatsapp/routes/sandbox.js`: sandbox terpisah dari state/transport WhatsApp,
  dengan pembatasan frekuensi dan satu permintaan aktif per agent.
- `src/lib/chatbot/property-knowledge.ts`: query dan proyeksi data properti yang diizinkan.

Persona pada panel adalah ringkasan read-only **Asisten Virtual Properti — konsultatif dan responsif**.
Skenario Manukan/Citraland/Northwest dapat menguji qualifying budget dan tujuan, kemudian
maksimal tiga rekomendasi dari aset Tersedia. Saat qualifying bot boleh mengajukan
dua pertanyaan; respons rekomendasi tetap diakhiri satu CTA. Nama kawasan yang
ambigu antarkota diklarifikasi terlebih dahulu. Tidak ada waiting list atau
janji capital gain yang dikarang. Prompt penuh dan API key tetap berada
pada backend. Token, URL backend dan identitas agent tujuan tidak dipilih browser.

Sandbox tidak mengirim pesan WhatsApp, mengubah status bot live atau mencatat lead.
Riwayat dikirim ke server/penyedia AI untuk menjawab, tetapi tidak disimpan ke database.
Permintaan data privat ditolak dan dihapus dari konteks giliran berikutnya. Jawaban
survei/finalisasi memakai pesan peralihan resmi; indikator UI menyatakan bahwa
handover hanya disimulasikan. Setelahnya kolom input dinonaktifkan dan tombol
**Mulai percakapan baru** tersedia agar pengguna dapat melanjutkan pengujian.
Bahasa informal/kurang jelas mendapat pertanyaan klarifikasi, bukan handoff
otomatis. Pencarian area, pertanyaan kriteria, dan kartu rekomendasi dari database
dirender langsung oleh backend tanpa menunggu model AI.

Sapaan/stiker/topik lain mendapat template standar satu kali. Permintaan di luar
konteks berikutnya mengembalikan `suppressed:true, reply:null` tanpa bubble bot.
`conversationId` UUID memisahkan konteks per tab/agent. Backend menyimpan status
interaksi, pointer aset dan riwayat terbatas di memori sandbox. Riwayat lama dari
browser tidak bisa memulihkan sesi yang kedaluwarsa. Setelah
45 menit tanpa pesan, konteks lama dibuang sebelum pesan baru diproses; handoff
tetap pause. Reset membuat sesi pengujian baru, tanpa mengubah WhatsApp live.

Aset Tersedia yang jadwal lelangnya terlewat memakai respons awal terstruktur:
dua kemungkinan hasil/retender, lalu satu pertanyaan area untuk opsi cadangan. Status
**Jadwal terlewat · Pengecekan hanya disimulasikan di Playground** tampil di chat.
Tidak ada tugas pengecekan nyata yang dibuat dari pengujian ini; keterangan
simulasi hanya di indikator UI. Jawaban area singkat melanjutkan kualifikasi
budget/tujuan. Pencarian opsi cadangan mengikuti kriteria klien: utamakan jadwal mendatang, lalu opsi
terbaru yang perlu konfirmasi jika kosong; hanya listing publik Tersedia.

Lihat [konfigurasi dan batas privasi database](../../../../backend/whatsapp/docs/property-database.md).

## Pemulihan kuota dan permintaan

HTTP 429 dari provider AI dibedakan dari batas sesi Playground. Pesan kuota harian,
batas sementara provider, sesi sedang memproses, gangguan layanan, dan timeout
memiliki penjelasan sendiri. `Retry-After` diteruskan dari backend; composer
mempertahankan draft dan tombol kirim menunggu jeda tersebut, tanpa mengirim
ulang otomatis. Reset percakapan tidak menghapus pembatasan kuota.

`LLM_FALLBACK_MODEL` pada backend mengaktifkan satu model cadangan di provider/API
key yang sama. Konfigurasi lokal memakai `gemini-3.5-flash-lite` sebagai cadangan
`gemini-2.5-flash`; keberhasilannya ditandai **AI cadangan** di chat. Provider
yang sedang dibatasi tidak dipanggil ulang sampai jedanya lewat. Jika semua
model dibatasi, UI menampilkan alasan/waktu coba lagi. Fallback tetap tunduk
pada kuota akun; ini tidak mengaktifkan billing atau menambah kuota.

Setiap POST membawa ID permintaan acak. **Reset Conversation** membatalkan fetch
browser dan mengirim DELETE terautentikasi untuk ID tersebut; pembatalan diteruskan
ke database/LLM. Permintaan yang terputus atau melewati 55 detik melepas slot
agent. ID yang dibatalkan sebelum POST tiba disimpan sementara agar POST terlambat
tidak memulai generasi. Respons lama tidak masuk ke percakapan baru.

Jika pengguna sedang menulis draft baru ketika pesan sebelumnya gagal, draft
baru dipertahankan dan pesan gagal dapat dibaca di **Lihat pesan yang belum
terkirim**. JSON respons tidak lengkap ditolak, bukan dirender sebagai balasan
kosong. Pemangkasan riwayat mempertahankan pesan user pertama dan terakhir.

Tes regresi ada di `backend/whatsapp/test/playground_reliability.test.js`.
Rujukan kuota dan model: [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits),
[Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).

Playground hanya menyimulasikan percakapan: tidak membuat klien CRM, sekalipun seluruh funnel lengkap atau nomor WhatsApp diketik di pesan. Simpan otomatis hanya berjalan dari transport WhatsApp nyata.

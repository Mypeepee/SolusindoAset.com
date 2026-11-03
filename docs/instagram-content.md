# Pengelolaan konten Instagram

Dashboard → Pemasaran → **Instagram** membaca akun perusahaan yang sudah terhubung.
Daftar mencakup konten yang dapat diakses Meta, termasuk unggahan langsung dari
Instagram, bukan hanya konten yang diterbitkan Planner.

Pilihan **Konten asli / Contoh posting** membedakan data akun dan tiga contoh
tampilan yang diminta pemilik. Saat API berhasil mengembalikan akun tanpa posting,
contoh ditampilkan lebih dahulu dengan label yang jelas. Foto contoh berasal dari
aset proyek; caption dan metrik merupakan ilustrasi. Detail contoh menyediakan
carousel, analitik, dan komentar ilustrasi yang hanya bisa dibaca. Tidak ada contoh
yang diterbitkan, dimasukkan ke database publikasi, atau dikirim sebagai ID media
ke Instagram. Header akun tetap memakai data asli. Uji tampilan dan pemisahan
sumber: `node scripts/verify-instagram-redesign-browser.mjs`.

Kemampuan yang diterapkan:

- Profil akun, jumlah pengikut/mengikuti/posting, daftar foto, video, carousel,
  Reels, dan Story aktif; pagination cursor 24 konten per permintaan.
- Pratinjau gambar/video dan seluruh anak carousel; caption asli dan permalink.
- Analitik per konten sesuai format: views, reach, shares, total_interactions;
  likes/comments/saved untuk feed/Reels; follows/profile_visits untuk feed/Story;
  waktu tonton/skip rate untuk Reels; replies/navigation/link_clicks untuk Story.
  Rasio interaksi dihitung dari total_interactions ÷ reach, hanya jika keduanya
  tersedia dan reach positif. Angka nol berbeda dari metrik yang tidak tersedia.
- Baca komentar dan balasan bertahap; kirim balasan publik; sembunyikan/tampilkan
  atau hapus komentar; aktif/nonaktifkan komentar pada konten.
- Hapus posting, Reel, Story, atau **seluruh** carousel dengan konfirmasi.
  Hapus satu anak carousel tidak didukung. Arsip sementara dan edit caption
  diarahkan ke aplikasi Instagram; keduanya tidak dipalsukan sebagai aksi API.

API privat: `GET/POST /api/dashboard/pemasaran/instagram/content`. GET menerima
`mode=media|stories|detail|comments|replies`, `mediaId`, `commentId`, dan `after`
sesuai mode. POST memakai schema discriminated union dengan `action`, account ID,
media ID, UUID `requestId`, dan field tindakan. Semua respons `private, no-store`.
OWNER aktif diperiksa pada setiap permintaan; POST memerlukan Origin yang sesuai.

## Izin dan batas Meta

Koneksi yang tersedia tetap digunakan. Kapabilitas diperiksa melalui `debug_token`
dan granular scope untuk akun yang terhubung. Tidak ada token yang dikirim ke browser.

| Fungsi | Izin tambahan pada mode Facebook/Unified |
| --- | --- |
| Analitik | `instagram_manage_insights` |
| Komentar, balasan, moderasi | `instagram_manage_comments` |
| Hapus media | `instagram_manage_contents`, **khusus Facebook Login** |

Permintaan OAuth Facebook tanpa Configuration ID kini menyertakan izin hapus.
Jika memakai Configuration ID, tambahkan izin pada konfigurasi Meta tersebut dan
hubungkan ulang. Akun yang sudah memberi semua izin tidak perlu dihubungkan ulang.
Persetujuan/App Review dan akses akun mengikuti konfigurasi aplikasi di Meta.

Data insights dapat terlambat 48 jam, disimpan Meta hingga dua tahun; Story insights
umumnya tersedia 24 jam dan bisa dibatasi jika jumlah penonton terlalu kecil.
Tidak semua metrik tersedia bagi setiap konten. Metrik tidak didukung diisolasi
agar metrik lainnya tetap terbaca; token kedaluwarsa/rate limit menghentikan fallback.
Pratinjau video dapat tidak tersedia karena hak audio. URL media dianggap sementara.
Tidak ada daftar identitas lengkap penonton atau pemberi like yang dijanjikan.

## Keamanan tindakan dan penyimpanan

Jalankan `npm run db:marketing` sebelum memakai tindakan. Migrasi tambahan membuat
`marketing_instagram_actions`; pembacaan memakai SQL berparameter sehingga tidak
memerlukan client Prisma baru. Model juga dicatat di schema untuk generate berikutnya.
Audit menyimpan UUID, account/owner ID, jenis/target tindakan, HMAC isian, status,
waktu dan acknowledgement minimal. **Isi komentar/balasan, URL credential dan token
tidak disimpan dalam audit.** Audit metadata mengikuti masa simpan riwayat Pemasaran.

Sebelum dispatch, server memeriksa izin, kepemilikan media dan hubungan komentar,
serta memeriksa ulang koneksi. Request ID disimpan sebelum side effect. Pengulangan
ID yang sama mengembalikan acknowledgement tersimpan; ID dengan isian/owner berbeda
ditolak. Indeks unik membatasi satu tindakan pending per target. Tindakan pending
lebih dari lima menit menjadi uncertain pada permintaan berikutnya untuk akun itu.
Tindakan uncertain/failed tidak dikirim ulang dengan ID yang sama. Meta tidak memberi
jaminan exactly-once untuk balasan; hasil tak pasti harus diperiksa di Instagram
sebelum pengguna membuat tindakan baru. Tidak ada retry mutation otomatis.

Penghapusan yang diakui Meta menandai publikasi lokal terkait dengan `MEDIA_DELETED`.
State delivery dan metrik historis dipertahankan; worker tidak menyinkronkannya lagi
dan tidak menganggapnya sebagai jadwal baru. Daftar live diperbarui. Penghapusan
yang dilakukan langsung di Instagram tercermin pada pembacaan daftar berikutnya;
ketiadaan media tidak otomatis ditafsirkan sebagai penghapusan dalam riwayat lokal.

Verifikasi: `npm run test:marketing`,
`node scripts/verify-instagram-content-browser.mjs` (fixture browser terisolasi),
`node scripts/verify-instagram-content-live.mjs` (GET saja pada akun terhubung).
Tidak ada uji yang mengirim komentar atau menghapus konten Instagram asli.

Referensi resmi diperiksa 28 Oktober 2026 WIB:

- [Instagram Media: fields, komentar, delete, batas login/album](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media)
- [Media Insights: metrik per format dan batas data](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights)
- [Comment Moderation](https://developers.facebook.com/documentation/instagram-platform/comment-moderation)
- [Changelog: Delete Instagram Media, 3 Desember 2025](https://developers.facebook.com/documentation/instagram-platform/changelog)
- [SDK resmi Meta: IGComment dan parameter hide](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/igcomment.py)

## Workspace carousel properti

Revisi visual mengikuti brief carousel saja: sampul desain 4:5 pada slide pertama,
lalu 1–3 foto dari properti yang sama. Foto utama tetap mendapat slide tersendiri.
Konten baru dengan satu foto sumber menghasilkan dua slide; materi satu gambar
ditolak sebelum dispatch. Ini batas materi aplikasi, bukan klaim batas Instagram.
Template sampul memakai logo/font lokal dan fakta listing; foto detail tidak dipotong.

Pilihan Konten asli dan Contoh carousel memisahkan akun terhubung dari tiga contoh
lokal berlabel ilustrasi. Pratinjau, thumbnail, panah, keyboard, dan swipe berbagi
komponen galeri dengan dialog analitik/komentar. Contoh tidak membuat request detail,
komentar, maupun mutasi Instagram. `scripts/render-instagram-examples.cjs` merender
sampul contoh dari template produksi dan foto lokal tanpa memposting apa pun.

Verifikasi revisi: 89 tes marketing lulus; browser pengelolaan posting lulus memakai
fixture; browser contoh lulus pada 1512, 1280, 1024, 768, 390 dan 320px dengan nol
mutasi Instagram. Production build lulus (120 halaman). Typecheck proyek masih
memiliki error di luar perubahan ini; pemeriksaan terfokus hanya menjumpai dua
error existing di `authOptions.ts:366`, tanpa error pada modul Pemasaran.

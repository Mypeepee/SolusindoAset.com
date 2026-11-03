# Instagram: pengisian webhook dan persiapan App Review

Dokumen kerja untuk aplikasi SolusindoAset pada portofolio yang sekarang.
Belum merupakan pengajuan review atau persetujuan Meta. Aplikasi masih
Unpublished; perubahan menjadi Published/Live belum dilakukan.

Update 28 Oktober 2026 WIB: koneksi dashboard berhasil melalui Facebook USER
token setelah profil dan kuota publikasi tervalidasi. Website lokal sekarang
memakai mode Facebook Login; kegagalan Unified Login di tabel historis di bawah
bukan lagi status koneksi dashboard saat ini. Lihat
[hasil koneksi dan konfigurasi Facebook](./instagram-facebook-login-test.md).
App Review tetap belum diajukan dan tidak ada publikasi uji yang dilakukan.

## Langkah 3 — Configure webhooks

Callback URL lingkungan pengujian saat ini:

```text
https://stefanie-scornful-liltingly.ngrok-free.dev/api/pemasaran/instagram/webhook
```

Verify token: salin **nilai** `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` dari `.env.local`,
tanpa nama variabel maupun tanda kutip. Ini terpisah dari access token dan
App Secret. Lalu klik **Verify and save** pada Dasbor Aplikasi Meta.

Pada 27 Oktober 2026, pemilik aplikasi melaporkan **Verify and save berhasil**.
Server mencatat challenge terbaru pada `2026-10-27T16:10:40.799Z`.
Registrasi callback ini terpisah dari subscription field dan subscription akun;
belum ada event akun perusahaan yang tersimpan saat pemeriksaan tersebut.

Pengujian field `comments` melalui **Test → Send to My Server** kemudian
dilaporkan sukses oleh pemilik aplikasi. Server mencatat delivery baru pada
`2026-10-27T16:18:18.208Z`; jumlah batch naik dari 1 menjadi 2. Entry contoh
memakai ID selain akun perusahaan, sehingga diabaikan sesuai filter akun.
Ini membuktikan pengiriman uji diterima, bukan akses profil atau notifikasi
akun perusahaan sudah tersedia. Record koneksi Instagram masih belum ada.

API App Subscriptions umum tidak mendukung pendaftaran webhook Instagram;
pendaftaran callback dilakukan melalui Dasbor Aplikasi. Respons kosong dari
API umum tersebut tidak membuktikan tidak ada konfigurasi Instagram.

Pilih field sesuai fitur yang digunakan. Field `comments` berhubungan dengan
`instagram_manage_comments`, `messages` dengan `instagram_manage_messages`,
dan `story_insights` dengan `instagram_manage_insights`. Penerima mendukung
penyimpanan event perubahan dan messaging, tetapi dashboard belum mempunyai
UI moderasi komentar atau percakapan DM. Konfigurasi penerima bukan bukti
fitur pengelolaan komentar/DM sudah selesai.

Gunakan tombol Test pada field Meta untuk menguji delivery. Contoh Meta dapat
memakai ID akun lain; endpoint membalas 200 untuk payload bertanda tangan yang
valid, tetapi isinya diabaikan bila ID berbeda dari akun perusahaan. Waktu
delivery juga dapat berasal dari skrip simulasi. Notifikasi akun asli memerlukan
app Published/Live, izin field yang memadai, dan subscription per akun melalui
`/INSTAGRAM_ACCOUNT_ID/subscribed_apps` setelah profil akun terbaca. Hal ini
belum boleh dianggap selesai selama akses profil masih menghasilkan 100/33.

Pemeriksaan ulang setelah webhook berhasil masih mengembalikan daftar assigned
accounts kosong dan profil 100/33, termasuk melalui native HTTPS di luar helper
website. Bukti, batas kesimpulan, serta pilihan tindak lanjut tersedia dalam
[diagnosis akses profil Unified Login](./instagram-unified-api-diagnosis.md).

## Langkah 4 — Status kesiapan

| Bagian                                          | Kondisi saat disiapkan                         |
| ----------------------------------------------- | ---------------------------------------------- |
| Konfigurasi Unified Login dan callback OAuth    | Ada                                            |
| Validitas token, App ID dan ID bisnis           | Telah diverifikasi                             |
| Profil Instagram melalui API                    | Masih gagal: 100/33, assigned account kosong   |
| Penerima webhook HTTPS, challenge dan signature | Telah dibuat dan diuji                         |
| Registrasi callback di Dasbor Meta              | Verify and save berhasil, dikonfirmasi pemilik |
| Delivery Test dari Dasbor Meta                  | Sukses; delivery baru tercatat di server        |
| Subscription notifikasi per akun                | Menunggu koneksi akun dapat dibaca             |
| Mode Published/Live                             | Belum diubah                                   |
| UI publikasi terjadwal dan metrik               | Ada; demo API nyata menunggu koneksi           |
| UI moderasi komentar dan DM                     | Belum tersedia                                 |
| Rekaman demo, akun review dan pengajuan         | Belum dibuat/diajukan                          |

Standard Access dapat dipakai untuk pengujian orang yang mempunyai peran pada
aplikasi. Untuk pengguna tanpa peran, panduan Unified Login meminta Advanced
Access ke setiap izin pada konfigurasi dan app Live. Konfigurasi default juga
meminta akses pesan; cocokkan kebutuhan serta persyaratan kompatibilitas
konfigurasi sebelum mengajukan izin. Fitur iklan tidak tersedia di dashboard
Pemasaran saat ini. Review tidak boleh mengklaim fitur yang belum diimplementasi.

## Draf deskripsi aplikasi

SolusindoAset menyediakan dashboard pemasaran untuk mengelola promosi properti
melalui akun Instagram profesional perusahaan. Pengguna yang berwenang memilih
properti, menyiapkan konten, memeriksa jadwal publikasi dan melihat metrik agregat
hasil publikasi. Akun dihubungkan melalui Instagram API with Unified Login.
Otomatisasi hanya digunakan setelah pemilik akun mengaktifkannya di dashboard.

## Draf alasan izin berdasarkan implementasi

| Izin                         | Penggunaan yang dapat dijelaskan                                                                           | Bukti demo yang diperlukan                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `instagram_basic`            | Memastikan identitas akun profesional yang dipilih dan menampilkan akun terhubung                          | Login Unified sampai username perusahaan tampil                                   |
| `instagram_content_publish`  | Membuat dan menerbitkan konten properti yang dipilih pada waktu yang ditetapkan                            | Pilihan aset, pratinjau, jadwal, satu publikasi uji pada akun yang disetujui      |
| `instagram_manage_insights`  | Menampilkan metrik agregat publikasi seperti reach, views, likes, comments, saved dan shares bila tersedia | Publikasi dengan nilai API nyata di dashboard                                     |
| `instagram_manage_comments`  | Fondasi penerimaan event komentar tersedia; moderasi melalui dashboard belum tersedia                      | Lengkapi use case komentar sebelum mengajukan akses untuk moderasi                |
| `instagram_manage_messages`  | Fondasi penerimaan event tersedia; percakapan dan pengiriman balasan belum tersedia                        | Pastikan kebutuhan konfigurasi dan lengkapi demo use case pesan sebelum pengajuan |
| `ads_read`, `ads_management` | Belum ada fitur iklan                                                                                      | Tinjau kebutuhan izin; jangan membuat klaim pengelolaan iklan                     |

## Urutan rekaman yang perlu disiapkan setelah koneksi bekerja

1. Buka dashboard menggunakan akun demo yang dapat mengakses Pemasaran.
2. Jelaskan tujuan koneksi dan izin, lalu jalankan Unified Login.
3. Pilih bisnis dan akun Instagram yang akan diuji, kemudian selesaikan consent.
4. Perlihatkan username dan status koneksi yang berhasil dibaca dari API.
5. Pilih satu aset dan tampilkan pratinjau serta jadwal.
6. Bila pengujian publikasi telah disetujui, terbitkan ke akun demo milik sendiri,
   lalu tunjukkan hasil posting dan metrik nyata.
7. Untuk izin tambahan, tampilkan tindakan yang benar-benar memakai izin itu.

Tidak ada publikasi uji yang dilakukan otomatis sebagai bagian persiapan ini.
Akun untuk reviewer perlu disiapkan di lingkungan demo terisolasi; kredensial
OWNER pribadi dan akses data operasional tidak dimasukkan ke dokumen ini.

## URL dan informasi untuk formulir

- Website: origin publik yang benar-benar dipakai saat review.
- Kebijakan privasi tersedia pada `/privacy`. Isi yang ada masih bersifat umum
  dan perlu dicocokkan dengan pemrosesan Instagram sebelum pengajuan.
- Bagian `/privacy#retensi` dan `/privacy#kontak` memuat permintaan penghapusan
  melalui kontak privasi. Pastikan petunjuk tersebut menjelaskan data Meta/
  Instagram yang diproses, identifikasi permintaan, dan prosedur penghapusannya.
- Callback OAuth: origin publik ditambah
  `/api/dashboard/pemasaran/instagram/callback`.
- Callback webhook: origin publik ditambah `/api/pemasaran/instagram/webhook`.
- Lengkapi kebutuhan business verification yang ditampilkan Meta untuk akses
  produksi, serta informasi aplikasi dan reviewer yang diminta formulir.

Domain ngrok saat ini merupakan lingkungan uji. Endpoint dan halaman yang
diajukan harus tetap aktif selama proses review. Origin deployment, Meta App ID,
Configuration ID, redirect URI dan callback webhook harus konsisten.

## Fakta pemrosesan untuk penyesuaian kebijakan privasi

Data integrasi meliputi identitas akun profesional, izin dan token akses yang
disetujui, konten publikasi, metrik agregat, serta event akun perusahaan bila
webhook diaktifkan. Credential dan isi event disimpan terenkripsi di server.
Event webhook dibatasi 30 hari dan record kedaluwarsa dibersihkan oleh tugas
Pemasaran atau penerimaan berikutnya. Endpoint kesehatan OWNER hanya menampilkan
metadata penerimaan. Infrastruktur penerima belum melakukan balasan otomatis.

Pemilik layanan perlu meninjau keterangan publik, kontak, retensi data lain,
prosedur penghapusan serta kebutuhan reviewer sebelum dokumen atau pengajuan
dipublikasikan. Draf ini tidak mengganti kebijakan privasi website yang ada.

## Referensi resmi

- [Unified Login: Get started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started)
- [Permissions](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions)
- [Set up Webhooks](https://developers.facebook.com/documentation/instagram-platform/webhooks/setup)
- [Webhook fields](https://developers.facebook.com/documentation/instagram-platform/webhooks/fields)
- [App Subscriptions: batasan Instagram](https://developers.facebook.com/docs/graph-api/reference/app/subscriptions/)
- [App Review](https://developers.facebook.com/documentation/instagram-platform/app-review)

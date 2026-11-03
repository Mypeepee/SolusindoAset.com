# Uji alternatif Instagram API with Facebook Login

## Hasil aktual — 28 Oktober 2026 WIB

Facebook User token baru valid untuk App ID yang diharapkan, dengan basic,
publish, insights, pages_show_list, dan pages_read_engagement. Profil
`@solusindopremier` dan GET kuota publikasinya sama-sama berhasil (HTTP 200).
Daftar Page tetap kosong; sebabnya belum ditentukan. Karena ID perusahaan
sudah ditetapkan di server, koneksi memakai verifikasi profil serta kapabilitas
publikasi langsung pada ID itu, bukan menyimpulkan akses dari daftar Page.

Website sekarang memakai `INSTAGRAM_LOGIN_MODE=facebook`. Token telah ditukar
di server menjadi token berumur panjang, divalidasi kembali, dan disimpan
terenkripsi pada koneksi `instagram`. Masa berlaku yang dikembalikan Meta:
`2026-12-26T17:12:05.000Z` (27 Desember 2026 sekitar 00.12 WIB).
Salinan token diagnostik di `.env.local` telah dikosongkan. Otomatisasi tetap
nonaktif; tidak ada posting, media container, pesan, atau publikasi uji dibuat.

API dashboard HTTPS mengembalikan `connected: true` dan username perusahaan.
Browser memverifikasi status asli serta panduan mode Facebook, navigasi tombol,
fokus keyboard, dan viewport 1440/768/375. Build produksi terpisah berhasil.
Pemeriksaan tipe tetap menemukan dua error NextAuth yang sudah ada di
`authOptions.ts:366`; tidak ada error baru pada modul koneksi yang diubah.

## Konfigurasi dan pemeliharaan

- `INSTAGRAM_LOGIN_MODE`: `facebook`; nilai default bila tidak diatur adalah
  `unified` untuk kompatibilitas konfigurasi sebelumnya.
- `INSTAGRAM_ACCOUNT_ID`: wajib pada mode Facebook dan harus berupa ID akun
  perusahaan yang dapat dibaca dengan token pengguna tersebut.
- `INSTAGRAM_FACEBOOK_CONFIG_ID`: opsional; jika dipakai, harus konfigurasi
  untuk Facebook USER token. Configuration ID SUAT lama tidak dipakai ulang.
- Tanpa Configuration ID Facebook, OAuth meminta scope Facebook yang diperlukan
  secara langsung. Callback, state cookie, dan OWNER guard tetap berlaku.
- Credential memakai envelope `meta-facebook-v1.` berisi token, App ID,
  configuration ID, user ID, dan account ID di dalam enkripsi AES-256-GCM.
  Credential Unified mempunyai envelope terpisah; keduanya tidak ditukar diam-diam.
- Masa berlaku credential dibatasi hasil debug token, masa akses data bila ada,
  dan masa berlaku respons pertukaran. Token USER tanpa masa berlaku terverifikasi
  tidak diterima. Penghubungan ulang melalui tombol dashboard memakai alur USER.
- Import operator tersedia melalui `npm run connect:instagram:facebook` setelah
  mengisi token sementara. Validasi profil, scope, identitas pengguna, dan kuota
  selesai sebelum koneksi database diganti. CLI membersihkan token sementara
  setelah penyimpanan berhasil.
- Koneksi publikasi tidak membuktikan izin komentar, pesan, maupun subscription
  webhook tingkat Page tersedia. Endpoint subscription lama menolak mode Facebook
  dengan `WEBHOOK_PAGE_SUBSCRIPTION_REQUIRED`; konfigurasi callback penerima yang
  sudah diverifikasi tetap ada. Belum ada subscription Page baru yang dibuat.

Bagian di bawah mempertahankan prosedur uji awal serta sumber keputusan.

Alur ini berbeda dari Instagram API with Unified Login yang sedang dipakai.
Persiapan berikut hanya melakukan GET dan belum mengganti mode koneksi,
menyimpan credential penerbitan, atau menerbitkan konten.

## Dasar resmi dan perbedaan dari artikel

Panduan resmi Meta mendukung Facebook User Access Token, daftar Page dari
`/me/accounts`, dan field `instagram_business_account` pada Page yang terhubung
ke Instagram profesional. Ini menguji jalur penemuan akun melalui Page,
terpisah dari `/me/assigned_instagram_accounts` milik BISU Unified Login.

Artikel Apidog yang dirujuk memakai konsep Facebook Login ini, tetapi contoh
kodenya perlu disesuaikan. Misalnya, contoh masih memakai v18.0; dokumentasi Meta
yang diperiksa memakai v26.0. Helper artikel menaruh `method` pada parameter URL
tanpa mengaturnya sebagai opsi fetch, sehingga contoh publikasinya bukan
implementasi POST yang dapat langsung disalin.

## Token untuk pemeriksaan awal

1. Buka Graph API Explorer dan pilih aplikasi **SolusindoAset**.
2. Pilih host **graph.facebook.com**, bukan graph.instagram.com, dan v26.0.
3. Gunakan akun Facebook administrator yang mempunyai akses Page perusahaan.
4. Pilih **Get User Access Token** pada pilihan token yang tersedia. Ini harus
   merupakan token tipe `USER`, bukan `SYSTEM_USER` dari konfigurasi Unified.
5. Untuk discovery mintalah `instagram_basic` dan `pages_show_list`. Tambahkan
   `pages_read_engagement` untuk pembacaan Page dan izin
   `instagram_content_publish`, `instagram_manage_insights` untuk pengujian
   kapabilitas dashboard. Ketersediaan izin bergantung pengaturan aplikasi.
6. Simpan token pada **nilai** `INSTAGRAM_DIAGNOSTIC_ACCESS_TOKEN` di
   `.env.local`. Tanda kutip dotenv diperbolehkan. Token tidak dikirim ke chat.
7. Jalankan `npm run diagnose:instagram` dari direktori proyek.

Jika pilihan User token atau izin Page tidak tersedia, catat pesan Meta sebelum
mengubah konfigurasi aplikasi. Mengklik login Facebook pada konfigurasi Unified
yang sekarang tetap menghasilkan token system-user; itu belum menjadi uji
Facebook User Access Token ini.

### Jika izin Page tidak muncul di Explorer

Pemilik melaporkan dropdown Explorer hanya menampilkan izin Instagram dan
iklan; `pages_show_list` dan `pages_read_engagement` tidak tersedia di daftar
yang diperlihatkan. Pemilihan token saja belum menambahkan izin ke aplikasi.

Dokumentasi pembuatan aplikasi Meta menyebut use case **Manage everything on
your Page** menambahkan `pages_show_list`, `business_management`, dan
`public_profile` sebagai izin wajib, serta menyediakan `pages_read_engagement`
sebagai izin opsional. Daftar izin yang tersedia mengikuti use case aplikasi.

Periksa **My Apps → SolusindoAset → Use cases → Add use cases** untuk melihat
apakah use case tersebut tersedia dan kompatibel. Ini pemeriksaan ketersediaan,
bukan bukti use case sudah ditambahkan. Meta menyatakan use case yang sudah
ditambahkan tidak dapat dihapus, dan hanya use case kompatibel yang ditampilkan.
Karena itu, ketersediaan perlu dikonfirmasi sebelum melanjutkan pengaturan.
Belum ada use case, aplikasi, atau portofolio baru yang dibuat pada tahap ini.

Jika tersedia, langkah lanjutan adalah meninjau penambahan use case tersebut,
menambahkan izin opsional `pages_read_engagement`, kemudian membuka kembali
Explorer dan membuat User token baru. Jika tidak tersedia, jalur Page belum
dapat diuji dengan konfigurasi aplikasi saat ini; penyebab kompatibilitasnya
belum terkonfirmasi. Izin iklan tidak menggantikan izin membaca daftar Page.

## Apa yang diperiksa

Skrip memeriksa validitas, jenis dan App ID token, lalu membaca Page beserta ID
Instagram yang terhubung. Pagination dibatasi dan URL eksternal dari respons
tidak diikuti. ID akun besar dipertahankan sebagai string.

Hanya token USER valid untuk App ID server dengan izin dasar dan daftar Page
yang dipakai untuk discovery alternatif ini. Bila Page benar-benar terhubung
ke ID perusahaan, profil terbaca, dan izin publikasi ada, skrip memeriksa kuota
publikasi melalui GET. Tidak ada permintaan POST atau perubahan database.

Bagian `facebookLogin` dalam laporan menunjukkan:

- `pages.companyLinked`: Page yang dapat diakses terhubung ke akun perusahaan.
- `companyProfileReadable`: profil akun perusahaan dapat dibaca.
- `publishingAccess.verified`: edge kuota publikasi dapat dibaca.
- `readyForConnectionTest`: ketiga pemeriksaan tadi berhasil. Ini belum
  menandakan migrasi koneksi website ataupun pengujian publikasi sudah selesai.

Laporan hanya mencetak status, jumlah, izin yang dikenal, dan kode/trace error.
Token, Page access token, App Secret, nama Page, dan username tidak dicetak.
Setelah pemeriksaan, kosongkan nilai token diagnostik dari `.env.local`.

## Tindak lanjut dari pemeriksaan awal

Implementasi koneksi website perlu memakai alur Facebook Login yang sesuai,
penemuan akun melalui Page, serta penyimpanan User/Page credential dan masa
berlakunya. Token USER tidak dapat dimasukkan begitu saja ke penyimpanan
credential Unified yang mengharuskan system user serta client business ID.
Implementasi tersebut kini tersedia untuk mode Facebook dengan ID perusahaan
yang ditetapkan di server, dan sudah divalidasi menggunakan koneksi asli.

## Referensi

- [Meta: Instagram API with Facebook Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login)
- [Meta: Get Started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/get-started)
- [Meta: Long-lived access tokens](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived)
- [Meta: Use cases dan izin aplikasi](https://developers.facebook.com/documentation/development/create-an-app)
- [Artikel yang ditinjau](https://apidog.com/id/blog/how-to-use-instagram-graph-api/)

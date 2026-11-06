# Dua akun Google Drive melalui konfigurasi server

Upload menggunakan akun pertama lebih dulu. Jika sisa kapasitas tidak cukup atau Google mengembalikan `storageQuotaExceeded`, berkas dicoba di akun kedua. Folder akun kedua dibuat di Drive milik akun kedua, sehingga penggunaan ruangnya benar-benar terpisah. Tidak ada menu baru atau koneksi/token yang disimpan di database.

## Konfigurasi

Koneksi pertama tetap memakai `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, serta folder yang sudah ada.

Tambahkan pada environment aplikasi produksi atau `.env.local` di pengembangan:

```dotenv
GOOGLE_DRIVE_2_REFRESH_TOKEN=refresh_token_dari_akun_google_kedua
```

Token kedua harus diterbitkan untuk OAuth client yang sama dengan akun pertama. Jika memakai OAuth client lain, tambahkan juga `GOOGLE_DRIVE_2_CLIENT_ID` dan `GOOGLE_DRIVE_2_CLIENT_SECRET` untuk client tersebut.

Untuk memperoleh refresh token dengan pola konfigurasi lama proyek:

1. Buka [Google OAuth Playground](https://developers.google.com/oauthplayground/).
2. Aktifkan **Use your own OAuth credentials** dan gunakan OAuth client server. Client harus mengizinkan redirect `https://developers.google.com/oauthplayground`.
3. Minta scope `https://www.googleapis.com/auth/drive.file`, otorisasi menggunakan akun Google kedua, lalu tukarkan authorization code menjadi token. Gunakan refresh token untuk `GOOGLE_DRIVE_2_REFRESH_TOKEN`.
4. Isi token langsung di environment server, lalu restart proses aplikasi dan scraper.
5. Jalankan `npm run diagnose:drive`. Pastikan dua akun terhubung dengan alamat akun yang berbeda dan akun kedua memiliki ruang kosong.

Opsional, gunakan folder tertentu yang dapat diakses akun kedua:

```dotenv
GOOGLE_DRIVE_2_FOLDER=id_folder_foto_properti
GOOGLE_DRIVE_2_AGENT_FOLDER=id_folder_data_agen
GOOGLE_DRIVE_2_ATTACHMENTS_FOLDER=id_folder_lampiran
```

Jika variabel folder tidak diisi, sistem membuat `Solusindo Aset/Foto Properti`, `Solusindo Aset/Data Agen`, dan `Solusindo Aset/Lampiran Lelang` saat jenis upload tersebut pertama kali digunakan. Folder akun pertama tidak dipakai otomatis sebagai folder akun kedua. URL/file ID lama tetap valid; penghapusan berkas yang diganti mencari akun pemiliknya.

## Perilaku kegagalan

- Semua akun penuh: respons 507 dengan pesan kapasitas habis.
- Error izin, batas permintaan API, dan token kedaluwarsa dibedakan dari kapasitas penuh.
- Hasil upload yang tidak pasti karena koneksi terputus tidak langsung diulang ke akun lain, untuk mengurangi berkas ganda.
- Kebijakan berbagi mengikuti pemanggil upload. Helper tidak memberi akses publik secara bawaan.
- Jalur yang tercakup: foto properti, foto tipe kamar kos, KTP closing, KTP/NPWP/foto profil agen, pendaftaran agen, lampiran scrape web, dan scraper terminal.

## Verifikasi

`npm run test:drive` menguji fallback, folder terpisah, error izin/koneksi, pembersihan berkas, pengurutan cover, dan status tanpa membocorkan token. Tidak mengunggah berkas ke akun Google sungguhan. `npm run diagnose:drive` hanya membaca status akun dan kapasitas.

Referensi: [error Drive](https://developers.google.com/workspace/drive/api/guides/handle-errors), [scope Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [OAuth offline access](https://developers.google.com/identity/protocols/oauth2/web-server#offline).

Hasil pemeriksaan 4 November 2026: 16 tes lulus; build produksi terisolasi berhasil; pemeriksaan status asli menunjukkan baru satu akun terkonfigurasi dengan sisa 6.863 byte. Akun kedua belum aktif sebelum refresh token aslinya diisi. Typecheck jalur upload hanya tertahan dua error lama di `authOptions.ts:366`; audit UI tetap memuat 163 temuan lama seperti sebelum perubahan. Pemeriksaan tidak mengunggah berkas uji ke Drive sungguhan.

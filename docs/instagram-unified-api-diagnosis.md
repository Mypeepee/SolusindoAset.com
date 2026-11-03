# Diagnosis akses profil Unified Login

Pemeriksaan 27 Oktober 2026 setelah callback dan delivery Test webhook berhasil.
Dokumen ini merupakan laporan lokal; belum dikirim ke Meta.

Pemilik memilih **konfirmasi ke Meta dahulu** menggunakan portofolio saat ini.
[Draf tiket siap disalin](./instagram-meta-support-request.md) sudah disiapkan;
belum dikirim dan belum ada portofolio atau aplikasi baru yang dibuat.

Update 28 Oktober 2026 WIB: jalur alternatif Facebook USER token berhasil
membaca profil serta kuota publikasi akun perusahaan. Koneksi website kini
disimpan memakai mode Facebook. Hasil ini tidak menetapkan penyebab kegagalan
BISU yang dilaporkan di bawah. Detail keberhasilan dan konfigurasi pemeliharaan
ada pada [panduan Facebook Login](./instagram-facebook-login-test.md).

## Hasil otorisasi terbaru

- App: SolusindoAset, `1113966761486383`.
- Configuration ID: `1106771008629719`.
- Client business ID: `1594322086067570` (Solusindo Premier Property).
- Instagram perusahaan: `17841419691674191`, `@solusindopremier`.
- Token valid, App ID cocok, tipe `SYSTEM_USER`.
- Izin basic, publish, comments, messages, dan insights tersedia.
- Pembacaan identitas system user serta bisnis klien berhasil.
- `/me/assigned_instagram_accounts`: HTTP 200, daftar kosong, tidak ada halaman berikutnya.
- Endpoint yang sama dengan ID system user eksplisit juga kosong.
- Profil `/17841419691674191?fields=id,username`: kode 100, subkode 33.
- Kuota publikasi akun: kode 100, subkode 33.
- Permintaan native HTTPS yang melewati Next.js dan helper Graph website
  mengembalikan daftar kosong dan penolakan profil yang sama.
- Transport Bearer maupun parameter token, dengan/tanpa appsecret proof,
  serta perbandingan v25.0/v26.0 tidak menghasilkan akses profil.

Trace ID terbaru untuk investigasi Meta:

| Pemeriksaan | Trace ID |
| --- | --- |
| Profil melalui helper Graph | `AVpdfuxqJ2ymsP3ER8PVHw-` |
| Kuota publikasi | `AlmL3nPPEcJO15ds-8BdPdC` |
| Profil melalui native HTTPS | `ATn8ZiIIXd_Fq1w76nO6ZsB` |

`business_management` tidak tersedia. Penolakan endpoint administratif
`owned_instagram_accounts` karena izin tersebut tidak dipakai sebagai bukti
bahwa lima izin Instagram di atas kurang.

Website belum menyimpan koneksi aktif dan tidak mengaktifkan publikasi.
Callback webhook serta delivery Test yang berhasil tidak mengubah hasil
pembacaan profil. ID contoh webhook diabaikan karena berbeda dari akun
perusahaan.

## Kesimpulan dan batasnya

Penolakan profil berasal dari API Meta dan dapat direproduksi melalui
permintaan langsung di luar jalur normal website. Ini mempersempit masalah
ke akses objek/penetapan aset atau persyaratan integrasi; bukan bukti bahwa
seluruh implementasi website bebas kesalahan ataupun ada bug Meta yang pasti.

Dokumentasi Facebook Login for Business, bagian persyaratan BISU, meminta
portofolio pemilik aplikasi terpisah dari portofolio bisnis klien. Berdasarkan
tangkapan layar dan informasi pemilik, aplikasi serta Instagram saat ini
dimiliki oleh portofolio yang sama. Pemisahan belum diuji dan belum terbukti
menyelesaikan error 100/33. Panduan troubleshooting Unified Login juga tidak
secara spesifik menetapkan alasan error ini untuk kasus tersebut.

Panduan Unified Login memperbolehkan pengujian Standard Access oleh orang
yang memiliki peran aplikasi. Karena itu, status Unpublished saja tidak cukup
untuk menyimpulkan App Review pasti memperbaiki akses profil pengujian ini.

## Dua tindak lanjut yang konkret

### Uji persyaratan portofolio dengan aplikasi terpisah

1. Pemilik membuat portofolio kedua khusus pengelolaan aplikasi, menggunakan
   informasi bisnis yang benar.
2. Buat aplikasi uji baru di bawah portofolio itu dan konfigurasi Unified Login.
   Solusindo Premier Property yang sekarang tetap menjadi pemilik Instagram.
3. Administrator aplikasi mempunyai full control pada bisnis klien dan akun
   Instagram ditetapkan sebagai tester aplikasi uji.
4. Daftarkan callback OAuth yang sudah tersedia. Uji token secara terpisah dari
   konfigurasi website aktif; periksa App ID, bisnis klien, assigned accounts,
   profil, dan kuota publikasi melalui GET.
5. Ubah konfigurasi website hanya setelah profil dan akses publikasi berhasil
   divalidasi. Publikasi otomatis tetap membutuhkan pengaktifan dari pemilik.

Langkah ini menambah resource Meta dan memerlukan keputusan pemilik. Belum
ada portofolio atau aplikasi baru yang dibuat, dan belum ada aset dipindah.

### Minta investigasi Meta dengan portofolio sekarang

Kirim App ID, Configuration ID, ID bisnis dan Instagram, hasil permintaan,
trace ID, waktu percobaan dengan zona WIB, serta bukti akun muncul pada consent
dan Connected apps. Jelaskan bahwa admin bisnis/aplikasi serta Instagram Tester
sudah diperiksa. Tanyakan apakah pengujian Unified Login boleh memakai
portofolio pemilik aplikasi yang sama dengan pemilik akun Instagram, dan
mengapa daftar assigned accounts kosong walaupun aset terlihat dibagikan.

Jangan sertakan token, App Secret, kata sandi, OAuth code/state, atau cookie.
Dokumen ini tidak memuat credential tersebut dan belum dikirim ke pihak lain.

## Referensi resmi yang diperiksa

- [Get started with Unified Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started)
- [Authentication and access tokens](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication)
- [Facebook Login for Business — BISU requirements](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business#business-integration-system-user-access-tokens)
- [Eligibility and troubleshooting](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/eligibility-and-troubleshooting)

# Tujuan percakapan dan pengalihan ke Jason

Pemeriksaan tujuan mendahului kualifikasi pembeli, pencarian katalog, penyimpanan
lead, pengajuan survei, dan jawaban AI. Kata “aset”, “rumah”, “beli”, atau “lelang”
tidak cukup untuk memasukkan pengirim ke alur pencarian.

## Urusan yang ditangani manusia

- Kuasa hukum atau pihak lama yang membahas aset, somasi, perkara, dan keberatan.
- Pembelian kembali/penebusan aset, termasuk “beli kembali rmh lelang atas nm Bu Ratna”.
- Tindak lanjut aset yang sudah dibeli/dimenangkan, pemilik lama, debitur, atau ahli waris.
- Permintaan berkomunikasi langsung dengan Jason, salah nomor, dan urusan pribadi.
- Pemilik yang menawarkan atau menitipkan properti untuk dijual/disewakan;
  calon pembeli yang ingin membeli untuk dijual lagi tetap dilayani.
- Pada konfigurasi live: pekerjaan lain yang jelas seperti invoice, rapat, lamaran,
  maupun jual/sewa barang selain properti.

Balasan tetap:

> Baik, saya asisten virtual Pak Jason. Pesan Bapak/Ibu akan ditangani langsung
> oleh Pak Jason. Mohon ditunggu ya.

Pemberitahuan dikirim satu kali lalu bot dijeda. Pesan berikutnya tidak ditanya
jenis transaksi, daerah, budget, atau luas tanah. Jeda tersimpan melalui kontrol
percakapan yang sama dengan handover manusia; restart, batas waktu sesi, pesan
website baru, dan alias nomor/LID tidak mengaktifkan bot sendiri. Pesan setelah
pengalihan ini juga tidak disimpan sebagai jawaban yang akan diputar ulang.
Aktivasi manual tetap tersedia lewat kontrol bot yang sudah ada.

Pemberitahuan dapat dikirim kepada kontak baru tanpa template website, tetapi
pengecualian itu hanya mengalihkan percakapan dan tidak memberikan izin pencarian.
Jika pemilik sudah mengambil alih atau menjeda bot, bot menghormati kontrol itu
dan tidak menyisipkan pemberitahuan tambahan. Tidak ada pesan otomatis ke kontak
ketiga yang ditambahkan oleh perubahan ini; Jason menangani chat WhatsApp yang sama.

## Calon pembeli tetap dilayani

Profesi dan status pembelian sebelumnya bukan alasan tunggal untuk menolak
pencarian baru. Misalnya, “Saya advokat, carikan rumah lelang di Surabaya”,
“Kami law firm mau beli kantor”, dan “Saya sudah beli rumah, sekarang cari ruko
baru” tetap masuk alur pencarian dalam sesi yang sudah dibuka dari website.
“Kalau sudah menang lelang bagaimana prosesnya?” adalah pertanyaan calon pembeli,
bukan bukti sudah terjadi pembelian. Syarat pencarian “bebas sengketa” juga tidak
dianggap pengajuan sengketa atas aset tertentu.

Aturan lokal mengenali tujuan yang jelas. Pesan perwakilan yang belum jelas
diperiksa oleh penafsir terstruktur dengan keluaran `human`, `property_search`,
`property`, `other`, atau `unclear` serta bukti kutipan pesan. Pemeriksaan ini
tetap berjalan pada pesan yang menyebut properti. Jika maksud perwakilan belum
bisa dipastikan atau penafsir gagal, pesan dialihkan ke Jason. Uji penafsir memakai
provider tiruan, bukan klaim akurasi model produksi pada seluruh bahasa.

## Ukuran tanah

“7,5 x 15”, “7.5 × 15”, dan “7,5 meter dikalikan 15 meter” dibaca sebagai 112,5 m²,
bukan nominal budget. Jika pengirim belum memilih batas minimal/maksimal/persis,
angka disimpan untuk klarifikasi. Jawaban “batas minimal” atau “batas maksimal”
memakai angka terakhir, termasuk koreksi “120 meter persegi” atau “+/- 120 meter
persegi”. Tidak ada rentang toleransi yang dikarang dari tanda perkiraan.
Ukuran bangunan yang disebut secara eksplisit tidak dipakai sebagai luas tanah.
Pada percakapan kuasa hukum, pesan ukuran tidak diproses sebagai kriteria pembeli.

## Verifikasi dan aktivasi

```sh
cd backend/whatsapp
node --test test/conversation_purpose.test.js test/land_dimensions.test.js
npm run simulate:purpose -- --output=/tmp/kosku-purpose-simulation
```

Simulasi memutar ulang seluruh chat ARN melalui `MessageProcessor`, dari kontak
baru, setelah template website, dan dari sesi pencarian lama. Kasus pembanding
memastikan pencarian nyata tetap dilayani. Katalog, CRM, dan WhatsApp memakai
fixture; tidak ada WhatsApp nyata, AI eksternal, atau database nyata yang dipanggil.
Transkrip dan hasil terstruktur disimpan sebagai `transkrip.md` dan `hasil.json`.

Backend yang berjalan perlu memuat kode baru. Setelah deployment/restart, periksa
`GET /health`: `understanding_version` harus `2026-11-06-overnight-followup-v33`.

Calon pembeli dari link mempunyai masa aktif sendiri, default tujuh hari tanpa
pesan, sehingga jawaban keesokan hari tidak dianggap pesan dari kontak baru.
Jenis pertanyaan server terakhir disimpan untuk melanjutkan “Ya” setelah restart;
jeda manusia tetap diutamakan. Lihat `test/overnight_followup.test.js`.

# SOP respons jadwal lelang dan konfirmasi stok

Contoh dihasilkan langsung oleh formatter backend, dengan waktu uji 22 Oktober 2026 pukul 15.52 WIB. Angka berasal dari contoh percakapan; ini bukan pengecekan ketersediaan produksi.

## Jadwal mendatang: 27 Oktober, lima hari lagi

```text
*DETAIL ASET — Kode 180642*
📍 Perum Graha Kencana Batujajar, Blok G3 No. 17, Desa Batujajar Timur, Kec. Batujajar, Kab. Bandung Barat, Prov. Jawa Barat
• Jenis transaksi: Lelang
• Jenis properti: rumah

*Harga limit: Rp 218.000.000*
_Harga limit adalah harga awal penawaran lelang, belum termasuk biaya pembelian. Harga menang dapat lebih tinggi._

*SPESIFIKASI*
• Luas tanah: 138 m²
• Luas bangunan: belum tercatat

🔗 Detail aset:
https://solusindoaset.com/Lelang/1-bidang-tanah-dengan-total-luas-138-m-berikut-bangunan-di-kab-bandung-barat-1791865707117-zb7e-180642/AG108

🟢 Aset ini masih tercatat *Tersedia* di website.

🗓️ Jadwal lelang: *27 Oktober 2026 WIB* — tinggal *5 hari lagi* menuju jadwal lelang.

Jika unit ini sesuai kebutuhan Bapak/Ibu, sebaiknya cek kondisi dari luar dan siapkan dokumen serta kebutuhan dananya sejak sekarang, agar siap mengikuti jadwal ini. Batas pendaftaran, jaminan, dan penawaran mengikuti pengumuman resmi.

Mau saya hitungkan rincian estimasi biaya pembeliannya?
```

## Jadwal lewat: ilustrasi 21 Oktober

```text
Halo Bapak/Ibu, saya asisten virtual Bapak Jason di Solusindo Aset. Berikut detail aset yang diminati berdasarkan listing terbaru. 🙏

*DETAIL ASET — Kode 180642*
📍 Perum Graha Kencana Batujajar, Blok G3 No. 17, Desa Batujajar Timur, Kec. Batujajar, Kab. Bandung Barat, Prov. Jawa Barat
• Jenis transaksi: Lelang
• Jenis properti: rumah

*Harga limit: Rp 432.000.000*
_Harga limit adalah harga awal penawaran lelang, belum termasuk biaya pembelian. Harga menang dapat lebih tinggi._

*SPESIFIKASI*
• Luas tanah: 113 m²
• Luas bangunan: belum tercatat

🔗 Detail aset:
https://solusindoaset.com/Lelang/1-bidang-tanah-dengan-total-luas-138-m-berikut-bangunan-di-kab-bandung-barat-1791865707117-zb7e-180642/AG108

Di database kami, aset ini masih tercatat *Tersedia*, tetapi jadwal lelang pada *21 Oktober 2026* sudah terlewat. Permintaan konfirmasi stok sudah saya kirim ke bagian stoker melalui WhatsApp. Kita menunggu jawaban mengenai ketersediaannya; tim internal kami akan menindaklanjuti, termasuk konfirmasi ke KPKNL bila diperlukan.

Pengecekan ini untuk memastikan apakah aset sudah dimenangkan pihak lain sementara data belum diperbarui, atau akan dijadwalkan lelang ulang (retender). Hasil lelang maupun jadwal baru belum dapat saya pastikan.

Mau saya hitungkan rincian estimasi biaya pembeliannya?
```

## Pesan ke stoker 6285707379606

```text
🔍 *Konfirmasi Stok Properti*

🆔 *ID:* 180642
📍 *Lokasi:* Perum Graha Kencana Batujajar, Blok G3 No. 17, Desa Batujajar Timur, Kec. Batujajar, Kab. Bandung Barat, Prov. Jawa Barat
📅 *Tanggal Lelang:* 21 Oktober 2026

❓ Apakah aset ini masih *TERSEDIA* atau sudah *TERJUAL*?

Ada respon dari klien kami yang sedang menanyakan. Mohon konfirmasi segera. 🙏

🔗 *Lihat detail properti:*
https://solusindoaset.com/Lelang/1-bidang-tanah-dengan-total-luas-138-m-berikut-bangunan-di-kab-bandung-barat-1791865707117-zb7e-180642
```

## Perilaku dan batas data

- Timestamp listing menentukan apakah jadwal sudah lewat. Sisa hari dihitung dari tanggal kalender Asia/Jakarta, termasuk batas bulan/tahun.
- Jadwal mendatang tidak membuat permintaan stok. Jadwal lewat mengirim melalui outbox: satu kiriman per agen/aset/jadwal/nomor stoker, termasuk setelah restart atau beberapa klien bertanya.
- Tersedia di website tidak dianggap bukti stok aktual. Bot tidak mengarang antrean peminat, janji kehabisan atau kemenangan.
- Tanggal lelang berbeda dari tenggat pendaftaran, jaminan dan penawaran. Jika tenggat yang diketahui sudah lewat, bot meminta kepastian bisa ikut sebelum mengajak melanjutkan.
- Hanya pengiriman berstatus sent diakui sebagai sudah dikirim. Putus koneksi, gagal atau hasil belum pasti tetap dijelaskan sesuai keadaan.
- Jawaban boleh pada tawaran biaya menghitung aset yang sama; pencarian pengganti memerlukan permintaan klien. Sesi lama dengan pertanyaan opsi cadangan tetap bisa dilanjutkan.
- Slug detail dipertahankan pada pesan stoker; kode agen AG108 dilepas dari tautan kanonik.

## Dasar redaksi

Urgensi memakai sisa waktu nyata untuk memeriksa objek, membaca pengumuman, menyiapkan tahapan dan menghindari keterlambatan. Rujukan: [artikel Opini Kemenkeu oleh Mohammad Eko Agus, 26 Agustus 2026](https://opini.kemenkeu.go.id/pages/read/sudah-siap-menawar-jangan-sampai-gagal-karena-terlambat). Artikel tersebut adalah opini penulis, bukan penetapan tenggat khusus untuk aset ini.

## Penerapan

Kode lokal belum diterapkan ke produksi. Backend perlu diperbarui dan di-restart. Periksa /health: understanding_version=2026-10-22-auction-timeline-v31 dan stock_confirmation_version=2026-10-22-auction-timeline-v2. Nomor stoker pada backend/whatsapp/.env lokal sudah 6285707379606. Tidak ada pesan WhatsApp nyata yang dikirim selama validasi.

## Validasi

Pada 22 Oktober 2026, `node --test --test-timeout=120000` dari direktori
`backend/whatsapp` lulus 1.233 tes, tanpa kegagalan. Regresi baru menguji
pergantian tanggal WIB/bulan/tahun, hari ini/besok, tenggat pendaftaran/jaminan
yang lebih awal, tautan/kode/template, respons biaya setelah “boleh”, kiriman
stoker satu kali setelah restart/pertanyaan berulang, dan klaim tanggal salah
dari OpenAI maupun Gemini. Transport serta provider memakai layanan tiruan.

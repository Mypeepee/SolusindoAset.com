# Contoh balasan biaya aset pilihan

Contoh ini dihasilkan formatter backend dari data yang diberikan pada percakapan 22 Oktober 2026, bukan pemeriksaan ketersediaan listing produksi. Runtime selalu membaca ulang listing sebelum menghitung.

Pesan klien: “Boleh bantu di hitungkan semua biaya sampai dengan balik nama / unit bisa di tempati”.

```text
*ESTIMASI BIAYA PEMBELIAN LELANG*
_1 bidang tanah dengan total luas 138 m² berikut bangunan di Kab. Bandung Barat_
📍 Perum Graha Kencana Batujajar, Blok G3 No. 17 (disertifikat tertulis Blok G3-17), Desa Batujajar Timur, Kec. Batujajar, Kab. Bandung Barat, Prov. Jawa Barat
🗓️ Lelang: 27 Oktober 2026

━━━━━━━━━━━━━━
*HARGA LIMIT*
*Rp 218.000.000*
_Harga limit belum all-in; harga menang lelang dapat lebih tinggi._
_Komponen persentase di bawah dihitung dari harga menang lelang; saat ini diestimasi dari harga limit._

━━━━━━━━━━━━━━
*A. BIAYA BALIK NAMA*
_Komponen persentase mengikuti harga menang lelang._
• Bea Lelang 2% — Rp 4.360.000
• BPHTB 5% — Rp 10.900.000
• PPN Lelang 1,1% — Rp 2.398.000
• Roya & Balik Nama 0,4% — Rp 872.000
• Fee Jasa Pengurusan — Rp 10.000.000
▸ *Subtotal: Rp 28.530.000*

━━━━━━━━━━━━━━
*B. PENYELESAIAN PENGOSONGAN*
_Biaya pengosongan selalu menggunakan estimasi eksekusi pengadilan worst case._
• Eksekusi pengosongan — Rp 150.000.000
• Transportasi 6 truk + 15 kuli — Rp 6.800.000
• Konsumsi aparat (100 orang) — Rp 3.000.000
• Fee jasa advokat — Rp 25.000.000
• Tempat perpindahan barang — _tentatif_
▸ *Estimasi worst case: Rp 184.800.000*

━━━━━━━━━━━━━━
*C. FEE AGENT*
_Dihitung dari harga menang lelang._
• Fee Agent 5% — Rp 10.900.000
▸ *Subtotal: Rp 10.900.000*

━━━━━━━━━━━━━━
*ESTIMASI MODAL — WORST CASE*
*Rp 442.230.000*
_Limit Rp 218 Jt_
_Balik nama Rp 29 Jt + eksekusi Rp 185 Jt + fee agent Rp 11 Jt_

_Tempat perpindahan barang bersifat tentatif dan belum masuk total._
_Angka di atas estimasi, belum termasuk pajak & biaya lain di luar daftar. Tarif dan kebutuhan pengosongan perlu dikonfirmasi sesuai aset._
_Nominal dibulatkan ke rupiah. Uang jaminan bagian pembayaran harga, bukan biaya tambahan. Harga menang dapat melebihi limit._

🔗 Detail aset:
https://solusindoaset.com/Lelang/1-bidang-tanah-dengan-total-luas-138-m-berikut-bangunan-di-kab-bandung-barat-1791865707117-zb7e-180642/AG108

Apakah Bapak/Ibu ingin saya jelaskan kondisi aset dan cara melihatnya dari luar?
```

## Validasi dan penerapan

Pada 22 Oktober 2026, `node --test` dari `backend/whatsapp` lulus 1.216 tes.
Regresi baru meliputi permintaan persis dari klien, bahasa informal/daerah/campuran,
jawaban “boleh”, tanggal mendatang, harga yang berubah, aset yang tidak ditemukan,
pencarian baru yang eksplisit, WhatsApp setelah restart, dan Playground.
Pengujian memakai katalog serta transport tiruan, tanpa pesan nyata ke klien.

Perubahan belum diterapkan ke produksi. Backend WhatsApp perlu diperbarui dan
di-restart; versi terbaru setelah pembaruan SOP jadwal lelang:
`2026-10-22-auction-timeline-v31`. Lihat [SOP jadwal lelang](auction-timeline-sop.md).

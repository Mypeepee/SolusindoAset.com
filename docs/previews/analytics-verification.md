# Verifikasi Analitik Pemasaran

Tanggal: 2 November 2026. Redesign lokal pada workspace Pemasaran; tidak ada deployment atau publikasi konten.

## Perilaku yang diterapkan

- Dark emerald dengan mint, sky, rose, violet, amber, dan teal untuk membedakan metrik.
- Ringkasan dengan cakupan data, grafik per tanggal terbit WIB, sorotan konten, dan peringkat posting.
- Perbandingan jenis, lokasi, harga, serta luas tanah; volume posting dipisahkan dari median respons.
- Proyeksi views berdasarkan persentil historis per jenis/kanal. Minimal lima posting berusia 72 jam, tiga identitas properti yang diketahui, serta rentang terbit 14 hari. Identitas yang hilang tidak dihitung sebagai properti berbeda.
- Pencarian, filter URL, pagination, detail jangkauan/simpan/bagikan, komentar, sinkronisasi per posting, dan ekspor CSV seluruh hasil terfilter.
- Data kosong tetap tidak tersedia; nol yang diterima dari sumber tetap nol. Kanal WhatsApp hanya menyatakan hitungan teramati.

## Hasil pemeriksaan

- `npm run test:marketing`: 188 tes lulus, termasuk 12 tes khusus Analitik.
- `NEXT_BUILD_DIR=.next-analytics-build npm run build`: build produksi berhasil. Konfigurasi repositori yang sudah ada melewati pemeriksaan tipe/lint saat build, sehingga typecheck diperiksa terpisah.
- Audit UI strict untuk kontrak Pemasaran: tidak ada temuan. Lihat [hasil JSON](analytics-ui-audit.json).
- Browser Chrome: berhasil pada lebar 1512, 1024, 768, 390, dan 320px; tanpa error JavaScript atau overflow horizontal Analitik. Lihat [hasil JSON](analytics-verification.json).
- Browser mencakup pencarian/kosong/reset, keyboard sort dan grafik, lebar popup, Escape/fokus kembali, pagination, komentar, kegagalan refresh/retry, kanal WA, filter segmen, isi CSV, reduced motion, dan pembatalan respons bulan yang terlambat.
- Endpoint asli diuji dengan pembacaan OWNER, private/no-store, penolakan 401 tanpa sesi, serta penolakan bulan tidak valid. Tidak ada pengiriman ke provider atau perubahan database oleh skrip QA ini. Data dengan metrik untuk pengujian UI diintersepsi di browser dan diberi label Data pengujian Analitik.

## Batas verifikasi tipe

Pemeriksaan tipe seluruh repositori kehabisan heap bawaan. Pemeriksaan terarah pada workspace Pemasaran/API dan dependensinya selesai, tetapi melaporkan dua error yang sudah ada pada `src/app/api/auth/[...nextauth]/authOptions.ts:366`: properti event `error` tidak dikenal dan parameter `message` memiliki implicit any. File autentikasi tidak diubah. Tidak ada diagnostik pada implementasi Analitik yang diubah.

Tidak ada formatter yang dikonfigurasi dalam skrip proyek. Analisis ini mencakup publikasi dari Pemasaran; unggahan manual di luar Pemasaran serta arsitektur/jumlah kamar yang belum ditandai tidak diinferensikan.

## Pratinjau dengan data pengujian

- [Desktop](analytics-desktop.png)
- [Perbandingan audiens dan proyeksi](analytics-insights.png)
- [Peringkat posting](analytics-posts.png)
- [Ponsel 320px](analytics-320.png)
- [Analisis audiens 320px](analytics-insights-320.png)
- [Kartu posting 320px](analytics-posts-320.png)
- [Kondisi kosong 320px](analytics-empty-320.png)

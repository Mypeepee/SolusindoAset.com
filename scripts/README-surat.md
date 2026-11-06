# Pemeriksaan generate surat

- `npm run test:surat`: validasi, pemetaan OCR, seluruh route/template, query sesuai skema Prisma, kegagalan, rollback register, dan unduhan. Database selalu tiruan di memori.
- `npm run test:surat:pdf`: pemeriksaan yang sama dengan konversi LibreOffice asli, termasuk isi panjang. Memerlukan LibreOffice atau `SOFFICE_PATH`. PDF uji ditulis ke `/tmp/kosku-surat-qa`.
- `npm run verify:surat:browser`: setelah tes PDF dan server lokal berjalan, menguji semua form dengan Chrome, gagal lalu coba ulang, dan unduhan. `SURAT_QA_ORIGIN` membatasi tujuan ke localhost; default port 3001. Hanya membaca akun OWNER untuk sesi lokal; seluruh mutasi dicegat. Memerlukan Chrome pada lokasi macOS yang tercantum di skrip.

Permohonan PN dan Grosse memakai salinan template dinamis. Berkas asli tetap tersedia. Jika template asli diperbarui, jalankan `python3 scripts/prepare-permohonan-templates.py`, sesuaikan pemetaan teks yang berubah secara sengaja, lalu jalankan tes PDF. Jangan menyalin hasil surat berisi identitas tetap menjadi template dinamis.

## Hasil pemeriksaan 4 November 2026

- Tes PDF lengkap: 18 lulus, 0 gagal. Sebelas skenario mencakup seluruh generator, dua skema MOU, dan Grosse sendiri/kuasa. Dokumen panjang diuji terpisah dalam suite yang sama; semua halaman serta surat kuasanya tetap ada.
- Chrome lokal: delapan form lulus skenario gagal/coba ulang dan unduhan. Sembilan unduhan teramati, termasuk satu PN melalui handler HTTP dan LibreOffice asli. Validasi, pemetaan OCR, Escape, perlindungan isian, tampilan 390px, dan reduced motion diperiksa. Mutasi finansial/register dicegat; tidak ada fixture ditulis ke database sungguhan.
- Build produksi terisolasi berhasil. Direktori hasil build uji sudah dibersihkan; server pengembangan dan template Word asli tetap tersedia.
- Typecheck terfokus menemukan dua error yang sudah ada di `authOptions.ts:366` (`events.error`). Typecheck proyek penuh sebelumnya melewati batas heap bawaan Node. Konfigurasi build proyek memang melewati pemeriksaan tipe/lint, sehingga build berhasil bukan bukti bahwa typecheck global bersih.
- ESLint belum dikonfigurasi; `npm run lint` meminta setup. Audit UI statis tetap mencatat 163 temuan lama, sama dengan sebelum perubahan, termasuk komponen surat lama yang tidak digunakan halaman aktif. Laporan tersimpan di `/tmp/kosku-surat-premium-audit-after.json`.
- `git diff --check` bersih. Perubahan `tsconfig.json` yang sudah ada sebelum pekerjaan dan lock file Word pengguna dipertahankan.

# PDF draf MOU untuk klien yang berminat

Template sumber: `src/app/dashboard/surat/components/templates/MOU_Template_persentase_final.docx`.
Template sumber telah direvisi sesuai ketentuan pengguna: komisi 5%, biaya pengurusan dokumen Rp10 juta, serta pemisahan uang tanda jadi dan jaminan lelang. Pasal 4, 9, dan 11 memuat mekanisme pembayaran, pembatalan, dan refund. Pasal 5 dan kewenangan penyetoran pada Pasal 8 diselaraskan agar jaminan tidak diarahkan ke rekening perusahaan. Pada salinan draf, kantor KPKNL yang sebelumnya tetap Surabaya menjadi kolom konfirmasi.

## Perilaku percakapan

Setelah aset dipilih dan detail/biaya diterima, ucapan “oke pak, saya serius” masuk ke closing. Bot menjelaskan langkah berikutnya, kemudian mengirim satu dokumen `Draf_MOU_Aset_<id>.pdf` dengan caption:

> Saya lampirkan draf MOU aset pilihan Anda. Mulai dari Pasal 3 untuk biaya pendampingan, Pasal 4 untuk tanda jadi dan jaminan lelang, Pasal 9 untuk pembatalan, lalu Pasal 11 untuk pengembalian dana jika kalah. Data yang belum lengkap ditandai di dokumen; ketentuannya bisa dibahas bersama tim sebelum disetujui.

Minat/serius sesudah memilih aset kini langsung masuk `purchase_preparation`: nominal tanda jadi, persiapan KTP dan cover buku tabungan atas nama klien, serta draf PDF dengan panduan Pasal 3, 4 dan 11. Ini satu fokus persiapan pembelian, bukan urutan meminta izin menjelaskan setiap tahap SOP. Jawaban “baik” melanjutkan tawaran pendampingan; kesiapan berkas atau penerimaan tawaran itu membawa sesi ke `purchasing_handoff` dan menjeda bot. Handoff persiapan boleh dilakukan saat stok menunggu; pembayaran tetap menunggu kepastian aset dan persetujuan MOU. Status berkas/pembayaran tetap belum terverifikasi sampai diperiksa tim. Lampiran atau nomor identitas masuk tidak diberikan ke LLM; sesi dijeda untuk pemeriksaan manusia.

PDF tidak dikirim lagi pada tiap jawaban. Permintaan “kirim ulang PDF MOU” dapat menghasilkan salinan baru untuk aset yang sedang dipilih. Draf boleh dipelajari sebelum klien menyatakan seluruh proses dipahami. Jalur penjelasan SOP lama tetap menjawab pertanyaan spesifik, termasuk keberatan soal refund. Persetujuan tanda tangan dan permintaan pembayaran tidak disimpulkan dari ucapan minat atau “siap”.

Jika pembuatan atau pengiriman gagal, bot menyampaikan kegagalan itu. Tidak ada klaim file terkirim. Status pengiriman tersimpan dalam cursor percakapan; hasil yang tidak pasti tidak otomatis dicoba lagi setelah restart. Human takeover membatalkan pengiriman yang belum dimulai.

## Data PDF

Alamat, harga limit, uang jaminan, luas tanah, dan jenis legalitas dibaca ulang melalui proyeksi listing publik. Batas bidding hanya diisi dari batas yang dinyatakan klien dalam closing; budget pencarian tidak otomatis menjadi otorisasi bidding. Komisi selalu 5% dari harga menang dan biaya pengurusan dokumen Rp10 juta. Identitas/NIK klien, nomor sertifikat, biaya tambahan, dan tanggal tanda tangan yang belum diketahui ditandai untuk dilengkapi. Tidak membuat transaksi, tanda tangan, akun lelang, atau pembayaran.

PDF mempunyai halaman ringkasan dan watermark tepat bertuliskan `Draft - untuk dipelajari` di tengah setiap halaman, termasuk cover. Pada contoh kode 121037: limit Rp350 juta, jaminan Rp100 juta, LT200 m², legalitas LAINNYA, tanda jadi Rp20 juta. Pengiriman draf tidak membuka pembayaran saat stok masih menunggu.

Ketentuan yang dihitung oleh generator draf dan MOU transaksi persentase dari helper yang sama (`src/lib/server/mouPaymentTerms.mjs`):

- Pasal 3 mengikuti tabel PDF pilihan pengguna `Draf_MOU_Aset_121037.pdf`: harga limit, tanda jadi, jaminan, batas bidding, komisi 5%, biaya balik nama dan eksekusi worst case. Balik nama ditulis sebagai **rumus 8,5% dari Harga Menang Lelang + Rp10 juta**, tanpa nominal hasil estimasi dari limit, termasuk pada halaman ringkasan. Rumus berasal dari `mouPaymentFields`; nominal akhir mengikuti harga menang sesungguhnya. Eksekusi tetap menggunakan subtotal worst case sesuai band harga, wilayah dan luas tanah, tanpa rincian armada/konsumsi/advokat. Estimasi angka balik nama pada tombol Rincian Biaya website tetap tersedia dengan catatan dasar limit; angka itu tidak dicetak sebagai biaya tetap di MOU. Batas bidding yang belum ditentukan ditampilkan sekali. Proses mediasi pada pasal serah terima tetap berlaku.
- Contoh Semarang kode 121790, limit Rp3.043.000.000, LT306 m², Jawa Tengah: balik nama Rp268.655.000; eksekusi worst case Rp384.800.000; komisi 5%. Halaman publik yang diperiksa pada 20 Oktober 2026 mencatat jaminan Rp610.000.000 dan SHM; contoh pratinjau diperbarui dengan nilai listing tersebut. Kepastian hasil/jadwal lelang tetap menunggu verifikasi.
- Pasal 4 hanya menyebut nominal final dan terbilang uang tanda jadi. Rumus 10% dari limit dengan batas Rp20 juta tetap dihitung backend dan tidak ditampilkan di dokumen. Pembayaran kepada PIHAK KEDUA menunggu konfirmasi aset serta persetujuan perjanjian. Jaminan diambil dari kolom `listing.uang_jaminan` website melalui proyeksi publik `deposit`, dibaca ulang saat PDF dibuat; disetor terpisah melalui VA resmi kepesertaan atas nama PIHAK PERTAMA dan diperhitungkan ke harga lelang jika menang.
- Pasal 9 mengikuti redaksi gambar yang dipilih pengguna: PIHAK PERTAMA tidak diperkenankan mundur/membatalkan selama 90 hari sejak penandatanganan. Seluruh dana yang telah disetor dinyatakan hangus jika jaminan tidak disetorkan tepat waktu, atau jika menang tetapi tidak melunasi paling lambat H+5 (lima hari kerja) dari tanggal lelang. Redaksi pasal dipulihkan dari template awal; ketentuan refund karena kalah pada Pasal 11 tetap terpisah.
- Pasal 11: jika kalah, uang tanda jadi dengan nominal rupiah yang sama dikembalikan 100% tanpa potongan ke rekening PIHAK PERTAMA maksimal 5 hari sejak hasil lelang diumumkan. Jaminan dikembalikan oleh penyelenggara melalui mekanismenya sendiri; tenggat perusahaan tidak dipaksakan ke penyelenggara.
- Contoh revisi kode 121037 mengikuti data PDF pilihan: limit Rp350 juta, tanda jadi Rp20 juta, jaminan Rp100 juta, komisi 5%, rumus balik nama 8,5% dari harga menang + Rp10 juta, dan estimasi eksekusi worst case Rp159,8 juta sesuai kebijakan biaya website untuk Jawa Timur. Nominal balik nama Rp39,75 juta dari estimasi berbasis limit tidak dicetak pada MOU atau cover. File rujukan pengguna dipertahankan; hasil revisi disimpan dengan nama berbeda.
- Contoh limit Rp100 juta dan jaminan Rp10 juta menghasilkan tanda jadi Rp10 juta. Limit Rp350 juta dengan jaminan Rp100 juta menghasilkan tanda jadi Rp20 juta, bukan Rp35 juta atau Rp100 juta. Budget maksimal bidding tidak mengubah hitungan tanda jadi.
- Jawaban refund bot menyebut nominal tanda jadi dan tenggat 5 hari sejak hasil lelang diumumkan, lalu merujuk ketentuan pembatalan/kewajiban pembayaran di Pasal 9. Ringkasan Pasal 9 pada cover dan system prompt memakai teks yang sama. Rewrite LLM yang mengganti tenggat refund menjadi hari kerja, mengubah rekening refund atau mencampurkan ketentuan hangus ke penjelasan kalah lelang ditolak.

## Integrasi

Backend memakai `MouDocumentClient` jika konektor `PROPERTY_API_URL` dan `CHATBOT_PROPERTY_TOKEN` dikonfigurasi. URL PDF otomatis berada di direktori yang sama: `/api/internal/chatbot/mou-draft`. Route Next.js ini memvalidasi token, membatasi input pada `assetId`/`maxBid`, membaca ulang listing, mengisi DOCX dengan docxtemplater, lalu memakai konverter LibreOffice yang sudah digunakan fitur surat. Respons PDF dibatasi 4 MiB dan diikat ke `X-MOU-Asset-ID`.

Deploy route Next.js beserta generator dan template sumber sebelum mengaktifkan backend baru. Paket aplikasi harus menyertakan file template di `src/app/dashboard/surat/components/templates/` seperti generator surat yang sudah ada. LibreOffice dan `SOFFICE_PATH` memakai konfigurasi fitur surat yang sama. Tidak diperlukan token baru atau data KTP di prompt LLM.

Baileys mengirim buffer PDF sebagai dokumen. Cloud API mengunggah media lalu mengirim berdasarkan media ID, tanpa URL publik file. Referensi: [Meta Media API](https://www.postman.com/meta/whatsapp-business-platform/folder/13382743-ecb27be5-4d27-4763-bbee-6a8002c04bf3), [Meta document message](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/document/).

Playground membuat PDF yang sama dan menampilkan lampiran unduhan. Dokumen disimpan sementara selama 15 menit, maksimum 20 MiB keseluruhan per proses, dan hanya dapat diunduh melalui sesi agent yang sesuai. Reset/pembatalan tidak mengirim WhatsApp. Tidak ada penyimpanan PDF di direktori publik.

## Verifikasi

Dari akar proyek:

```sh
node --test scripts/test-chatbot-mou.cjs scripts/test-chatbot-integration.cjs
node scripts/test-lelang-costs.cjs --browser
node --experimental-strip-types scripts/preview-chatbot-mou.mjs
node --experimental-strip-types scripts/preview-chatbot-mou.mjs --example=100juta
node --experimental-strip-types scripts/preview-chatbot-mou.mjs --example=semarang
node --experimental-strip-types scripts/preview-chatbot-mou.mjs --asset-file=/private/tmp/semarang-listing-public-asset.json
```

Dari `backend/whatsapp`, jalankan `npm test`. Pengujian memakai transport WhatsApp tiruan, katalog simulasi, dan SQLite sementara. Konversi contoh menjalankan LibreOffice lokal dan menyimpan PDF di direktori sementara; tidak menghubungi klien atau memeriksa stok nyata.

Jalankan `npm run simulate:purchasing` untuk membuat PDF asli dan lima simulasi interest → persiapan → pendamping. Transkrip: `docs/simulasi-interest-ke-purchasing.md`. Laporan menyimpan kesiapan menurut klien terpisah dari status berkas dan pembayaran yang terverifikasi.

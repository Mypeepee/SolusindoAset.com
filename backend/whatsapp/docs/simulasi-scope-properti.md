# Sapaan netral dan pembatasan topik properti

Verifikasi 21 Oktober 2026: bot menyapa secara profesional tanpa menganggap
kontak baru sedang mencari properti. Pekerjaan di luar properti diabaikan tanpa
pesan penolakan atau pengalihan ke agen. Jika klien kembali membahas properti,
layanan berlanjut dengan konteks sebelumnya.

## Contoh yang diverifikasi di Playground lokal

| Klien | Bot |
| --- | --- |
| selamat siang | Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja? |
| saya verlyna | Salam kenal, Verlyna. Ada yang bisa saya bantu? |
| selamat siang, saya vera (pesan pertama dalam percakapan baru) | Salam kenal, Vera. Ada yang bisa saya bantu? |
| malam pak jason, saya vera (pesan pertama dalam percakapan baru) | Salam kenal, Vera. Ada yang bisa saya bantu? |
| tolong kirim invoice pekerjaan kemarin | Tidak ada balasan (`reply:null`, `suppressed:true`). |
| pak tolong carikan saya aset property di Surabaya | Siap, Verlyna. Saya bantu cari properti di Surabaya ya. Dilanjutkan pertanyaan jenis transaksi yang belum diketahui. |

Sapaan dan perkenalan boleh digabung, dengan atau tanpa koma, titik, baris baru,
atau sapaan kepada bot. Sepuluh variasi diperiksa sebagai pesan pertama dan
jawaban atas pertanyaan nama, serta melalui route Playground. Tiga variasi,
termasuk pesan persis “selamat siang, saya vera”, juga diverifikasi pada
Playground lokal yang sedang berjalan. Nama dan kebutuhan properti yang
menyusul tetap diproses; sapaan kepada bot tidak menjadi sapaan pilihan klien.

Pengenalan sapaan juga memisahkan nama penerima dan nama klien. “Malam Pak
Jason, saya Vera”, “halo Mas Budi ini saya Vera”, “Pak Jason, saya Vera”,
“Vera di sini”, dan perkenalan dengan “boleh tanya?” ditangani tanpa panggilan
AI. Panggilan Pak kepada penerima tidak membuat Vera dipanggil Pak. Sapaan
“malam Pak Jason” tanpa perkenalan tetap mengundang klien menyebut namanya.
Identitas yang dinyatakan klien tetap berlaku, termasuk klien bernama Jason.

`npm run simulate:greetings` memeriksa 305 percakapan / 915 giliran melalui
pemroses WhatsApp asli dengan transport, kontak dan katalog tiruan; semuanya
lulus. Setiap percakapan mencakup perkenalan, pesan pekerjaan lain yang harus
diabaikan, lalu permintaan properti. Transkrip ada di
`/private/tmp/kosku-addressed-introductions.json`. Variasi yang sama diperiksa
sebagai pesan pertama dan jawaban atas pertanyaan nama (610 pemeriksaan).
Empat contoh termasuk pesan persis “malam pak jason, saya vera” juga lulus
pada Playground lokal yang sedang berjalan. Nama, asal klien, lokasi pencarian,
dan budget tetap dipisahkan jika dinyatakan dalam satu pesan.

## Simulasi otomatis

`npm run simulate:scope` menjalankan 191 skenario / 454 giliran melalui
`MessageProcessor` asli, memakai katalog, AI jawaban, dan transport WhatsApp
tiruan. Seluruh skenario lulus. Tidak ada pesan ke kontak nyata atau penulisan CRM.
Transkrip lengkap di `/private/tmp/kosku-property-scope.json`.

Ada 30 variasi permintaan properti: formal, santai, singkatan “rmh”, “cariin”,
“nyari”, typo “proeprty”, pembelian, sewa, lelang, dan pesan campuran. Ada 40
variasi urusan lain, masing-masing diperiksa pada awal percakapan, setelah
perkenalan, saat membahas satu aset, dan saat kualifikasi. Pemeriksaan mencakup
tidak ada balasan, pencarian katalog atau handoff, serta konteks dan identitas
klien tetap utuh. Setelah urusan lain, “brp harganya?” tetap memakai aset yang sama.

Tes tambahan memeriksa pemisahan nominal dan kota dalam pesan campuran,
klasifikasi semantik pada kedua transport provider, bukti kutipan, keluaran
tidak valid, gangguan layanan, pembatalan, serta nomor invoice yang tidak boleh
dianggap dokumen pembelian.

## Uji provider AI nyata

`npm run simulate:scope:ai` mengklasifikasikan 12 pesan sintetis dengan konfigurasi
provider lokal (Gemini). Seluruh 12 contoh lulus setelah enam contoh yang semula
timeout diuji ulang dengan batas waktu 12 detik. Hasil gabungan tersimpan di
`/private/tmp/kosku-property-scope-ai.json`; `--retry-failed` mengulang hanya
contoh yang belum lulus.

| Contoh | Maksud yang dikenali |
| --- | --- |
| Golek omah kanggo keluarga pak | Pencarian properti |
| Mas tulung golekkno omah sing cocok kanggo anak bojo | Pencarian properti |
| Need a small warehouse around Gresik, could you help? | Pencarian properti |
| Sy lg nyri tmpat tnggal utk kluarga | Pencarian properti |
| Boleh bantu saya punya tempat menetap bersama anak istri? | Pencarian properti |
| Butuh bangunan buat nyimpen stok dagangan | Pencarian properti |
| Bisa bantu perpanjang lisensi tahunan tim? | Urusan lain |
| Mas file kemarin udah ditandatangani pimpinan belum? | Urusan lain |
| Maaf aku mau koordinasi pengiriman barang buat besok | Urusan lain |
| Need a rental car for a business trip | Urusan lain |
| yang itu masih kosong nggak? (setelah membahas rumah) | Pertanyaan lanjutan properti |
| Mas tanggal presentasine dipindah Senen wae yo (setelah membahas rumah) | Urusan lain |

Hasil ini membuktikan contoh yang diuji, bukan jaminan seluruh gaya bahasa atau
ketersediaan provider. Pengujian tidak mengirim pesan WhatsApp nyata.

Empat kegagalan tes lama pada balasan persetujuan tahap MOU/persiapan pembelian
juga ditemukan pada salinan kode HEAD sebelum perubahan ini. Perbaikan penyaring
topik tidak mengubah alur tersebut.

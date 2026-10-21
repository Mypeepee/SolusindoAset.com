# Simulasi interest ke purchasing

Simulasi lokal menjalankan MessageProcessor, state machine, dan generator PDF dari template MOU yang disetujui. Katalog, hasil stok, dan WhatsApp tiruan. Tidak ada pengiriman pesan nyata, KTP asli, pembayaran, atau transaksi. LLM tidak dipanggil; respons canonical menjadi acuan saat provider gagal maupun tidak aktif.

Aset contoh kode 121037, Pacarkembang, Tambaksari, Surabaya. Limit Rp350 juta; tanda jadi Rp20 juta; jaminan lelang Rp100 juta. Tanggal lelang sudah lewat. Hanya skenario pertama memakai konfirmasi tersedia dari operator tiruan. Tanda jadi terpisah dari uang jaminan lelang.

[PDF yang benar-benar dihasilkan](/private/tmp/Simulasi_Interest_Purchasing_MOU_121037.pdf) · [Laporan JSON](/private/tmp/kosku-interest-to-purchasing.json)

## Aset terkonfirmasi: minat → PDF → berkas siap → pendamping

**Klien:** oke saya tertarik

**Bot:** Baik, saya bantu lanjutkan persiapan pembelian aset kode 121037. Kelengkapan untuk prosesnya adalah KTP dan cover buku tabungan atas nama Anda, serta uang tanda jadi Rp 20.000.000. Silakan pelajari ketentuannya di draf MOU. Pembayaran tanda jadi dilakukan setelah ketentuan MOU disetujui dan instruksi pembayaran dikonfirmasi tim. Dari draf MOU ini, ada yang ingin ditanyakan?

**Lampiran:** Draf_MOU_Aset_121037.pdf (99312 byte)

Saya lampirkan draf MOU aset pilihan Anda. Mulai dari Pasal 3 untuk biaya pendampingan, Pasal 4 untuk tanda jadi dan jaminan lelang, Pasal 9 untuk pembatalan, lalu Pasal 11 untuk pengembalian dana jika kalah. Data yang belum lengkap ditandai di dokumen; ketentuannya bisa dibahas bersama tim sebelum disetujui.

**Klien:** KTP dan cover buku tabungan sudah siap, saya mau lanjut

**Bot:** Baik, saya teruskan persiapan pembelian ini ke tim Solusindo Premier. Tim akan membantu melengkapi MOU, mengarahkan pengiriman KTP dan cover buku tabungan atas nama Anda, serta memeriksa kelengkapan berkas. Pembayaran tanda jadi dilakukan setelah ketentuan MOU disetujui dan instruksi pembayaran dikonfirmasi tim.

Hasil: aset 121037; lead hot; fase purchasing_handoff; stok available. Bot dijeda untuk pendamping. Berkas dan pembayaran belum dinyatakan terverifikasi.

## Stok menunggu: minat → PDF → pertanyaan MOU → pendamping persiapan

**Klien:** oke pak saya serius

**Bot:** Baik, saya bantu lanjutkan persiapan pembelian aset kode 121037. Kelengkapan untuk prosesnya adalah KTP dan cover buku tabungan atas nama Anda, serta uang tanda jadi Rp 20.000.000. Silakan pelajari ketentuannya di draf MOU. Pembayaran tanda jadi menunggu kepastian aset dari tim dan persetujuan ketentuan MOU. Dari draf MOU ini, ada yang ingin ditanyakan?

**Lampiran:** Draf_MOU_Aset_121037.pdf (99312 byte)

Saya lampirkan draf MOU aset pilihan Anda. Mulai dari Pasal 3 untuk biaya pendampingan, Pasal 4 untuk tanda jadi dan jaminan lelang, Pasal 9 untuk pembatalan, lalu Pasal 11 untuk pengembalian dana jika kalah. Data yang belum lengkap ditandai di dokumen; ketentuannya bisa dibahas bersama tim sebelum disetujui.

**Klien:** boleh pak

**Bot:** Silakan, saya bantu jawab dulu supaya tidak ada yang mengganjal. Bagian mana yang ingin ditanyakan?

**Klien:** MOU ini mengatur apa saja?

**Bot:** Draf MOU memuat ruang lingkup pendampingan dan ketentuan transaksi untuk dipelajari. Data serta ketentuan DP yang belum final dilengkapi bersama tim. Anda bisa mempelajarinya tanpa perlu memutuskan tanda tangan sekarang. Bagian kesepakatan apa yang ingin Anda ketahui dulu?

**Klien:** KTP dan cover buku tabungan sudah siap, saya mau lanjut

**Bot:** Baik, saya teruskan persiapan pembelian ini ke tim Solusindo Premier. Tim akan membantu melengkapi MOU, mengarahkan pengiriman KTP dan cover buku tabungan atas nama Anda, serta memeriksa kelengkapan berkas. Kepastian aset dan jadwal lelang tetap dikonfirmasi lebih dahulu; pembayaran tanda jadi menunggu konfirmasi tersebut dan persetujuan MOU.

Hasil: aset 121037; lead hot; fase purchasing_handoff; stok pending. Bot dijeda untuk pendamping. Berkas dan pembayaran belum dinyatakan terverifikasi.

## Cover tabungan belum ada: bantu persiapan tanpa menganggap lengkap

**Klien:** saya tertarik

**Bot:** Baik, saya bantu lanjutkan persiapan pembelian aset kode 121037. Kelengkapan untuk prosesnya adalah KTP dan cover buku tabungan atas nama Anda, serta uang tanda jadi Rp 20.000.000. Silakan pelajari ketentuannya di draf MOU. Pembayaran tanda jadi menunggu kepastian aset dari tim dan persetujuan ketentuan MOU. Dari draf MOU ini, ada yang ingin ditanyakan?

**Lampiran:** Draf_MOU_Aset_121037.pdf (99312 byte)

Saya lampirkan draf MOU aset pilihan Anda. Mulai dari Pasal 3 untuk biaya pendampingan, Pasal 4 untuk tanda jadi dan jaminan lelang, Pasal 9 untuk pembatalan, lalu Pasal 11 untuk pengembalian dana jika kalah. Data yang belum lengkap ditandai di dokumen; ketentuannya bisa dibahas bersama tim sebelum disetujui.

**Klien:** KTP sudah siap tapi cover buku tabungan belum

**Bot:** Boleh disiapkan dulu. Tim memerlukan KTP dan cover buku tabungan atas nama Anda untuk melengkapi data pembelian, akun lelang, dan rekening pengembalian. Untuk uang tanda jadi Rp 20.000.000, silakan pelajari ketentuannya di draf MOU. Pembayaran tanda jadi menunggu kepastian aset dari tim dan persetujuan ketentuan MOU. Mau dibantu tim mengecek kelengkapan berkas yang perlu disiapkan?

**Klien:** boleh

**Bot:** Baik, saya teruskan persiapan pembelian ini ke tim Solusindo Premier. Tim akan membantu melengkapi MOU, mengarahkan pengiriman KTP dan cover buku tabungan atas nama Anda, serta memeriksa kelengkapan berkas. Kepastian aset dan jadwal lelang tetap dikonfirmasi lebih dahulu; pembayaran tanda jadi menunggu konfirmasi tersebut dan persetujuan MOU.

Hasil: aset 121037; lead hot; fase purchasing_handoff; stok pending. Bot dijeda untuk pendamping. Berkas dan pembayaran belum dinyatakan terverifikasi.

## Pertanyaan refund: jawab keberatan → kembali ke persiapan pembelian

**Klien:** wow saya tertarik pak

**Bot:** Baik, saya bantu lanjutkan persiapan pembelian aset kode 121037. Kelengkapan untuk prosesnya adalah KTP dan cover buku tabungan atas nama Anda, serta uang tanda jadi Rp 20.000.000. Silakan pelajari ketentuannya di draf MOU. Pembayaran tanda jadi menunggu kepastian aset dari tim dan persetujuan ketentuan MOU. Dari draf MOU ini, ada yang ingin ditanyakan?

**Lampiran:** Draf_MOU_Aset_121037.pdf (99312 byte)

Saya lampirkan draf MOU aset pilihan Anda. Mulai dari Pasal 3 untuk biaya pendampingan, Pasal 4 untuk tanda jadi dan jaminan lelang, Pasal 9 untuk pembatalan, lalu Pasal 11 untuk pengembalian dana jika kalah. Data yang belum lengkap ditandai di dokumen; ketentuannya bisa dibahas bersama tim sebelum disetujui.

**Klien:** kalau kalah uang tanda jadi balik tidak?

**Bot:** Kalau kalah lelang, uang tanda jadi (DP) Rp 20.000.000 kami kembalikan 100% tanpa potongan biaya apa pun ke rekening atas nama Anda maksimal 5 hari sejak hasil lelang diumumkan. Uang jaminan lelang juga dikembalikan melalui mekanisme penyelenggara ke rekening Anda. Ketentuan pembatalan dan kewajiban pembayaran diatur terpisah dalam Pasal 9. Dengan gambaran ini, mau kita bahas langkah untuk melanjutkan?

**Klien:** dokumennya sudah siap pak

**Bot:** Baik, saya teruskan persiapan pembelian ini ke tim Solusindo Premier. Tim akan membantu melengkapi MOU, mengarahkan pengiriman KTP dan cover buku tabungan atas nama Anda, serta memeriksa kelengkapan berkas. Kepastian aset dan jadwal lelang tetap dikonfirmasi lebih dahulu; pembayaran tanda jadi menunggu konfirmasi tersebut dan persetujuan MOU.

Hasil: aset 121037; lead hot; fase purchasing_handoff; stok pending. Bot dijeda untuk pendamping. Berkas dan pembayaran belum dinyatakan terverifikasi.

## Klien mengaku membayar: pemeriksaan tim, tanpa klaim dana diterima

**Klien:** saya serius

**Bot:** Baik, saya bantu lanjutkan persiapan pembelian aset kode 121037. Kelengkapan untuk prosesnya adalah KTP dan cover buku tabungan atas nama Anda, serta uang tanda jadi Rp 20.000.000. Silakan pelajari ketentuannya di draf MOU. Pembayaran tanda jadi menunggu kepastian aset dari tim dan persetujuan ketentuan MOU. Dari draf MOU ini, ada yang ingin ditanyakan?

**Lampiran:** Draf_MOU_Aset_121037.pdf (99312 byte)

Saya lampirkan draf MOU aset pilihan Anda. Mulai dari Pasal 3 untuk biaya pendampingan, Pasal 4 untuk tanda jadi dan jaminan lelang, Pasal 9 untuk pembatalan, lalu Pasal 11 untuk pengembalian dana jika kalah. Data yang belum lengkap ditandai di dokumen; ketentuannya bisa dibahas bersama tim sebelum disetujui.

**Klien:** saya sudah bayar tanda jadi

**Bot:** Informasi pembayaran Anda akan diperiksa oleh tim. Tim akan membantu melengkapi MOU, mengarahkan pengiriman KTP dan cover buku tabungan atas nama Anda, serta memeriksa kelengkapan berkas. Kepastian aset dan jadwal lelang tetap dikonfirmasi lebih dahulu; pembayaran tanda jadi menunggu konfirmasi tersebut dan persetujuan MOU.

Hasil: aset 121037; lead hot; fase purchasing_handoff; stok pending. Bot dijeda untuk pendamping. Berkas dan pembayaran belum dinyatakan terverifikasi.

## Tindak lanjut operasional

Minat memulai persiapan, bukan menandatangani perjanjian atau membuktikan pembayaran. Saat klien siap, sesi masuk antrean percakapan yang ditangani tim; tidak ada pesan terpisah yang dikirim ke agen. Tim memeriksa KTP/cover, melengkapi MOU, mengonfirmasi stok dan instruksi pembayaran. Lampiran masuk tidak diunduh atau dibaca LLM. Tanda jadi dibayar setelah kepastian aset dan persetujuan MOU; jaminan lelang mengikuti VA resmi kepesertaan, terpisah dari rekening perusahaan.

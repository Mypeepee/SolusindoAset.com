# Simulasi percakapan pembelian

Data sintetis untuk meninjau bahasa bot. Tidak membaca stok nyata, membuat akun, menjalankan bidding, atau mengirim WhatsApp.
Mode: provider LLM terkonfigurasi, dengan fallback lokal jika gagal.

## Jadwal lewat, stok belum terkonfirmasi

Klien: Baik pak, saya serius untuk aset ini, langkah selanjutnya bagaimana ya?

Bot: Baik, saya bantu lanjutkan untuk aset ini. Kita perlu mendapat kepastian dulu dari tim bahwa asetnya belum terjual. Setelah stoknya terkonfirmasi masih tersedia, baru kita bahas komitmen DP dan proses pembelian berikutnya. Sambil menunggu, mau saya jelaskan ketentuan DP keseriusannya dulu?

Validasi: topic=stock, phase=awaiting_stock, pending_action=explain_dp, generation=primary.

## Menjawab boleh pada undangan mengajukan pertanyaan

Pertanyaan sebelumnya: Ada yang ingin ditanyakan tentang pengecekan jadwalnya?

Klien: boleh

Bot: Silakan, saya bantu jawab dulu supaya tidak ada yang mengganjal. Bagian mana yang ingin ditanyakan?

Validasi: topic=clarify, phase=awaiting_stock, pending_action=ask_question, generation=primary.

## Nominal DP dihitung backend, stok belum terkonfirmasi

Klien: DP-nya berapa?

Bot: DP keseriusan untuk aset ini Rp 20.000.000. Setelah DP, kami bantu buatkan akun lelang atas nama Anda. Pembayarannya menunggu kepastian aset dari tim. Mau saya jelaskan data yang perlu disiapkan untuk akun lelangnya?

Validasi: topic=dp, phase=awaiting_stock, pending_action=explain_account, generation=primary.

## Tidak ada pertanyaan DP; lanjut ke informasi akun tanpa mengulang DP

Pertanyaan sebelumnya: Ada ketentuan DP yang ingin ditanyakan sambil menunggu konfirmasi asetnya?

Klien: tidak ada

Bot: Baik. Akun lelangnya tetap atas nama Anda. Tim Solusindo Premier membantu persiapannya memakai KTP dan cover buku tabungan atas nama Anda untuk rekening pengembalian jaminan. Dokumen disampaikan melalui kanal aman tim, sedangkan password dan OTP tetap Anda pegang sendiri. Mau saya jelaskan ke mana setoran jaminan lelangnya dibayarkan?

Validasi: topic=account, phase=awaiting_stock, pending_action=explain_deposit, generation=primary.

## Stok diasumsikan telah dikonfirmasi tersedia; klien bertanya data akun

Klien: Akunnya atas nama siapa, perlu data apa?

Bot: Akun lelangnya tetap atas nama Anda. Tim Solusindo Premier membantu persiapannya memakai KTP dan cover buku tabungan atas nama Anda untuk rekening pengembalian jaminan. Dokumen disampaikan melalui kanal aman tim, sedangkan password dan OTP tetap Anda pegang sendiri. Ada yang ingin ditanyakan tentang persiapan data akun?

Validasi: topic=account, phase=explanation, pending_action=ask_question, generation=primary.

## Stok diasumsikan tersedia; klien bertanya bidding dan batas harga

Klien: Harga mentok saya 900 juta, proses biddingnya gimana?

Bot: Tim kami terdiri dari tiga bidder profesional yang akan membantu strategi dan pelaksanaan penawaran untuk satu kepesertaan atas nama Anda. Kami akan berupaya mendapatkan harga serendah mungkin tanpa melewati batas harga mentok yang Anda tetapkan. Batas yang Anda sampaikan Rp 900.000.000 akan kami konfirmasi kembali sebelum penawaran. Namun, hasil akhirnya tetap bergantung pada penawaran peserta lain, sehingga kemenangan atau harga akhir tidak bisa dijamin pasti. Batas penawaran yang tercatat ini sudah sesuai?

Validasi: topic=bidding, phase=explanation, pending_action=confirm_bid_limit, generation=primary.

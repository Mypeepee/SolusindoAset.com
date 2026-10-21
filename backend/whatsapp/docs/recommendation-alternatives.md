# Permintaan properti lain — 15 Oktober 2026

Versi: `2026-10-15-alternative-memory-v11`.

Kalimat customer “adakah selain property tersebut?” sebelumnya membuka
pencarian baru dengan kriteria lama, tetapi tidak mengecualikan hasil lama.
Pendeteksi permintaan pencarian sudah menormalisasi “property” menjadi
“properti”, sementara penyusun `exclude_ids` memakai pesan mentah.

Sekarang semua pemanggil `requestsAlternatives` memakai normalisasi yang sama.
Variasi “properties”, “property2 tersebut”, “properti-properti tadi”, “opsi
berikutnya”, dan “ada lagi?” juga dipahami. Permintaan yang ditolak (“tidak
usah cari yang lain”) serta pertanyaan detail/biaya tidak membuang daftar.
Rujukan dibuang sebelum menafsirkan nama wilayah; “lanjut” bukan wilayah baru.
“Property2 tersebut” tidak lagi dianggap permintaan kode aset 2; “kode 2” dan
“property2” tanpa penanda jamak tetap berfungsi sebagai kode.

`exclude_ids` berisi ID dari tautan kartu, termasuk tautan Markdown dan daftar
yang dibagi menjadi beberapa pesan. Query properti publik mempertahankan
wilayah, budget, jenis, transaksi, luas, serta landmark, dan menerapkan
`id_property.notIn`. Connector juga menyaring hasil berdasarkan ID pengecualian
agar respons server lama tidak bisa menawarkan kembali daftar yang ditolak.
Jika tidak ada pilihan baru, bot menjelaskannya tanpa menampilkan daftar lama.

## Pengujian

`npm run simulate:recommendations` menjalankan 39 skenario memakai inventori
tiruan melalui parser, funnel, connector dan query Prisma asli. Termasuk lima
tautan persis yang dilaporkan, permintaan yang diulang hingga inventori habis,
dan beberapa hasil yang dikirim dalam pesan terpisah. Hasil percakapan:
`/tmp/kosku-recommendation-simulations.md` dan `.json`.

Tes transport WhatsApp tiruan serta Playground dengan riwayat milik server
memajukan jam enam menit antara daftar awal dan permintaan berikutnya. Tes
juga memeriksa filter Surabaya Barat + sekolah dalam radius 1 km + budget
Rp500 juta tetap utuh saat customer memakai kalimat yang dilaporkan.

Pengujian tambahan di Playground lokal dengan database listing publik asli
berhasil mereproduksi lima ID pada laporan customer, lalu memberikan:

| Giliran | ID listing |
| --- | --- |
| Daftar awal | 121815, 121192, 119036, 121455, 118874 |
| “adakah selain property tersebut?” | 117565, 117511, 117472, 117466, 118647 |
| Kalimat sama sekali lagi | 118336, 118296, 117052, 116990, 116639 |

Tidak ada ID berulang. Transkrip lengkap: `/tmp/kosku-repeat-live.md`.
Ini pengujian sandbox; tidak mengirim WhatsApp atau mengonfirmasi hasil
lelang/ketersediaan aktual. Pencarian tidak mengubah data listing.

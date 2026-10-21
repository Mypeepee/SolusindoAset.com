# Melanjutkan pencarian setelah detail — 15 Oktober 2026

Versi: `2026-10-15-detail-search-memory-v12`.

Sebelumnya, saat `previousId` terisi karena customer membuka detail, backend
memotong riwayat dari giliran pemilihan aset. Pertanyaan budget dan jawaban
luas tanah sebelum daftar rekomendasi ikut hilang. Lokasi, kategori dan
transaksi kemudian diisi dari aset pilihan, sehingga “adakah yang lain?”
mengulang pertanyaan dan bisa mempersempit Surabaya Barat menjadi kelurahan
aset tersebut.

`retainedSearchHistory` mempertahankan giliran kualifikasi dan menandai
pemilihan nomor/alamat/kode/tautan sebagai aktivitas melihat aset. Alamat yang
disalin tidak dibaca lagi sebagai preferensi wilayah. Jawaban nominal pada
pertanyaan budget atau luas tetap diperlakukan sebagai jawaban, bukan kode.

Jika preferensi customer sudah lengkap, permintaan alternatif langsung
memakai query yang sama, dengan pengecualian seluruh ID yang telah ditawarkan.
Bot menyebut kembali wilayah dan budget yang digunakan. Aset pilihan tidak
harus masih tersedia agar pencarian independen dengan preferensi lengkap bisa
dilanjutkan. Pertanyaan biaya tetap membahas harga aset pilihan, bukan budget.

Jika customer mengirim kode lain di luar daftar, konteks konsultasi baru
dipisahkan. Tanpa preferensi terdahulu yang relevan, budget atau batas luas
yang belum diketahui tetap ditanyakan; harga dan luas listing tidak dianggap
sebagai kemampuan beli atau preferensi customer. Aset acuan untuk pencarian
cadangan yang berasal dari kode tetap dibaca ulang lewat endpoint publik.

## Perkenalan dan pertanyaan jadwal pada unit pilihan — 20 Oktober 2026

Perkenalan seperti “saya Fikri dari Batujajar” saat membahas kode 121820
diterima sebagai identitas dan asal customer. Bot menyapa Fikri sambil
mempertahankan unit pilihan; Batujajar tidak menjadi filter pencarian cadangan.

Pertanyaan “unit tersebut kapan ada lelang lagi?” membaca ulang unit pilihan
dari katalog publik. Jadwal mendatang yang baru tercatat ditampilkan apa adanya.
Jika tanggal yang tersedia sudah lewat, bot menyebut tanggal terakhir dan
menjelaskan bahwa tanggal lelang ulang belum bisa dipastikan. Balasan ini memakai
data listing dan status pengecekan sebenarnya tanpa memerlukan keluaran LLM.
Jadwal pembayaran, jaminan, dan survei tetap ditangani menurut topiknya.

Jika pointer pilihan hilang tetapi kode/tautan asli masih ada pada pesan klien,
backend memulihkan ID tersebut dan memverifikasi ulang listing. Pesan assistant
saja, jawaban nominal budget, dan pencarian baru tidak memilih kembali unit lama.

Pada Playground, sesi server yang baru boleh memakai `previousId` yang masih
dipegang browser sebagai pointer untuk pertanyaan informasi. Data unit tetap
dibaca ulang. Pointer tersebut tidak membuktikan kesiapan pembelian, tidak
menggantikan pilihan sesi server yang masih aktif, serta tidak membatalkan
reset idle atau jeda karena pengambilalihan percakapan.

Regresi pada `test/asset_followup_context.test.js` mengulang pesan properti,
perkenalan Fikri, dan pertanyaan lelang ulang dengan jeda sembilan menit setelah
perkenalan. Meliputi WhatsApp tiruan, Playground, pointer sesi yang hilang,
perubahan tanggal pada sumber, dan listing yang sudah tidak ditemukan.

## Verifikasi

`npm run simulate:detail-alternatives`: 26 skenario dengan inventori tiruan,
parser dan query Prisma asli. Meliputi pemilihan 1–5, alamat, kode, tautan,
pertanyaan biaya, koreksi budget, batas luas, sekolah/radius, primary,
secondary, sewa tahunan, hasil habis dan pemilihan ulang dari daftar berikutnya.
Transkrip: `/tmp/kosku-detail-alternatives-simulations.md` dan `.json`.

Tes tambahan mencakup transport WhatsApp tiruan dengan jeda enam menit,
Playground dengan riwayat milik server, nominal budget tanpa label, kode
tidak terkait, dan aset pilihan yang sudah tidak tersedia. Tidak ada
pengiriman WhatsApp pada pengujian ini.

Playground lokal dengan database listing publik asli juga mereproduksi:

1. Cari rumah lelang di Surabaya Barat, maksimal Rp1,5 miliar, luas bebas.
2. Minta daftar berikutnya: 118779, 116682, 118525, 117200, 116568.
3. “boleh lihat yang nomor 5?” membuka detail aset 116568.
4. “hmmm, adakah yang lain?” menghasilkan 116407, 116251, 114535, 119497,
   114108 dengan cakupan dan budget tetap; tidak meminta luas lagi.

Respons dimulai dengan “Baik, saya lanjutkan pencarian rumah lelang di
Surabaya Barat, budget maksimal Rp 1.500.000.000. Kriteria sebelumnya tetap
saya gunakan.” Jadwal lelang yang sudah lewat tetap dijelaskan sesuai data.
Transkrip lengkap: `/tmp/kosku-detail-memory-live.md`. Pengujian membaca
listing publik dan tidak mengubah database atau memastikan hasil lelang.

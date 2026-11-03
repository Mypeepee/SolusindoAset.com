# Campaign pemasaran

Dashboard → Pemasaran → **Campaign** mengatur aset yang tampil selama suatu
periode, jumlah tayangan per hari, dan jam tayangnya. Campaign tidak memakai AI.
Template carousel dan caption standar listing tetap digunakan. Riwayat konten
berada di **Planner → Riwayat konten dan pengiriman**; tautan lama `?tab=antrean`
membuka riwayat tersebut.

## Alur

1. Isi nama dan tanggal mulai/akhir, maksimal 90 hari. Filter daerah, kategori,
   jenis aset, harga, dan ambang diskon per campaign. Sumber tetap properti BELI
   dengan bukti harga dari perhitungan Investor.
2. Halaman utama menyediakan **Edit** langsung pada baris campaign. Editor
   menampilkan **Aset mengikuti filter**: daerah, jenis, harga dan persentase
   otomatis menentukan aset layak dengan tenggat lelang dan pemerataan giliran. Tidak ada
   pencarian alamat, centang aset atau pilihan prioritas terpisah. Perubahan filter
   membatalkan hasil lama; hanya rekomendasi untuk filter terbaru yang bisa
   menyusun jadwal. Foto asli tersedia dalam strip horizontal. Draf tetap bisa
   disimpan jika stok kosong atau pemeriksaan gagal, tanpa mengubah jadwal terpakai.
3. Atur **Tayangan per hari** (1–12), jam HH:MM yang berbeda dalam WIB, serta
   kanal Instagram/Status WhatsApp. Jam ini milik campaign dan dapat berbeda
   dari jadwal otomatis reguler di Pengaturan. Jam berlaku setiap hari selama
   periode, hanya untuk waktu mendatang hingga 90 hari dari sekarang.
4. **Simpan ke Planner** menyimpan campaign, menyusun jadwal, lalu menerapkannya
   langsung. Kalender dan agenda diperbarui tanpa tombol terapkan kedua. Properti
   dan jam sudah terikat meski materi belum dirender; ringkasan **Jadwal terisi**
   menghitung rencana tersimpan dan materi siap. Status otomatisasi global tetap.
   Jika aset kosong, pemeriksaan gagal, atau semua jam sudah lewat, tombol menjadi
   **Simpan draf**; Planner terpakai tidak berubah. Bila suatu tahap sinkronisasi
   gagal, form tetap terbuka dan menjelaskan bahwa draf tersimpan, sedangkan Planner
   belum diperbarui. Percobaan ulang memakai ID/revisi terakhir, tanpa campaign baru.
5. **Atur aset & waktu** mengganti aset dengan kandidat dari pilihan campaign
   atau memindahkannya ke jam campaign yang kosong. Pratinjau menampilkan
   carousel template produksi serta caption faktual standar.
6. Untuk tinjauan manual melalui **Susun ulang jadwal**, **Terapkan jadwal**
   tetap mengonfirmasi jumlah slot terisi. Slot kosong tetap
   ditahan tanpa pengganti otomatis. Penerapan menyimpan rencana, tidak
   mengaktifkan otomatisasi global atau langsung memublikasikan konten.
7. **Jeda campaign** mempertahankan waktu dan asetnya. **Lanjutkan** hanya
   memulihkan waktu mendatang. Riwayat tayang menampilkan hasil kanal dan metrik
   yang tersedia; data yang tidak tersedia tetap ditandai demikian.

## Aturan penjadwalan

### Pengingat email H-1

Scheduler Pemasaran memeriksa campaign berstatus `running` yang sudah diterapkan,
menggunakan `activeBrief`, termasuk campaign satu hari yang dimulai besok.
Pada H-1 tanggal akhir campaign, mulai pukul **08.00 WIB**, sistem mengirim
pengingat terpisah ke **closingsystem@gmail.com** dan **jasoncliendo@gmail.com**.
Pengingat meminta planner konten untuk besok dan persiapan campaign berikutnya.
Tombol membuka `/dashboard/pemasaran?tab=campaign&campaign=<id>` pada domain
publik; autentikasi OWNER tetap diperlukan. Penerima yang belum login
diarahkan ke halaman masuk dengan tujuan Campaign yang
dipertahankan; tujuan login hanya menerima URL pada origin yang sama. Draf,
campaign dijeda, dan campaign yang telah berakhir tidak memicu pengingat.
Perubahan draf belum disetujui tidak
mengubah tanggal atau isi email. Pengingat tetap berjalan saat sakelar publikasi
sosial global dimatikan.

Pemeriksaan berjalan sebelum penyiapan/publikasi sosial, melalui cron Pemasaran
yang sudah ada. Server yang kembali aktif setelah pukul 08.00 mengejar pengingat
selama masih hari H-1. Tidak ada pengiriman susulan di hari akhir campaign.
Tabel `marketing_campaign_reminders` mencatat satu pengiriman untuk kombinasi
campaign, tanggal akhir, dan penerima. Perubahan periode yang diterapkan dapat
memicu pengingat baru pada H-1 periode baru. Penolakan SMTP yang pasti dicoba
ulang setelah 15 menit, maksimal lima percobaan. Respons SMTP yang ambigu atau
proses terhenti saat mengirim ditandai `uncertain` dan tidak dikirim ulang
otomatis; periksa `messageId` di kotak Terkirim sebelum tindakan manual.
Gunakan konfigurasi Gmail SMTP dan `CRON_SECRET` yang sudah ada, jalankan
`npm run db:marketing`, `npx prisma generate`, lalu mulai ulang server.

Pratinjau HTML ada di `docs/previews/campaign-reminder.html`. Buat ulang beserta
screenshot melalui `node scripts/preview-campaign-reminder.cjs --render`.
Tambahkan `--send` hanya untuk mengirim contoh berlabel PRATINJAU ke kedua
penerima. Pratinjau memakai renderer produksi tanpa mengubah campaign/Planner.

### Aturan campaign

- Inventori membedakan **aset di sumber**, **siap tayang**, dan **aset dipilih**.
  Angka aset dipilih pada kartu campaign bukan jumlah listing dalam database.
  Diagnosis mencakup seluruh wilayah/jenis/kategori/rentang harga yang dipilih,
  sebelum filter persen dan paginasi. Alasan gugur dihitung terpisah: sumber
  tidak tersedia, tanggal lelang belum ada/sudah lewat/terlalu dekat dengan awal
  tayang, kelurahan belum terverifikasi, pembanding belum ada, ambang persen
  tidak tercapai, atau foto belum tersedia. Tanggal lelang terakhir selalu
  menyertakan tahun. Sumber kedaluwarsa menunjuk ke pengambilan data lelang
  yang sudah ada di tab baru agar draf tetap terbuka.
- Campaign yang sudah berakhir menampilkan status **Berakhir**, tanggal akhir dan
  **Ubah periode campaign**. Contoh arsip dibuka secara sengaja melalui disclosure;
  tidak ada kartu/jam uji yang menyerupai jadwal aktif saat halaman pertama dibuka.
  Untuk periode hari ini yang tidak punya sisa jam, pratinjau menampilkan aset layak
  pada awal tayang (minimal waktu sekarang), dengan keterangan nol jadwal.
  Pembacaan inventori tidak memerlukan periode mendatang; penyimpanan,
  penyusunan dan persetujuan tetap memakai validasi periodenya masing-masing.
  Sistem tidak memperluas wilayah, menurunkan ambang, memperpanjang tanggal
  lelang, atau menjalankan pengambilan data otomatis untuk mengisi angka.
- **Dasar harga murah** memilih **Diskon kelurahan**, **Penurunan lelang**,
  atau **Salah satu (atau)**. Setiap ambang menerima 0–100%, termasuk desimal.
  Diskon kelurahan memakai `(rata-rata harga tanah/m² − harga tanah/m² aset) /
  rata-rata harga tanah/m² × 100` dengan pembanding terverifikasi sejenis di
  kelurahan yang sama. Ini perbandingan terhadap rata-rata, bukan persentil
  urutan harga termurah. Penurunan lelang memakai `(nilai lelang pertama −
  nilai lelang terkini) / nilai lelang pertama × 100`. Nilai yang tepat sama
  dengan ambang lolos; bukti yang tidak tersedia tidak dianggap 0%.
  Mode salah satu memakai OR; mode khusus hanya menerima bukti yang dipilih.
  Filter bekerja sebelum paginasi, rekomendasi, pemilihan dan penyusunan slot.
  Kriteria disimpan bersama rencana Planner, diperiksa ulang saat persetujuan,
  penyiapan dan sebelum pengiriman. Perubahan benchmark yang membuat aset
  tidak lolos menahan jadwal untuk diperiksa, tanpa pengganti otomatis.
- Target adalah jumlah jam harian dikali hari mendatang dalam periode. Jam yang
  sudah lewat tidak dikejar. Ketersediaan, foto, tanggal lelang dan jeda identitas
  aset diperiksa untuk setiap tanggal tayang, lintas campaign dan rencana manual.
- Campaign lelang memerlukan sisa waktu **minimal 5 hari penuh (120 jam)** sebelum lelang
  pada waktu tayang. Aturan ini berlaku pada rekomendasi, usulan, penggantian,
  persetujuan, penyiapan materi, dan pemeriksaan terakhir sebelum pengiriman.
  Aset tanpa foto atau tanggal lelang tidak direkomendasikan. Tanggal masuk
  memakai `listing.tanggal_dibuat` dari listing sumber terbaru, bukan waktu cache
  atau perubahan kosmetik. Label baru masuk berlaku hingga 14 hari; tanggal
  yang tidak tersedia tetap disebut tidak tersedia. Stok lama yang masih layak
  dapat menjadi cadangan setelah stok terbaru mendapat giliran.
- Rekomendasi memperhitungkan slot bentrok dan reservasi/cooldown dari jadwal
  lain; jadwal campaign sendiri yang belum pernah dicoba dapat diganti saat
  revisi. Jumlah slot yang dapat diisi adalah proyeksi untuk rekomendasi, bukan
  jumlah publikasi atau janji bahwa semua slot pasti terisi. Stok kurang tetap
  disertai alasan; filter dan jeda tidak dilonggarkan untuk mengisi angka.
- Setelah masa layak lewat, Planner menandai aset campaign sebagai **Perlu
  diperiksa** dan mencegah penyiapan. Revisi terpakai mengganti jadwal mendatang;
  slot lama beralasan `CAMPAIGN_REPLACED` tidak muncul lagi di kalender.
- Beberapa campaign dapat berjalan bersamaan pada jam berbeda. Jam yang sudah
  dipakai rencana manual, campaign lain atau pengiriman tidak ditimpa. Dua kanal
  dalam satu slot merupakan satu tayangan dengan dua tujuan pengiriman.
- Setelah diterapkan, periode campaign menggantikan jadwal otomatis reguler.
  Ini juga berlaku saat campaign dijeda agar frekuensi tidak bertambah di luar
  jam pilihan. Rencana manual dan campaign lain tetap dipertahankan. Di luar
  periode yang sudah disetujui, otomatisasi reguler mengikuti Pengaturan.
- Draf tidak memesan waktu atau mengubah otomatisasi. `activeBrief` menyimpan
  pengaturan yang sudah disetujui; mengedit draf tidak mengubah periode berjalan.
  Persetujuan revisi mengganti hanya slot mendatang yang belum pernah dicoba,
  dan mempertahankan status jeda. Riwayat percobaan/terbit tetap tersimpan.
- Stok, snapshot, revisi, benturan dan cooldown diperiksa ulang di bawah worker
  lease. Semua persetujuan disimpan dalam transaksi. Mengulang persetujuan
  versi yang sama mengembalikan hasil yang sama tanpa jadwal ganda.
- Worker memakai aset serta caption yang tersimpan. Perubahan kelayakan/fakta
  listing menandai **Perlu diperiksa**; sistem tidak mencari pengganti otomatis.
  Ambang diskon dan dasar pembanding dapat diatur per campaign. Campaign lama
  tanpa kriteria tersebut mewarisi ambang global dengan aturan salah satu (OR).
  Jeda, kanal aktif, kontak dan sakelar publikasi tetap global.

## Tampilan Campaign

Campaign memakai emerald dark mode dengan panel berlapis. Mint menandai pilihan
aset dan jadwal terisi, biru menandai informasi waktu, dan amber menandai jeda atau
slot kosong. Teks dan ikon selalu menyertai warna. Formulir dikelompokkan menjadi
nama/periode, filter, intensitas/jam/kanal, dan pilihan aset. Filter dan jadwal
berdampingan di desktop; nama serta tanggal berada dalam satu baris. Padding
16px dan jarak 12px mengurangi ruang kosong. Jenis aset memakai dropdown pilihan
ganda berikon dari Home: delapan kategori jual/lelang, dengan reset, keyboard,
Escape dan pengembalian fokus. Kontrol, peninjauan,
pratinjau serta dialog tetap memakai komponen dashboard yang sama. Layout
menumpuk di ponsel, target tombol minimal 44px, dan animasi mengikuti preferensi
pengurangan gerak. Detail token dan kepemilikan CSS ada di DESIGN.md.

## Penyimpanan dan API

Jalankan `npx prisma generate` dan `npm run db:marketing`, lalu mulai ulang
server. Migrasi aditif menyimpan campaign, usulan berversi, hubungan pada job,
dan `activeBrief`. Data campaign versi lama tetap dapat dibaca; kolom strategi
lama tidak lagi dipakai. Tidak ada konfigurasi atau panggilan model AI campaign.

`GET/POST /api/dashboard/pemasaran/campaigns` hanya untuk OWNER aktif. POST
memeriksa Origin; respons selalu `private, no-store`.

- GET: daftar 20 campaign; `id` untuk detail; `mode=candidates` untuk pemilih
  aset per slot, dibatasi pada aset pilihan campaign yang masih memenuhi syarat.
- POST `inventory`: filter, periode, jam, ID campaign opsional, ID pilihan,
  query dan offset. Mengembalikan kandidat berhalaman, kelayakan ID pilihan,
  rekomendasi seluruh scope, proyeksi cakupan slot, serta waktu pemeriksaan,
  tanpa menulis jadwal. Pencarian dan pagination tidak mengubah rekomendasi.
- POST: `save`, `generate`, `edit-slot`, `preview`, `approve`, `pause`.
  Selain create dan inventory, tindakan membawa ID dan revisi campaign.
  Tindakan per usulan membawa `proposalId`. Snapshot tidak diterima dari klien.
- Jenis aset mengikuti delapan kategori jual/lelang Home dari
  `BUY_PROPERTY_TYPES`. Kategori tambahan memakai perhitungan sumber Investor
  yang sama dalam cache Pemasaran terpisah; read model Investor empat kategori
  tetap digunakan untuk cakupan lama. Tidak diperlukan perubahan skema database.
- Perubahan pengaturan campaign/global membuat usulan belum disetujui perlu
  disusun ulang. Konflik revisi mengembalikan 409. Usulan ditampilkan 12 slot per
  halaman; riwayat mencakup 100 terbaru dan menampilkan jumlah keseluruhan.

## Verifikasi

- `npm run test:marketing`: aturan formulir, jam WIB, pemilihan aset, caption,
  periode, worker dan regresi kanal pemasaran.
- `node scripts/verify-marketing-campaigns-db.cjs`: transaksi nyata dengan
  stok fixture, rotasi, dua campaign, persetujuan berulang, konflik, jeda/lanjut,
  revisi, stok kurang dan penahanan jadwal reguler. Data uji dibersihkan.
- `node scripts/verify-marketing-campaigns-browser.mjs`: mutasi dicegat fixture;
  filter/paginasi/pilihan aset, intensitas/jam, kegagalan simpan, pratinjau,
  persetujuan, jeda, navigasi belum tersimpan, keyboard dan lima ukuran layar.
- `node scripts/verify-marketing-campaigns-live.mjs`: draf sementara memakai
  sumber Investor dan renderer nyata. Draf/media dibersihkan tanpa menerapkan
  jadwal, mengaktifkan otomatisasi, atau mengirim ke media sosial.

### Hasil verifikasi 28 Oktober 2026 WIB

107 tes pemasaran lulus, termasuk validasi jadwal campaign dan penghapusan
aksi AI lama. Uji transaksi nyata mencakup pemilihan berhalaman, rotasi, dua
campaign, persetujuan berulang, konflik, jeda/lanjut, revisi, pengisian slot
kosong dan pembersihan container otomatis lama yang belum pernah dicoba.
Uji browser Campaign lulus pada 1512, 1024, 768, 390 dan 320px tanpa overflow
horizontal atau error JavaScript. Regresi browser Planner/Pengaturan/Analitik
dan pemilih properti manual lulus. Uji draf nyata memperoleh enam aset dan
merender carousel, tanpa menerapkan jadwal atau mengirim ke kanal sosial.
Semua draf, jadwal dan media uji dibersihkan; otomatisasi tetap dijeda.

Build produksi lulus. Audit UI strict dan formatter lulus; lint DESIGN.md
memiliki nol error dan tiga peringatan token yang sudah ada. Typecheck terfokus
tidak menemukan error Pemasaran; dua error dependensi di authOptions.ts:366
masih ada di luar pekerjaan ini.

### Redesign 29 Oktober 2026 WIB

Varian emerald dark Campaign mencakup daftar, empty state, detail, tiga bagian
formulir, pemilih aset, jadwal, riwayat serta dialog. Uji browser lulus pada 1512,
1024, 768, 390 dan 320px, termasuk daftar, slot kosong, pratinjau ponsel, font
lokal, reduced motion dan alur keyboard. Tidak ada overflow horizontal atau error
JavaScript. Regresi Planner, Analitik, dan Pengaturan lulus; 107 tes pemasaran,
build produksi, formatter, dan audit UI strict lulus. Lint DESIGN.md memiliki nol
error dan tiga peringatan token lama. Typecheck tetap memiliki dua error lama di
authOptions.ts:366 dan tidak menemukan error Pemasaran.

### Kepadatan daftar 29 Oktober 2026 WIB

Daftar campaign memakai baris ringkas: status/nama/lokasi, periode/aset/jam,
jumlah terjadwal/terbit, dan tombol Buka berjajar pada panel lebar. Padding,
radius dan angka hasil diperkecil; header Campaign juga dipadatkan. Container
query menyesuaikan susunan terhadap lebar panel. Data dan alur tetap sama.
Verifikasi browser mengukur tinggi baris contoh dengan tiga jam: 107px pada
1512px, 166px pada 1024px, 222px pada 768/390px, dan 250px pada 320px. Konten
panjang tetap membungkus dan tombol Buka mempertahankan target minimal 44px.

### Edit langsung dan stok fresh · 30 Oktober 2026 WIB

Edit terbuka di daftar campaign; rekomendasi stok asli terlihat sebelum masuk
editor. Pilihan kosong diisi rekomendasi, dengan prioritas tanggal masuk sumber,
batas aman lelang 24 jam, rotasi, jeda, dan benturan yang sama dengan usulan.
Pembacaan memakai cache sumber maksimal 60 detik; persetujuan dan worker tetap
memverifikasi fakta listing langsung. Perubahan pilihan memerlukan simpan dan
penerapan usulan untuk memperbarui Planner.

113 tes pemasaran lulus. Uji browser campaign lulus pada 1512, 1024, 768,
390, dan 320px tanpa error JavaScript atau overflow, termasuk edit langsung,
kegagalan simpan, rekomendasi otomatis, dan prioritas fresh. Uji transaksi
database lulus. Uji draf dengan sumber asli memperoleh enam aset, menyusun enam
slot, dan merender carousel; draf/media uji dibersihkan tanpa menyimpan jadwal
atau mengirim ke kanal sosial. Audit UI strict untuk Pemasaran dan formatter
lulus. Typecheck terfokus masih melaporkan dua error lama di authOptions.ts:366,
tanpa error baru pada Pemasaran.

Regresi browser Planner, Analitik, dan Pengaturan lulus pada 1440, 1024, 768,
dan 320px. Build produksi terisolasi lulus; beberapa rute lain mencatat warning
akses database dari sandbox pada tahap prerender. Audit global masih memiliki
temuan lama di luar scope Pemasaran; audit Pemasaran tetap nol temuan.

### Editor ringkas dan jenis aset Home · 30 Oktober 2026 WIB

Nama/tanggal dirapatkan; filter dan jadwal berdampingan pada kontainer minimal
780px, diikuti area aset dengan dua kolom desktop dan satu kolom ponsel. Pada
kontainer 1080px, pengaturan sebelum daftar aset menempati sekitar 632px.
Jenis aset memakai varian dropdown TypePicker dengan delapan ikon Solar lokal,
pilihan ganda, reset, navigasi panah, Escape, dan pengembalian fokus. Konten
form diisolasi agar tombol daftar tidak menutupi footer Simpan.

114 tes pemasaran lulus. Uji browser campaign lulus pada 1512/1024/768/390/320px,
termasuk ukuran popup, ikon tanpa jaringan, filter jenis, pagination, simpan,
kegagalan/coba ulang, dan akses keyboard. Regresi Planner/Pengaturan/Analitik,
cache Investor serta uji transaksi jenis tambahan lulus. Sumber asli memberi
enam aset/enam slot dan carousel berhasil dirender, dengan nol pengiriman sosial.
Formatter, audit UI strict Pemasaran, dan build produksi lulus. Typecheck tetap
memiliki dua error autentikasi lama di authOptions.ts:366.

## Mencoba Campaign → Planner dengan aset contoh

Di Campaign, klik **Coba A, B, C**. Mode simulasi menampilkan tiga aset contoh yang memenuhi ambang contoh: A → 09:00, B → 13:00, C → 18:00 WIB hari ini. **Lihat di Planner** membuka kalender dan agenda yang sama dengan Planner asli, menggunakan satu proyeksi lokal. Ubah intensitas/jam di Campaign untuk langsung mengubah slot Planner; 2 tayangan mengisi A/B, 4 tayangan mengisi A/B/C dan satu slot menunggu stok. Perluasan periode tetap menghormati masa lelang serta jeda aset tujuh hari.

Jam simulasi dibekukan pada 00:00 WIB tanggal awal agar jam pagi dapat dicoba pada malam hari. Seluruh harga, foto dan tanggal diberi label contoh. Pratinjau carousel berasal dari aset lokal. Tidak ada marketing API, perubahan database, publikasi atau pengiriman dari mode ini. **Keluar simulasi** kembali ke data asli; reset/reload mengembalikan contoh awal. Kampanye asli tetap melalui alur penyusunan, persetujuan dan penyiapan materi yang berlaku.

Verifikasi: unit tests memeriksa jadwal WIB, intensitas, waktu invalid, freshness/expiry/photos/cooldown; browser memeriksa A/B/C pada kedua tab, perubahan waktu, gap, preview, layar 320/390/1512, reload/exit dan nol marketing requests selama simulasi.

Validasi akhir 31 Oktober 2026: 124 tes pemasaran, fixture transaksi Campaign/Planner, browser campaign (termasuk simulasi tanpa marketing requests dan batas input 320/390/1512 px), regresi Planner/Analitik/Pengaturan, formatter, audit UI strict nol temuan, serta build produksi terisolasi lulus. Pemeriksaan screenshot 320 px menemukan dan memperbaiki layout input jam yang sebelumnya terpotong; CampaignRhythm kini memiliki reset layout sendiri untuk semua pemakai. Typecheck terfokus tidak memiliki error Pemasaran; dua error autentikasi lama tetap berada di authOptions.ts:366. Tidak ada konten yang dikirim atau data contoh yang disimpan di database.

## Format dan urutan jam tayang

CampaignRhythm memakai input 24 jam bersama pada editor dan simulasi. Angka empat digit seperti 1200 otomatis menjadi 12:00, termasuk paste. Jam di luar 00–23, menit di luar 00–59, karakter asing dan paste terlalu panjang ditolak. Pengeditan di tengah teks mempertahankan caret; satu tombol hapus menghapus satu digit, termasuk di sisi pemisah, sehingga empat Backspace mengosongkan empat angka. Nilai yang belum lengkap diberi pesan dan tidak bisa disimpan.

Semua slot harus semakin akhir: Jam 1 < Jam 2 < Jam 3 dan seterusnya. Misalnya 12:30, 15:30, 13:40 menandai Jam 3 dan memblokir simpan; koreksi menjadi 16:40 menghasilkan jadwal yang valid. Pemeriksaan sama berlaku pada API simpan, pembuatan proposal, persetujuan dan proyeksi Planner. Penambahan/restorasi intensitas menghasilkan jam unik dalam urutan waktu, termasuk penambahan dari jam terakhir 23:59; waktu yang telah diedit dipertahankan. Input yang belum selesai atau urutannya salah harus diperbaiki sebelum menambah slot. Skema baca riwayat tetap menerima urutan lama agar campaign terdahulu dan reservasi periode aktif tidak hilang.

Verifikasi 1 November 2026: 129 tes lulus, termasuk seluruh 1.440 jam valid, perluasan setiap jam menjadi 12 slot terurut, input/paste ilegal, urutan mundur/duplikat dan penolakan API sebelum penulisan. Browser development dan produksi lulus pada desktop/ponsel: 1200 → 12:00, paste panjang ditolak, caret/hapus tetap benar, simpan waktu tidak lengkap/terbalik diblokir, hanya kolom yang salah ditandai, serta 12:30/15:30/16:40 tampil identik di Planner. Fixture transaksi database, audit UI strict, formatter dan build produksi lulus; tidak ada pengiriman konten. Typecheck terfokus hanya memiliki dua error autentikasi lama di authOptions.ts:366.

## Contoh properti arsip terbaru

Jika stok layak tayang saat ini kosong, inventori menyediakan contoh properti asli dari kelompok lelang terbaru yang masih memenuhi filter, termasuk ambang persentase. Pada campaign berakhir, buka **Contoh tampilan dari properti arsip** untuk memuatnya. Data saat ini menyediakan 45 properti berfoto yang memenuhi filter campaign; yang terbaru berlelang 11 Juni 2026. Enam arsip terbaru langsung tersedia dalam satu deretan horizontal yang dapat digeser. Foto besar berada di atas alamat dan harga; jam uji tetap pada foto. Luas tanah, persen pembanding, tanggal lelang asli dan akses foto/detail tetap terlihat.

Kartu tidak ditumpuk pada desktop, tablet maupun ponsel. Lebarnya maksimal 360px dan menyisakan sedikit kartu berikutnya pada ponsel. Foto 16:10, alamat 14px dan harga 24px memperjelas properti; aksi tetap setinggi 44px. Scroll native mendukung swipe dan trackpad, dengan snap ringan, scrollbar netral, panah sebelumnya/berikutnya, penghitung posisi serta navigasi keyboard kiri/kanan/Home/End. Preferensi reduced motion menghapus gulir halus; tidak ada autoplay atau pengambilalihan scroll vertikal. Header, catatan arsip, jadwal dan footer diagnostik tetap dirapatkan dalam shell 14px. Semua varian stok memakai CampaignStockCards yang sama.

Hari uji berada sebelum tenggat kelompok kecil arsip terpilih. Tanggal sumber tidak dimajukan. Tombol Coba arsip di Planner menampilkan identitas yang sama pada jam campaign; perubahan intensitas/jam memperbarui proyeksi lokal. URL arsip dapat dimuat ulang dengan pembacaan OWNER yang dapat dibatalkan dan dicoba lagi. Aset kedaluwarsa tetap tidak layak untuk publikasi asli, dan membuka pratinjau tidak mengubah database atau mengirim konten.

CampaignPropertyGallery memakai slide berindeks dari /api/foto dengan view=card dan ukuran 640px yang didukung; tanpa view tersebut endpoint foto email hanya mengembalikan foto pertama. Galeri properti memakai varian gelap, sedangkan kontrol/fokus tetap milik DialogFrame dan InstagramCarousel.

Verifikasi 31 Oktober 2026: 125 tes pemasaran, fixture transaksi campaign/Planner, regresi browser campaign dan Planner/Analitik/Pengaturan, formatter, audit UI strict nol temuan, serta build produksi lulus. Skrip verify-marketing-archive-browser.mjs lulus pada development dan hasil build produksi dengan database serta foto asli: tiga kartu awal ber-ID 119016/120448/118569, galeri benar-benar beralih ke foto kedua, proyeksi Planner beridentitas sama, foto agenda selesai dimuat, pemulihan URL arsip, perubahan intensitas, layar 1512/1024/768/390/320px, dan nol perubahan campaign/job/publikasi. Typecheck tidak memiliki error Pemasaran; dua error autentikasi lama tetap ada di authOptions.ts:366.

Verifikasi carousel: 125 tes pemasaran, regresi browser campaign/editor/simulasi (termasuk stok 20 properti), formatter, audit UI strict nol temuan dan build produksi lulus. Browser database/foto asli lulus pada development dan produksi untuk 1512/1280/1024/768/600/540/390/360/320px. Keenam properti berada pada satu baris; kartu desktop 360px dengan foto setinggi 216px, sementara ponsel menampilkan satu kartu besar dan sebagian kartu berikutnya. Harga utuh, aksi minimal 44px, panah, keyboard/Home/End, swipe sentuh asli, reduced motion dan pengembalian fokus galeri dari kartu terakhir lulus. Tidak ada overflow horizontal halaman atau perubahan campaign/job/publikasi. Pemulihan URL arsip dan sinkronisasi identitas/jam/intensitas dengan Planner tetap lulus. Typecheck terfokus hanya melaporkan dua error autentikasi lama yang sama.


## Periode berakhir dan penyederhanaan editor · 1 November 2026

Status memakai tanggal WIB dan snapshot periode yang sudah diterapkan; draf yang
belum diterapkan tidak memperpanjang masa tayang. Status **Berakhir** mengalahkan
Draf/Dijeda/Aktif setelah hari terakhir. Jam UI diperbarui tiap 30 detik dan saat
kembali ke tab. Riwayat tetap tersedia; aksi lanjutkan dan sunting slot lampau
hilang/nonaktif. Persetujuan ulang periode lama ditolak. Worker memeriksa periode
terpakai sebelum render dan kirim, melewati pekerjaan yang belum dicoba, serta
mempertahankan bukti published/sending/uncertain. Slot antrean lebih dari satu jam
terlewat tanpa bukti pengiriman ditandai **Terlewat**, bukan materi siap.

Editor menggunakan satu sumber pilihan aset: filter yang sudah diisi di atas.
Daftar otomatis menampilkan jumlah aset dan cakupan slot, strip foto asli serta
rincian alasan kelayakan dalam disclosure. Pencarian alamat, urutan manual dan
pilihan “Prioritas tayang” dihapus. Respons lama tidak boleh dipakai setelah filter
berubah. Simpan mengubah draf; Terapkan jadwal tetap mengonfirmasi perubahan Planner.

Input jam tetap empat angka dengan pemisah otomatis. Empat Backspace mengosongkan
jam, lalu 1300 langsung menjadi 13:00. Edit menit sementara seperti 23:6 diperbolehkan
untuk mengetik, namun hanya jam lengkap dan urutan meningkat yang dapat disimpan.


Verifikasi akhir 1 November 2026: 135 tes pemasaran lulus. Regresi browser
Campaign pada development dan produksi mencakup empat digit/four Backspace,
filter otomatis dan invalidasi hasil lama, gagal simpan/coba ulang, status
Berakhir untuk draft/running/paused, snapshot periode terpakai dan pergantian
hari WIB tanpa reload. Fixture transaksi database membuktikan periode lama tidak
bisa resume/generate/approve/render; fixture dibersihkan dan nol pengiriman.
Regresi Planner/Analitik/Pengaturan lulus pada development dan produksi. Database
serta foto asli diuji pada 1512/1280/1024/768/600/540/390/360/320 px, termasuk
disclosure arsip, harga utuh, strip horizontal, galeri, pemulihan URL dan identitas
serta jam Planner yang sama. Bingkai arsip berlapis diratakan agar foto tetap
terbaca pada ponsel. Build produksi, formatter, diff whitespace dan audit UI strict
nol temuan lulus. Typecheck terfokus hanya melaporkan dua error autentikasi lama
di authOptions.ts:366; tidak ada error tipe pemasaran.

Halaman detail periode berakhir tidak mengulang petunjuk menyusun jadwal dan tidak
menampilkan tombol susun yang nonaktif. Tanpa proposal, satu pesan akhir periode
beserta aksi ubah tanggal sudah cukup. Riwayat yang belum memiliki catatan memakai
panel ringkas, tanpa angka nol berulang atau ruang kosong untuk tabel yang belum ada.


## Tenggat lelang dan pemerataan tayang · 1 November 2026

Aturan sebelumnya yang mendahulukan tanggal masuk diganti oleh permintaan pemilik:
lelang yang paling dekat perlu mendapat perhatian tanpa menelantarkan stok jauh.
**Minimal H−5** berarti tanggal/waktu lelang dikurangi waktu posting harus >= 120
jam; tepat 120 jam diterima. Lelang 5 November tidak boleh diposting setelah
31 Oktober pada jam yang sama. Batas ini dipakai rekomendasi, persetujuan, slot
manual/reguler, render, dan pemeriksaan pengiriman; tidak ada pengecualian karena
kekurangan stok. Kelayakan awal dihitung pada jam posting pertama, bukan tengah malam.

Pembagian mengikuti jumlah sesi harian: sekitar sepertiga sesi (dibulatkan, minimal
satu untuk 2–12 sesi) menjadi jatah pemerataan, sisanya lelang sisa 5–14 hari.
Contoh: 3 sesi = 2+1; 5 sesi = 3+2; 8 sesi = 5+3; 12 sesi = 8+4.
Giliran pemerataan disebar di antara jam campaign, bukan siklus tetap tiga slot. Di jalur mendesak, aset yang lebih sedikit mendapat paparan didahulukan,
lalu tenggat terdekat. Di jalur pemerataan, prioritaskan aset jauh yang belum mendapat
giliran; jika habis, berikan stok belum terpapar lain kesempatan sebelum pengulangan.
Di antara aset setara, jalur utama memakai tanggal masuk terbaru; jalur pemerataan
memakai penantian yang lebih lama. Tanggal yang tidak diketahui tidak direkayasa.
Aset belum mendapat giliran yang akan kehilangan kelayakan sebelum slot berikutnya
boleh mengambil giliran sekarang. Akhir periode sendiri bukan alasan menyebut semua
aset sebagai kesempatan terakhir: pada akhir daftar, rescue dibatasi pada tenggat
H−5 yang datang dalam 24 jam. Kelayakan, benturan dan cooldown selalu mengalahkan kuota.
Jika salah satu kelompok habis, slot boleh diisi kelompok lain yang masih layak.

Riwayat 90 hari dan reservasi sebelum waktu tayang dihitung per parcel, satu job
merupakan satu paparan meskipun mengirim ke dua kanal. Dilewati tanpa percobaan bukan
paparan. Sending/uncertain tetap dilindungi. Pengulangan mematuhi cooldown global.
Untuk 2–12 sesi, kuota mengikuti posisi jam harian yang dikonfigurasi; penyusunan
ulang pada siang hari tidak mengulang urutan pagi. Campaign satu sesi membawa
giliran pemerataan antarhari memakai riwayat sebelum slot pertama. Reservasi
campaign lain memengaruhi kelayakan tanpa menggeser posisi jatah pemerataan. Proposal menyimpan versi kebijakan; usulan
lama harus disusun ulang. Penerapan tetap tidak menimpa publikasi atau rencana manual.

Cakupan menyebut jumlah properti sesuai filter yang mendapat jadwal dan yang belum.
Tidak ada janji semua properti bisa tayang bila slot tidak cukup; tambah intensitas
atau periode sesuai kebutuhan. Planner menunjukkan draf campaign yang belum
tersinkron, menyediakan tautan langsung, serta membedakan **Belum terisi** di masa
depan dari **Dilewati/Terlewat** di masa lalu. Simulasi A/B/C kini memakai lelang
10/12/30 hari untuk memperlihatkan dua prioritas dekat dan satu aset jauh; arsip
memakai hari contoh enam hari sebelum lelang tertua dalam kelompok, dengan tanggal
sumber dan foto asli tetap utuh.

Setelah sinkronisasi berhasil, cache bulan dihapus dan tanggal Planner diarahkan
ke slot terisi pertama. Pemilik tidak harus menemukan tanggal itu secara manual
atau menggunakan tombol Buka Planner khusus; tab Planner biasa menampilkan hasilnya.
Diagnosis sumber asli saat pengembangan: campaign 1–5 November memiliki 2.090
listing dalam scope, 2.089 lelang kedaluwarsa dan satu pembanding belum tersedia,
sehingga nol aset/12 slot layak. Status ini tidak diperbaiki dengan tanggal palsu.


Verifikasi H−5 dan sinkronisasi langsung: 147 tes logika lulus, termasuk batas
120 jam ±1 ms, dua prioritas/satu pemerataan, kuota pada 1 unggahan per hari,
riwayat dua kanal dihitung sekali, pengulangan/parcel, rescue dan akhir periode,
serta reservasi campaign lain yang tidak boleh menggeser giliran. Uji transaksi
menyimpan ID properti, alasan pemilihan dan versi kebijakan dalam job Planner;
usulan lama ditolak dan fixture dibersihkan. Browser development dan produksi
membuktikan Simpan ke Planner langsung menerapkan rencana, retry tidak membuat
campaign baru, tab Planner biasa membuka tanggal pertama dan cache kosong terhapus.
Regresi riwayat/kalender/Pengaturan/Analitik dan foto asli 320–1512 px lulus,
termasuk pemberitahuan draf, galeri, contoh arsip dan nol pengiriman konten.
Pemulihan caret jam dipindahkan ke layout commit React agar pengeditan cepat tidak
ditimpa frame tertunda. Build produksi, formatter, diff whitespace dan audit UI
strict nol temuan lulus. Typecheck tetap hanya melaporkan dua error autentikasi
lama di authOptions.ts:366, tanpa error tipe Pemasaran.
## Campaign list lifecycle groups

The list API accepts `view=grouped&page=1&endedPage=1`, returning independent
`current` and `ended` pages (20 records each, with total/page/pageSize). Each
filter runs before pagination; `Campaign berjalan` includes drafts, scheduled,
running and paused campaigns whose effective end date is today or later in WIB.
`Campaign usai` contains elapsed periods. Approved periods remain authoritative
after unapplied edits, and legacy records without an approved end date use their
saved brief. The default ungrouped API remains compatible. The UI restores pages
through `campaignPage` and `endedCampaignPage`, refreshes at day rollover and
defers that refresh while an inline draft is open.

Ended cards have a subdued charcoal forest appearance, explicit Berakhir badge,
and secondary Edit/Buka controls. This is a read-only classification: grouping
never alters jobs, automation settings, campaign state or publication history.



Campaign rhythms and Planner sessions — 2026-11-01:
The saved campaign period and its own HH:mm times own calendar projections.
A 1–3 November campaign with five daily times yields fifteen sessions, five boxes
on each date and five agenda cards per selected day. Render every configured time,
including on phones; do not cap at three entries or replace extra sessions with dots.
Empty drafts expose read-only “Jadwal draf” sessions; elapsed projected times read
“Waktu lewat” and never claim publication history. They offer Buka campaign, not
global automatic preparation/manual-plan actions. Approved periods keep their
immutable times until changes are applied. Ignore unassigned, unattempted global
placeholders within campaign dates; retain actual assignments and delivery evidence.
Outside the campaign period, global settings still govern ordinary automatic slots.
Both draft saves and applied plans invalidate the month cache immediately.
Policy version 3 requires old unapproved proposals to regenerate before applying.

Verifikasi pembagian sesi: 152 tes pemasaran lulus, termasuk seluruh intensitas
2–12 sesi, tiga hari dengan lima sesi, penyusunan ulang setelah jam pagi,
batas bulan WIB, periode yang sudah diterapkan, dan bukti pengiriman yang tetap
terlihat. Integrasi transaksi membuktikan 15 job untuk 5 sesi × 3 hari; draf kosong
memproyeksikan ritmenya tanpa membuat job eksekusi. Browser development dan produksi
lulus pada 1512/1024/768/540/390/320 px, termasuk lima kotak per tanggal, lima kartu
agenda, serta perubahan draf 5 ke 6 sesi tanpa reload Planner. Regresi navigasi,
cache, kanal, Pengaturan dan Analitik lulus. Audit UI strict nol temuan, formatter,
diff check dan build produksi lulus. Typecheck terfokus menyisakan dua error
autentikasi lama pada authOptions.ts:366; tidak ada error tipe Pemasaran baru.
Tidak ada konten diterbitkan dan data campaign operasional tidak diubah oleh fixture.


## Live two-day campaign queues — 2026-11-01

The current owner request supersedes the example/archive workflow and full-period
asset preselection. Production has no A/B/C action, archive substitution or example
Planner mode. Old simulation query parameters are discarded and load the real workspace.
CampaignReadyAssets is the single live queue owner: it reads persisted Planner jobs,
original property facts and actual publication states, in dated horizontal carriages.
Keep large photo cards and shared gallery/scroll controls; render at most two day groups.

Batches are anchored to the campaign start in WIB, with two dates each. Prepare the
next batch on the preceding batch's final day. For 1–3 November, five daily sessions:
creation prepares ten jobs on 1–2 November; on 2 November the panel shows the next
batch, 3 November only (five jobs), while 2 November assignments stay in Planner.
Never create dates after campaign end. Future dates beyond the prepared horizon keep
all configured slots, labelled Menunggu batch. The worker and live panel reconcile
the queue under the existing worker lease; polling does not enable publication.

Fresh searches use approved campaign criteria, never IDs frozen in the previous batch.
Keep still-valid committed jobs unchanged during automatic refresh. New matching stock
can enter the following batch. Refill shortages/reviewable unattempted jobs at 15-minute
intervals or explicit refresh, without overwriting delivery attempts or manual plans.
Empty source stock activates honest unfilled jobs; it never substitutes expired archives.
Unapplied edits cannot change the approved queue. Preserve unrelated campaign metadata.

Published properties never re-enter campaign selection, across all publication history
and campaigns. Protect sending/uncertain evidence too. Deduplicate stable parcel identity,
exclude other future reservations, and prohibit repeats inside a generated plan. Recheck
lifetime publication evidence at approval, media preparation and dispatch; the same
multichannel job may finish its remaining channel. All source, verified price evidence,
minimum five full days before auction, daily intensity and priority rules stay enforced.
Policy version 4 requires old unapproved proposals to regenerate.

Current automated acceptance for this workflow lives in verify-marketing-batches-browser.mjs
and verify-marketing-campaigns-db.cjs. Earlier archive/simulation browser scripts describe
the retired workflow and are superseded for production acceptance.

### Diagnosis antrean kosong

Antrean draf dan sesi mendatang yang belum terisi memeriksa inventori asli dari
filter campaign. Campaign berjalan memakai `activeBrief`, sehingga perubahan draf
yang belum diterapkan tidak mengubah diagnosis. Panel menampilkan jumlah sumber,
alasan gugur, tanggal lelang terakhir beserta tahun, serta tautan pengambilan data
di tab baru bila sumber kedaluwarsa. Status draf tidak mengklaim pencarian gagal
atau batch berikutnya akan disiapkan otomatis. Properti yang sudah dipasarkan
memiliki alasan terpisah dari foto yang belum tersedia.

Pemeriksaan inventori hanya membaca data dan tidak menerapkan draf. Bila sumber
gagal dibaca, penugasan Planner tetap ditampilkan bersama pemberitahuan pemeriksaan
gagal. Tombol perbarui mengulang pemeriksaan. Uji regresi berada di
`scripts/test-campaign-queue.cjs` dan `scripts/verify-marketing-batches-browser.mjs`.

### Larangan aset kembar lintas batch · 2 November 2026

Kebijakan versi 5 melindungi seluruh penugasan yang masih terikat, termasuk
campaign dijeda dan sesi yang sudah lewat waktunya. Penyusunan batch hanya boleh
melepas job tanpa percobaan yang memang akan diganti pada tanggal/jam usulan itu.
Job dari batch sebelumnya, campaign lain, dan rencana manual tetap mereservasi
asetnya, tanpa batas cooldown atau jendela pencarian. Refresh memperbaiki kembar
yang sudah tersimpan pada batch mendatang sambil mempertahankan penugasan awal.
Jika stok unik habis, sesi menunggu aset lain.

Riwayat terbit, pengiriman berjalan, dan hasil ambigu tetap menghalangi penggunaan
kembali seumur riwayat. Pencocokan mencakup identitas parcel, ID listing, snapshot
dan rencana manual, termasuk data lama yang belum dirender atau berubah alias.
Pemeriksaan berlaku pada rekomendasi, usulan, persetujuan, rencana manual,
penyiapan materi, dan sebelum setiap kanal dikirim. Satu job dua kanal tetap
dapat menyelesaikan kanalnya sendiri; riwayat percobaan tidak dihapus.

Regresi mencakup batch dijeda tanpa publikasi, waktu lama yang lewat, perbaikan
kembar tersimpan, reservasi setelah usulan dibuat di luar cooldown, alias snapshot
publikasi lama, penolakan dispatch kembar, dan dua kanal dalam job yang sama.

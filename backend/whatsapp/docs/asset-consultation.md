# Kondisi aset, biaya pembelian, dan pengajuan survei

WhatsApp dan Playground membaca jenis transaksi serta harga dari listing terbaru.
Riwayat percakapan menyimpan maksud pertanyaan dan ID pilihan, bukan sumber harga.
Bot tidak mengarang kondisi interior yang belum dicatat pada listing.

## Percakapan

- Lelang: viewing mandiri dari luar untuk mengecek eksterior, jalan, dan lingkungan.
  Tidak diperkenankan masuk dan tidak dibuatkan appointment pendampingan.
- Primary/secondary/sewa: bot dapat memandu pengajuan survei bersama agen.
  Akses dan pendampingan masih mengikuti konfirmasi agen serta pemilik/pengelola.
- Kondisi → tawarkan biaya. Biaya → tawarkan kondisi. Jika keduanya telah dijelaskan,
  lanjut ke survei untuk nonlelang atau pertanyaan klien berikutnya untuk lelang.
- “Boleh”, “nggih”, “gas”, dan jawaban pendek mengikuti pertanyaan terakhir yang
  benar-benar dikirim. Jawaban mengenai MOU atau alamat tidak menghidupkan CTA lama.
- Memilih kode/link lain membaca ulang aset baru dan memisahkan konteks konsultasinya.
  Permintaan survei tanpa pilihan aset meminta klien memilih dahulu.

Contoh bahasa yang diuji: “bangunane piye?”, “iso mlebu ta?”, “all in brp?”,
“nambah piro buat biaya beli?”, “sesuk jam 1 siang”, “besok pukul 10 pagi”, dan
“Sabtu jam sebelas”. Waktu ambigu atau bertentangan diklarifikasi; misalnya
“Sabtu besok” ketika besok sebenarnya Kamis. Semua waktu menggunakan WIB.

Lihat [42 giliran simulasi](simulasi-kondisi-biaya-survei.md). Fixture memakai
Rabu, 21 Oktober 2026, pukul 09.00 WIB dan tidak mengirim pesan nyata.

## Biaya

Perhitungan lelang tetap menggunakan `auction_cost_policy.js`; yang berubah
hanya ajakan akhir mengenai kondisi dan viewing mandiri dari luar.

Untuk primary/secondary, cadangan anggaran pembeli mengikuti asumsi operator:
BPHTB 5%, AJB 0,5%, dan notaris 0,5%–1%. Dengan harga Rp1 miliar, tambahan
cadangan Rp60–65 juta dan total anggaran Rp1,060–1,065 miliar. Persentase dihitung
di backend, dibulatkan per komponen, lalu dijumlahkan agar nominal konsisten.

Cadangan BPHTB 5% dari harga bukan tagihan pajak final. Dasar pajak, NPOPTKP,
dan keringanan harus diperiksa sesuai daerah dan kondisi perolehan. Sebagai
rujukan lokal, [Perda Surabaya 7/2023](https://pbb.surabaya.go.id/Content/assets/doc/Perda%20Surabaya%207%20th%202023%20pajak%20retribusi%20daerah.pdf)
mengatur tarif serta pengurang BPHTB. Bot tidak menganggap klien otomatis
memenuhi syarat pengurangan tertentu.

AJB/notaris adalah estimasi anggaran operator, bukan pernyataan tarif wajib.
Honorarium PPAT diatur dalam [PP 24/2016](https://peraturan.bpk.go.id/Download/27324/PP%20Nomor%2024%20Tahun%202016.pdf).
Komponen yang sudah tercakup dalam satu paket tidak ditambahkan dua kali.
Untuk primary, periksa apakah harga developer sudah mencakup PPN/pengurusan;
biaya bank/KPR mengikuti penawaran bank. Sewa memakai harga sesuai periode,
deposit, layanan, dan utilitas; estimasi biaya jual beli tidak diterapkan.

## Penyimpanan dan jadwal

1. Klien menyebut hari/tanggal, jam, dan nama. Nama yang sudah tersimpan digunakan.
   Nomor berasal dari metadata WhatsApp terverifikasi, bukan teks yang diketik klien.
2. Bot mengecek slot agen. Slot satu jam tersedia pada pukul 08, 09, 10, 11,
   13, 14, 15, 16, dan 17 WIB, sampai 92 hari ke depan.
3. Bot menyebut ulang aset, nama, tanggal, dan jam lalu meminta konfirmasi klien.
4. Setelah disetujui, transaksi database menyimpan `booking_survei` berstatus
   `PENDING` dan `Acara` bertipe `SITE_VISIT` pada agen WhatsApp yang melayani.
   `Acara` memakai `SCHEDULED` untuk memblokir slot; pendampingan belum dianggap final.
5. Balasan baru menyebut “tersimpan” setelah mendapat receipt API yang cocok.
   Notifikasi dashboard dikirim setelah commit. Playground memakai mock dan
   menampilkan label simulasi tanpa menyimpan booking sungguhan.

Booking tidak menaruh ID CRM pada kolom `BookingSurvei.id_klien`, karena kolom
tersebut merujuk akun `Pengguna`. Jika kontak ditemukan di CRM, referensinya
dicatat pada `Acara.id_klien_ref`.

`chatbot_request_id` unik menyatukan retry dengan pengajuan yang sama. State
`submitting/retry/booked` serta ID tersebut disimpan di SQLite sebelum/selesai
memanggil API, sehingga timeout atau restart tidak membuat pengajuan ganda.
Penguncian transaksi per agen dan pengecekan overlap melindungi bentrokan
antara chat dan formulir website. Kalender yang dibatalkan tidak memblokir slot.
Pembatalan setelah booking sudah tersimpan diteruskan ke agen; bot tidak
mengklaim telah membatalkan atau menjadwal ulang tanpa penyimpanan yang sesuai.

## Konfigurasi dan verifikasi

Endpoint baru `POST /api/internal/chatbot/surveys` memakai `CHATBOT_CLIENT_TOKEN`
yang sama dengan penyimpanan CRM. Backend menyusun URL dari `CLIENT_API_URL`.
Identitas agen diteruskan dari koneksi WhatsApp; caller tidak bisa mengirim
status booking, ID akun pengguna, atau ID acara sendiri.

Migrasi tambahan: `prisma/migration_chatbot_survei.sql`. Kolom boleh null,
sehingga formulir survei website tetap dapat digunakan. Terapkan migrasi di
setiap database deployment sebelum menggunakan booking dari bot.

```sh
# Dari root repository: uji API, konflik jadwal, dan formulir website
node --test scripts/test-chatbot-surveys.cjs scripts/test-property-contact.cjs

# Verifikasi database nyata; seluruh booking/acara uji di-rollback
node scripts/verify-chatbot-surveys-db.cjs

# Opsional saat menerapkan kolom/index pada database target
node scripts/verify-chatbot-surveys-db.cjs --apply

# Simulasi lewat MessageProcessor, tanpa WhatsApp/database nyata
npm --prefix backend/whatsapp run simulate:consultation
```

Verifikasi database tidak memanggil API, Pusher, maupun WhatsApp. Uji ini
memeriksa write/read booking dan agenda, retry idempoten, konflik slot, dan
ketiadaan data fixture setelah rollback.

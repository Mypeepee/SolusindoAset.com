# Simulasi pemahaman bahasa chatbot — 12 Oktober 2026

Kasus awal: setelah area Menganti, Kabupaten Gresik dan anggaran Rp400 juta
sudah diketahui, pengguna menjawab “rumah dan toko pak. tidak ada batasan
luasan”. Versi lama mengulang pertanyaan jenis dan luas. Versi baru menyimpan
RUMAH atau TOKO, tanpa batas luas, mempertahankan lokasi/anggaran, dan langsung
menjalankan pencarian.

## Hasil

| Kumpulan skenario | Sebelum | Sesudah |
| --- | ---: | ---: |
| Kasus asli Menganti | 0/1 | 1/1 |
| Variasi acak | 74/500 | 500/500 |
| Jawaban yang harus diklarifikasi | 10/10 | 10/10 |
| Koreksi jenis | 3/4 | 4/4 |
| Total | 87/515 (16.89%) | 515/515 (100.00%) |

Baseline diukur sebelum perubahan pada corpus dan seed yang sama. Simulasi
menggunakan alur `generatePropertyReply`, bukan hanya fungsi parser.
Tes backend lengkap (`npm run check`): **442 lulus, 0 gagal**, termasuk
penerapan filter Prisma beberapa kategori, alur WhatsApp tiruan, dan permintaan
HTTP Playground dengan konteks yang disimpan server.
Verifikasi akhir pada 13 Oktober 2026 kembali meluluskan seluruh 442 tes,
termasuk balasan hasil kosong yang tidak menawarkan perubahan luas ketika
pengguna sudah memilih tanpa batas luas.
Pemeriksaan TypeScript khusus `property-knowledge.ts` lulus. Pemeriksaan
seluruh proyek menemukan 138 error di file di luar perubahan chatbot;
lognya berada di `/tmp/kosku-chatbot-tsc.log`.

## Arti probabilitas

Seed: `20261012`. Sebanyak 500 sampel diambil dengan pengembalian dari kombinasi
12 frasa jenis, 12 frasa luas, sapaan, pemisah, urutan kriteria, dan kapitalisasi.
Sampel dapat mengandung kombinasi duplikat. Semua kombinasi diperiksa terhadap
jenis, luas, lokasi, anggaran, kesiapan pencarian, dan tidak mengulang pertanyaan
yang sudah terjawab. Kasus negatif harus tetap meminta klarifikasi tanpa query.

Estimasi keberhasilan empiris pada **generator sintetis ini** adalah
**100.00%**; interval Wilson 95%:
**99.24–100.00%**. Interval ini hanya menggambarkan variasi sampling dari
generator tersebut. Corpus juga dipakai untuk memperbaiki parser, sehingga
hasilnya merupakan evaluasi regresi, bukan evaluasi independen atas pelanggan.
Tidak ada klaim probabilitas memahami seluruh bahasa Indonesia. Akurasi dunia
nyata memerlukan kumpulan percakapan anonim yang terpisah dari pengembangan.

## Contoh hasil

Filter yang diteruskan setelah jawaban asli:

```json
{
  "location": "Menganti",
  "city": "Kabupaten Gresik",
  "district": "Menganti",
  "village": null,
  "category": null,
  "categories": ["RUMAH", "TOKO"],
  "max_price": 400000000,
  "min_land_area_m2": null,
  "max_land_area_m2": null
}
```

Simulasi sengaja memakai katalog kosong; balasan aktualnya:

> Bapak/Ibu, saat ini belum ditemukan rumah atau toko yang cocok di area *Menganti* dengan kriteria pencarian tersebut.
> 
> Apakah Bapak/Ibu ingin memperluas area pencarian atau menyesuaikan anggaran?

Ini tidak menyatakan kondisi stok properti asli. Tidak ada panggilan AI,
pencarian database produksi, atau pengiriman pesan WhatsApp nyata.

## Menjalankan kembali

Dari `backend/whatsapp`:

```sh
npm run simulate:language
npm run check
```

Transkrip, filter query, hasil per skenario, dan statistik berada di
`/tmp/kosku-language-simulations.json`. Snapshot sebelum perbaikan berada di
`/tmp/kosku-language-baseline.json` pada sesi pengembangan ini; angka baseline
juga dicatat dalam tabel di atas. File `/tmp` bersifat sementara.

Backend WhatsApp dan API Next.js perlu diperbarui bersama karena kontrak API
kini mendukung `categories`. Perubahan ini belum dideploy ke layanan aktif.

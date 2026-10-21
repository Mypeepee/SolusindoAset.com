# Smart Search: kriteria kompleks dan memori percakapan

Implementasi ada di `services/smart_search_parser.js`. `SMART_SEARCH_SCHEMA`
mendefinisikan Structured Outputs, `SMART_SEARCH_PROMPT` menjelaskan istilah
lokal, `createSmartSearchParser()` memanggil provider yang sudah dikonfigurasi,
dan `validateSmartSearch()` memeriksa hasil sebelum menjadi filter.

OpenAI memakai Responses API dengan `text.format.type=json_schema`,
`strict: true`, dan `store: false`. Gemini memakai JSON Schema melalui
`responseJsonSchema`. Tidak ada SQL atau nama kolom yang dibuat model.
Skema memakai `additionalProperties: false` dan semua field diwajibkan; nilai
kosong/null berarti tidak mengubah preferensi sebelumnya. Rujukan API:
[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## Hasil ekstraksi

Setelah klien memilih ruko, percakapan Koko menghasilkan ringkasan berikut.
Field ini tersedia di `knowledge.search` pada hasil Playground:

```json
{
  "jenis_properti": ["ruko"],
  "budget_maksimal": 1000000000,
  "lokasi_diminati": ["Manyar", "Ngagel", "Pucang"],
  "patokan_area_atau_rute": ["ITC", "Pasar Atom", "Stikom", "MERR"],
  "syarat_legalitas": ["Bukan Surat Ijo"],
  "spesifikasi_khusus": "nol jalan, 2arah aspal, hitung tanah",
  "kota_kabupaten": ["Surabaya"],
  "luas_tanah_minimal": 80,
  "luas_tanah_maksimal": null
}
```

Skema ekstraksi juga memiliki `operasi_lokasi` (`keep`, `replace`, `add`,
`remove`, `clear`) dan `bukti` untuk setiap perubahan. Bukti harus berupa
kutipan persis dari pesan klien yang sedang diproses. Nama lokasi harus
didukung kutipan tersebut, dan nominal/luas diperiksa lagi oleh parser angka.
Pertanyaan dan contoh yang ditulis asisten tidak menjadi bukti preferensi.

`hitung tanah` menyatakan orientasi nilai/kondisi properti. Istilah ini tidak
mengubah jenis RUKO menjadi TANAH. `Ok`, `siap`, dan `carikan` tidak menjadi
lokasi atau izin melonggarkan filter. Nama Manyar saja tetap memerlukan
disambiguasi; gabungan patokan Surabaya yang dikenal dapat menetapkan kota.

## Alur Node.js dan memori

Alur produksi sudah terhubung melalui `MessageProcessor` dan juga digunakan
Playground. Bentuk pemanggilannya di `services/property_reply.js` adalah:

```js
const buyer = buyerContext(history, text, previousId, {
  continuation: session.buyer_state,
});

const parsed = await ai.parseSearch({ text, history, buyer, signal });
if (parsed?.patch) applyDiscovery(buyer.profile, parsed.patch);

// Setelah rekonsiliasi field yang masih kurang, jalankan katalog dengan
// filter terstruktur. Respons hasil hanya dikirim setelah pencarian selesai.
const context = await catalog.resolve(text, null, buyer.profile);
session.buyer_state = buyer.continuation;
store.rememberSearch(session);
```

Cuplikan di atas memperlihatkan alurnya; implementasi lengkap juga menangani
field yang belum terjawab, pembatalan permintaan, pemilihan aset, dan fallback.
`createAiController(config.llm)` menyediakan `parseSearch` secara otomatis.
Konfigurasi provider/model/key mengikuti `.env` backend yang sudah ada.

Model menerima **seluruh riwayat yang masih disimpan server**, ditambah
ringkasan kriteria terstruktur. Riwayat dibatasi 24 pesan/24.000 karakter;
kriteria yang lebih lama tetap ada dalam `buyer_state`, sehingga pemangkasan
riwayat tidak menghapus anggaran, jenis, beberapa area, legalitas, atau luas.
Pesan WhatsApp yang datang beruntun tetap dicatat; balasan tertunda memakai
kriteria terbaru dan menjawab pertanyaan yang masuk sejak balasan terakhir.

`state/conversation_control.js` menyimpan preferensi terstruktur, sapaan klien,
dan nomor urut pesan ke SQLite, terpisah untuk setiap agent/kontak. Setelah
restart, nomor urut dilanjutkan agar pesan baru tidak dianggap sudah diproses.
Riwayat chat mentah tidak disimpan di tabel ini. Batas idle pencarian tetap
mengikuti `SESSION_IDLE_MINUTES` (default 45 menit); restart tidak memperpanjangnya.
Jeda karena agent mengambil alih tetap dipertahankan.

Parser AI dibatasi sepuluh detik termasuk failover. Jika kuota, jaringan,
timeout, atau validasi gagal, ekstraksi lokal tetap menyimpan kriteria yang
sudah dikenali dan bot hanya meminta field yang benar-benar belum diketahui.

## Filter database dan batas data

`src/lib/chatbot/property-knowledge.ts` memvalidasi array lalu membentuk Prisma
predicates dengan nilai terikat. Manyar **atau** Ngagel **atau** Pucang berada
dalam satu grup OR; kota, kategori, anggaran, luas, status tayang, dan jenis
sertifikat tetap menjadi syarat AND. Beberapa kota juga diterima tanpa otomatis
memilih kota pertama. Penyebutan satu keluarga Kota/Kabupaten Mojokerto tetap
mengikuti resolusi wilayah yang sudah ada.

Penolakan Surat Ijo membatasi sertifikat tercatat ke SHM/HGB. Data sertifikat
yang kosong/tidak memenuhi tidak dipromosikan sebagai cocok. Ini tidak
menggantikan pemeriksaan dokumen aset.

Data listing belum memiliki kolom terstruktur untuk nol jalan, jalan dua arah
aspal, dan harga hitung tanah. Syarat tersebut disimpan serta ditampilkan
kembali dengan catatan perlu dicocokkan tim. Jika hanya koridor yang diketahui,
pencarian memakai kecocokan alamat/patokan yang tercatat; ini belum mengukur
seluruh rute di antara titik tersebut. Ketika area preferensi tersedia,
area-area itulah yang dipakai untuk penyaringan lokasi.

Pertanyaan kapan bisa ditempati dan dana setelah pelunasan dijawab sebelum
ringkasan pencarian. Bot tidak menjanjikan aman 100%, jadwal pengosongan, atau
nominal biaya tanpa aset yang jelas. Penjelasan mengikuti
[FAQ DJKN tentang pengosongan, balik nama, dan biaya lelang](https://www.djkn.kemenkeu.go.id/faq/faq_detail/pelayanan-lelang/3).

## Verifikasi

```sh
cd backend/whatsapp
node --test test/smart_search.test.js
node --test --test-concurrency=2
```

Tes khusus mencakup log Koko, pesan serentak, kedua provider dengan respons
tiruan, snapshot riwayat yang dipangkas, restart/isolasi agent, tambah/hapus area,
multi-kota, filter Prisma, jawaban pendek, validasi bukti, dan kegagalan provider.
Pengujian ini tidak mengirim WhatsApp atau mengakses database produksi.

Hasil verifikasi 20 Oktober 2026:

- 17 tes Smart Search lulus, termasuk reproduksi percakapan Koko.
- 159 tes pencarian/wilayah/kategori yang diperiksa bersama lulus.
- Uji sintetis langsung ke Gemini 2.5 Flash menghasilkan patch tervalidasi
  dalam sekitar 5,8 detik: RUKO, Rp1 miliar, Manyar/Ngagel/Pucang, Surabaya,
  penolakan Surat Ijo, kebutuhan jalan/hitung tanah, dan LT minimal 80 m².
- Pemeriksaan tipe untuk jalur API properti dan pemeriksaan sintaks modul
  yang diubah lulus.
- Regresi seluruh backend: 1.019 dari 1.023 tes lulus. Empat tes pada
  `mou_document.test.js`, `polite_selection.test.js`, dan
  `single_recommendation.test.js` mengharapkan `purchase_preparation`
  sesudah jawaban pendek pada pertanyaan MOU; implementasi intake yang ada
  menghasilkan `clarify`. Keempatnya juga gagal dengan jalur Smart Search
  dinonaktifkan. Perubahan Search/Discovery ini tidak menyelesaikan perbedaan
  ekspektasi pada alur closing tersebut.

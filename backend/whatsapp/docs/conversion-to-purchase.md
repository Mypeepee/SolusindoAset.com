# Journey pembelian Solusindo Premier

Percakapan pembelian mengikuti keputusan dan kepastian aset yang sedang dibahas.
Bot tidak berpindah slide SOP hanya karena pelanggan membalas “boleh”. Backend
menyimpan **pertanyaan yang dikirim dan tindakan yang ditawarkan**, sehingga
jawaban pendek selalu ditafsirkan berdasarkan pertanyaan itu.

Minat singkat setelah melihat detail atau biaya juga merupakan sinyal untuk
menjelaskan proses pembelian. “Wow... saya tertarik pak”, “saya minat”, atau
“mau lanjut pak” tidak harus mengulang kode aset maupun kata “membeli”. Policy,
resolver aset, dan state machine memakai konteks aset pilihan yang disimpan
server, sehingga tidak kembali bertanya ingin tahu harga/lokasi/fasilitas/biaya.
Resolver tetap membaca ulang listing publik sebelum melanjutkan.

Konteks ini membutuhkan aset yang sudah dipilih. Daftar rekomendasi baru tidak
mengizinkan penutupan aset lama berdasarkan minat yang belum spesifik. Minat pada
daerah lain, pertanyaan tentang properti, penolakan, kondisi hipotetis, atau
keraguan tidak diperlakukan sebagai persetujuan melanjutkan. Minat juga tidak
mencatat pembayaran, membuat akun, atau membuka MOU secara otomatis.

[Simulasi lengkap Sumber Pasir](simulasi-interest-setelah-biaya.md) menjalankan
pencarian dua aset, pemilihan nomor satu, rincian biaya, minat singkat, informasi
DP, lalu informasi akun. Transkrip memakai katalog/WhatsApp tiruan; tidak memeriksa
stok nyata atau mengirim pesan keluar.

## Perjalanan pelanggan

Untuk aset dengan tanggal lelang yang sudah lewat, konfirmasi stok didahulukan.
Status tayang `TERSEDIA` bukan bukti bahwa aset belum terjual. Pesan ke stoker
terkirim atau catatan pengecekan ditutup juga bukan hasil konfirmasi stok.

Setelah tim mengonfirmasi aset belum terjual, penjelasan mengikuti urutan ini.
Informasi jadwal ulang dijawab saat relevan atau ditanyakan; tidak harus menjadi
satu giliran terpisah sebelum menjelaskan akun.

| Fokus | Penjelasan dan keputusan berikutnya |
| --- | --- |
| DP keseriusan | Backend menghitung 10%, dengan batas Rp20 juta. Bot hanya menyebut nominal hasilnya dan menghubungkan ke bantuan pembuatan akun atas nama klien setelah DP. Rumus dan batas tidak disebut dalam balasan. |
| Akun klien | Akun atas nama klien, dengan KTP dan cover buku tabungan atas nama klien untuk rekening pengembalian. Dokumen melalui kanal aman tim. |
| Setoran jaminan | Ke VA resmi kepesertaan lelang klien; bukan rekening PT. VA Mandiri mengikuti instruksi resmi pada akun lelang. Bot tidak membuat nomor atau instruksi transfer sendiri. |
| Bidding | Tiga bidder profesional membantu satu kepesertaan klien, mengupayakan harga terbaik tanpa melebihi batas maksimal klien. Tidak menjamin kemenangan atau harga akhir. |
| Jika menang | Pengurusan dokumen dan balik nama; dokumen asli diserahkan setelah proses balik nama selesai. |
| Setelah balik nama | Mediasi dengan debitur/penghuni. Bila penyelesaian sukarela gagal, pendampingan proses pengadilan mengikuti kondisi aset dan respons debitur. |
| Jika kalah | Kebijakan layanan: jaminan dan DP dikembalikan 100% tanpa potongan biaya layanan. Jaminan melalui penyelenggara ke rekening klien; DP dikembalikan tim sesuai kesepakatan. |
| Siap melanjutkan | Setelah proses dan biaya dipahami, tawarkan mempelajari draf MOU/ketentuan DP, tanpa mendesak tanda tangan. |

Jika jadwal lama lewat, Solusindo Premier membantu koordinasi pengajuan lelang
ulang setelah kepastian aset dan komitmen DP. Tanggal mengikuti penjual dan
penyelenggara; penjelasan akun tidak berarti jadwal baru sudah ditetapkan.

Penjelasan boleh diberikan sambil menunggu stok, tetapi **ajakan komitmen DP untuk
aset yang jadwalnya lewat menunggu konfirmasi tersedia**. Bot tidak mengatakan
bahwa akun dibuat, jadwal ditetapkan, jaminan dibayar, bidding dijalankan, balik
nama selesai, atau pengosongan dilakukan berdasarkan chat biasa.

Satu giliran tetap berfokus pada kebutuhan yang sedang dibahas. Pertanyaan
langsung dijawab tanpa memaksa pelanggan mengulang seluruh alur. CTA bukan
ujian “sudah jelas?” pada setiap tahap: bot menawarkan penjelasan yang relevan,
menggali batas penawaran, atau memberi ruang mengajukan pertanyaan.
Pernyataan eksplisit bahwa **seluruh alur** sudah dipahami dapat membuka draf
kesepakatan tanpa mengulang semua topik. “Sudah jelas” untuk satu bagian atau
“boleh” biasa tetap mengikuti pertanyaan terakhir. Persetujuan menyiapkan draf
menyerahkan chat ke tim dan menjeda bot dengan pesan khusus kesepakatan/DP.

## Contoh penting: makna jawaban “boleh”

Pertanyaan bot:

> Ada yang ingin ditanyakan tentang pengecekan jadwalnya?

Klien:

> Boleh.

Respons berikutnya:

> Silakan, saya bantu jawab dulu supaya tidak ada yang mengganjal. Bagian mana
> yang ingin ditanyakan?

Jika pertanyaan sebelumnya “Sambil menunggu, mau saya jelaskan ketentuan DP
keseriusannya dulu?”, jawaban “boleh” membuka **informasi DP**. Tidak ada
perpindahan otomatis ke akun hanya karena klien mengizinkan mengajukan pertanyaan.
Namun, setelah informasi DP, bot boleh menawarkan **penjelasan data akun** saat
stok masih menunggu konfirmasi. Persetujuannya tidak membuat akun atau menagih DP.

## Contoh penting: nominal DP dan jawaban “tidak ada”

Untuk harga aset Rp417.128.521, backend menghitung DP Rp20.000.000. Balasan:

> DP keseriusan untuk aset ini Rp 20.000.000. Setelah DP, kami bantu buatkan akun
> lelang atas nama Anda. Mau saya jelaskan data yang perlu disiapkan untuk akun
> lelangnya?

Saat stok masih menunggu, tambahkan satu kalimat: “Pembayarannya menunggu
kepastian aset dari tim.” Jangan menyebut “harga limit aset ini Rp20.000.000”,
persentase atau batas DP. Jika harga belum diketahui, nominal dikonfirmasi tim.

Jika sesi lama masih menanyakan “Ada ketentuan DP yang ingin ditanyakan?” lalu
klien membalas “tidak ada”, “nggak ada”, atau “tidak ada pertanyaan”, bot menutup
bahasan DP dengan pengakuan singkat dan menjelaskan persiapan akun. Bot tidak
mengulang nominal atau pertanyaan DP. Jawaban seperti “tidak ada dana” tetap
dibedakan dari tidak adanya pertanyaan. Pengakuan ini tidak menandakan DP sudah
dibayar, stok tersedia, atau persetujuan tanda tangan.

[Simulasi percakapan](simulasi-purchase-journey.md) menampilkan keluaran dan
mode generasinya. Data simulasi tidak membuktikan stok aktual Kode 121820.

## Konfirmasi stok dari dashboard

Di Dashboard Owner → Chatbot Integration → Perlu cek status lelang, operator
memilih hasil dan mencatat sumber konfirmasi:

- **Dikonfirmasi masih tersedia**: bot dapat menjelaskan komitmen DP ketika
  prospek membalas lagi.
- **Dikonfirmasi sudah terjual**: pembelian aset dihentikan; bot menawarkan
  pencarian pengganti.
- **Tutup catatan, stok belum pasti**: penutupan administratif saja; tidak
  membuka tahap DP.

Akses tetap melalui sesi Owner dan integrasi agent yang ditentukan server.
Browser tidak dapat mengganti tenant atau menyisipkan status stok ke sesi chat.
Tidak ada pengiriman hasil proaktif ke pelanggan ketika tombol ditekan.

Kontrak backend yang kompatibel dengan penutupan catatan lama:

```http
PATCH /agents/AG108/admin/asset-checks/<checkId>
Authorization: Bearer <ADMIN_API_TOKEN>
Content-Type: application/json

{
  "status": "completed",
  "result": "available",
  "reference": "Konfirmasi stoker pada tanggal dan jam pemeriksaan"
}
```

`result` hanya `available` atau `sold`, dengan `reference` wajib maksimal 300
karakter. Tanpa result, hanya menutup catatan. Konfirmasi terikat tenant, kode
aset, dan waktu lelang yang sama; tidak dipindahkan ke aset atau ronde lain.
Hasil berlaku 24 jam untuk menjaga konteks keputusan tetap baru. Hasil dan sumber
tersimpan di SQLite; sumber internal tidak dikirim ke LLM atau pelanggan.
Operator tetap perlu memperbarui listing ketika status/jadwalnya berubah.
Permintaan baru membuka kembali catatan yang belum pasti atau sudah kedaluwarsa.
Pesan konfirmasi baru dapat dikirim setelah 24 jam sejak kiriman yang berhasil;
hasil pengiriman ambigu tetap membutuhkan pemeriksaan manual sebelum dikirim ulang.

## Prompt dan generasi bahasa

`services/closing_state.js` menentukan fokus, gerbang stok, pemahaman klien,
batas penawaran dan tindak lanjut. `services/closing_controller.js` memuat
`systemMessage`, contoh percakapan, fakta tiap fokus dan respons cadangan.

LLM dapat menulis ulang fakta yang diberikan menjadi 2–4 kalimat natural. Output
JSON: `{ "body": "...", "cta_id": 0 }`. CTA dirender server dan dipetakan ke
tindakan seperti `ask_question`, `explain_dp`, `capture_bid_limit`, atau
`explain_account`. Model tidak menerima alat untuk membayar, menawar, mengubah
stok atau memajukan status operasional.

Backend memeriksa panjang, format, angka, kelengkapan fakta utama, topik, klaim
stok, hasil lelang, pengumpulan dokumen dan janji kemenangan. Output tidak valid,
quota atau timeout memakai respons lokal untuk fokus yang sama. Cancellation
tetap membatalkan giliran. Transport OpenAI/Gemini tetap menggunakan schema,
timeout, cooldown dan failover yang sudah ada; `store:false` tetap dipakai pada
OpenAI. [Dokumentasi resmi Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

Nominal DP dihitung server sebagai `min(round(base / 10), 20_000_000)` dari harga
limit yang tersedia. Validasi output mewajibkan nominal tersebut tetap tepat,
menolak persentase atau batas DP dalam keluaran, dan menjaga keterangan menunggu
kepastian aset sebelum pembayaran. Kesepakatan pendampingan tetap melalui tim.
Uang jaminan lelang mengikuti pengumuman/instruksi resmi dan berbeda dari DP;
penjelasannya diberikan pada fokus jaminan agar balasan DP tetap singkat.

Akun atas nama peserta, rekening pengembalian atas nama peserta, mekanisme VA,
dan pengurusan setelah menang harus disesuaikan dengan instruksi resmi aset.
Sumber utama: [FAQ DJKN](https://www.djkn.kemenkeu.go.id/faq/faq_detail/pelayanan-lelang/3)
dan [FAQ KPKNL Surabaya](https://www.djkn.kemenkeu.go.id/kpknl-surabaya/baca-berita/15736/Frequently-Asked-Question-FAQ-Konsultasi-Pelayanan-KPKNL-Surabaya.html).
Kebijakan DP dan pengembaliannya merupakan SOP pendampingan dari pemilik layanan,
bukan klaim ketentuan universal penyelenggara lelang.

## Memory dan lifecycle

`conversion` menyimpan `flow_version:3`, `phase`, `stock_status`, `topic`,
`last_topic`, `pending_action`, `pending_question`, `explained_topics`,
`process_understood`, `max_bid`, dan hasil lelang tepercaya. Cursor dan pertanyaan
terakhir dipersistenkan lewat `conversation-control.sqlite`; riwayat teks chat
berada dalam memori yang dibatasi. State WhatsApp baru disimpan setelah bubble
terkirim. Pengambilalihan manusia dan kegagalan kirim tidak memajukan journey.

Sesi versi lama dimigrasikan saat dipakai tanpa menghilangkan batas penawaran
atau hasil menang/kalah yang telah dicatat operator. Jika pertanyaan lama membuka
sesi tanya jawab, “boleh” tidak dianggap persetujuan membuat akun.

Playground menyimpan state di server per `agentId:conversationId`; tidak membaca
state dari body/history browser. Playground tidak mengirim permintaan stok nyata,
sehingga skenario stok lewat tetap menunggu konfirmasi dan hanya menjelaskan
informasi. Gunakan simulasi atau tes untuk meninjau skenario stok terkonfirmasi.

Endpoint hasil lelang tetap tersedia:

```http
POST /agents/AG108/admin/conversations/<contact>/closing-outcome
Authorization: Bearer <ADMIN_API_TOKEN>
Content-Type: application/json

{
  "event_id": "hasil-lelang-20261120-001",
  "asset_id": "121820",
  "outcome": "won",
  "reference": "referensi-hasil-resmi-001"
}
```

Hasil hanya `won` atau `lost`. Event harus terikat aset, konflik ditolak, dan
payload sama dengan ID sama idempotent. Menang bukan bukti balik nama selesai;
penanganan dokumen dan mediasi tetap dijelaskan sebagai tahap yang akan dilakukan.

## Pengujian dan simulasi

```sh
cd backend/whatsapp
node --test test/closing.test.js
npm test
node scripts/preview-purchase-journey.js
# Opsional: maksimal enam request ke provider yang sudah dikonfigurasi.
node scripts/preview-purchase-journey.js --live
```

Tes memakai mock LLM/WhatsApp, SQLite sementara dan HTTP loopback. Simulasi live
hanya meminta teks dari provider; tidak membaca stok nyata atau mengirim WhatsApp.
Konfigurasi provider, model dan secret tetap melalui `.env` server yang sudah ada.

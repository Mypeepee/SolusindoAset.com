// One-off seed for sample blog articles. Run: node scripts/seed-berita.mjs
// Safe to delete the rows afterwards via the dashboard (Kelola Berita).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 280);
}

const IMG = {
  lelang:
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80",
  market:
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80",
  buyer:
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=80",
  legal:
    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1600&q=80",
};

const articles = [
  {
    judul: "Cara Menang Lelang Rumah Sitaan Bank: Panduan Lengkap Pemula",
    kategori: "Tips Lelang",
    ringkasan:
      "Jangan takut main lelang. Simak strategi bidding, cara cek legalitas aset, dan risiko tersembunyi agar investasi properti lelang Anda menguntungkan.",
    gambar_utama: IMG.lelang,
    tag: ["lelang", "kpknl", "investasi"],
    berita_utama: true,
    berita_unggulan: true,
    daysAgo: 1,
    isi: `Lelang properti sitaan bank kerap dianggap jalur pintas mendapatkan properti di bawah harga pasar. Namun tanpa persiapan matang, justru bisa berujung kerugian besar.

Berdasarkan data KPKNL, nilai transaksi lelang properti di Indonesia meningkat rata-rata **23% per tahun** sejak 2022. Ini menandakan minat investor ritel yang terus tumbuh.

## Pahami Jenis Lelang Properti

Ada dua jenis utama yang perlu Anda kenali:

- **Lelang eksekusi** — properti jaminan kredit macet yang dieksekusi bank.
- **Lelang sukarela** — pemilik memilih menjual lewat mekanisme lelang.

> Lelang eksekusi tidak memerlukan persetujuan debitur. Bank berhak menjual agunan melalui KPKNL setelah kredit dinyatakan macet.

## Cek Legalitas Sebelum Bidding

Pastikan dokumen properti bersih. Periksa sertifikat (SHM/HGB), status pajak PBB, dan pastikan tidak ada sengketa ahli waris. Minta salinan dokumen dari panitia lelang dan konsultasikan ke notaris atau PPAT terpercaya.

## Strategi Penawaran yang Tepat

Tentukan batas harga maksimum sebelum hari H berdasarkan survei minimal 3 properti pembanding. Jangan terbawa emosi saat bidding — disiplin terhadap batas harga adalah kunci keuntungan.

---

**Kesimpulan:** Lelang properti adalah peluang investasi menjanjikan bila dilakukan dengan riset dan disiplin. Persiapkan dokumen, pahami legalitas, dan tetap rasional saat proses bidding.`,
  },
  {
    judul: "Prediksi Harga Properti Surabaya 2026: Saatnya Beli?",
    kategori: "Analisa Pasar",
    ringkasan:
      "Melihat tren kenaikan harga tanah di Surabaya Barat dan Timur. Apakah ini momen yang tepat untuk mulai berinvestasi properti?",
    gambar_utama: IMG.market,
    tag: ["surabaya", "analisa pasar", "tanah"],
    berita_unggulan: true,
    daysAgo: 4,
    isi: `Pasar properti Surabaya menunjukkan pemulihan yang stabil memasuki 2026, didorong oleh pembangunan infrastruktur dan migrasi penduduk ke kawasan barat.

## Surabaya Barat vs Timur

Kawasan barat (Pakuwon, Citraland) tetap memimpin dari sisi harga premium, sementara kawasan timur menawarkan **potensi capital gain** lebih tinggi untuk investor jangka menengah.

- Surabaya Barat: harga stabil, likuiditas tinggi.
- Surabaya Timur: harga lebih terjangkau, pertumbuhan agresif.

## Faktor Pendorong 2026

1. Penyelesaian proyek jalan lingkar luar.
2. Ekspansi kawasan industri dan pergudangan.
3. Permintaan hunian kelas menengah yang konsisten.

> Momentum terbaik membeli properti adalah saat pasar sedang konsolidasi — sebelum kenaikan tajam berikutnya.

Bagi investor dengan horizon 3–5 tahun, 2026 menawarkan titik masuk yang menarik, terutama untuk lahan di koridor pertumbuhan baru.`,
  },
  {
    judul: "Panduan AJB, SHM, HGB: Legalitas Properti yang Wajib Dipahami",
    kategori: "Legal & Dokumen",
    ringkasan:
      "Bingung dengan istilah dokumen properti? Kami bedah tuntas perbedaan AJB, SHM, HGB, dan mana yang paling aman untuk investasi jangka panjang.",
    gambar_utama: IMG.legal,
    tag: ["shm", "hgb", "legalitas"],
    daysAgo: 9,
    isi: `Memahami status legalitas adalah fondasi investasi properti yang aman. Kesalahan membaca dokumen bisa berakibat sengketa berkepanjangan.

## Tiga Dokumen Utama

- **SHM (Sertifikat Hak Milik)** — hak terkuat dan terpenuh, berlaku selamanya.
- **HGB (Hak Guna Bangunan)** — hak mendirikan bangunan dengan jangka waktu tertentu.
- **AJB (Akta Jual Beli)** — bukti peralihan hak, bukan sertifikat kepemilikan.

## Mana yang Paling Aman?

Untuk hunian jangka panjang, **SHM** adalah pilihan ideal. HGB umum untuk properti komersial dan apartemen, namun perlu diperpanjang sebelum masa berlaku habis.

> Selalu lakukan pengecekan sertifikat ke kantor BPN setempat sebelum transaksi untuk memastikan keaslian dan status bebas sengketa.

Pastikan setiap transaksi dituangkan dalam AJB di hadapan PPAT, lalu lanjutkan proses balik nama agar kepemilikan tercatat resmi.`,
  },
];

async function main() {
  let created = 0;
  for (const a of articles) {
    const slug = slugify(a.judul);
    const exists = await prisma.berita.findUnique({ where: { slug } });
    if (exists) {
      console.log("skip (exists):", slug);
      continue;
    }
    const tanggal = new Date(Date.now() - a.daysAgo * 86400000);
    await prisma.berita.create({
      data: {
        judul: a.judul,
        slug,
        ringkasan: a.ringkasan,
        isi_berita: a.isi,
        gambar_utama: a.gambar_utama,
        kategori: a.kategori,
        tag: JSON.stringify(a.tag),
        penulis: "Tim Redaksi",
        status_publish: "PUBLISHED",
        berita_unggulan: !!a.berita_unggulan,
        berita_utama: !!a.berita_utama,
        tanggal_publish: tanggal,
        tanggal_diupdate: tanggal,
      },
    });
    created += 1;
    console.log("created:", slug);
  }
  console.log(`Done. ${created} article(s) created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

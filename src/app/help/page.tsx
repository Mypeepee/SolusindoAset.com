"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

/* ============================================================================
 * PUSAT BANTUAN — SOLUSINDO ASET
 * Ultra-premium help center: jual beli, lelang, sewa, titip jual & keamanan.
 * ========================================================================== */

// ── Konfigurasi kontak (ganti nomor WA dengan nomor resmi Anda) ──────────────
const SUPPORT = {
  whatsapp: "https://wa.me/62XXXXXXXXXXX", // TODO: ganti dengan nomor WhatsApp resmi
  email: "closingsystem@gmail.com",
  hours: "Setiap hari, 08.00–21.00 WIB",
  address:
    "Santorini Town Square, Jl. Ronggolawe No.2A, DR. Soetomo, Tegalsari, Surabaya",
};

// ── Animasi ──────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

// ── Tipe ───────────────────────────────────────────────────────────────────
type Role = "cari" | "jual";
interface Faq {
  id: string;
  roles: Role[]; // ["cari","jual"] = tampil di kedua peran
  cat: string;
  q: string;
  a: string;
}

// ── Kategori ─────────────────────────────────────────────────────────────────
const categories = [
  { id: "all", label: "Semua Topik", icon: "solar:widget-2-bold-duotone" },
  { id: "memulai", label: "Memulai", icon: "solar:rocket-2-bold-duotone" },
  { id: "jualbeli", label: "Jual Beli", icon: "solar:home-smile-bold-duotone" },
  { id: "lelang", label: "Aset Lelang", icon: "solar:tag-price-bold-duotone" },
  { id: "sewa", label: "Sewa", icon: "solar:key-minimalistic-square-bold-duotone" },
  { id: "pembayaran", label: "Bayar & Keamanan", icon: "solar:shield-keyhole-bold-duotone" },
  { id: "legalitas", label: "Legalitas", icon: "solar:document-text-bold-duotone" },
  { id: "akun", label: "Akun", icon: "solar:user-id-bold-duotone" },
];

const popularSearches = ["KPR", "Lelang", "Biaya beli", "Balik nama", "Titip jual", "Lupa password"];

// ── Database FAQ ─────────────────────────────────────────────────────────────
const faqs: Faq[] = [
  // MEMULAI
  {
    id: "m1",
    roles: ["cari", "jual"],
    cat: "memulai",
    q: "Apa itu Solusindo Aset?",
    a: "Solusindo Aset adalah platform properti terintegrasi untuk jual beli (primary & secondary), aset lelang, hingga sewa. Semua kebutuhan properti Anda — mencari, menjual, sampai mengurus legalitas — tersedia dalam satu aplikasi yang aman dan transparan, didukung 1.200+ agent profesional.",
  },
  {
    id: "m2",
    roles: ["cari", "jual"],
    cat: "memulai",
    q: "Apakah membuat akun di Solusindo Aset gratis?",
    a: "Ya, 100% gratis. Anda dapat menjelajah listing, menyimpan favorit, dan menghubungi agent tanpa biaya apa pun. Biaya hanya berlaku saat transaksi, dengan besaran yang jelas dan disepakati di awal.",
  },
  {
    id: "m3",
    roles: ["cari"],
    cat: "memulai",
    q: "Bagaimana cara mencari properti yang sesuai kebutuhan?",
    a: "Buka menu Cari Properti, lalu gunakan filter lokasi, rentang harga, tipe, luas tanah/bangunan, dan jumlah kamar. Simpan pencarian Anda agar kami kirim notifikasi setiap ada listing baru yang cocok.",
  },
  {
    id: "m4",
    roles: ["cari", "jual"],
    cat: "memulai",
    q: "Apakah semua listing sudah terverifikasi?",
    a: "Setiap listing melewati kurasi tim kami: kelengkapan dokumen, kewajaran harga, dan kejelasan agent penanggung jawab. Cari badge 'Terverifikasi' untuk listing yang keabsahan datanya sudah kami periksa.",
  },
  {
    id: "m5",
    roles: ["cari", "jual"],
    cat: "memulai",
    q: "Di kota mana saja Solusindo Aset tersedia?",
    a: "Kami aktif di Jabodetabek, Bandung, Surabaya, Semarang, Bali, dan terus meluas ke kota lain. Masukkan lokasi incaran Anda di kolom pencarian untuk melihat ketersediaan terkini.",
  },

  // JUAL BELI — sisi pembeli
  {
    id: "jb1",
    roles: ["cari"],
    cat: "jualbeli",
    q: "Bagaimana proses membeli properti di Solusindo Aset?",
    a: "Singkatnya: (1) pilih properti & ajukan survei, (2) negosiasi harga bersama agent, (3) tanda jadi / booking fee, (4) tanda tangan PPJB/AJB di hadapan notaris, (5) pelunasan & serah terima, lalu (6) balik nama sertifikat. Agent kami mendampingi di setiap tahap.",
  },
  {
    id: "jb2",
    roles: ["cari"],
    cat: "jualbeli",
    q: "Apa bedanya properti Primary dan Secondary?",
    a: "Primary adalah unit baru langsung dari developer — sering disertai promo, KPR developer, dan opsi inden. Secondary adalah properti seken milik perorangan yang umumnya siap huni dan harganya lebih bisa dinegosiasi.",
  },
  {
    id: "jb3",
    roles: ["cari"],
    cat: "jualbeli",
    q: "Apakah harga yang tertera bisa dinegosiasi?",
    a: "Untuk properti secondary dan lelang, harga umumnya masih bisa dinego. Sampaikan penawaran Anda melalui agent — mereka akan menjembatani negosiasi dengan penjual hingga tercapai harga terbaik.",
  },
  {
    id: "jb4",
    roles: ["cari"],
    cat: "jualbeli",
    q: "Bisakah saya mengajukan KPR lewat Solusindo Aset?",
    a: "Bisa. Agent kami membantu simulasi cicilan dan pengajuan KPR ke bank rekanan. Siapkan dokumen seperti KTP, NPWP, slip gaji/laporan keuangan, dan rekening koran untuk mempercepat proses persetujuan.",
  },
  {
    id: "jb5",
    roles: ["cari"],
    cat: "jualbeli",
    q: "Apa saja biaya tambahan saat membeli properti?",
    a: "Di luar harga jual, umumnya ada BPHTB (5% dari nilai transaksi/NJOP setelah dikurangi NPOPTKP), biaya AJB & jasa notaris/PPAT, biaya balik nama, serta PPN untuk properti primary. Agent akan merincikan estimasinya sejak awal agar tidak ada kejutan.",
  },
  {
    id: "jb6",
    roles: ["cari"],
    cat: "jualbeli",
    q: "Apakah saya bisa survei lokasi sebelum membeli?",
    a: "Tentu. Klik 'Hubungi Agent' atau 'Ajukan Survei' di halaman properti untuk menjadwalkan kunjungan langsung. Kami sangat menyarankan survei fisik sebelum melakukan pembayaran apa pun.",
  },
  // JUAL BELI — sisi penjual
  {
    id: "jb7",
    roles: ["jual"],
    cat: "jualbeli",
    q: "Bagaimana cara menjual atau menitipkan properti saya?",
    a: "Buka menu Titip Jual, isi detail properti, lalu unggah foto dan dokumen kepemilikan. Tim kami menilai harga pasar, memasarkan ke ribuan pencari, dan menugaskan agent untuk menangani calon pembeli Anda.",
  },
  {
    id: "jb8",
    roles: ["jual"],
    cat: "jualbeli",
    q: "Berapa komisi atau biaya titip jual?",
    a: "Mendaftarkan properti gratis. Komisi hanya dibayar saat properti berhasil terjual, dengan besaran transparan yang disepakati di awal sebelum tanda tangan perjanjian — tanpa biaya tersembunyi.",
  },
  {
    id: "jb9",
    roles: ["jual"],
    cat: "jualbeli",
    q: "Berapa lama biasanya properti saya terjual?",
    a: "Bergantung pada lokasi, harga, dan kelengkapan dokumen. Properti dengan harga wajar, foto berkualitas, dan legalitas lengkap (SHM) biasanya jauh lebih cepat menarik pembeli serius.",
  },
  {
    id: "jb10",
    roles: ["jual"],
    cat: "jualbeli",
    q: "Dokumen apa yang dibutuhkan untuk menjual properti?",
    a: "Umumnya: sertifikat (SHM/SHGB), IMB/PBG, bukti PBB tahun berjalan, serta KTP & KK pemilik. Untuk properti warisan atau atas nama perusahaan ada dokumen tambahan yang akan dipandu oleh agent kami.",
  },

  // LELANG
  {
    id: "l1",
    roles: ["cari"],
    cat: "lelang",
    q: "Bagaimana cara mengikuti lelang properti di Solusindo Aset?",
    a: "Pilih aset di menu Lelang, pelajari detail dan jadwalnya, lalu daftar dan setor uang jaminan. Saat lelang berlangsung, ajukan penawaran Anda — penawar tertinggi yang menang berhak melunasi dan memproses kepemilikan.",
  },
  {
    id: "l2",
    roles: ["cari"],
    cat: "lelang",
    q: "Apakah aman membeli aset lelang?",
    a: "Aman selama Anda memahami statusnya. Aset lelang resmi (mis. lelang bank/KPKNL) legal dan bersertifikat, namun sebagian dijual apa adanya. Kami menampilkan status legalitas dan kondisi pengosongan agar Anda dapat menilai risiko sebelum ikut.",
  },
  {
    id: "l3",
    roles: ["cari"],
    cat: "lelang",
    q: "Berapa uang jaminan lelang dan apakah dikembalikan?",
    a: "Uang jaminan biasanya berkisar 20–50% dari harga limit dan disetor sebelum lelang. Jika Anda kalah, jaminan dikembalikan penuh. Jika menang, jaminan diperhitungkan sebagai bagian dari pelunasan.",
  },
  {
    id: "l4",
    roles: ["cari"],
    cat: "lelang",
    q: "Apa saja risiko membeli properti lelang?",
    a: "Risiko utama: objek masih dihuni pihak lama sehingga perlu proses pengosongan, atau dokumen yang belum balik nama. Tim lelang kami membantu mengecek status hukum dan memperkirakan langkah yang perlu Anda tempuh setelah menang.",
  },
  {
    id: "l5",
    roles: ["cari"],
    cat: "lelang",
    q: "Apa yang terjadi setelah saya memenangkan lelang?",
    a: "Anda melunasi sisa pembayaran dalam tenggat yang ditentukan (umumnya 5 hari kerja), menerima Kutipan Risalah Lelang sebagai dasar kepemilikan, lalu memproses balik nama sertifikat di BPN. Agent kami mendampingi prosesnya.",
  },

  // SEWA
  {
    id: "s1",
    roles: ["cari"],
    cat: "sewa",
    q: "Bagaimana cara menyewa properti?",
    a: "Pilih properti sewa, hubungi agent untuk survei dan cek ketersediaan, sepakati durasi serta harga, lalu tanda tangani perjanjian sewa dan lakukan pembayaran melalui kanal resmi Solusindo Aset.",
  },
  {
    id: "s2",
    roles: ["cari"],
    cat: "sewa",
    q: "Apakah uang deposit sewa dikembalikan?",
    a: "Ya. Deposit adalah jaminan yang dikembalikan di akhir masa sewa, setelah dikurangi biaya kerusakan (jika ada) atau tunggakan. Kondisi properti dicatat di awal agar pengembalian deposit berjalan adil.",
  },
  {
    id: "s3",
    roles: ["cari"],
    cat: "sewa",
    q: "Metode pembayaran sewa apa saja yang tersedia?",
    a: "Pembayaran sewa dapat dilakukan via transfer Virtual Account, e-wallet, atau kartu kredit. Selalu bayar melalui kanal resmi aplikasi — jangan pernah mentransfer ke rekening pribadi mana pun.",
  },
  {
    id: "s4",
    roles: ["jual"],
    cat: "sewa",
    q: "Bagaimana cara menyewakan properti saya?",
    a: "Daftarkan properti melalui Titip Jual dan pilih opsi 'Disewakan'. Tentukan harga sewa dan ketentuannya, lalu agent kami akan memasarkannya dan menyaring calon penyewa untuk Anda.",
  },

  // PEMBAYARAN & KEAMANAN
  {
    id: "p1",
    roles: ["cari", "jual"],
    cat: "pembayaran",
    q: "Metode pembayaran apa saja yang tersedia?",
    a: "Kami menerima Transfer Bank (Virtual Account), e-wallet (GoPay, OVO, ShopeePay, DANA), kartu kredit/debit, hingga pembayaran di minimarket. Semua transaksi tercatat resmi di akun Anda.",
  },
  {
    id: "p2",
    roles: ["cari", "jual"],
    cat: "pembayaran",
    q: "Apakah uang saya aman saat bertransaksi?",
    a: "Aman. Dana diproses melalui sistem pembayaran tepercaya dan, untuk transaksi tertentu, ditahan di Rekening Bersama (escrow) hingga kewajiban kedua pihak terpenuhi. Uang baru diteruskan setelah Anda mengonfirmasi.",
  },
  {
    id: "p3",
    roles: ["cari", "jual"],
    cat: "pembayaran",
    q: "Bagaimana Solusindo Aset melindungi saya dari penipuan?",
    a: "Selalu bertransaksi di dalam aplikasi dan hanya ke rekening atas nama resmi Solusindo Aset. Kami tidak pernah meminta transfer ke rekening pribadi agent. Laporkan akun atau tawaran mencurigakan ke tim support kami kapan saja.",
  },
  {
    id: "p4",
    roles: ["cari", "jual"],
    cat: "pembayaran",
    q: "Apakah data pribadi saya aman?",
    a: "Ya. Data Anda dienkripsi, disimpan sesuai standar keamanan, dan tidak pernah kami jual ke pihak ketiga. Anda dapat membaca detailnya di halaman Kebijakan Privasi kami.",
  },

  // LEGALITAS
  {
    id: "lg1",
    roles: ["cari", "jual"],
    cat: "legalitas",
    q: "Apa itu SHM, SHGB, dan AJB?",
    a: "SHM (Sertifikat Hak Milik) adalah kepemilikan terkuat dan tanpa batas waktu. SHGB (Hak Guna Bangunan) berlaku untuk jangka waktu tertentu dan dapat diperpanjang. AJB (Akta Jual Beli) adalah bukti transaksi jual beli, bukan sertifikat kepemilikan.",
  },
  {
    id: "lg2",
    roles: ["cari", "jual"],
    cat: "legalitas",
    q: "Bagaimana memastikan sertifikat asli dan tidak sengketa?",
    a: "Keaslian sertifikat dapat dicek di kantor BPN/ATR setempat atau melalui aplikasi Sentuh Tanahku. Agent kami membantu memverifikasi status, riwayat, dan memastikan properti tidak sedang dalam sengketa atau menjadi jaminan.",
  },
  {
    id: "lg3",
    roles: ["cari"],
    cat: "legalitas",
    q: "Apa itu BPHTB dan siapa yang membayarnya?",
    a: "BPHTB (Bea Perolehan Hak atas Tanah dan Bangunan) adalah pajak yang ditanggung pembeli, sebesar 5% dari nilai transaksi/NJOP setelah dikurangi NPOPTKP yang berlaku di daerah Anda. Pembayaran ini wajib sebelum balik nama.",
  },
  {
    id: "lg4",
    roles: ["cari", "jual"],
    cat: "legalitas",
    q: "Bagaimana proses balik nama sertifikat?",
    a: "Setelah AJB ditandatangani di hadapan PPAT, berkas diajukan ke BPN untuk mengganti nama pemilik pada sertifikat. Prosesnya umumnya beberapa minggu, dan notaris/agent kami memandu serta memantau statusnya hingga selesai.",
  },

  // AKUN
  {
    id: "a1",
    roles: ["cari", "jual"],
    cat: "akun",
    q: "Bagaimana cara mendaftar akun?",
    a: "Klik 'Daftar' di pojok kanan atas, lalu daftar menggunakan email atau nomor WhatsApp aktif. Setelah verifikasi singkat, akun Anda langsung siap digunakan untuk menjelajah dan menyimpan properti.",
  },
  {
    id: "a2",
    roles: ["cari", "jual"],
    cat: "akun",
    q: "Saya lupa password, bagaimana cara reset?",
    a: "Pada jendela Masuk, klik 'Lupa Password'. Kami akan mengirim tautan atau kode reset ke email/WhatsApp terdaftar. Ikuti langkahnya untuk membuat kata sandi baru dalam hitungan menit.",
  },
  {
    id: "a3",
    roles: ["cari", "jual"],
    cat: "akun",
    q: "Bagaimana cara mengubah data profil saya?",
    a: "Masuk ke menu Profil Saya, lalu perbarui nama, foto, nomor kontak, atau preferensi notifikasi Anda. Pastikan kontak selalu aktif agar tidak ketinggalan info dari agent dan tim kami.",
  },
  {
    id: "a4",
    roles: ["cari", "jual"],
    cat: "akun",
    q: "Bagaimana cara menghapus akun saya?",
    a: "Anda dapat mengajukan penghapusan akun melalui menu Profil atau dengan menghubungi tim support. Setelah diverifikasi, akun dan data pribadi Anda akan dihapus sesuai kebijakan privasi yang berlaku.",
  },
];

// ── Pilar kepercayaan ────────────────────────────────────────────────────────
const trustPillars = [
  {
    icon: "solar:shield-check-bold-duotone",
    title: "Rekening Bersama",
    desc: "Dana ditahan di escrow dan baru diteruskan setelah kedua pihak terpenuhi.",
    color: "text-emerald-300",
    glow: "from-emerald-500/20",
  },
  {
    icon: "solar:verified-check-bold-duotone",
    title: "Agent Terverifikasi",
    desc: "1.200+ agent profesional ber-identitas resmi mendampingi transaksi Anda.",
    color: "text-sky-300",
    glow: "from-sky-500/20",
  },
  {
    icon: "solar:document-text-bold-duotone",
    title: "Legalitas Dicek",
    desc: "Sertifikat & dokumen divalidasi sebelum listing tayang di platform.",
    color: "text-violet-300",
    glow: "from-violet-500/20",
  },
  {
    icon: "solar:lock-keyhole-minimalistic-bold-duotone",
    title: "Privasi Terlindungi",
    desc: "Data Anda dienkripsi, aman, dan tidak pernah kami jual ke pihak mana pun.",
    color: "text-amber-300",
    glow: "from-amber-500/20",
  },
];

// ── Tautan cepat ─────────────────────────────────────────────────────────────
const quickLinks = [
  { label: "Cari Properti", desc: "Jelajahi semua listing", href: "/properti/semua", icon: "solar:map-point-rotate-bold-duotone" },
  { label: "Titip Jual", desc: "Jual properti Anda", href: "/titip-jual", icon: "solar:hand-money-bold-duotone" },
  { label: "Gabung Jadi Agent", desc: "Bangun karier bersama kami", href: "/gabung-jadi-agent", icon: "solar:user-hand-up-bold-duotone" },
  { label: "Blog & Panduan", desc: "Tips & insight properti", href: "/blog", icon: "solar:notebook-bold-duotone" },
  { label: "Tentang Kami", desc: "Kenali Solusindo Aset", href: "/about/company-profile", icon: "solar:buildings-3-bold-duotone" },
];

// ── Util: highlight kata pencarian ───────────────────────────────────────────
const highlight = (text: string, q: string): React.ReactNode => {
  const term = q.trim();
  if (!term) return text;
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${safe})`, "ig"));
  return parts.map((p, i) =>
    p.toLowerCase() === term.toLowerCase() ? (
      <mark key={i} className="bg-primary/25 text-primary rounded px-0.5">
        {p}
      </mark>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    )
  );
};

// background grid halus
const gridStyle: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)",
  backgroundSize: "38px 38px",
  WebkitMaskImage:
    "radial-gradient(ellipse 75% 55% at 50% 0%, #000 35%, transparent 78%)",
  maskImage:
    "radial-gradient(ellipse 75% 55% at 50% 0%, #000 35%, transparent 78%)",
};

const HelpCenterPage = () => {
  const [role, setRole] = useState<Role>("cari");
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "yes" | "no">>({});

  // ── Filter ──
  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqs.filter((item) => {
      const matchRole = item.roles.includes(role);
      const matchCat = activeCategory === "all" || item.cat === activeCategory;
      const matchSearch =
        !q ||
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q);
      return matchRole && matchCat && matchSearch;
    });
  }, [role, activeCategory, searchQuery]);

  const switchRole = (r: Role) => {
    setRole(r);
    setActiveCategory("all");
    setExpandedFaq(null);
  };

  return (
    <main className="bg-darkmode min-h-screen text-white overflow-x-hidden pb-24 selection:bg-primary/30">
      {/* ===================== HERO ===================== */}
      <section className="relative pt-20 pb-10 px-4 sm:pt-24 sm:pb-12 lg:pt-36 lg:pb-20 overflow-hidden">
        {/* Aurora + grid background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[520px] bg-primary/20 blur-[140px] rounded-full opacity-40" />
          <div className="absolute top-10 -left-24 w-[420px] h-[420px] bg-sky-500/10 blur-[130px] rounded-full" />
          <div className="absolute top-0 -right-24 w-[420px] h-[420px] bg-emerald-500/10 blur-[130px] rounded-full" />
          <div className="absolute inset-0" style={gridStyle} />
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="container mx-auto max-w-3xl text-center"
        >
          {/* Eyebrow */}
          <motion.div variants={fadeUp} className="flex justify-center mb-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-primary backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Pusat Bantuan Solusindo Aset
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight"
          >
            Ada yang bisa{" "}
            <span className="gradient-text">kami bantu?</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-xl text-sm sm:text-base text-white/55 leading-relaxed"
          >
            Jawaban cepat seputar jual beli, lelang, sewa, hingga keamanan
            transaksi properti Anda — semua dalam satu tempat.
          </motion.p>

          {/* Search bar */}
          <motion.div variants={fadeUp} className="relative mt-7 group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary/40 via-emerald-400/20 to-sky-400/30 opacity-0 blur transition-opacity duration-500 group-focus-within:opacity-100" />
            <div className="relative flex items-center rounded-2xl border border-white/10 bg-[#0d0f12]/90 backdrop-blur-xl shadow-2xl transition-colors focus-within:border-primary/50">
              <Icon
                icon="solar:magnifer-linear"
                className="ml-5 text-xl sm:text-2xl text-white/40 shrink-0 transition-colors group-focus-within:text-primary"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari: KPR, biaya beli, lelang, balik nama…"
                className="w-full bg-transparent py-4 sm:py-5 pl-3 pr-3 text-sm sm:text-base text-white placeholder:text-white/35 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Bersihkan pencarian"
                  className="mr-3 rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors shrink-0"
                >
                  <Icon icon="solar:close-circle-bold" className="text-lg" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Popular searches */}
          <motion.div
            variants={fadeUp}
            className="mt-4 flex flex-wrap items-center justify-center gap-2"
          >
            <span className="text-[11px] text-white/30 hidden sm:inline">
              Populer:
            </span>
            {popularSearches.map((term) => (
              <button
                key={term}
                onClick={() => setSearchQuery(term)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-white/55 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
              >
                {term}
              </button>
            ))}
          </motion.div>
        </motion.div>

        {/* Trust stats */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="container mx-auto max-w-3xl mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            { v: "10.000+", l: "Pertanyaan terjawab" },
            { v: "< 5 menit", l: "Rata-rata respon" },
            { v: "1.200+", l: "Agent terverifikasi" },
            { v: "100%", l: "Transaksi aman" },
          ].map((s) => (
            <motion.div
              key={s.l}
              variants={fadeUp}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-center backdrop-blur-sm"
            >
              <p className="text-lg sm:text-xl font-extrabold text-white">{s.v}</p>
              <p className="text-[10px] sm:text-[11px] text-white/45 mt-0.5">{s.l}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===================== ROLE SWITCHER ===================== */}
      <section className="container mx-auto px-4 max-w-4xl">
        <div className="flex justify-center">
          <div className="relative grid grid-cols-2 w-full max-w-sm rounded-full border border-white/10 bg-[#0d0f12]/80 p-1.5 backdrop-blur-md">
            <motion.div
              className="absolute inset-y-1.5 w-[calc(50%-6px)] rounded-full bg-gradient-to-r from-primary to-emerald-400 shadow-lg shadow-primary/20"
              animate={{ left: role === "cari" ? "6px" : "50%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            />
            <button
              onClick={() => switchRole("cari")}
              className={`relative z-10 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-colors ${
                role === "cari" ? "text-darkmode" : "text-white/55 hover:text-white"
              }`}
            >
              <Icon icon="solar:magnifer-bold" className="text-base" />
              Pembeli & Penyewa
            </button>
            <button
              onClick={() => switchRole("jual")}
              className={`relative z-10 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-colors ${
                role === "jual" ? "text-darkmode" : "text-white/55 hover:text-white"
              }`}
            >
              <Icon icon="solar:hand-money-bold" className="text-base" />
              Penjual & Pemilik
            </button>
          </div>
        </div>
      </section>

      {/* ===================== CATEGORIES ===================== */}
      <section className="container mx-auto px-4 max-w-5xl mt-8">
        <div className="flex gap-3 overflow-x-auto pb-3 hide-scrollbar md:grid md:grid-cols-4 lg:grid-cols-8 md:overflow-visible">
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setExpandedFaq(null);
                }}
                className={`group flex shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border px-4 py-4 md:px-2 md:min-w-0 min-w-[92px] transition-all duration-300 ${
                  active
                    ? "border-primary/50 bg-primary/10 shadow-lg shadow-primary/5"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                <Icon
                  icon={cat.icon}
                  className={`text-2xl transition-colors ${
                    active ? "text-primary" : "text-white/40 group-hover:text-white"
                  }`}
                />
                <span
                  className={`text-[11px] font-semibold leading-tight text-center transition-colors ${
                    active ? "text-white" : "text-white/50 group-hover:text-white/80"
                  }`}
                >
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ===================== FAQ LIST ===================== */}
      <section className="container mx-auto px-4 max-w-4xl mt-10 min-h-[420px]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Icon icon="solar:chat-square-like-bold-duotone" className="text-primary text-xl" />
            {searchQuery ? "Hasil pencarian" : "Pertanyaan yang sering diajukan"}
          </h2>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/50">
            {filteredData.length} jawaban
          </span>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredData.length > 0 ? (
              filteredData.map((item) => {
                const open = expandedFaq === item.id;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                    className={`group relative overflow-hidden rounded-2xl border backdrop-blur-sm transition-colors ${
                      open
                        ? "border-primary/40 bg-white/[0.04]"
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"
                    }`}
                  >
                    {/* Accent bar saat terbuka */}
                    <span
                      className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary to-emerald-400 transition-opacity duration-300 ${
                        open ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <button
                      onClick={() => setExpandedFaq(open ? null : item.id)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-4 p-5 sm:p-6 text-left"
                    >
                      <span
                        className={`text-base sm:text-lg font-bold transition-colors ${
                          open ? "text-primary" : "text-white"
                        }`}
                      >
                        {highlight(item.q, searchQuery)}
                      </span>
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                          open
                            ? "rotate-180 bg-primary/15 text-primary"
                            : "bg-white/5 text-white/40 group-hover:text-white"
                        }`}
                      >
                        <Icon icon="solar:alt-arrow-down-linear" className="text-lg" />
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-white/5 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                            <p className="text-sm sm:text-[15px] leading-relaxed text-white/65">
                              {item.a}
                            </p>

                            {/* Feedback */}
                            <div className="mt-5 flex items-center gap-3">
                              {feedback[item.id] ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                                  <Icon icon="solar:heart-bold" className="text-sm" />
                                  Terima kasih atas masukan Anda!
                                </span>
                              ) : (
                                <>
                                  <span className="text-xs text-white/40">
                                    Apakah ini membantu?
                                  </span>
                                  <button
                                    onClick={() =>
                                      setFeedback((f) => ({ ...f, [item.id]: "yes" }))
                                    }
                                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:border-primary/40 hover:text-primary transition-colors"
                                  >
                                    <Icon icon="solar:like-linear" /> Ya
                                  </button>
                                  <button
                                    onClick={() =>
                                      setFeedback((f) => ({ ...f, [item.id]: "no" }))
                                    }
                                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:border-white/30 hover:text-white transition-colors"
                                  >
                                    <Icon icon="solar:dislike-linear" /> Tidak
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center"
              >
                <Icon
                  icon="solar:magnifer-bug-bold-duotone"
                  className="mx-auto mb-4 text-6xl text-white/20"
                />
                <p className="text-white/60 font-medium">
                  Belum ada jawaban untuk pencarian itu.
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-white/40">
                  Coba kata kunci lain, atau hubungi tim kami — kami siap membantu
                  secara langsung.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCategory("all");
                    }}
                    className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/5 transition-colors"
                  >
                    Reset Pencarian
                  </button>
                  <a
                    href={SUPPORT.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-darkmode hover:bg-emerald-300 transition-colors"
                  >
                    Tanya via WhatsApp
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ===================== TRUST SECTION ===================== */}
      <section className="container mx-auto px-4 max-w-6xl mt-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              Kepercayaan Anda, Prioritas Kami
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold">
              Mengapa transaksi di Solusindo Aset aman?
            </h2>
            <p className="mt-3 text-sm text-white/50">
              Setiap langkah dirancang untuk melindungi uang, data, dan hak Anda.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trustPillars.map((p) => (
              <motion.div
                key={p.title}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-sm"
              >
                <div
                  className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${p.glow} to-transparent blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
                />
                <div className="relative">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Icon icon={p.icon} className={`text-2xl ${p.color}`} />
                  </div>
                  <h3 className="text-base font-bold text-white">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ===================== QUICK LINKS ===================== */}
      <section className="container mx-auto px-4 max-w-6xl mt-24">
        <div className="mb-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold">Jelajahi lebih lanjut</h2>
          <p className="mt-2 text-sm text-white/50">
            Tautan cepat untuk membantu langkah Anda berikutnya.
          </p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {quickLinks.map((link) => (
            <motion.div key={link.label} variants={fadeUp} whileHover={{ y: -4 }}>
              <Link
                href={link.href}
                className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 backdrop-blur-sm transition-colors hover:border-primary/30 hover:bg-white/[0.04]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <Icon icon={link.icon} className="text-2xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white">{link.label}</p>
                  <p className="truncate text-xs text-white/45">{link.desc}</p>
                </div>
                <Icon
                  icon="solar:arrow-right-linear"
                  className="text-xl text-white/30 transition-all group-hover:translate-x-1 group-hover:text-primary"
                />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===================== CONTACT / STILL NEED HELP ===================== */}
      <section className="container mx-auto px-4 max-w-6xl mt-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-[#0d0f12] to-sky-500/10 p-8 sm:p-12">
          {/* glow accents */}
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-sky-500/15 blur-[100px]" />

          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Left copy */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
                <Icon icon="solar:headphones-round-bold" /> Dukungan Manusia
              </span>
              <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold leading-tight">
                Masih butuh bantuan?
              </h2>
              <p className="mt-3 max-w-md text-sm sm:text-base text-white/55 leading-relaxed">
                Tim kami yang ramah siap menjawab pertanyaan Anda — dari soal harga,
                legalitas, sampai proses transaksi. Jangan ragu menghubungi kami.
              </p>
              <div className="mt-5 flex items-center gap-2 text-sm text-white/50">
                <Icon icon="solar:clock-circle-bold-duotone" className="text-primary" />
                {SUPPORT.hours}
              </div>
            </div>

            {/* Right channels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* WhatsApp */}
              <a
                href={SUPPORT.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-[#25D366]/50 hover:bg-[#25D366]/10"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/15">
                  <Icon icon="fa6-brands:whatsapp" className="text-2xl text-[#25D366]" />
                </div>
                <div>
                  <p className="font-bold text-white">Chat WhatsApp</p>
                  <p className="text-xs text-white/45">Balasan tercepat, &lt; 5 menit</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-[#25D366]">
                  Mulai chat
                  <Icon icon="solar:arrow-right-linear" className="transition-transform group-hover:translate-x-1" />
                </span>
              </a>

              {/* Email */}
              <a
                href={`mailto:${SUPPORT.email}`}
                className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-primary/50 hover:bg-primary/10"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                  <Icon icon="solar:letter-bold-duotone" className="text-2xl text-primary" />
                </div>
                <div>
                  <p className="font-bold text-white">Kirim Email</p>
                  <p className="truncate text-xs text-white/45">{SUPPORT.email}</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-primary">
                  Tulis email
                  <Icon icon="solar:arrow-right-linear" className="transition-transform group-hover:translate-x-1" />
                </span>
              </a>
            </div>
          </div>

          {/* Office */}
          <div className="relative mt-8 flex items-start gap-2 border-t border-white/10 pt-6 text-xs text-white/40">
            <Icon icon="solar:map-point-bold-duotone" className="text-primary/70 text-base shrink-0 mt-0.5" />
            <span className="leading-relaxed">{SUPPORT.address}</span>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HelpCenterPage;

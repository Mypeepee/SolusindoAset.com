"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import Link from "next/link";

const blogData = {
  id: 1,
  title: "Cara Menang Lelang Rumah Sitaan Bank: Panduan Lengkap Pemula",
  author: "Tim Redaksi",
  date: "14 Jan 2026",
  readTime: "8 min read",
  image: "/images/hero/banner.jpg",
  category: "Tips Lelang",
};

const relatedPosts = [
  {
    id: 2,
    title: "Prediksi Harga Properti Surabaya 2026: Saatnya Beli?",
    category: "Analisa Pasar",
    date: "10 Jan 2026",
    image: "/images/hero/banner.jpg",
  },
  {
    id: 5,
    title: "Panduan AJB, SHM, HGB: Legalitas Properti yang Wajib Dipahami",
    category: "Legal & Dokumen",
    date: "20 Des 2025",
    image: "/images/hero/banner.jpg",
  },
  {
    id: 6,
    title: "ROI Properti vs Saham vs Reksa Dana: Mana yang Paling Cuan di 2026?",
    category: "Investasi",
    date: "15 Des 2025",
    image: "/images/hero/banner.jpg",
  },
];

const BlogClient = ({ id }: { id: number }) => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="bg-darkmode min-h-screen text-white relative">

      {/* READING PROGRESS BAR */}
      <div className="fixed top-0 left-0 w-full h-1.5 z-50 bg-gray-800">
        <div
          className="h-full bg-[#86efac] transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        ></div>
      </div>

      {/* ARTICLE HEADER */}
      <header className="pt-32 pb-10 container mx-auto px-4 text-center max-w-4xl">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-6 font-bold uppercase tracking-wider">
          <Link href="/blog" className="hover:text-[#86efac] transition-colors">Blog</Link>
          <Icon icon="solar:alt-arrow-right-linear" />
          <span className="text-[#86efac]">{blogData.category}</span>
        </div>

        <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight">
          {blogData.title}
        </h1>

        <div className="flex items-center justify-center gap-6 text-sm text-gray-400 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#86efac]/10 border border-[#86efac]/20 flex items-center justify-center">
              <Icon icon="solar:user-bold" className="text-[#86efac] text-sm" />
            </div>
            <span className="text-white font-bold">{blogData.author}</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-gray-600"></span>
          <span>{blogData.date}</span>
          <span className="w-1 h-1 rounded-full bg-gray-600"></span>
          <span className="flex items-center gap-1">
            <Icon icon="solar:clock-circle-bold" className="text-[#86efac]" /> {blogData.readTime}
          </span>
        </div>
      </header>

      {/* FEATURED IMAGE */}
      <div className="container mx-auto px-4 mb-16">
        <div className="relative w-full aspect-video md:aspect-[21/9] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          <Image
            src={blogData.image}
            alt="Cover Article"
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="container mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative">

          {/* LEFT: STICKY SHARE */}
          <div className="hidden lg:block lg:col-span-2 relative">
            <div className="sticky top-32 flex flex-col gap-4 items-center">
              <span className="text-[10px] uppercase font-bold text-gray-500 mb-2">Bagikan</span>
              <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:bg-[#1877F2] hover:text-white transition-all">
                <Icon icon="logos:facebook" width="18" />
              </button>
              <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:bg-[#1DA1F2] hover:text-white transition-all">
                <Icon icon="logos:twitter" width="18" />
              </button>
              <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:bg-[#25D366] hover:text-white transition-all">
                <Icon icon="logos:whatsapp-icon" width="18" />
              </button>
            </div>
          </div>

          {/* CENTER: MAIN ARTICLE */}
          <article className="lg:col-span-8">
            <div className="space-y-8 text-gray-300 leading-loose text-lg font-light">
              <p className="first-letter:text-5xl first-letter:font-bold first-letter:text-[#86efac] first-letter:mr-1 first-letter:float-left">
                Lelang properti sitaan bank kerap dianggap sebagai jalur pintas mendapatkan properti di bawah harga pasar. Namun tanpa persiapan yang matang, justru bisa berujung kerugian besar.
              </p>
              <p>
                Berdasarkan data KPKNL (Kantor Pelayanan Kekayaan Negara dan Lelang), nilai transaksi lelang properti di Indonesia meningkat rata-rata 23% per tahun sejak 2022. Ini menandakan minat investor ritel yang terus tumbuh.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold text-white mt-12 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-[#86efac] text-darkmode flex items-center justify-center text-lg font-bold">1</span>
                Pahami Jenis Lelang Properti
              </h2>
              <p>
                Ada dua jenis utama lelang properti yang perlu Anda kenali: <strong className="text-white">lelang eksekusi</strong> (properti jaminan kredit macet yang dieksekusi bank) dan <strong className="text-white">lelang sukarela</strong> (pemilik memilih menjual melalui mekanisme lelang).
              </p>
              <div className="bg-[#86efac]/10 border-l-4 border-[#86efac] p-6 rounded-r-xl my-8">
                <h4 className="text-[#86efac] font-bold text-sm mb-2 uppercase tracking-wider flex items-center gap-2">
                  <Icon icon="solar:lightbulb-bolt-bold" /> Catatan Penting
                </h4>
                <p className="text-sm text-[#86efac]/80">
                  Lelang eksekusi tidak memerlukan persetujuan debitur. Bank berhak menjual agunan melalui KPKNL setelah kredit dinyatakan macet.
                </p>
              </div>

              <h2 className="text-2xl md:text-3xl font-bold text-white mt-12 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-[#86efac] text-darkmode flex items-center justify-center text-lg font-bold">2</span>
                Cek Legalitas Sebelum Bidding
              </h2>
              <p>
                Sebelum mengikuti lelang, pastikan dokumen properti bersih. Periksa sertifikat (SHM/HGB), status pajak PBB, dan pastikan tidak ada sengketa ahli waris. Minta salinan dokumen dari panitia lelang dan konsultasikan ke notaris atau PPAT terpercaya.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold text-white mt-12 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-[#86efac] text-darkmode flex items-center justify-center text-lg font-bold">3</span>
                Strategi Penawaran yang Tepat
              </h2>
              <p>
                Tentukan batas harga maksimum Anda sebelum hari H berdasarkan survei harga pasar area tersebut (minimal 3 properti pembanding). Jangan terbawa emosi saat bidding — disiplin terhadap batas harga adalah kunci keuntungan.
              </p>
              <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-6 rounded-r-xl my-8">
                <h4 className="text-yellow-500 font-bold text-sm mb-2 uppercase tracking-wider flex items-center gap-2">
                  <Icon icon="solar:danger-triangle-bold" /> Risiko yang Perlu Diperhatikan
                </h4>
                <p className="text-sm text-yellow-200/80">
                  Properti dijual dalam kondisi &quot;apa adanya&quot; (as is). Pastikan sudah survei fisik bangunan, kondisi lingkungan, dan akses jalan sebelum menawar.
                </p>
              </div>

              <hr className="border-white/10 my-12" />

              <p className="font-bold text-white">
                Kesimpulan: Lelang properti adalah peluang investasi yang menjanjikan jika dilakukan dengan riset dan disiplin. Persiapkan dokumen, pahami legalitas, dan tetap rasional saat proses bidding berlangsung.
              </p>
            </div>

            {/* AUTHOR BOX */}
            <div className="mt-16 bg-[#1A1A1A] border border-white/5 p-8 rounded-3xl flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
              <div className="w-20 h-20 rounded-full bg-[#86efac]/10 border-2 border-[#86efac]/30 flex items-center justify-center flex-shrink-0">
                <Icon icon="solar:user-bold" className="text-4xl text-[#86efac]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Ditulis oleh {blogData.author}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  Tim editorial Kosku terdiri dari praktisi properti, analis pasar, dan konsultan investasi berpengalaman yang berkomitmen memberikan informasi akurat dan terpercaya.
                </p>
              </div>
            </div>

            {/* RELATED ARTICLES */}
            <div className="mt-16">
              <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                <span className="w-1 h-6 bg-[#86efac] rounded-full"></span>
                Artikel Terkait
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.id}`}
                    className="group bg-[#151515] border border-white/10 rounded-2xl overflow-hidden hover:border-[#86efac]/40 transition-all"
                  >
                    <div className="relative h-40 w-full overflow-hidden">
                      <Image src={post.image} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                        <span className="text-[9px] font-bold text-[#86efac] uppercase tracking-wide">{post.category}</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-white/40 mb-2">{post.date}</p>
                      <h4 className="text-sm font-bold text-white line-clamp-2 group-hover:text-[#86efac] transition-colors leading-snug">
                        {post.title}
                      </h4>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </article>

          {/* RIGHT: STICKY TOC */}
          <div className="hidden lg:block lg:col-span-2 relative">
            <div className="sticky top-32">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-[#86efac] pl-3">Daftar Isi</h4>
              <ul className="space-y-3 text-sm border-l border-white/10 pl-3">
                <li><a href="#" className="text-[#86efac] font-medium block">1. Jenis Lelang Properti</a></li>
                <li><a href="#" className="text-gray-500 hover:text-white transition-colors block">2. Cek Legalitas</a></li>
                <li><a href="#" className="text-gray-500 hover:text-white transition-colors block">3. Strategi Penawaran</a></li>
                <li><a href="#" className="text-gray-500 hover:text-white transition-colors block">Kesimpulan</a></li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
};

export default BlogClient;

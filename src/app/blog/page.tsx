"use client";
import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import Link from "next/link";

const blogPosts = [
  {
    id: 1,
    title: "Cara Menang Lelang Rumah Sitaan Bank: Panduan Lengkap Pemula",
    excerpt: "Jangan takut main lelang. Simak strategi bidding, cara cek legalitas aset, dan risiko tersembunyi agar investasi properti lelang Anda menguntungkan.",
    category: "Tips Lelang",
    author: "Tim Redaksi",
    date: "14 Jan 2026",
    readTime: "8 min read",
    image: "/images/hero/banner.jpg",
    featured: true,
  },
  {
    id: 2,
    title: "Prediksi Harga Properti Surabaya 2026: Saatnya Beli?",
    excerpt: "Melihat tren kenaikan harga tanah di Surabaya Barat dan Timur. Apakah ini momen yang tepat untuk mulai berinvestasi properti?",
    category: "Analisa Pasar",
    author: "Analis Senior",
    date: "10 Jan 2026",
    readTime: "10 min read",
    image: "/images/hero/banner.jpg",
    featured: false,
  },
  {
    id: 3,
    title: "Beli Rumah Primary vs Secondary: Mana Lebih Untung?",
    excerpt: "Perbandingan detail mengenai biaya KPR, legalitas, dan potensi capital gain antara rumah baru developer dan rumah bekas pasar.",
    category: "Panduan Pembeli",
    author: "Tim Redaksi",
    date: "05 Jan 2026",
    readTime: "7 min read",
    image: "/images/hero/banner.jpg",
    featured: false,
  },
  {
    id: 4,
    title: "5 Kesalahan Fatal Investor Properti Pemula yang Wajib Dihindari",
    excerpt: "Dari tergiur harga murah tanpa cek SHM hingga mengabaikan NJOP, ini deretan blunder yang bisa merugikan ratusan juta rupiah.",
    category: "Investasi",
    author: "Konsultan Properti",
    date: "28 Des 2025",
    readTime: "6 min read",
    image: "/images/hero/banner.jpg",
    featured: false,
  },
  {
    id: 5,
    title: "Panduan AJB, SHM, HGB: Legalitas Properti yang Wajib Dipahami",
    excerpt: "Bingung dengan istilah dokumen properti? Kami bedah tuntas perbedaan AJB, SHM, HGB, dan mana yang paling aman untuk investasi jangka panjang.",
    category: "Legal & Dokumen",
    author: "Konsultan Hukum",
    date: "20 Des 2025",
    readTime: "9 min read",
    image: "/images/hero/banner.jpg",
    featured: false,
  },
  {
    id: 6,
    title: "ROI Properti vs Saham vs Reksa Dana: Mana yang Paling Cuan di 2026?",
    excerpt: "Analisis mendalam perbandingan imbal hasil properti, saham blue chip, dan reksa dana campuran dalam 5 tahun terakhir berdasarkan data riil.",
    category: "Investasi",
    author: "Analis Senior",
    date: "15 Des 2025",
    readTime: "12 min read",
    image: "/images/hero/banner.jpg",
    featured: false,
  },
];

const categories = ["All", "Tips Lelang", "Analisa Pasar", "Panduan Pembeli", "Investasi", "Legal & Dokumen"];

const BlogPage = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPosts = blogPosts.filter((post) => {
    const matchCategory = activeCategory === "All" || post.category === activeCategory;
    const matchSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const featuredPost = blogPosts.find(p => p.featured);
  const otherPosts = filteredPosts.filter(p => !p.featured);

  return (
    <main className="bg-darkmode min-h-screen text-white pb-24">

      {/* HERO SECTION */}
      <section className="pt-32 pb-12 border-b border-white/5 bg-gradient-to-b from-darkmode to-[#1A1A1A]">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/10 text-[#86efac] text-[10px] font-bold tracking-widest mb-3 uppercase">
            Wawasan Properti
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Berita & Insight <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] to-teal-500">
              Pasar Properti Indonesia
            </span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg mb-10">
            Strategi investasi, panduan lelang, analisa pasar, hingga legalitas properti — semua ada di sini untuk membantu keputusan Anda.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto relative">
            <input
              type="text"
              placeholder="Cari artikel (contoh: lelang, KPR, investasi)..."
              className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-6 pr-14 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#86efac] focus:bg-white/10 transition-all"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="absolute right-2 top-2 bg-[#86efac] text-darkmode p-2 rounded-full hover:bg-white transition-colors">
              <Icon icon="solar:magnifer-linear" className="text-xl" />
            </button>
          </div>
        </div>
      </section>

      {/* CATEGORY FILTER */}
      <section className="py-3 sticky top-[72px] z-30 bg-darkmode/80 backdrop-blur-md border-b border-white/5">
        <div className="container mx-auto px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 min-w-max justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all border ${
                  activeCategory === cat
                    ? "bg-[#86efac] text-darkmode border-[#86efac]"
                    : "bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 mt-12">

        {/* FEATURED POST */}
        {activeCategory === "All" && !searchQuery && featuredPost && (
          <div className="mb-16">
            <Link href={`/blog/${featuredPost.id}`} className="group relative block rounded-3xl overflow-hidden aspect-video md:aspect-[21/9] border border-white/10">
              <Image
                src={featuredPost.image}
                alt={featuredPost.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90"></div>

              <div className="absolute bottom-0 left-0 w-full p-6 md:p-12">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="bg-[#86efac] text-darkmode text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{featuredPost.category}</span>
                    <span className="text-gray-300 text-xs flex items-center gap-1"><Icon icon="solar:clock-circle-bold" /> {featuredPost.readTime}</span>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight group-hover:text-[#86efac] transition-colors">
                    {featuredPost.title}
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg line-clamp-2 mb-6 hidden md:block">
                    {featuredPost.excerpt}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#86efac]/20 border-2 border-[#86efac]/40 flex items-center justify-center">
                      <Icon icon="solar:user-bold" className="text-[#86efac]" />
                    </div>
                    <div className="text-sm">
                      <p className="text-white font-bold">{featuredPost.author}</p>
                      <p className="text-gray-400 text-xs">{featuredPost.date}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* POST GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {otherPosts.length > 0 ? (
            otherPosts.map((post) => (
              <Link href={`/blog/${post.id}`} key={post.id} className="group flex flex-col h-full bg-[#151515] border border-white/10 rounded-3xl overflow-hidden hover:border-[#86efac]/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(134,239,172,0.05)]">
                <div className="relative h-56 w-full overflow-hidden">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#151515] via-transparent to-transparent opacity-60" />
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    <span className="text-[10px] font-bold text-[#86efac] uppercase tracking-wide">{post.category}</span>
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex items-center gap-2 text-xs text-white/40 mb-3 font-medium">
                    <Icon icon="solar:calendar-date-bold-duotone" className="text-base" />
                    <span>{post.date}</span>
                    <span className="mx-1">•</span>
                    <Icon icon="solar:clock-circle-bold" className="text-base" />
                    <span>{post.readTime}</span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-3 line-clamp-2 leading-snug group-hover:text-[#86efac] transition-colors">
                    {post.title}
                  </h3>

                  <p className="text-white/50 text-sm line-clamp-3 mb-6 flex-grow leading-relaxed">
                    {post.excerpt}
                  </p>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#86efac]/10 flex items-center justify-center border border-[#86efac]/20">
                        <Icon icon="solar:user-bold" className="text-[#86efac] text-xs" />
                      </div>
                      <span className="text-xs text-gray-300 font-bold">{post.author}</span>
                    </div>
                    <span className="text-[#86efac] text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                      Baca <Icon icon="solar:arrow-right-linear" />
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-20">
              <Icon icon="solar:sad-square-linear" className="text-6xl text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white">Artikel tidak ditemukan</h3>
              <p className="text-gray-500">Coba cari dengan kata kunci lain.</p>
            </div>
          )}
        </div>

        {/* NEWSLETTER CTA */}
        <div className="mt-24 relative rounded-3xl overflow-hidden bg-[#86efac]/5 border border-[#86efac]/20 p-8 md:p-16 text-center">
          <div className="relative z-10 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#86efac]/10 border border-[#86efac]/20 flex items-center justify-center mx-auto mb-6">
              <Icon icon="solar:bell-bold" className="text-3xl text-[#86efac]" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Dapatkan Update Pasar Properti Terbaru</h2>
            <p className="text-gray-400 mb-8">
              Notifikasi properti lelang baru, analisa pasar mingguan, dan panduan investasi eksklusif langsung di email Anda.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="Masukkan alamat email Anda"
                className="flex-1 bg-darkmode border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#86efac] transition-colors"
              />
              <button className="bg-[#86efac] hover:bg-teal-400 text-darkmode font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-green-500/20">
                Berlangganan
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-4">Tidak ada spam. Berhenti berlangganan kapan saja.</p>
          </div>
        </div>

      </div>
    </main>
  );
};

export default BlogPage;

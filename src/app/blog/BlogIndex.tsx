"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import CoverImage from "@/components/Blog/CoverImage";
import { accentFor, formatTanggal } from "@/lib/beritaUi";
import type { BeritaListItem } from "@/lib/berita";

type Props = {
  featured: BeritaListItem | null;
  initialItems: BeritaListItem[];
  initialTotalPages: number;
  categories: string[];
  categoryCounts: Record<string, number>;
  totalPublished: number;
  pageSize: number;
};

export default function BlogIndex({
  featured,
  initialItems,
  initialTotalPages,
  categories,
  categoryCounts,
  totalPublished,
  pageSize,
}: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const [items, setItems] = useState<BeritaListItem[]>(initialItems);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const firstRun = useRef(true);

  const isDefaultView = activeCategory === "All" && !debounced.trim();
  const showFeatured = isDefaultView && !!featured;

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    async (pageNum: number, mode: "replace" | "append") => {
      const params = new URLSearchParams();
      if (debounced.trim()) params.set("q", debounced.trim());
      if (activeCategory !== "All") params.set("kategori", activeCategory);
      params.set("page", String(pageNum));
      params.set("pageSize", String(pageSize));
      // Avoid duplicating the headline in the default grid.
      if (activeCategory === "All" && !debounced.trim() && featured) {
        params.set("excludeSlug", featured.slug);
      }

      if (mode === "replace") setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await fetch(`/api/berita?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        const newItems: BeritaListItem[] = data.items || [];
        setTotalPages(data.totalPages || 1);
        setPage(pageNum);
        setItems((prev) => (mode === "append" ? [...prev, ...newItems] : newItems));
      } catch {
        if (mode === "replace") setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debounced, activeCategory, pageSize, featured]
  );

  // Refetch from page 1 whenever filters change (skip the SSR-primed first run).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    fetchPage(1, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, activeCategory]);

  const canLoadMore = page < totalPages;

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-darkmode text-white">
      {/* ───────────────────── HERO ───────────────────── */}
      <section className="relative isolate overflow-hidden pt-20 pb-10 sm:pt-24 sm:pb-12 lg:pt-28 lg:pb-14">
        {/* layered ambient background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,rgba(16,185,129,0.16),transparent_55%)]" />
          <div className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.18] [mask-image:radial-gradient(70%_60%_at_50%_0%,#000,transparent)]"
            style={{
              backgroundImage:
                "linear-gradient(to right,rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.06) 1px,transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
        </div>

        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300 backdrop-blur"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Wawasan Properti
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-4 text-[2rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Berita &amp; Insight
            <span className="mt-1 block bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Pasar Properti Indonesia
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-4 max-w-xl text-sm text-gray-400 sm:text-base"
          >
            Strategi investasi, panduan lelang, analisa pasar, hingga legalitas
            properti — kurasi editorial untuk keputusan yang lebih cerdas.
          </motion.p>

          {/* search */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="group relative mx-auto mt-6 max-w-lg"
          >
            <div className="absolute inset-0 -z-10 rounded-2xl bg-emerald-500/20 opacity-0 blur-xl transition-opacity duration-500 group-focus-within:opacity-100" />
            <Icon
              icon="solar:magnifer-linear"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-500"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder="Cari artikel — lelang, KPR, investasi…"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-gray-500 backdrop-blur transition-all focus:border-emerald-400/50 focus:bg-white/[0.06] focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-500 hover:bg-white/10 hover:text-white"
                aria-label="Bersihkan pencarian"
              >
                <Icon icon="solar:close-circle-bold" className="text-lg" />
              </button>
            )}
          </motion.div>

          <p className="mt-4 text-xs text-gray-600">
            {totalPublished > 0
              ? `${totalPublished} artikel terkurasi • diperbarui berkala`
              : "Segera hadir — artikel sedang disiapkan redaksi"}
          </p>
        </div>
      </section>

      {/* ─────────────── CATEGORY FILTER (sticky) ─────────────── */}
      <div className="sticky top-[56px] z-30 border-y border-white/5 bg-darkmode/80 backdrop-blur-xl lg:top-[72px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto py-3">
            <CategoryPill
              label="Semua"
              active={activeCategory === "All"}
              count={totalPublished}
              onClick={() => setActiveCategory("All")}
            />
            {categories.map((cat) => (
              <CategoryPill
                key={cat}
                label={cat}
                active={activeCategory === cat}
                count={categoryCounts[cat] || 0}
                onClick={() => setActiveCategory(cat)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ───────────────────── CONTENT ───────────────────── */}
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6">
        {/* FEATURED HEADLINE */}
        <AnimatePresence mode="wait">
          {showFeatured && featured && (
            <motion.div
              key="featured"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-12"
            >
              <FeaturedCard post={featured} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* SECTION LABEL */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.2em] text-gray-300">
            <span className="h-4 w-1 rounded-full bg-emerald-400" />
            {debounced.trim()
              ? `Hasil pencarian "${debounced.trim()}"`
              : activeCategory === "All"
              ? "Artikel Terbaru"
              : activeCategory}
          </h2>
          {!loading && items.length > 0 && (
            <span className="text-xs text-gray-600">{items.length} artikel</span>
          )}
        </div>

        {/* GRID */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : items.length > 0 ? (
          <motion.div
            layout
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((post, i) => (
              <ArticleCard key={post.id} post={post} index={i} />
            ))}
          </motion.div>
        ) : (
          <EmptyState onReset={() => { setQuery(""); setActiveCategory("All"); }} />
        )}

        {/* LOAD MORE */}
        {!loading && canLoadMore && (
          <div className="mt-12 flex justify-center">
            <button
              onClick={() => fetchPage(page + 1, "append")}
              disabled={loadingMore}
              className="group inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-7 py-3.5 text-sm font-bold text-white transition-all hover:border-emerald-400/40 hover:bg-emerald-400/10 disabled:opacity-60"
            >
              {loadingMore ? (
                <>
                  <Icon icon="solar:refresh-linear" className="animate-spin text-lg" />
                  Memuat…
                </>
              ) : (
                <>
                  Muat Lebih Banyak
                  <Icon
                    icon="solar:arrow-down-linear"
                    className="text-lg transition-transform group-hover:translate-y-0.5"
                  />
                </>
              )}
            </button>
          </div>
        )}

        {/* NEWSLETTER */}
        <NewsletterCTA />
      </div>
    </main>
  );
}

/* ─────────────────────────── Sub-components ─────────────────────────── */

function CategoryPill({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition-all ${
        active
          ? "border-emerald-400 bg-emerald-400 text-black shadow-[0_0_24px_-6px_rgba(52,211,153,0.7)]"
          : "border-white/10 bg-transparent text-gray-400 hover:border-white/25 hover:text-white"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
          active ? "bg-black/15 text-black/70" : "bg-white/5 text-gray-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function FeaturedCard({ post }: { post: BeritaListItem }) {
  const accent = accentFor(post.kategori);
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative block aspect-[16/10] overflow-hidden rounded-[1.75rem] border border-white/10 sm:aspect-[2/1] lg:aspect-[21/9]"
    >
      <CoverImage
        src={post.gambar_utama}
        alt={post.judul}
        priority
        sizes="(max-width:1024px) 100vw, 1200px"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-black">
              <Icon icon="solar:star-bold" className="text-xs" /> Headline
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur ${accent.chip}`}
            >
              {post.kategori}
            </span>
          </div>
          <h2 className="text-2xl font-extrabold leading-tight text-white transition-colors group-hover:text-emerald-300 sm:text-4xl lg:text-5xl">
            {post.judul}
          </h2>
          {post.ringkasan && (
            <p className="mt-3 hidden max-w-2xl text-sm text-gray-300 line-clamp-2 sm:block sm:text-base">
              {post.ringkasan}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
            <span className="flex items-center gap-1.5 font-semibold text-white">
              <Icon icon="solar:user-rounded-bold" className="text-emerald-400" />
              {post.penulis}
            </span>
            <span className="h-1 w-1 rounded-full bg-gray-600" />
            <span>{formatTanggal(post.tanggal_publish || post.tanggal_dibuat)}</span>
            <span className="h-1 w-1 rounded-full bg-gray-600" />
            <span className="flex items-center gap-1">
              <Icon icon="solar:clock-circle-bold" /> {post.readMinutes} min baca
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ArticleCard({ post, index }: { post: BeritaListItem; index: number }) {
  const accent = accentFor(post.kategori);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
    >
      <Link
        href={`/blog/${post.slug}`}
        className={`group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#101010] transition-all duration-300 hover:-translate-y-1 ${accent.ring} ${accent.glow}`}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          <CoverImage
            src={post.gambar_utama}
            alt={post.judul}
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-transparent to-transparent opacity-70" />
          <span
            className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-md ${accent.chip}`}
          >
            {post.kategori}
          </span>
          {post.views > 0 && (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-gray-200 backdrop-blur-md">
              <Icon icon="solar:eye-bold" className="text-xs" />
              {formatViews(post.views)}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-medium text-gray-500">
            <Icon icon="solar:calendar-minimalistic-bold" className="text-sm" />
            <span>{formatTanggal(post.tanggal_publish || post.tanggal_dibuat)}</span>
            <span className="h-1 w-1 rounded-full bg-gray-700" />
            <span>{post.readMinutes} min</span>
          </div>

          <h3 className="text-[1.05rem] font-bold leading-snug text-white transition-colors line-clamp-2 group-hover:text-emerald-300">
            {post.judul}
          </h3>

          {post.ringkasan && (
            <p className="mt-2.5 flex-1 text-sm leading-relaxed text-gray-500 line-clamp-3">
              {post.ringkasan}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3.5">
            <span className="flex items-center gap-2 text-xs font-semibold text-gray-300">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-400/20">
                <Icon icon="solar:user-rounded-bold" className="text-[11px] text-emerald-400" />
              </span>
              {post.penulis}
            </span>
            <span className={`flex items-center gap-1 text-xs font-bold ${accent.text}`}>
              Baca
              <Icon
                icon="solar:arrow-right-linear"
                className="transition-transform group-hover:translate-x-1"
              />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#101010]">
      <div className="aspect-[16/10] w-full animate-pulse bg-white/5" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
        <div className="h-4 w-full animate-pulse rounded bg-white/10" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-full animate-pulse rounded bg-white/5" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
      </div>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
        <Icon icon="solar:file-text-broken" className="text-3xl text-gray-600" />
      </div>
      <h3 className="mt-5 text-lg font-bold text-white">Belum ada artikel</h3>
      <p className="mt-1.5 max-w-sm text-sm text-gray-500">
        Tidak ada artikel yang cocok dengan pencarian atau kategori ini. Coba kata
        kunci lain.
      </p>
      <button
        onClick={onReset}
        className="mt-5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 py-2.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-400/20"
      >
        Reset filter
      </button>
    </div>
  );
}

function NewsletterCTA() {
  return (
    <div className="relative mt-20 overflow-hidden rounded-[1.75rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-transparent p-8 sm:p-12">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="relative mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10">
          <Icon icon="solar:letter-opened-bold" className="text-2xl text-emerald-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
          Update Pasar Properti, Langsung ke Inbox
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
          Notifikasi lelang baru, analisa pasar mingguan, dan panduan investasi
          eksklusif. Tanpa spam.
        </p>
        <form
          className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            placeholder="Alamat email Anda"
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-5 py-3 text-sm text-white placeholder:text-gray-500 focus:border-emerald-400/50 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-emerald-400 px-7 py-3 text-sm font-extrabold text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-300 active:scale-95"
          >
            Berlangganan
          </button>
        </form>
      </div>
    </div>
  );
}

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

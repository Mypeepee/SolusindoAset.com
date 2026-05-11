"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface PropertyItem {
  id_property: string;
  slug: string;
  judul: string;
  kota: string;
  harga: number;
  harga_promo: number | null;
  jenis_transaksi: string;
  kategori: string;
  gambar: string;
  foto_list: string[];
  luas_tanah: number;
  luas_bangunan: number;
  kamar_tidur: number;
  kamar_mandi: number;
  tanggal_lelang: string | null;
  agent_name: string;
  agent_photo: string;
  agent_office: string;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

interface TabCounts {
  semua: number;
  jual: number;
  lelang: number;
  sewa: number;
}

interface Props {
  slug: string;
  label: string;
  initialData: PropertyItem[];
  pagination: PaginationData;
  activeTipe: string;
  activeSort: string;
  tabCounts: TabCounts;
}

// ─── KATEGORI ICONS ───────────────────────────────────────────────────────────
const KATEGORI_ICONS: Record<string, string> = {
  RUMAH:          "solar:home-smile-bold-duotone",
  APARTEMEN:      "solar:city-bold-duotone",
  RUKO:           "solar:shop-bold-duotone",
  TANAH:          "solar:map-point-wave-bold-duotone",
  GUDANG:         "solar:box-bold-duotone",
  HOTEL_DAN_VILLA:"solar:bed-bold-duotone",
  TOKO:           "solar:bag-heart-bold-duotone",
  PABRIK:         "solar:garage-bold-duotone",
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
const formatCurrency = (v: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

const daysUntil = (iso: string | null): number | null => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

const getPropertyUrl = (item: PropertyItem): string => {
  const t = item.jenis_transaksi?.toUpperCase();
  const id = `${item.slug}-${item.id_property}`;
  if (t === "SEWA")   return `/Sewa/${id}`;
  if (t === "LELANG") return `/Lelang/${id}`;
  return `/Jual/${id}`;
};

// ─── BADGE PER JENIS TRANSAKSI ────────────────────────────────────────────────
const TransaksiBadge = ({ type }: { type: string }) => {
  const t = type?.toUpperCase();
  if (t === "PRIMARY")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200 bg-blue-500/20 border border-blue-400/40 backdrop-blur-sm">
        <Icon icon="solar:home-2-bold-duotone" className="text-xs" />Primary
      </span>
    );
  if (t === "SECONDARY")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200 bg-violet-500/20 border border-violet-400/40 backdrop-blur-sm">
        <Icon icon="solar:buildings-2-bold-duotone" className="text-xs" />Secondary
      </span>
    );
  if (t === "SEWA")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200 bg-emerald-500/20 border border-emerald-400/40 backdrop-blur-sm">
        <Icon icon="solar:key-bold-duotone" className="text-xs" />Sewa
      </span>
    );
  return null;
};

// Badge countdown khusus lelang (ikut pattern Lelang page yang sudah ada)
const LelangBadge = ({ tanggal_lelang }: { tanggal_lelang: string | null }) => {
  const days = daysUntil(tanggal_lelang);
  if (days === null) return null;

  if (days <= 0)
    return (
      <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] text-amber-50">
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 opacity-80 blur-[3px]" />
        <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-[#18181b] via-[#030712] to-[#111827] border border-amber-300/80 shadow-[0_0_22px_rgba(250,204,21,0.75)]" />
        <span className="relative inline-flex items-center gap-1.5 px-1">
          <Icon icon="solar:cup-star-bold-duotone" className="text-sm text-amber-200" />
          <span className="text-[10px] tracking-[0.24em]">PELUANG EMAS</span>
        </span>
      </span>
    );

  if (days <= 10)
    return (
      <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] text-white">
        <span className="absolute inset-0 rounded-full bg-[conic-gradient(at_top,_#22c55e,_#f97316,_#ef4444,_#22c55e)] opacity-90 blur-[3px]" />
        <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-black/80 via-black/70 to-black/80 border border-red-400/80 shadow-[0_0_26px_rgba(248,113,113,0.8)]" />
        <span className="relative inline-flex items-center gap-1 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
          <Icon icon="solar:fire-bold-duotone" className="text-sm text-yellow-200" />
          {days} hari lagi
        </span>
      </span>
    );

  if (days <= 20)
    return (
      <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.12em] text-white">
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 opacity-80 blur-[2px]" />
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 animate-pulse opacity-70" />
        <span className="relative inline-flex items-center gap-1.5 px-1">
          <Icon icon="solar:fire-bold-duotone" className="text-sm text-yellow-100" />
          {days} hari lagi
        </span>
      </span>
    );

  return (
    <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] text-sky-50">
      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 opacity-70 blur-[3px]" />
      <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-[#020617] via-[#020617] to-[#022c22] border border-sky-300/70 shadow-[0_0_18px_rgba(56,189,248,0.7)]" />
      <span className="relative inline-flex items-center gap-1.5 px-1">
        <Icon icon="solar:calendar-bold-duotone" className="text-sm text-sky-200" />
        {formatDateShort(tanggal_lelang!)}
      </span>
    </span>
  );
};

// ─── PROPERTY CARD ────────────────────────────────────────────────────────────
const PropertyCard = ({ item }: { item: PropertyItem }) => {
  const [imgIdx, setImgIdx] = useState(0);
  const images = item.foto_list.length > 0 ? item.foto_list : [item.gambar || "/images/hero/banner.jpg"];

  const nextImage = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setImgIdx((p) => (p + 1) % images.length); };
  const prevImage = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setImgIdx((p) => (p - 1 + images.length) % images.length); };

  const isLelang   = item.jenis_transaksi?.toUpperCase() === "LELANG";
  const hasDiscount = !isLelang && item.harga_promo != null && item.harga_promo > 0 && item.harga_promo < item.harga;
  const discountPct = hasDiscount ? Math.round(((item.harga - item.harga_promo!) / item.harga) * 100) : 0;
  const mainPrice   = hasDiscount ? item.harga_promo! : item.harga;
  const icon        = KATEGORI_ICONS[item.kategori?.toUpperCase()] || "solar:home-2-bold-duotone";

  return (
    <Link href={getPropertyUrl(item)} className="block h-full group">
      <div
        className="
          bg-[#050608] border border-white/10 rounded-3xl overflow-hidden
          relative flex flex-col h-full
          shadow-[0_18px_60px_rgba(0,0,0,0.9)]
          before:content-[''] before:absolute before:inset-px before:rounded-[22px]
          before:border before:border-white/5 before:pointer-events-none
          hover:border-emerald-400/60 hover:shadow-[0_22px_70px_rgba(34,197,94,0.3)]
          transition-all duration-300
        "
      >
        {/* ── IMAGE ── */}
        <div className="relative h-64 w-full overflow-hidden">
          <Image
            key={images[imgIdx]}
            src={images[imgIdx]}
            alt={item.judul}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            onError={(e) => { (e.target as HTMLImageElement).src = "/images/hero/banner.jpg"; }}
          />

          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/0 pointer-events-none" />

          {/* shimmer line bottom */}
          <div className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent opacity-60 pointer-events-none" />

          {/* slider controls */}
          {images.length > 1 && (
            <>
              <button onClick={prevImage} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-primary hover:text-black text-white flex items-center justify-center z-20 transition-all opacity-0 group-hover:opacity-100">
                <Icon icon="solar:alt-arrow-left-linear" />
              </button>
              <button onClick={nextImage} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-primary hover:text-black text-white flex items-center justify-center z-20 transition-all opacity-0 group-hover:opacity-100">
                <Icon icon="solar:alt-arrow-right-linear" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {images.slice(0, 5).map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === imgIdx ? "bg-white w-4" : "bg-white/40 w-1.5"}`} />
                ))}
              </div>
            </>
          )}

          {/* badge kiri: kategori */}
          <div className="absolute top-4 left-4 z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/80 text-emerald-300 text-[11px] font-semibold border border-emerald-400/40 backdrop-blur-sm">
              <Icon icon={icon} className="text-sm" />
              {item.kategori.replace(/_/g, " ")}
            </span>
          </div>

          {/* badge kanan */}
          <div className="absolute top-4 right-4 z-10">
            {isLelang ? <LelangBadge tanggal_lelang={item.tanggal_lelang} /> : <TransaksiBadge type={item.jenis_transaksi} />}
          </div>

          {/* discount badge */}
          {hasDiscount && (
            <div className="absolute bottom-4 right-3 z-20">
              <div className="absolute inset-0 blur-xl bg-gradient-to-r from-rose-500/40 via-orange-500/40 to-amber-400/40 animate-pulse pointer-events-none" />
              <span className="absolute -top-2 -right-1 w-3 h-3 rounded-full bg-amber-300 animate-ping" />
              <div className="relative bg-gradient-to-r from-rose-600 via-orange-500 to-amber-400 text-white px-3.5 py-1.5 rounded-full text-[11px] font-extrabold tracking-wide shadow-[0_0_20px_rgba(248,113,113,0.9)] flex items-center gap-1.5">
                <Icon icon="solar:fire-bold-duotone" className="text-sm drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
                -{discountPct}%
              </div>
            </div>
          )}
        </div>

        {/* ── CONTENT ── */}
        <div className="p-5 flex flex-col flex-grow bg-gradient-to-b from-slate-900/80 via-slate-950/90 to-black border-t border-slate-800">
          {/* Harga */}
          <div className="mb-2">
            {hasDiscount ? (
              <>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-white text-xl font-black tracking-tight">{formatCurrency(mainPrice)}</h3>
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Hemat {formatCurrency(item.harga - mainPrice)}
                  </span>
                </div>
                <span className="text-gray-500 text-xs line-through decoration-2 decoration-rose-400/80">{formatCurrency(item.harga)}</span>
              </>
            ) : (
              <h3 className="text-white text-xl font-black tracking-tight">{formatCurrency(mainPrice)}</h3>
            )}
            {item.jenis_transaksi?.toUpperCase() === "SEWA" && (
              <span className="text-gray-500 text-[11px]"> / bulan</span>
            )}
            {isLelang && (
              <span className="ml-1 text-amber-400/60 text-[11px]">nilai limit</span>
            )}
          </div>

          {/* Judul */}
          <h4 className="text-gray-100 text-base font-bold line-clamp-2 group-hover:text-primary transition-colors mb-2" title={item.judul}>
            {item.judul}
          </h4>

          {/* Lokasi */}
          <div className="flex items-start gap-2 mb-4">
            <Icon icon="solar:map-point-wave-bold" className="text-primary text-base shrink-0 mt-0.5" />
            <span className="text-gray-400 text-sm line-clamp-1">{item.kota}</span>
          </div>

          {/* Specs box */}
          <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950/90 rounded-2xl p-3 mb-4 border border-slate-700/80 shadow-[0_12px_35px_rgba(0,0,0,0.8)]">
            {isLelang ? (
              // lelang: luas tanah + tanggal lelang
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:ruler-angular-bold" className="text-gray-400" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase">Luas Tanah</span>
                    <span className="text-white text-xs font-bold">{item.luas_tanah ? `${item.luas_tanah} m²` : "-"}</span>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex items-center gap-2">
                  <Icon icon="solar:calendar-date-bold" className="text-red-400" />
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1 text-[10px] text-gray-500 uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Lelang
                    </span>
                    <span className="text-white text-xs font-bold">{item.tanggal_lelang ? formatDateShort(item.tanggal_lelang) : "-"}</span>
                  </div>
                </div>
              </div>
            ) : (
              // jual/sewa: 4 specs
              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                {[
                  { label: "KT", value: item.kamar_tidur || "-", icon: "solar:bed-bold" },
                  { label: "KM", value: item.kamar_mandi || "-", icon: "solar:bath-bold" },
                  { label: "LT", value: item.luas_tanah ? `${item.luas_tanah}` : "-", icon: "solar:maximize-square-2-linear" },
                  { label: "LB", value: item.luas_bangunan ? `${item.luas_bangunan}` : "-", icon: "solar:buildings-linear" },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-white font-semibold inline-flex justify-center items-center gap-1">
                      <Icon icon={icon} className="text-xs text-gray-400" />{value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent + CTA */}
          <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-800 -mx-5 px-5 pb-1">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-full p-[1px] bg-gradient-to-tr from-primary to-transparent shrink-0">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#151515] relative">
                  <Image
                    src={item.agent_photo}
                    alt={item.agent_name}
                    fill
                    className="object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/images/default-profile.png"; }}
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-white leading-tight">{item.agent_name}</span>
                <span className="text-[10px] text-gray-500 leading-tight truncate max-w-[110px]">{item.agent_office}</span>
              </div>
            </div>

            <span className="bg-emerald-400/5 hover:bg-emerald-400 text-emerald-200 hover:text-black border border-emerald-400/60 shadow-[0_0_18px_rgba(34,197,94,0.4)] hover:shadow-[0_0_24px_rgba(34,197,94,0.8)] text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 transition-all duration-200 shrink-0">
              Detail
              <Icon icon="solar:arrow-right-up-bold-duotone" className="text-sm" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

// ─── PAGINATION ───────────────────────────────────────────────────────────────
const Pagination = ({ pagination, onPage }: { pagination: PaginationData; onPage: (p: number) => void }) => {
  const { currentPage, totalPages } = pagination;
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="mt-16 flex justify-center">
      <nav className="flex items-center gap-2 bg-[#1A1A1A] p-2 rounded-full border border-white/10 shadow-2xl">
        <button
          onClick={() => onPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Icon icon="solar:alt-arrow-left-linear" className="text-xl" />
        </button>

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="text-gray-600 px-1">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`w-10 h-10 rounded-full font-bold text-sm transition-all duration-300 ${
                p === currentPage
                  ? "bg-primary text-black shadow-[0_0_15px_rgba(74,222,128,0.4)] scale-110"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Icon icon="solar:alt-arrow-right-linear" className="text-xl" />
        </button>
      </nav>
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function KategoriPageClient({
  slug,
  label,
  initialData,
  pagination,
  activeTipe,
  activeSort,
  tabCounts,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();
  const listRef  = useRef<HTMLDivElement>(null);

  const navigate = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(sp.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tabs = [
    { key: "semua",  label: "Semua",  count: tabCounts.semua  },
    { key: "jual",   label: "Jual",   count: tabCounts.jual   },
    { key: "lelang", label: "Lelang", count: tabCounts.lelang },
    { key: "sewa",   label: "Sewa",   count: tabCounts.sewa   },
  ];

  const sortOptions = [
    { value: "terbaru",    label: "Terbaru"    },
    { value: "termurah",   label: "Termurah"   },
    { value: "termahal",   label: "Termahal"   },
    { value: "terpopuler", label: "Terpopuler" },
  ];

  const categoryIcon = KATEGORI_ICONS[slug.toUpperCase().replace(/-/g, "_")] || "solar:home-2-bold-duotone";

  return (
    <main className="bg-[#0F0F0F] min-h-screen pb-24">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-[#080808] border-b border-white/[0.06]">
        {/* grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: "linear-gradient(rgba(52,211,153,1) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,1) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* radial glow */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.12),transparent_70%)] pointer-events-none" />

        <div className="relative container mx-auto max-w-screen-xl px-4 pt-20 pb-14">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-white/25 mb-8">
            <Link href="/" className="hover:text-white/60 transition-colors">Beranda</Link>
            <Icon icon="solar:alt-arrow-right-linear" className="text-[9px]" />
            <span className="text-white/50">{label}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              {/* eyebrow */}
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-[0.18em] px-4 py-2 rounded-full mb-5">
                <Icon icon={categoryIcon} className="text-sm" />
                Kategori Properti
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-none tracking-tight">
                Properti{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">
                  {label}
                </span>
              </h1>
              <p className="text-white/40 text-base mt-4 max-w-lg">
                Temukan {label.toLowerCase()} terbaik — dijual, disewa, maupun lelang di seluruh Indonesia
              </p>
            </div>

            {/* stat chip */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white/[0.04] border border-white/[0.10] rounded-2xl px-6 py-4 text-center">
                <div className="text-3xl font-black text-white tabular-nums">
                  {tabCounts.semua.toLocaleString("id-ID")}
                </div>
                <div className="text-white/30 text-xs mt-0.5">Total Listing</div>
              </div>
              <div className="hidden sm:flex flex-col gap-2">
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-white/40 text-xs">{tabCounts.jual} Dijual</span>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-white/40 text-xs">{tabCounts.lelang} Lelang</span>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-white/40 text-xs">{tabCounts.sewa} Sewa</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER BAR (sticky) ── */}
      <div className="sticky top-0 z-40 bg-[#0F0F0F]/95 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="container mx-auto max-w-screen-xl px-4">
          <div className="flex items-center gap-4 py-3 overflow-x-auto scrollbar-none">

            {/* Tabs with framer-motion underline */}
            <div className="flex gap-1 shrink-0 relative">
              {tabs.map((tab) => {
                const isActive = activeTipe === tab.key || (tab.key === "semua" && activeTipe === "semua");
                return (
                  <button
                    key={tab.key}
                    onClick={() => navigate({ tipe: tab.key === "semua" ? undefined : tab.key, page: undefined })}
                    className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 flex items-center gap-2 whitespace-nowrap ${
                      isActive ? "text-white" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="tab-bg"
                        className="absolute inset-0 bg-white/10 rounded-xl border border-white/15"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                    <span className={`relative z-10 text-[10px] px-1.5 py-0.5 rounded-full tabular-nums font-bold ${
                      isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/25"
                    }`}>
                      {tab.count.toLocaleString("id-ID")}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* divider */}
            <div className="w-px h-5 bg-white/10 shrink-0" />

            {/* Sort */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <Icon icon="solar:sort-by-time-bold-duotone" className="text-white/25 text-sm" />
              <select
                value={activeSort}
                onChange={(e) => navigate({ sort: e.target.value, page: undefined })}
                className="bg-transparent border-none text-white/60 text-sm outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-4"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-[#1a1a1a] text-white">
                    {o.label}
                  </option>
                ))}
              </select>
              <Icon icon="solar:alt-arrow-down-linear" className="text-white/25 text-xs -ml-3 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ── GRID ── */}
      <div className="container mx-auto max-w-screen-xl px-4 mt-10" ref={listRef}>

        {/* result info */}
        <p className="text-white/25 text-xs mb-6">
          Menampilkan <span className="text-white/50 font-semibold">{pagination.totalItems.toLocaleString("id-ID")}</span> properti
          {activeTipe !== "semua" && ` · ${tabs.find(t => t.key === activeTipe)?.label}`}
        </p>

        {initialData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(52,211,153,0.08)]">
              <Icon icon="solar:buildings-bold-duotone" className="text-5xl text-white/15" />
            </div>
            <h3 className="text-white/50 text-xl font-bold mb-2">Belum ada listing</h3>
            <p className="text-white/25 text-sm">Coba tab lain atau kunjungi kembali nanti</p>
            <button
              onClick={() => navigate({ tipe: undefined, page: undefined })}
              className="mt-8 px-8 py-3 bg-primary text-black font-bold rounded-full hover:bg-green-400 transition-all shadow-[0_0_24px_rgba(74,222,128,0.3)]"
            >
              Lihat Semua
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTipe}-${pagination.currentPage}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
            >
              {initialData.map((item, idx) => (
                <motion.div
                  key={item.id_property}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.3 }}
                >
                  <PropertyCard item={item} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        <Pagination pagination={pagination} onPage={(p) => navigate({ page: String(p) })} />
      </div>

      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}

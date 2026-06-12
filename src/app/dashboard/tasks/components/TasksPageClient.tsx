"use client";

import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */

type Category = "URGENT" | "KONTEN" | "FOLLOWUP" | "VIEWING" | "PIPELINE" | "NETWORKING";
type LeadTemp = "HOT" | "WARM" | "COLD";
type ListingType = "RUMAH" | "APARTEMEN" | "RUKO" | "KAVLING" | "GUDANG";

type DailyTask = {
  id: string;
  category: Category;
  title: string;
  why: string;
  done: boolean;
  overdue?: boolean;
  target?: number;
  current?: number;
  leadName?: string;
  leadTemp?: LeadTemp;
  leadPhone?: string;
  pipelineStage?: string;
  commissionValue?: number;
  propertyTitle?: string;
  scheduledAt?: string;
  openCatalog?: boolean;
  actions: ActionDef[];
};

type ActionDef = {
  label: string;
  icon: string;
  variant: "primary" | "green" | "sky" | "violet" | "amber" | "ghost" | "rose" | "pink";
  onClick: () => void;
};

type CatalogListing = {
  id: string;
  rank: number;
  title: string;
  location: string;
  price: number;
  type: ListingType;
  bedrooms?: number;
  bathrooms?: number;
  buildArea?: number;
  landArea?: number;
  views7d: number;
  inquiries7d: number;
  potentialScore: number;
};

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS PER CATEGORY
═══════════════════════════════════════════════════════════════ */

type CatDesign = {
  label: string;
  icon: string;
  grad: string;
  orb: string;
  hairline: string;
  leftBar: string;
  iconGrad: string;
  iconRing: string;
  iconShadow: string;
  accent: string;
  sectionBg: string;
  sectionBorder: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
};

const CAT_DESIGN: Record<Category, CatDesign> = {
  URGENT: {
    label: "Mendesak",
    icon: "solar:danger-bold-duotone",
    grad: "linear-gradient(135deg,rgba(159,18,57,.22) 0%,rgba(7,10,11,.94) 65%)",
    orb: "radial-gradient(circle,rgba(251,113,133,.28) 0%,transparent 65%)",
    hairline: "via-rose-400/35",
    leftBar: "bg-rose-500",
    iconGrad: "linear-gradient(135deg,#fb7185,#e11d48)",
    iconRing: "ring-rose-300/25",
    iconShadow: "shadow-[0_8px_24px_-8px_rgba(244,63,94,.65)]",
    accent: "text-rose-300",
    sectionBg: "from-rose-500/[0.12] to-transparent",
    sectionBorder: "border-rose-400/25",
    chipBg: "bg-rose-500/10",
    chipBorder: "border-rose-400/25",
    chipText: "text-rose-300",
  },
  KONTEN: {
    label: "Konten & Marketing",
    icon: "solar:gallery-add-bold-duotone",
    grad: "linear-gradient(135deg,rgba(76,29,149,.22) 0%,rgba(7,10,11,.94) 65%)",
    orb: "radial-gradient(circle,rgba(167,139,250,.28) 0%,transparent 65%)",
    hairline: "via-violet-400/35",
    leftBar: "bg-violet-500",
    iconGrad: "linear-gradient(135deg,#a78bfa,#7c3aed)",
    iconRing: "ring-violet-300/25",
    iconShadow: "shadow-[0_8px_24px_-8px_rgba(139,92,246,.65)]",
    accent: "text-violet-300",
    sectionBg: "from-violet-500/[0.12] to-transparent",
    sectionBorder: "border-violet-400/25",
    chipBg: "bg-violet-500/10",
    chipBorder: "border-violet-400/25",
    chipText: "text-violet-300",
  },
  FOLLOWUP: {
    label: "Follow-up Lead",
    icon: "solar:phone-calling-bold-duotone",
    grad: "linear-gradient(135deg,rgba(7,89,133,.22) 0%,rgba(7,10,11,.94) 65%)",
    orb: "radial-gradient(circle,rgba(56,189,248,.28) 0%,transparent 65%)",
    hairline: "via-sky-400/35",
    leftBar: "bg-sky-500",
    iconGrad: "linear-gradient(135deg,#38bdf8,#0284c7)",
    iconRing: "ring-sky-300/25",
    iconShadow: "shadow-[0_8px_24px_-8px_rgba(14,165,233,.65)]",
    accent: "text-sky-300",
    sectionBg: "from-sky-500/[0.12] to-transparent",
    sectionBorder: "border-sky-400/25",
    chipBg: "bg-sky-500/10",
    chipBorder: "border-sky-400/25",
    chipText: "text-sky-300",
  },
  VIEWING: {
    label: "Viewing & Meeting",
    icon: "solar:home-2-bold-duotone",
    grad: "linear-gradient(135deg,rgba(120,53,15,.22) 0%,rgba(7,10,11,.94) 65%)",
    orb: "radial-gradient(circle,rgba(251,191,36,.28) 0%,transparent 65%)",
    hairline: "via-amber-400/35",
    leftBar: "bg-amber-500",
    iconGrad: "linear-gradient(135deg,#fbbf24,#d97706)",
    iconRing: "ring-amber-300/25",
    iconShadow: "shadow-[0_8px_24px_-8px_rgba(245,158,11,.65)]",
    accent: "text-amber-300",
    sectionBg: "from-amber-500/[0.12] to-transparent",
    sectionBorder: "border-amber-400/25",
    chipBg: "bg-amber-500/10",
    chipBorder: "border-amber-400/25",
    chipText: "text-amber-300",
  },
  PIPELINE: {
    label: "Pipeline & Admin",
    icon: "solar:chart-square-bold-duotone",
    grad: "linear-gradient(135deg,rgba(6,78,59,.22) 0%,rgba(7,10,11,.94) 65%)",
    orb: "radial-gradient(circle,rgba(52,211,153,.28) 0%,transparent 65%)",
    hairline: "via-emerald-400/35",
    leftBar: "bg-emerald-500",
    iconGrad: "linear-gradient(135deg,#34d399,#059669)",
    iconRing: "ring-emerald-300/25",
    iconShadow: "shadow-[0_8px_24px_-8px_rgba(16,185,129,.65)]",
    accent: "text-emerald-300",
    sectionBg: "from-emerald-500/[0.12] to-transparent",
    sectionBorder: "border-emerald-400/25",
    chipBg: "bg-emerald-500/10",
    chipBorder: "border-emerald-400/25",
    chipText: "text-emerald-300",
  },
  NETWORKING: {
    label: "Networking",
    icon: "solar:users-group-rounded-bold-duotone",
    grad: "linear-gradient(135deg,rgba(131,24,67,.22) 0%,rgba(7,10,11,.94) 65%)",
    orb: "radial-gradient(circle,rgba(244,114,182,.28) 0%,transparent 65%)",
    hairline: "via-pink-400/35",
    leftBar: "bg-pink-500",
    iconGrad: "linear-gradient(135deg,#f472b6,#db2777)",
    iconRing: "ring-pink-300/25",
    iconShadow: "shadow-[0_8px_24px_-8px_rgba(236,72,153,.65)]",
    accent: "text-pink-300",
    sectionBg: "from-pink-500/[0.12] to-transparent",
    sectionBorder: "border-pink-400/25",
    chipBg: "bg-pink-500/10",
    chipBorder: "border-pink-400/25",
    chipText: "text-pink-300",
  },
};

const ACTION_CLS: Record<ActionDef["variant"], string> = {
  primary: "border-emerald-400/35 bg-emerald-500/[0.12] text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 hover:shadow-[0_0_18px_-4px_rgba(52,211,153,.3)]",
  green:   "border-green-400/30  bg-green-500/[0.10]  text-green-300  hover:bg-green-500/20  hover:border-green-400/50",
  sky:     "border-sky-400/30    bg-sky-500/[0.10]    text-sky-300    hover:bg-sky-500/20    hover:border-sky-400/50",
  violet:  "border-violet-400/30 bg-violet-500/[0.10] text-violet-300 hover:bg-violet-500/20 hover:border-violet-400/50",
  amber:   "border-amber-400/30  bg-amber-500/[0.10]  text-amber-300  hover:bg-amber-500/20  hover:border-amber-400/50",
  rose:    "border-rose-400/30   bg-rose-500/[0.10]   text-rose-300   hover:bg-rose-500/20   hover:border-rose-400/50",
  pink:    "border-pink-400/30   bg-pink-500/[0.10]   text-pink-300   hover:bg-pink-500/20   hover:border-pink-400/50",
  ghost:   "border-white/[0.08]  bg-white/[0.03]      text-slate-400  hover:text-white       hover:bg-white/[0.08]",
};

/* ═══════════════════════════════════════════════════════════════
   CATALOG DATA
═══════════════════════════════════════════════════════════════ */

const CATALOG_LISTINGS: CatalogListing[] = [
  { id:"l1",rank:1,  title:"Apartemen Ciputra World 2BR",      location:"Ciputra World, Surabaya Pusat",   price:850_000_000,  type:"APARTEMEN",bedrooms:2,bathrooms:2,buildArea:68,                views7d:203,inquiries7d:18,potentialScore:91 },
  { id:"l2",rank:2,  title:"Rumah Mewah Citraland Golf",       location:"Citraland, Surabaya Barat",       price:3_800_000_000,type:"RUMAH",   bedrooms:4,bathrooms:4,buildArea:420,landArea:320,  views7d:187,inquiries7d:14,potentialScore:94 },
  { id:"l3",rank:3,  title:"Town House Pakuwon City",          location:"Pakuwon City, Surabaya Timur",    price:2_150_000_000,type:"RUMAH",   bedrooms:3,bathrooms:3,buildArea:200,landArea:150,  views7d:142,inquiries7d:11,potentialScore:88 },
  { id:"l4",rank:4,  title:"Ruko 3 Lantai HR Muhammad",        location:"HR Muhammad, Surabaya Barat",     price:2_900_000_000,type:"RUKO",               buildArea:350,landArea:120,  views7d:98, inquiries7d:7, potentialScore:75 },
  { id:"l5",rank:5,  title:"Kavling Premium Graha Family",     location:"Graha Family, Surabaya Barat",    price:1_200_000_000,type:"KAVLING",                          landArea:200,  views7d:76, inquiries7d:5, potentialScore:62 },
  { id:"l6",rank:6,  title:"Gudang Rungkut Industri",          location:"Rungkut, Surabaya Timur",         price:5_500_000_000,type:"GUDANG",              buildArea:1200,landArea:1500,views7d:54, inquiries7d:4, potentialScore:70 },
  { id:"l7",rank:7,  title:"Rumah Darmo Permai 4KT",           location:"Darmo Permai, Surabaya Barat",    price:4_200_000_000,type:"RUMAH",   bedrooms:4,bathrooms:3,buildArea:380,landArea:280,  views7d:91, inquiries7d:9, potentialScore:82 },
  { id:"l8",rank:8,  title:"Apartemen Pakuwon Mall Studio",    location:"Pakuwon Mall, Surabaya Barat",    price:450_000_000,  type:"APARTEMEN",bedrooms:1,bathrooms:1,buildArea:32,                views7d:134,inquiries7d:10,potentialScore:78 },
  { id:"l9",rank:9,  title:"Ruko Galaxy Mall 2 Lantai",        location:"Galaxy Mall, Surabaya Timur",     price:1_800_000_000,type:"RUKO",               buildArea:220,landArea:88,   views7d:67, inquiries7d:6, potentialScore:68 },
  { id:"l10",rank:10,title:"Kavling Bukit Darmo Golf",         location:"Bukit Darmo, Surabaya Barat",     price:2_100_000_000,type:"KAVLING",                          landArea:350,  views7d:58, inquiries7d:3, potentialScore:59 },
  { id:"l11",rank:11,title:"Rumah Kupang Indah 3KT",           location:"Kupang Indah, Surabaya Barat",    price:1_350_000_000,type:"RUMAH",   bedrooms:3,bathrooms:2,buildArea:175,landArea:130,  views7d:49, inquiries7d:4, potentialScore:57 },
  { id:"l12",rank:12,title:"Gudang Margomulyo Area",           location:"Margomulyo, Surabaya Barat",      price:3_200_000_000,type:"GUDANG",              buildArea:800, landArea:1000,views7d:41, inquiries7d:3, potentialScore:65 },
  { id:"l13",rank:13,title:"Apartemen The Frontage 1BR",       location:"A. Yani, Surabaya Selatan",       price:650_000_000,  type:"APARTEMEN",bedrooms:1,bathrooms:1,buildArea:42,                views7d:88, inquiries7d:7, potentialScore:72 },
  { id:"l14",rank:14,title:"Ruko Klampis Jaya Corner",         location:"Klampis, Surabaya Timur",         price:2_400_000_000,type:"RUKO",               buildArea:300,landArea:100,  views7d:53, inquiries7d:4, potentialScore:61 },
  { id:"l15",rank:15,title:"Rumah Puri Merdeka 4KT Mewah",    location:"Puri Merdeka, Sidoarjo",          price:1_950_000_000,type:"RUMAH",   bedrooms:4,bathrooms:3,buildArea:310,landArea:240,  views7d:45, inquiries7d:3, potentialScore:55 },
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

function fIDR(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function openWA(phone: string, name: string, msg?: string) {
  const n = phone.replace(/\D/g, "").replace(/^0/, "62");
  const m = msg ?? `Halo ${name}, saya dari Solusindo Aset. Ada info properti menarik yang ingin saya sampaikan 🏡`;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(m)}`, "_blank");
}

function useCountUp(target: number, dur = 700) {
  const [val, setVal] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const from = ref.current; ref.current = target;
    if (from === target) { setVal(target); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setVal(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return val;
}

const LISTING_ICON: Record<ListingType, string> = {
  RUMAH: "solar:home-2-bold-duotone", APARTEMEN: "solar:buildings-bold-duotone",
  RUKO: "solar:shop-bold-duotone", KAVLING: "solar:map-point-bold-duotone", GUDANG: "solar:box-bold-duotone",
};

/* ═══════════════════════════════════════════════════════════════
   CATALOG MODAL
═══════════════════════════════════════════════════════════════ */

function CatalogModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const shareAll = () => {
    const names = CATALOG_LISTINGS.slice(0, 5).map((l) => `🏡 ${l.title} — ${fIDR(l.price)}`).join("\n");
    const msg = `*TOP ASET PILIHAN SOLUSINDO ASET* 🌟\n\n${names}\n\n...dan 10 properti eksklusif lainnya.\nHubungi saya untuk info lengkap!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const RANK_BADGE: Record<number, string> = {
    1: "bg-gradient-to-r from-amber-400 to-yellow-500 text-black",
    2: "bg-gradient-to-r from-slate-300 to-slate-400 text-black",
    3: "bg-gradient-to-r from-orange-500 to-amber-600 text-white",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col w-full max-w-2xl overflow-hidden rounded-3xl border border-white/[0.09] bg-[#080c0f] shadow-[0_48px_140px_rgba(0,0,0,.95)]"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top hairline */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        {/* Ambient orb */}
        <div className="pointer-events-none absolute -top-20 left-1/3 h-48 w-48 rounded-full bg-amber-500/[0.07] blur-3xl" />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-amber-300/25 shadow-[0_8px_24px_-8px_rgba(245,158,11,.7)]"
              style={{ background: "linear-gradient(135deg,#fbbf24,#d97706)" }}
            >
              <Icon icon="solar:star-bold-duotone" className="text-xl text-white drop-shadow" />
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent opacity-50" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">Katalog Top 15 Aset</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Diranking berdasarkan views, inquiry & potential score</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selected.size > 0 && (
              <span className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                {selected.size} dipilih
              </span>
            )}
            <button type="button" onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:border-rose-400/30 hover:text-rose-300 transition">
              <Icon icon="solar:close-circle-bold" className="text-base" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.07)_transparent]">
          {CATALOG_LISTINGS.map((l) => {
            const isSel = selected.has(l.id);
            const rankCls = RANK_BADGE[l.rank];

            return (
              <motion.div
                key={l.id}
                layout
                className={[
                  "relative overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer group",
                  isSel
                    ? "border-emerald-400/35 bg-emerald-500/[0.06] shadow-[0_0_0_1px_rgba(52,211,153,.12)]"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.13] hover:bg-white/[0.04]",
                ].join(" ")}
                onClick={() => toggle(l.id)}
              >
                <div className="flex items-center gap-3 p-3.5">
                  {/* Rank */}
                  <span className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-extrabold ${rankCls ?? "bg-white/[0.06] text-slate-500"}`}>
                    {l.rank <= 3 ? <Icon icon={l.rank === 1 ? "solar:crown-star-bold-duotone" : "solar:medal-star-bold-duotone"} className="text-sm" /> : l.rank}
                  </span>

                  {/* Icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04]">
                    <Icon icon={LISTING_ICON[l.type]} className="text-lg text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{l.title}</p>
                    <p className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                      <Icon icon="solar:map-point-bold" className="text-[10px] shrink-0" />{l.location}
                    </p>
                    <p className="text-[11px] font-extrabold text-emerald-400 mt-1">{fIDR(l.price)}</p>
                  </div>

                  {/* Stats */}
                  <div className="shrink-0 text-right hidden sm:block">
                    <p className="text-xs font-bold text-white tabular-nums">{l.views7d} views</p>
                    <p className="text-[10px] text-sky-300 tabular-nums">{l.inquiries7d} inquiry</p>
                    <div className="mt-1 h-1 w-16 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${l.potentialScore >= 80 ? "bg-emerald-500" : l.potentialScore >= 65 ? "bg-amber-500" : "bg-slate-500"}`}
                        style={{ width: `${l.potentialScore}%` }}
                      />
                    </div>
                    <p className={`text-[9px] font-bold mt-0.5 ${l.potentialScore >= 80 ? "text-emerald-400" : "text-slate-500"}`}>{l.potentialScore}pt</p>
                  </div>

                  {/* Select check */}
                  <div className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-lg border transition-all ${isSel ? "border-emerald-400/50 bg-emerald-500/25" : "border-white/[0.1] bg-white/[0.03]"}`}>
                    {isSel && <Icon icon="solar:check-circle-bold" className="text-xs text-emerald-400" />}
                  </div>
                </div>

                {/* Action row for selected */}
                <AnimatePresence>
                  {isSel && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-2 px-3.5 pb-3 border-t border-emerald-400/10 pt-2.5" onClick={(e) => e.stopPropagation()}>
                        <button type="button"
                          onClick={() => { toast.success(`Membuat poster untuk ${l.title}...`); }}
                          className="flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-bold text-violet-300 hover:bg-violet-500/20 transition">
                          <Icon icon="solar:gallery-add-bold-duotone" className="text-sm" /> Buat Poster
                        </button>
                        <button type="button"
                          onClick={() => {
                            const specs = [l.bedrooms && `${l.bedrooms}KT`, l.bathrooms && `${l.bathrooms}KM`, l.buildArea && `${l.buildArea}m²`].filter(Boolean).join(" · ");
                            openWA("", "", `🏡 *${l.title}*\n📍 ${l.location}\n💰 ${fIDR(l.price)}${specs ? `\n🏠 ${specs}` : ""}\n\nHubungi saya untuk info lengkap!`);
                          }}
                          className="flex items-center gap-1.5 rounded-xl border border-green-400/30 bg-green-500/10 px-3 py-1.5 text-[11px] font-bold text-green-300 hover:bg-green-500/20 transition">
                          <Icon icon="logos:whatsapp-icon" className="text-sm" /> Share WA
                        </button>
                        <button type="button"
                          onClick={() => { navigator.clipboard.writeText(`https://solusindoaset.com/listing/${l.id}`); toast.success("Link disalin!"); }}
                          className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/[0.08] transition">
                          <Icon icon="solar:link-bold" className="text-sm" /> Copy Link
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-t border-white/[0.07] bg-white/[0.02]">
          <button type="button" onClick={shareAll}
            className="flex items-center gap-2 rounded-2xl border border-green-400/30 bg-green-500/10 px-4 py-2.5 text-sm font-bold text-green-300 hover:bg-green-500/20 transition">
            <Icon icon="logos:whatsapp-icon" className="text-base" /> Share Top 5 ke WA
          </button>
          <button type="button" onClick={() => toast("Generate PDF katalog...")}
            className="flex items-center gap-2 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-2.5 text-sm font-bold text-violet-300 hover:bg-violet-500/15 transition">
            <Icon icon="solar:file-download-bold-duotone" className="text-base" /> Download PDF
          </button>
          {selected.size > 0 && (
            <button type="button" onClick={() => { toast.success(`Membuat poster untuk ${selected.size} listing...`); }}
              className="flex items-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-300 hover:bg-amber-500/15 transition">
              <Icon icon="solar:gallery-add-bold-duotone" className="text-base" /> Buat Konten ({selected.size})
            </button>
          )}
          <p className="ml-auto text-[10px] text-slate-600 hidden sm:block">
            Klik listing untuk pilih &amp; lihat opsi
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BUILD DAILY TASKS
═══════════════════════════════════════════════════════════════ */

function buildDailyTasks(
  mark: (id: string) => void,
  incr: (id: string) => void,
  openCatalog: () => void,
): DailyTask[] {
  return [
    /* URGENT */
    { id:"u1", category:"URGENT", overdue:true, done:false,
      title:"Follow-up Bapak Hendra — belum dihubungi 45 menit lalu",
      why:"Lead HOT di tahap Negosiasi. Diam > 24 jam = 60% probabilitas closing turun.",
      leadName:"Bapak Hendra", leadTemp:"HOT", leadPhone:"08123456789",
      pipelineStage:"Negosiasi", commissionValue:36_000_000,
      actions:[
        { label:"WA Sekarang", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>openWA("08123456789","Bapak Hendra","Halo Pak Hendra, saya dari Solusindo. Bagaimana keputusannya untuk penawaran Rp 3,5M? 🙏") },
        { label:"Telepon", icon:"solar:phone-bold", variant:"sky",
          onClick:()=>window.open("tel:08123456789") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("u1") },
      ]},
    { id:"u2", category:"URGENT", overdue:true, done:false,
      title:"Kirim draft PPJB ke Notaris Budi hari ini",
      why:"Kavling Graha Family sudah deal — dokumen harus masuk hari ini agar tidak molor.",
      propertyTitle:"Kavling Graha Family", commissionValue:28_500_000,
      actions:[
        { label:"Buka Dokumen", icon:"solar:document-text-bold-duotone", variant:"violet",
          onClick:()=>toast("Membuka halaman Surat & Dokumen...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("u2") },
      ]},

    /* KONTEN */
    { id:"k1", category:"KONTEN", done:false,
      title:"Post listing Apartemen Ciputra World di Instagram & TikTok",
      why:"203 views 7 hari — trafik tertinggi. Konten pagi mendapat engagement 2x lebih tinggi.",
      propertyTitle:"Apartemen Ciputra World 2BR",
      actions:[
        { label:"Lihat Katalog Top 15", icon:"solar:star-bold-duotone", variant:"amber",
          onClick:()=>openCatalog() },
        { label:"Buat Konten", icon:"solar:gallery-add-bold-duotone", variant:"violet",
          onClick:()=>toast("Membuka content creator...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("k1") },
      ]},
    { id:"k2", category:"KONTEN", done:false,
      title:"Post listing Rumah Citraland Golf di Facebook & marketplace",
      why:"Potential score 94 — listing terbaik kamu. Upload ulang dengan foto baru agar algoritma mendorong.",
      propertyTitle:"Rumah Citraland Golf",
      actions:[
        { label:"Lihat Katalog", icon:"solar:star-bold-duotone", variant:"amber",
          onClick:()=>openCatalog() },
        { label:"Buat Konten", icon:"solar:gallery-add-bold-duotone", variant:"violet",
          onClick:()=>toast("Membuka content creator...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("k2") },
      ]},
    { id:"k3", category:"KONTEN", done:false,
      title:"Post 1 konten edukasi: '5 Tips Negosiasi Harga Properti'",
      why:"Konten edukatif membangun trust & positioning sebagai expert. Engagement rata-rata 3x lebih tinggi dari listing biasa.",
      actions:[
        { label:"Buat Konten", icon:"solar:gallery-add-bold-duotone", variant:"violet",
          onClick:()=>toast("Membuka content creator...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("k3") },
      ]},

    /* FOLLOWUP */
    { id:"f1", category:"FOLLOWUP", done:false, scheduledAt:"14:00",
      title:"Konfirmasi site visit Ibu Ratna — Town House Pakuwon (sore ini)",
      why:"HOT lead, viewing ke-3. Konfirmasi sekarang mencegah no-show dan menunjukkan profesionalisme.",
      leadName:"Ibu Ratna", leadTemp:"HOT", leadPhone:"08234567890",
      pipelineStage:"Viewing", commissionValue:52_000_000,
      actions:[
        { label:"WA Konfirmasi", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>openWA("08234567890","Ibu Ratna","Halo Bu Ratna, mengingatkan site visit Town House Pakuwon hari ini jam 14:00. Kami sudah siapkan semua. Sampai jumpa! 🏡") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("f1") },
      ]},
    { id:"f2", category:"FOLLOWUP", done:false,
      title:"Follow-up Mbak Sari — negosiasi final, tunggu keputusan 5 hari",
      why:"Semakin lama di stage Negosiasi, semakin dingin. Hubungi hari ini atau deal bisa gagal.",
      leadName:"Mbak Sari", leadTemp:"HOT", leadPhone:"08456789012",
      pipelineStage:"Negosiasi", commissionValue:24_750_000,
      actions:[
        { label:"WA", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>openWA("08456789012","Mbak Sari","Halo Mbak Sari, bagaimana pertimbangannya untuk Ruko HR Muhammad? Ada yang bisa saya bantu? 😊") },
        { label:"Telepon", icon:"solar:phone-bold", variant:"sky",
          onClick:()=>window.open("tel:08456789012") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("f2") },
      ]},
    { id:"f3", category:"FOLLOWUP", done:false,
      title:"Follow-up Mas Rizky — qualified buyer, belum dijawab kemarin",
      why:"Buyer yang tidak di-follow-up dalam 48 jam biasanya pergi ke agen lain.",
      leadName:"Mas Rizky", leadTemp:"WARM", leadPhone:"08345678901",
      pipelineStage:"Qualified", commissionValue:19_000_000,
      actions:[
        { label:"WA", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>openWA("08345678901","Mas Rizky","Halo Mas Rizky, ada update untuk Apartemen Ciputra World yang cocok untuk investasi 🏢") },
        { label:"Telepon", icon:"solar:phone-bold", variant:"sky",
          onClick:()=>window.open("tel:08345678901") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("f3") },
      ]},
    { id:"f4", category:"FOLLOWUP", done:false, target:5, current:1,
      title:"Hubungi 5 prospek baru dari database hari ini",
      why:"Top agent melakukan minimal 5 outreach baru per hari. Ini adalah fondasi pipeline masa depan.",
      actions:[
        { label:"+1 Dihubungi", icon:"solar:user-plus-bold-duotone", variant:"sky",
          onClick:()=>incr("f4") },
        { label:"Buka Database", icon:"solar:users-group-rounded-bold", variant:"ghost",
          onClick:()=>toast("Membuka database client...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("f4") },
      ]},

    /* VIEWING */
    { id:"v1", category:"VIEWING", done:false, scheduledAt:"14:00",
      title:"Site visit bersama Ibu Ratna — Town House Pakuwon City",
      why:"Viewing ke-3. Siapkan info AJB, biaya notaris, dan simulasi KPR. Ini bisa langsung closing.",
      leadName:"Ibu Ratna", leadTemp:"HOT", propertyTitle:"Town House Pakuwon City", commissionValue:52_000_000,
      actions:[
        { label:"Buka di Maps", icon:"solar:map-point-bold-duotone", variant:"amber",
          onClick:()=>window.open("https://maps.google.com?q=Pakuwon+City+Surabaya","_blank") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("v1") },
      ]},
    { id:"v2", category:"VIEWING", done:false,
      title:"After-visit follow-up — kirim summary properti ke lead kemarin",
      why:"24 jam setelah viewing adalah golden window. Kirim info sebelum mereka bandingkan ke properti lain.",
      actions:[
        { label:"Buat & Kirim WA", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>toast("Membuka template after-visit follow-up...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("v2") },
      ]},

    /* PIPELINE */
    { id:"p1", category:"PIPELINE", done:false,
      title:"Update status Bapak Hendra di pipeline",
      why:"Pipeline yang tidak diupdate = blind spot. Kamu tidak tahu deal mana yang butuh perhatian sekarang.",
      leadName:"Bapak Hendra", leadTemp:"HOT", pipelineStage:"Negosiasi",
      actions:[
        { label:"Buka Pipeline", icon:"solar:square-transfer-horizontal-bold", variant:"primary",
          onClick:()=>toast("Membuka pipeline view...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"ghost", onClick:()=>mark("p1") },
      ]},
    { id:"p2", category:"PIPELINE", done:false, target:2, current:0,
      title:"Update foto & deskripsi 2 listing yang >7 hari tidak diperbarui",
      why:"Portal properti mendeprioritaskan listing lama. Update rutin = lebih banyak organic traffic.",
      actions:[
        { label:"+1 Diupdate", icon:"solar:add-circle-bold", variant:"primary",
          onClick:()=>incr("p2") },
        { label:"Buka Listing", icon:"solar:buildings-3-bold-duotone", variant:"ghost",
          onClick:()=>toast("Membuka halaman listings...") },
      ]},

    /* NETWORKING */
    { id:"n1", category:"NETWORKING", done:false, target:2, current:0,
      title:"Hubungi 2 agen lain untuk co-broke Gudang Rungkut Industri",
      why:"Co-broke memperluas jangkauan listing 3x. Komisi bisa dibagi tapi tetap besar.",
      propertyTitle:"Gudang Rungkut Industri",
      actions:[
        { label:"+1 Agen Dihubungi", icon:"solar:add-circle-bold", variant:"pink",
          onClick:()=>incr("n1") },
        { label:"Buka Network", icon:"solar:users-group-rounded-bold-duotone", variant:"ghost",
          onClick:()=>toast("Membuka network agen...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("n1") },
      ]},
    { id:"n2", category:"NETWORKING", done:false,
      title:"Minta 1 referral dari Pak Didik (client yang sudah closing)",
      why:"Referral dari satisfied client adalah lead paling hangat dan paling murah.",
      leadName:"Pak Didik Santoso", leadPhone:"08567890123",
      actions:[
        { label:"WA Pak Didik", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>openWA("08567890123","Pak Didik","Halo Pak Didik, semoga gudang barunya berjalan lancar 🏭 Kalau ada kenalan yang cari properti, boleh referensikan ke saya ya? 🙏") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("n2") },
      ]},
  ];
}

/* ═══════════════════════════════════════════════════════════════
   TASK ROW — PREMIUM CARD
═══════════════════════════════════════════════════════════════ */

function TaskCard({ task, onToggle }: { task: DailyTask; onToggle: () => void }) {
  const D = CAT_DESIGN[task.category];
  const isBatch = task.target !== undefined;
  const isDone  = task.done || (isBatch && (task.current ?? 0) >= (task.target ?? 1));
  const batchPct = isBatch ? Math.min(100, ((task.current ?? 0) / (task.target ?? 1)) * 100) : 0;

  const LEAD_TEMP = {
    HOT:  { cls:"border-rose-400/30 bg-rose-500/10 text-rose-300",    icon:"solar:fire-bold-duotone",      label:"HOT" },
    WARM: { cls:"border-amber-400/25 bg-amber-500/10 text-amber-300", icon:"solar:sun-bold-duotone",       label:"WARM" },
    COLD: { cls:"border-slate-400/20 bg-slate-500/10 text-slate-400", icon:"solar:snowflake-bold-duotone", label:"COLD" },
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDone ? 0.45 : 1, y: 0 }}
      exit={{ opacity: 0, x: -30, height: 0 }}
      transition={{ duration: 0.22 }}
      className={[
        "group relative overflow-hidden rounded-3xl border transition-all duration-300",
        isDone
          ? "border-white/[0.05] bg-white/[0.01]"
          : "border-white/[0.08] hover:border-white/[0.16] hover:shadow-[0_8px_32px_-12px_rgba(0,0,0,.6)]",
      ].join(" ")}
      style={{ background: isDone ? undefined : D.grad }}
    >
      {/* Top hairline */}
      {!isDone && (
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${D.hairline} to-transparent`} />
      )}
      {/* Ambient orb */}
      {!isDone && (
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl opacity-70 transition-all duration-700 group-hover:scale-125 group-hover:opacity-100"
          style={{ background: D.orb }} />
      )}
      {/* Left accent bar */}
      {!isDone && (
        <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-full ${D.leftBar} opacity-70`} />
      )}
      {/* Shimmer on hover */}
      {!isDone && (
        <div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent opacity-0 transition-all duration-1000 ease-out group-hover:left-[120%] group-hover:opacity-100" />
      )}

      <div className="relative flex gap-4 p-5">
        {/* Icon orb + checkbox */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          {/* Category icon orb */}
          <div
            className={`relative flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${D.iconRing} ${D.iconShadow} transition-transform duration-300 ${!isDone ? "group-hover:scale-110" : "opacity-40"}`}
            style={{ background: isDone ? "rgba(255,255,255,0.04)" : D.iconGrad }}
          >
            <Icon icon={D.icon} className="text-base text-white drop-shadow" />
            {!isDone && <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/25 to-transparent opacity-60" />}
          </div>

          {/* Checkbox */}
          <button type="button" onClick={onToggle}
            className={[
              "flex h-6 w-6 items-center justify-center rounded-xl border transition-all duration-200",
              isDone
                ? "border-emerald-400/40 bg-emerald-500/20"
                : task.overdue
                ? "border-rose-400/40 bg-rose-500/[0.1] hover:bg-rose-500/20"
                : "border-white/[0.15] bg-white/[0.04] hover:border-white/30",
            ].join(" ")}
          >
            {isDone && <Icon icon="solar:check-circle-bold" className="text-xs text-emerald-400" />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title + overdue badge */}
          <div className="flex items-start justify-between gap-3">
            <p className={`text-[13.5px] font-bold leading-snug ${isDone ? "line-through text-slate-500" : "text-white"}`}>
              {task.title}
            </p>
            {task.overdue && !isDone && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-rose-400/35 bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold text-rose-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-70 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
                </span>
                OVERDUE
              </span>
            )}
            {task.scheduledAt && !task.overdue && !isDone && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                <Icon icon="solar:clock-circle-bold" className="text-[10px]" />
                {task.scheduledAt}
              </span>
            )}
          </div>

          {/* Meta chips */}
          {!isDone && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {task.leadTemp && (() => {
                const t = LEAD_TEMP[task.leadTemp!];
                return (
                  <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${t.cls}`}>
                    <Icon icon={t.icon} className="text-[10px]" />{t.label}
                  </span>
                );
              })()}
              {task.pipelineStage && (
                <span className="text-[10px] font-semibold text-slate-400 border border-white/[0.08] bg-white/[0.03] rounded-lg px-2 py-0.5">
                  {task.pipelineStage}
                </span>
              )}
              {task.propertyTitle && (
                <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                  <Icon icon="solar:home-2-bold" className="text-[10px]" />{task.propertyTitle}
                </span>
              )}
              {task.commissionValue && (
                <span className="text-[11px] font-extrabold text-emerald-400/90">{fIDR(task.commissionValue)}</span>
              )}
            </div>
          )}

          {/* Batch progress bar */}
          {isBatch && !isDone && (
            <div className="flex items-center gap-2.5 mt-2.5">
              <div className="flex-1 h-2 rounded-full bg-black/30 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${batchPct}%` }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full ${batchPct >= 100 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-sky-600 to-sky-400"}`}
                />
              </div>
              <span className={`text-[11px] font-extrabold tabular-nums shrink-0 ${batchPct >= 100 ? "text-emerald-300" : "text-sky-300"}`}>
                {task.current ?? 0}/{task.target}
              </span>
            </div>
          )}

          {/* Why */}
          {!isDone && (
            <p className="mt-2.5 text-[11px] text-slate-500 leading-relaxed">
              <span className="text-slate-600">💡</span> {task.why}
            </p>
          )}

          {/* Action buttons */}
          {!isDone && (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {task.actions.map((a) => (
                <button key={a.label} type="button" onClick={a.onClick}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[11px] font-bold transition-all duration-150 ${ACTION_CLS[a.variant] ?? ACTION_CLS.ghost}`}>
                  <Icon icon={a.icon} className="text-sm" />
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION HEADER — PREMIUM
═══════════════════════════════════════════════════════════════ */

function SectionHeader({ category, total, done }: { category: Category; total: number; done: number }) {
  const D = CAT_DESIGN[category];
  const pct = total > 0 ? (done / total) * 100 : 0;
  const allDone = done === total && total > 0;

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${D.sectionBorder} bg-gradient-to-r ${D.sectionBg} px-5 py-4 mb-3`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${D.iconRing} ${D.iconShadow}`}
          style={{ background: D.iconGrad }}
        >
          <Icon icon={D.icon} className="text-base text-white drop-shadow" />
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-white/25 to-transparent opacity-60" />
        </div>

        {/* Label + progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-extrabold tracking-tight ${D.accent}`}>{D.label}</span>
            {category === "URGENT" && !allDone && (
              <span className="flex h-2 w-2 relative">
                <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              </span>
            )}
            {allDone && (
              <Icon icon="solar:check-circle-bold" className="text-sm text-emerald-400" />
            )}
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 rounded-full bg-black/20 overflow-hidden">
              <motion.div
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={`h-full rounded-full ${allDone ? "bg-emerald-500" : D.leftBar}`}
              />
            </div>
            <span className="text-[10px] font-extrabold text-slate-500 tabular-nums shrink-0">{done}/{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════════ */

function Sidebar({ tasks }: { tasks: DailyTask[] }) {
  const total = tasks.length;
  const done  = tasks.filter((t) => t.done || ((t.current ?? 0) >= (t.target ?? 1))).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const animPct = useCountUp(pct);

  const totalComm = tasks.filter((t) => !t.done && t.commissionValue)
    .reduce((s, t) => s + (t.commissionValue ?? 0), 0);
  const urgentLeft = tasks.filter((t) => t.category === "URGENT" && !t.done).length;
  const hotLeft    = tasks.filter((t) => t.leadTemp === "HOT" && !t.done).length;

  const statusMsg =
    pct === 100 ? "🏆 Semua task selesai! Hari yang luar biasa." :
    pct >= 75 ? "🔥 Hampir finish! Jangan berhenti sekarang." :
    pct >= 50 ? "💪 Setengah jalan. Keep going!" :
    "🎯 Fokus ke task URGENT & HOT leads dulu.";

  return (
    <div className="space-y-4">
      {/* Progress Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#0b1214] to-[#07090b] p-5">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/[0.06] blur-2xl" />

        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-600 mb-4">Progress Hari Ini</p>

        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
              <circle cx="32" cy="32" r="26" fill="none"
                stroke={pct === 100 ? "#34d399" : "#38bdf8"} strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(animPct / 100) * 163.4} 163.4`}
                className="drop-shadow-[0_0_8px_rgba(52,211,153,.5)] transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold text-white tabular-nums">{Math.round(animPct)}%</span>
              <span className="text-[8px] text-slate-500 uppercase tracking-wider">selesai</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-3xl font-extrabold text-white tabular-nums leading-none">{done}</p>
            <p className="text-sm text-slate-500 mt-0.5">dari {total} task</p>
            {urgentLeft > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-rose-400/25 bg-rose-500/10 px-2.5 py-1">
                <span className="flex h-1.5 w-1.5"><span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 opacity-75 animate-ping"/><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400"/></span>
                <span className="text-[10px] font-bold text-rose-300">{urgentLeft} mendesak</span>
              </div>
            )}
          </div>
        </div>
        <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">{statusMsg}</p>
      </div>

      {/* Commission */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/[0.09] to-emerald-900/[0.04] p-5">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
        <div className="flex items-center gap-2 mb-2">
          <Icon icon="solar:wallet-money-bold-duotone" className="text-base text-emerald-300" />
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400/60">Komisi Potensial</p>
        </div>
        <p className="text-2xl font-extrabold bg-gradient-to-br from-emerald-300 to-emerald-500 bg-clip-text text-transparent tabular-nums">
          {totalComm > 0 ? fIDR(totalComm) : "—"}
        </p>
        <p className="text-[10px] text-emerald-400/40 mt-0.5">dari task aktif hari ini</p>
      </div>

      {/* HOT leads */}
      {hotLeft > 0 && (
        <div className="relative overflow-hidden rounded-3xl border border-rose-400/15 bg-gradient-to-br from-rose-500/[0.08] to-transparent p-5">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/25 to-transparent" />
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:fire-bold-duotone" className="text-base text-rose-300" />
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-rose-400/60">HOT Lead Aktif</p>
          </div>
          <p className="text-2xl font-extrabold text-rose-300 tabular-nums">{hotLeft}</p>
          <p className="text-[10px] text-rose-400/40 mt-0.5">belum dihubungi hari ini</p>
          <p className="mt-2 text-[11px] text-slate-500">Setiap jam tunda = peluang closing turun.</p>
        </div>
      )}

      {/* Streak */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#0b1012] to-[#07090b] p-5">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/15 to-transparent" />
        <div className="flex items-center gap-2 mb-3">
          <Icon icon="solar:fire-bold-duotone" className="text-base text-amber-300" />
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Streak Produktif</p>
        </div>
        <p className="text-3xl font-extrabold text-amber-300 leading-none">7 <span className="text-base text-slate-500 font-semibold">hari</span></p>
        <div className="flex gap-1 mt-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i < 7 ? "bg-gradient-to-r from-amber-500 to-amber-300" : "bg-white/[0.05]"}`} />
          ))}
        </div>
        <p className="text-[11px] text-slate-600 mt-2">Pertahankan streak-mu!</p>
      </div>

      {/* Mindset */}
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.01] p-5">
        <div className="flex items-center gap-2 mb-2.5">
          <Icon icon="solar:lightbulb-bold-duotone" className="text-base text-amber-300" />
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Mindset Hari Ini</p>
        </div>
        <p className="text-[12px] text-slate-400 leading-relaxed italic">
          &ldquo;Tidak ada closing besar yang terjadi tanpa follow-up yang konsisten. Hubungi dulu, deal kemudian.&rdquo;
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAT CARD
═══════════════════════════════════════════════════════════════ */

type StatAccent = "sky" | "emerald" | "rose" | "amber";

const STAT_CFG: Record<StatAccent, { border: string; bg: string; orb: string; icon: string; val: string }> = {
  sky:     { border:"border-sky-400/[0.18]",     bg:"bg-sky-500/[0.06]",     orb:"bg-sky-500/[0.2]",     icon:"text-sky-400",     val:"text-sky-100"     },
  emerald: { border:"border-emerald-400/[0.18]", bg:"bg-emerald-500/[0.06]", orb:"bg-emerald-500/[0.2]", icon:"text-emerald-400", val:"text-emerald-100" },
  rose:    { border:"border-rose-400/[0.18]",    bg:"bg-rose-500/[0.06]",    orb:"bg-rose-500/[0.2]",    icon:"text-rose-400",    val:"text-rose-100"    },
  amber:   { border:"border-amber-400/[0.18]",   bg:"bg-amber-500/[0.06]",   orb:"bg-amber-500/[0.2]",   icon:"text-amber-400",   val:"text-amber-100"   },
};

function StatCard({ icon, label, value, sub, accent, gradient, urgent }: {
  icon: string; label: string; value: string; sub: string;
  accent: StatAccent; gradient?: boolean; urgent?: boolean;
}) {
  const A = STAT_CFG[accent];
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${A.border} ${A.bg} p-4`}>
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full ${A.orb} blur-2xl`} />
      {urgent && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
        </span>
      )}
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${A.border} bg-black/25 mb-3`}>
        <Icon icon={icon} className={`text-base ${A.icon}`} />
      </div>
      <p className={`text-[1.2rem] font-extrabold leading-none tabular-nums ${gradient ? "bg-gradient-to-br from-emerald-300 to-emerald-500 bg-clip-text text-transparent" : A.val}`}>
        {value}
      </p>
      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-600 mt-1.5">{label}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HEADER — COMMAND CENTER
═══════════════════════════════════════════════════════════════ */

function Header({ tasks, totalDone, byCategory }: {
  tasks: DailyTask[];
  totalDone: number;
  byCategory: Record<Category, DailyTask[]>;
}) {
  const today = new Date();
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const pct      = tasks.length > 0 ? (totalDone / tasks.length) * 100 : 0;
  const animPct  = useCountUp(pct);
  const totalComm = tasks.filter((t) => !t.done && t.commissionValue).reduce((s, t) => s + (t.commissionValue ?? 0), 0);
  const hotLeads  = tasks.filter((t) => t.leadTemp === "HOT" && !t.done).length;
  const urgentLeft = (byCategory["URGENT"] ?? []).filter((t) => !t.done).length;

  const DAYS   = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

  return (
    <header
      className="relative overflow-hidden border-b border-white/[0.05]"
      style={{ background: "linear-gradient(180deg,#060a14 0%,#050810 55%,#040609 100%)" }}
    >
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 65%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 65%, transparent 100%)",
        }}
      />
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute -top-32 left-[22%] h-72 w-72 rounded-full bg-emerald-500/[0.07] blur-[60px]" />
      <div className="pointer-events-none absolute -top-24 right-[28%] h-56 w-56 rounded-full bg-violet-500/[0.05] blur-[50px]" />
      <div className="pointer-events-none absolute top-1/2 -right-12 h-40 w-40 rounded-full bg-sky-500/[0.04] blur-3xl" />
      {/* Top hairline */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#040609]/80 to-transparent" />
      {/* Corner brackets */}
      <div className="pointer-events-none absolute top-5 left-5 h-6 w-6 border-t-[1.5px] border-l-[1.5px] border-emerald-400/25 rounded-tl" />
      <div className="pointer-events-none absolute top-5 right-5 h-6 w-6 border-t-[1.5px] border-r-[1.5px] border-emerald-400/25 rounded-tr" />

      <div className="relative max-w-screen-xl mx-auto px-5 lg:px-8 pt-8 pb-7">

        {/* Row 1 — badge + clock */}
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-[7px] w-[7px]">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-emerald-400" />
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.35em] text-emerald-400/75 select-none">
              Daily Command Center
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:block text-[11px] font-medium text-slate-500">
              {DAYS[today.getDay()]}, {today.getDate()} {MONTHS[today.getMonth()]} {today.getFullYear()}
            </span>
            <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="font-mono text-sm font-bold text-white tabular-nums">{time}</span>
              <span className="hidden sm:block text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">WIB</span>
            </div>
          </div>
        </div>

        {/* Row 2 — headline + ring */}
        <div className="flex items-center justify-between gap-6 mb-7">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-600 mb-1.5">
              {today.getDate()} {MONTHS[today.getMonth()]} · Agent Performance
            </p>
            <h1 className="text-[2rem] sm:text-[2.4rem] font-black tracking-tight leading-[1.05]">
              <span className="bg-gradient-to-br from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                {pct >= 100 ? "Misi Selesai! 🏆" : "Misi Hari Ini"}
              </span>
            </h1>
            <p className="mt-2 text-[12.5px] text-slate-500 leading-relaxed max-w-sm">
              {pct >= 100
                ? "Semua task tuntas — hari yang luar biasa!"
                : `${tasks.length - totalDone} task tersisa · Fokus ke URGENT & HOT leads terlebih dahulu.`}
            </p>
          </div>

          {/* Animated ring */}
          <div className="relative shrink-0 h-[92px] w-[92px]">
            <div className={`absolute inset-3 rounded-full blur-2xl opacity-25 transition-colors duration-700 ${pct >= 100 ? "bg-emerald-500" : "bg-sky-500"}`} />
            <svg className="relative h-[92px] w-[92px] -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3.5" />
              <circle
                cx="32" cy="32" r="26" fill="none"
                stroke={pct >= 100 ? "#34d399" : "#38bdf8"}
                strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${(animPct / 100) * 163.4} 163.4`}
                className="drop-shadow-[0_0_8px_rgba(56,189,248,.55)] transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-white tabular-nums leading-none">{Math.round(animPct)}%</span>
              <span className="text-[8px] text-slate-500 uppercase tracking-[0.2em] mt-0.5">done</span>
            </div>
          </div>
        </div>

        {/* Row 3 — stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon="solar:checklist-bold-duotone"          label="Tasks Hari Ini"  value={`${totalDone}/${tasks.length}`}              sub="selesai"             accent="sky"     />
          <StatCard icon="solar:wallet-money-bold-duotone"       label="Komisi Potensi" value={totalComm > 0 ? fIDR(totalComm) : "—"}        sub="dari task aktif"     accent="emerald" gradient />
          <StatCard icon="solar:fire-bold-duotone"               label="HOT Leads"      value={String(hotLeads)}                              sub="butuh follow-up"     accent="rose"    urgent={hotLeads > 0} />
          <StatCard icon="solar:danger-triangle-bold-duotone"    label="Mendesak"       value={String(urgentLeft)}                            sub="harus selesai segera" accent="amber"  urgent={urgentLeft > 0} />
        </div>

        {/* Row 4 — progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-600">Daily Progress</span>
            <span className="text-[10px] font-extrabold tabular-nums text-slate-500">{totalDone}/{tasks.length} task</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className={`absolute inset-y-0 left-0 rounded-full ${
                pct >= 100
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-300"
                  : "bg-gradient-to-r from-sky-700 via-sky-400 to-emerald-300"
              }`}
              style={{ boxShadow: "0 0 14px rgba(56,189,248,.45)" }}
            />
          </div>
        </div>

        {/* Row 5 — category pills */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ORDER.map((cat) => {
            const D = CAT_DESIGN[cat];
            const items = byCategory[cat] ?? [];
            if (items.length === 0) return null;
            const catDone = items.filter((t) => t.done || ((t.current ?? 0) >= (t.target ?? 1))).length;
            const allDone = catDone === items.length;
            return (
              <button
                key={cat} type="button"
                onClick={() => document.getElementById(`sec-${cat}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className={[
                  "shrink-0 flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-[11px] font-bold transition-all duration-200 select-none",
                  allDone
                    ? "border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-400"
                    : cat === "URGENT"
                    ? "border-rose-400/30 bg-rose-500/[0.09] text-rose-300 shadow-[0_0_14px_-5px_rgba(239,68,68,.4)]"
                    : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:text-white hover:border-white/[0.12] hover:bg-white/[0.04]",
                ].join(" ")}
              >
                <Icon icon={allDone ? "solar:check-circle-bold" : D.icon} className="text-sm" />
                <span className="hidden sm:inline">{D.label}</span>
                <span className={`text-[10px] tabular-nums ${allDone ? "text-emerald-400" : "text-slate-600"}`}>
                  {catDone}/{items.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

const ORDER: Category[] = ["URGENT","KONTEN","FOLLOWUP","VIEWING","PIPELINE","NETWORKING"];

export function TasksPageClient() {
  const [tasks,       setTasks]       = useState<DailyTask[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);

  const markDone = (id: string) =>
    setTasks((p) => p.map((t) => {
      if (t.id !== id) return t;
      if (!t.done) toast.success("Task selesai! 🔥");
      return { ...t, done: !t.done };
    }));

  const incrTask = (id: string) =>
    setTasks((p) => p.map((t) => {
      if (t.id !== id || t.target == null) return t;
      const next = Math.min((t.current ?? 0) + 1, t.target);
      if (next >= t.target) toast.success(`Target ${t.target} tercapai! 🎯`);
      return { ...t, current: next };
    }));

  useEffect(() => {
    setTasks(buildDailyTasks(markDone, incrTask, () => setShowCatalog(true)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalDone = tasks.filter((t) => t.done || ((t.current ?? 0) >= (t.target ?? 1))).length;

  const byCategory = ORDER.reduce<Record<Category, DailyTask[]>>((a, c) => {
    a[c] = tasks.filter((t) => t.category === c);
    return a;
  }, {} as Record<Category, DailyTask[]>);

  return (
    <div className="flex min-h-screen flex-col bg-[#060810]">

      <Header tasks={tasks} totalDone={totalDone} byCategory={byCategory} />

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-6 px-4 py-6 lg:px-6 max-w-screen-xl mx-auto">

          {/* Task list */}
          <div className="flex-1 min-w-0 space-y-8">
            {ORDER.map((cat) => {
              const items = byCategory[cat] ?? [];
              if (items.length === 0) return null;
              const catDone = items.filter((t) => t.done || ((t.current ?? 0) >= (t.target ?? 1))).length;
              return (
                <div key={cat} id={`sec-${cat}`}>
                  <SectionHeader category={cat} total={items.length} done={catDone} />
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {items.map((t) => (
                        <TaskCard key={t.id} task={t} onToggle={() => markDone(t.id)} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar (desktop) */}
          <div className="hidden lg:block w-72 xl:w-80 shrink-0">
            <div className="sticky top-6"><Sidebar tasks={tasks} /></div>
          </div>
        </div>

        {/* Mobile sidebar */}
        <div className="lg:hidden px-4 pb-8">
          <Sidebar tasks={tasks} />
        </div>
      </div>

      {/* Catalog Modal */}
      <AnimatePresence>
        {showCatalog && <CatalogModal onClose={() => setShowCatalog(false)} />}
      </AnimatePresence>
    </div>
  );
}

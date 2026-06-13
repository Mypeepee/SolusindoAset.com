"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { CATALOG_LISTINGS, LISTING_ICON } from "./constants";
import { fIDR, openWA } from "./helpers";

export function CatalogModal({ onClose }: { onClose: () => void }) {
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

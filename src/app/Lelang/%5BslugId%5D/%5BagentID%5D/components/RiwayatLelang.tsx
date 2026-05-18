"use client";
import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import Image from "next/image";

interface RiwayatItem {
  id_property: string;
  judul: string;
  harga: number;
  nilai_limit_lelang: number | null;
  tanggal_lelang: string | null;
  gambar_utama: string | null;
  status_tayang: string;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  legalitas: string | null;
  nomor_legalitas: string | null;
  slug: string;
}

const formatRupiah = (val: number | null | undefined) => {
  if (val == null || isNaN(val)) return "Rp —";
  if (val >= 1_000_000_000)
    return `Rp ${(val / 1_000_000_000).toFixed(2).replace(".", ",")} M`;
  if (val >= 1_000_000)
    return `Rp ${(val / 1_000_000).toFixed(0)} Jt`;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

const formatRupiahFull = (val: number | null | undefined) => {
  if (val == null || isNaN(val)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

const formatDate = (val: string | null) => {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString("id-ID", { day: "2-digit" }),
    month: d.toLocaleDateString("id-ID", { month: "short" }).toUpperCase(),
    year: d.getFullYear().toString(),
  };
};

const STATUS_CFG: Record<string, { label: string; color: string; dot: string; border: string; bg: string }> = {
  TERSEDIA: {
    label: "AKTIF",
    color: "text-emerald-400",
    dot: "bg-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
  },
  TERJUAL: {
    label: "TERJUAL",
    color: "text-blue-400",
    dot: "bg-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
  },
  TIDAK_AKTIF: {
    label: "NONAKTIF",
    color: "text-slate-500",
    dot: "bg-slate-600",
    border: "border-slate-600/30",
    bg: "bg-slate-700/20",
  },
};

function getStatus(s: string) {
  return STATUS_CFG[s] ?? {
    label: s,
    color: "text-slate-400",
    dot: "bg-slate-400",
    border: "border-slate-600/30",
    bg: "bg-slate-700/20",
  };
}

export default function RiwayatLelang({
  idProperty,
  currentIdProperty,
}: {
  idProperty: string;
  currentIdProperty: string;
}) {
  const [riwayat, setRiwayat] = useState<RiwayatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    if (!idProperty) return;
    fetch(`/api/listing/${idProperty}/riwayat-lelang`)
      .then((r) => r.json())
      .then((data) => setRiwayat(data.riwayat ?? []))
      .catch(() => setRiwayat([]))
      .finally(() => setLoading(false));
  }, [idProperty]);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, [riwayat]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/6 bg-[#0c0c0c] p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
          <div className="space-y-2">
            <div className="h-3.5 w-36 bg-white/5 rounded animate-pulse" />
            <div className="h-2.5 w-20 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-[240px] h-[300px] rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (riwayat.length < 1) return null;

  const legalitasLabel = riwayat[0]?.legalitas ?? "";
  const nomorLegalitas = riwayat[0]?.nomor_legalitas ?? "";
  const lokasiLabel = [riwayat[0]?.kelurahan, riwayat[0]?.kecamatan, riwayat[0]?.kota]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="relative">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-orange-500/6 via-transparent to-transparent pointer-events-none" />

      <div className="relative rounded-2xl border border-white/8 bg-[#0c0c0c] overflow-hidden">
        {/* Scanline top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />

        {/* ── HEADER ── */}
        <div className="px-5 pt-5 pb-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="relative flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/15 to-red-600/10 border border-orange-500/20 flex items-center justify-center">
              <Icon icon="solar:hammer-bold-duotone" className="text-orange-400 text-lg" />
              <span className="absolute top-0 right-0 w-2 h-2 border-t border-r border-orange-500/60 rounded-tr-xl" />
              <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-orange-500/60 rounded-bl-xl" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white tracking-wide uppercase">
                  Riwayat Lelang Aset
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/25 text-orange-400 text-[10px] font-black tracking-widest">
                  {riwayat.length}×
                </span>
              </div>
              <p className="text-[10px] text-gray-600 mt-0.5 font-mono tracking-widest uppercase">
                Aset dilelang {riwayat.length} kali
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {legalitasLabel && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/8 border border-emerald-500/20 text-[10px]">
                <Icon icon="solar:shield-check-bold-duotone" className="text-emerald-400 text-xs" />
                <span className="text-emerald-400 font-bold">{legalitasLabel}</span>
                {nomorLegalitas && (
                  <span className="text-emerald-300/40 font-mono">/ {nomorLegalitas}</span>
                )}
              </div>
            )}
            {lokasiLabel && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/4 border border-white/8 text-[10px] text-gray-500">
                <Icon icon="solar:map-point-bold-duotone" className="text-gray-600 text-xs" />
                <span className="truncate max-w-[130px]">{lokasiLabel}</span>
              </div>
            )}

            {/* Scroll buttons */}
            <div className="hidden sm:flex items-center gap-1 ml-1">
              <button
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-default transition-all"
              >
                <Icon icon="solar:alt-arrow-left-linear" className="text-sm" />
              </button>
              <button
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-default transition-all"
              >
                <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
              </button>
            </div>
          </div>
        </div>

        {/* ── HORIZONTAL TIMELINE RAIL ── */}
        <div className="px-5 pt-4 pb-1">
          <div className="relative flex items-center gap-0">
            {riwayat.map((item, idx) => {
              const isLast = idx === riwayat.length - 1;
              const isCurrent = item.id_property === currentIdProperty;
              return (
                <React.Fragment key={item.id_property}>
                  {/* Node */}
                  <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                    isCurrent
                      ? "bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/50"
                      : idx < riwayat.findIndex(r => r.id_property === currentIdProperty)
                        ? "bg-[#1a1a1a] border border-white/15 text-gray-400"
                        : "bg-[#141414] border border-white/8 text-gray-600"
                  }`}>
                    {isCurrent && <span className="absolute inset-0 rounded-full bg-orange-400/25 animate-ping" />}
                    <span className="relative z-10">{idx + 1}</span>
                  </div>
                  {/* Connector line */}
                  {!isLast && (
                    <div className={`flex-1 h-px min-w-[20px] ${
                      idx < riwayat.findIndex(r => r.id_property === currentIdProperty)
                        ? "bg-white/20"
                        : isCurrent
                          ? "bg-gradient-to-r from-orange-500/60 to-white/8"
                          : "bg-white/6"
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          {/* Label row */}
          <div className="flex items-center gap-0 mt-1">
            {riwayat.map((item, idx) => {
              const isLast = idx === riwayat.length - 1;
              const isCurrent = item.id_property === currentIdProperty;
              return (
                <React.Fragment key={item.id_property}>
                  <div className="flex-shrink-0 w-8 flex justify-center">
                    <span className={`text-[8px] font-bold tracking-widest uppercase ${isCurrent ? "text-orange-400" : "text-gray-700"}`}>
                      {isCurrent ? "NOW" : `L${idx + 1}`}
                    </span>
                  </div>
                  {!isLast && <div className="flex-1 min-w-[20px]" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── CARDS HORIZONTAL SCROLL ── */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-5 pb-5 pt-3 scrollbar-hide snap-x snap-mandatory"
        >
          {riwayat.map((item, idx) => {
            const isCurrent = item.id_property === currentIdProperty;
            const statusCfg = getStatus(item.status_tayang);
            const tanggal = formatDate(item.tanggal_lelang);
            const harga = item.nilai_limit_lelang ?? item.harga;

            return (
              <Link
                key={item.id_property}
                href={`/Lelang/${item.slug}-${item.id_property}`}
                className="group flex-shrink-0 w-[240px] snap-start block"
              >
                <div className={`relative rounded-xl border overflow-hidden transition-all duration-300 h-full flex flex-col ${
                  isCurrent
                    ? "border-orange-500/40 shadow-lg shadow-orange-500/15"
                    : "border-white/8 hover:border-white/20"
                } bg-[#0e0e0e]`}>

                  {/* Corner brackets */}
                  {isCurrent && (
                    <>
                      <span className="absolute top-2 left-2 z-20 w-3 h-3 border-t-2 border-l-2 border-orange-500/70 rounded-tl" />
                      <span className="absolute top-2 right-2 z-20 w-3 h-3 border-t-2 border-r-2 border-orange-500/70 rounded-tr" />
                      <span className="absolute bottom-2 left-2 z-20 w-3 h-3 border-b-2 border-l-2 border-orange-500/70 rounded-bl" />
                      <span className="absolute bottom-2 right-2 z-20 w-3 h-3 border-b-2 border-r-2 border-orange-500/70 rounded-br" />
                    </>
                  )}

                  {/* Top accent */}
                  <div className={`absolute top-0 left-0 right-0 h-px z-10 ${
                    isCurrent
                      ? "bg-gradient-to-r from-transparent via-orange-500/80 to-transparent"
                      : "bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  }`} />

                  {/* ── IMAGE ── */}
                  <div className="relative w-full h-[130px] flex-shrink-0 overflow-hidden bg-[#111]">
                    {item.gambar_utama ? (
                      <Image
                        src={item.gambar_utama}
                        alt={item.judul}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="240px"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon icon="solar:home-bold-duotone" className="text-4xl text-white/10" />
                      </div>
                    )}

                    {/* Image overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/20 to-transparent" />

                    {/* Lelang ke-N badge — overlay on image */}
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black tracking-widest backdrop-blur-md border ${
                        isCurrent
                          ? "bg-orange-500/90 border-orange-400/50 text-white"
                          : "bg-black/60 border-white/10 text-gray-300"
                      }`}>
                        <Icon icon="solar:hammer-bold-duotone" className="text-[10px]" />
                        LELANG KE-{idx + 1}
                      </div>
                    </div>

                    {/* SAAT INI badge */}
                    {isCurrent && (
                      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 border border-orange-500/40 text-[8px] font-black text-orange-400 backdrop-blur-md tracking-widest">
                        <span className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
                        SAAT INI
                      </div>
                    )}
                  </div>

                  {/* ── CONTENT ── */}
                  <div className="p-3.5 flex flex-col flex-1">

                    {/* ID + status row */}
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-mono text-[9px] text-gray-700 tracking-widest">
                        #{item.id_property}
                      </span>
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                        <span className={`w-1 h-1 rounded-full ${statusCfg.dot} ${isCurrent ? "animate-pulse" : ""}`} />
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Judul */}
                    <p className={`text-xs font-bold leading-snug line-clamp-2 mb-3 min-h-[32px] transition-colors ${
                      isCurrent ? "text-white" : "text-gray-300 group-hover:text-white"
                    }`}>
                      {item.judul}
                    </p>

                    {/* Divider */}
                    <div className={`h-px mb-3 ${isCurrent ? "bg-orange-500/20" : "bg-white/5"}`} />

                    {/* Harga */}
                    <div className="mb-3">
                      <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${
                        isCurrent ? "text-orange-500/60" : "text-gray-700"
                      }`}>
                        Nilai Limit
                      </p>
                      <p className={`text-base font-black tracking-tight leading-none ${
                        isCurrent ? "text-orange-300" : "text-gray-200"
                      }`}>
                        {formatRupiah(harga)}
                      </p>
                      <p className="text-[8px] text-gray-700 font-mono mt-0.5 leading-none">
                        {formatRupiahFull(harga)}
                      </p>
                    </div>

                    {/* Tanggal */}
                    <div className="mt-auto">
                      <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${
                        isCurrent ? "text-orange-500/60" : "text-gray-700"
                      }`}>
                        Tanggal Lelang
                      </p>
                      {tanggal ? (
                        <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${
                          isCurrent
                            ? "bg-orange-500/8 border-orange-500/20"
                            : "bg-white/3 border-white/6"
                        }`}>
                          <Icon
                            icon="solar:calendar-date-bold-duotone"
                            className={`text-lg flex-shrink-0 ${isCurrent ? "text-orange-400" : "text-gray-600"}`}
                          />
                          <div>
                            <p className={`text-xs font-black leading-none ${isCurrent ? "text-white" : "text-gray-300"}`}>
                              {tanggal.day} {tanggal.month} {tanggal.year}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/3 border border-white/6">
                          <Icon icon="solar:calendar-minimalistic-bold-duotone" className="text-gray-700 text-lg" />
                          <p className="text-[10px] text-gray-700 font-mono">Belum dijadwalkan</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hover shimmer */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/2 via-transparent to-transparent pointer-events-none" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── FOOTER ── */}
        <div className="mx-5 mb-5 px-3.5 py-2.5 rounded-xl bg-white/3 border border-white/5 flex items-start gap-2">
          <Icon icon="solar:graph-up-bold-duotone" className="text-orange-400/50 text-sm flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-600 leading-relaxed">
            {legalitasLabel && nomorLegalitas
              ? (
                <>
                  Aset <span className="text-white/60 font-semibold">{legalitasLabel} No. {nomorLegalitas}</span>
                  {lokasiLabel && <> di {lokasiLabel}</>} dilelang{" "}
                  <span className="text-orange-400 font-bold">{riwayat.length}×</span>.
                  {" "}Semakin sering dilelang, semakin besar peluang harga lebih fleksibel.
                </>
              )
              : <>Aset ini tercatat dilelang <span className="text-orange-400 font-bold">{riwayat.length}×</span>.</>
            }
          </p>
        </div>

        {/* Bottom scanline */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />
      </div>
    </div>
  );
}

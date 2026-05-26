"use client";
import React, { useEffect, useState } from "react";
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
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  TERSEDIA: {
    label: "Tersedia",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  TERJUAL: {
    label: "Terjual",
    dot: "bg-blue-400",
    text: "text-blue-300",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  TIDAK_AKTIF: {
    label: "Tidak Aktif",
    dot: "bg-slate-500",
    text: "text-slate-400",
    bg: "bg-slate-700/30",
    border: "border-slate-600/20",
  },
};

const getStatus = (s: string) =>
  STATUS_CFG[s] ?? {
    label: s,
    dot: "bg-slate-500",
    text: "text-slate-400",
    bg: "bg-slate-700/30",
    border: "border-slate-600/20",
  };

export default function RiwayatLelang({
  idProperty,
  currentIdProperty,
}: {
  idProperty: string;
  currentIdProperty: string;
}) {
  const [riwayat, setRiwayat] = useState<RiwayatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idProperty) return;
    fetch(`/api/listing/${idProperty}/riwayat-lelang`)
      .then((r) => r.json())
      .then((data) => setRiwayat(data.riwayat ?? []))
      .catch(() => setRiwayat([]))
      .finally(() => setLoading(false));
  }, [idProperty]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 space-y-4 animate-pulse">
        <div className="flex gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/5" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-40 bg-white/5 rounded-lg" />
            <div className="h-3 w-24 bg-white/5 rounded-lg" />
          </div>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-white/5" />
        ))}
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
    <div className="relative group/section">
      {/* Ambient glow */}
      <div className="absolute -inset-6 bg-orange-500/3 rounded-[3rem] blur-3xl pointer-events-none opacity-0 group-hover/section:opacity-100 transition-opacity duration-700" />

      <div className="relative space-y-5">
        {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Icon block */}
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500/25 to-red-600/15 border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/15">
                <Icon icon="solar:diagram-down-bold-duotone" className="text-orange-400 text-xl" />
              </div>
              <div className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-md shadow-orange-500/50 ring-2 ring-[#0f0f0f]">
                {riwayat.length}
              </div>
            </div>

            <div>
              <h3 className="text-base font-black text-white tracking-tight">
                Riwayat Lelang Aset
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tercatat dilelang{" "}
                <span className="text-orange-400 font-bold">{riwayat.length}×</span> dengan aset identik
              </p>
            </div>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            {legalitasLabel && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 backdrop-blur-sm">
                <Icon icon="solar:shield-check-bold-duotone" className="text-emerald-400 text-sm flex-shrink-0" />
                <span className="text-xs font-bold text-emerald-300">{legalitasLabel}</span>
                {nomorLegalitas && (
                  <span className="text-[10px] text-emerald-400/50 font-mono">
                    {nomorLegalitas}
                  </span>
                )}
              </div>
            )}
            {lokasiLabel && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8 backdrop-blur-sm">
                <Icon icon="solar:map-point-bold-duotone" className="text-slate-400 text-sm flex-shrink-0" />
                <span className="text-xs text-slate-300 truncate max-w-[150px]">{lokasiLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── TIMELINE ───────────────────────────────────────── */}
        <div className="relative">
          {/* Connecting line */}
          {riwayat.length > 1 && (
            <div
              className="absolute left-[22px] top-10 bottom-10 w-px pointer-events-none"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(249,115,22,0.5), rgba(249,115,22,0.15), transparent)",
              }}
            />
          )}

          <div className="space-y-4">
            {riwayat.map((item, idx) => {
              const isCurrent = item.id_property === currentIdProperty;
              const statusCfg = getStatus(item.status_tayang);
              const tanggal = formatDate(item.tanggal_lelang);
              const harga = item.nilai_limit_lelang ?? item.harga;

              return (
                <Link
                  key={item.id_property}
                  href={`/Lelang/${item.slug}-${item.id_property}`}
                  className="block group/card"
                >
                  <div className="flex gap-4 items-start">
                    {/* Timeline node */}
                    <div className="flex-shrink-0 flex flex-col items-center pt-5">
                      <div
                        className={`relative w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-300 ${
                          isCurrent
                            ? "bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/40"
                            : "bg-slate-800/80 text-slate-400 border border-slate-700/60 group-hover/card:border-orange-500/30 group-hover/card:text-orange-300"
                        }`}
                      >
                        {isCurrent && (
                          <div className="absolute inset-0 rounded-2xl bg-orange-500/30 animate-ping opacity-75" />
                        )}
                        <span className="relative">{idx + 1}</span>
                      </div>
                    </div>

                    {/* Card */}
                    <div
                      className={`relative flex-1 rounded-2xl overflow-hidden border transition-all duration-300 ${
                        isCurrent
                          ? "border-orange-500/35 shadow-xl shadow-orange-500/8"
                          : "border-white/6 group-hover/card:border-white/12 group-hover/card:shadow-lg group-hover/card:shadow-black/40"
                      }`}
                      style={{
                        background: isCurrent
                          ? "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(17,24,39,0.95) 50%, rgba(15,23,42,0.98) 100%)"
                          : "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(15,23,42,0.90) 100%)",
                      }}
                    >
                      {/* Top edge accent line for current */}
                      {isCurrent && (
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
                      )}

                      <div className="flex min-h-[130px]">
                        {/* Image */}
                        <div className="relative w-36 sm:w-44 shrink-0 overflow-hidden">
                          {item.gambar_utama ? (
                            <>
                              <Image
                                src={item.gambar_utama}
                                alt={item.judul}
                                fill
                                className="object-cover transition-transform duration-700 group-hover/card:scale-105"
                                sizes="(max-width: 640px) 144px, 176px"
                                unoptimized
                              />
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-900/70" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800/60">
                              <Icon icon="solar:home-2-bold-duotone" className="text-4xl text-slate-700" />
                            </div>
                          )}

                          {/* SAAT INI overlay on image */}
                          {isCurrent && (
                            <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500 shadow-md shadow-orange-500/50 backdrop-blur-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              <span className="text-[9px] font-black text-white tracking-wide">SAAT INI</span>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                          <div>
                            {/* Top row: ID + Status */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] text-slate-600 font-mono tracking-wider">
                                #{item.id_property}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${statusCfg.bg} ${statusCfg.text} border ${statusCfg.border}`}
                              >
                                <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />
                                {statusCfg.label}
                              </span>
                            </div>

                            {/* Title */}
                            <p className="text-xs font-semibold text-slate-200 line-clamp-2 leading-relaxed mb-3">
                              {item.judul}
                            </p>
                          </div>

                          <div>
                            {/* Price */}
                            <p
                              className={`text-sm font-black mb-2 ${
                                isCurrent ? "text-orange-300" : "text-white"
                              }`}
                            >
                              {formatRupiah(harga)}
                            </p>

                            {/* Date */}
                            <div className="flex items-center gap-1.5">
                              <Icon
                                icon="solar:calendar-date-bold-duotone"
                                className="text-slate-600 text-xs flex-shrink-0"
                              />
                              {tanggal ? (
                                <span className="text-[10px] text-slate-400">{tanggal}</span>
                              ) : (
                                <span className="text-[10px] text-slate-600 italic">Belum dijadwalkan</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hover arrow */}
                      <div className="absolute right-3 top-3 opacity-0 group-hover/card:opacity-100 transition-all duration-200 translate-x-1 group-hover/card:translate-x-0">
                        <div className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center">
                          <Icon icon="solar:arrow-right-up-linear" className="text-white text-xs" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── FOOTER NOTE ────────────────────────────────────── */}
        {legalitasLabel && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-orange-500/4 border border-orange-500/12">
            <div className="w-7 h-7 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon icon="solar:info-circle-bold-duotone" className="text-orange-400 text-sm" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Aset dengan sertifikat{" "}
              <span className="text-white font-semibold">{legalitasLabel}</span>
              {nomorLegalitas && (
                <span className="text-slate-300"> No. {nomorLegalitas}</span>
              )}{" "}
              di <span className="text-slate-300">{lokasiLabel}</span> tercatat dilelang{" "}
              <span className="text-orange-300 font-bold">{riwayat.length}×</span>.{" "}
              Semakin sering dilelang, semakin besar peluang harga lebih fleksibel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

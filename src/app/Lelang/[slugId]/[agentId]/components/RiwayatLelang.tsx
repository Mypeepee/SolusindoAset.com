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
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  TERSEDIA: {
    label: "Tersedia",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    icon: "solar:clock-circle-bold-duotone",
  },
  TERJUAL: {
    label: "Terjual",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/25",
    icon: "solar:check-circle-bold-duotone",
  },
  TIDAK_AKTIF: {
    label: "Tidak Aktif",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/25",
    icon: "solar:close-circle-bold-duotone",
  },
};

function getStatus(s: string) {
  return STATUS_STYLE[s] ?? {
    label: s,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/25",
    icon: "solar:info-circle-bold-duotone",
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

  useEffect(() => {
    if (!idProperty) return;
    fetch(`/api/listing/${idProperty}/riwayat-lelang`)
      .then((r) => r.json())
      .then((data) => {
        console.log("[RiwayatLelang] hasil:", data.riwayat?.length, data.riwayat);
        setRiwayat(data.riwayat ?? []);
      })
      .catch((err) => {
        console.error("[RiwayatLelang] fetch error:", err);
        setRiwayat([]);
      })
      .finally(() => setLoading(false));
  }, [idProperty]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-2xl p-6 animate-pulse">
        <div className="h-5 w-48 bg-slate-700/50 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-800/40 rounded-xl h-44" />
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
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-orange-500/5 via-transparent to-red-500/5 pointer-events-none" />

      <div className="relative bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/40 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 border-b border-slate-700/30">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/10">
                <Icon icon="solar:hammer-bold-duotone" className="text-orange-400 text-xl" />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-md">
                  {riwayat.length}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Riwayat Lelang Aset Ini</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Aset ini tercatat dilelang{" "}
                  <span className="text-orange-400 font-bold">{riwayat.length}x</span>
                </p>
              </div>
            </div>

            {/* Identifier tags */}
            <div className="flex flex-wrap items-center gap-2">
              {legalitasLabel && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                  <Icon icon="solar:shield-check-bold-duotone" className="text-emerald-400 text-sm" />
                  <span className="text-emerald-400 font-bold">{legalitasLabel}</span>
                  {nomorLegalitas && (
                    <span className="text-emerald-300/70 font-semibold">No. {nomorLegalitas}</span>
                  )}
                </div>
              )}
              {lokasiLabel && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/40 border border-slate-600/30 text-xs text-slate-300">
                  <Icon icon="solar:map-point-bold-duotone" className="text-slate-400 text-sm" />
                  <span className="truncate max-w-[160px]">{lokasiLabel}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cards grid */}
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {riwayat.map((item, idx) => {
              const isCurrent = item.id_property === currentIdProperty;
              const statusCfg = getStatus(item.status_tayang);
              const tanggal = formatDate(item.tanggal_lelang);
              const urutan = idx + 1;

              return (
                <Link
                  key={item.id_property}
                  href={`/Lelang/${item.slug}-${item.id_property}`}
                  className={`group relative rounded-xl overflow-hidden border transition-all duration-300 ${
                    isCurrent
                      ? "border-orange-500/50 ring-1 ring-orange-500/30 shadow-lg shadow-orange-500/15"
                      : "border-slate-700/40 hover:border-slate-500/60 hover:shadow-lg hover:shadow-black/30"
                  } bg-slate-900/60`}
                >
                  {/* Current indicator */}
                  {isCurrent && (
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500 text-[9px] font-black text-white shadow-md shadow-orange-500/40">
                      <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                      SAAT INI
                    </div>
                  )}

                  {/* Urutan badge */}
                  <div className={`absolute top-2 right-2 z-20 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-md ${
                    isCurrent
                      ? "bg-orange-500 text-white"
                      : "bg-slate-800/90 text-slate-300 border border-slate-600/50"
                  }`}>
                    {urutan}
                  </div>

                  {/* Image */}
                  <div className="relative w-full h-[100px] bg-slate-800 overflow-hidden">
                    {item.gambar_utama ? (
                      <Image
                        src={item.gambar_utama}
                        alt={item.judul}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, 33vw"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <Icon icon="solar:home-bold-duotone" className="text-3xl text-slate-600" />
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    {/* ID listing */}
                    <div className="flex items-center gap-1 mb-1.5">
                      <Icon icon="solar:hashtag-bold" className="text-slate-500 text-[10px]" />
                      <span className="text-[10px] text-slate-500 font-mono">
                        ID {item.id_property}
                      </span>
                    </div>

                    {/* Judul */}
                    <p className="text-xs font-bold text-white leading-snug line-clamp-2 mb-2 min-h-[32px]">
                      {item.judul}
                    </p>

                    {/* Harga */}
                    <p className="text-sm font-black text-white mb-2">
                      {formatRupiah(item.nilai_limit_lelang ?? item.harga)}
                    </p>

                    {/* Tanggal + Status */}
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      {tanggal ? (
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Icon icon="solar:calendar-bold-duotone" className="text-slate-500 text-xs" />
                          <span>{tanggal}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600">— Belum dijadwalkan</span>
                      )}

                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${statusCfg.bg} ${statusCfg.color} border ${statusCfg.border}`}>
                        <Icon icon={statusCfg.icon} className="text-[9px]" />
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-orange-500/5 border border-orange-500/15">
            <Icon icon="solar:info-circle-bold-duotone" className="text-orange-400 text-base flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Aset dengan{" "}
              <span className="text-white font-semibold">
                {legalitasLabel} No. {nomorLegalitas}
              </span>{" "}
              di {lokasiLabel} tercatat dilelang{" "}
              <span className="text-orange-300 font-bold">{riwayat.length} kali</span>.
              Semakin sering dilelang, semakin besar peluang harga lebih fleksibel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

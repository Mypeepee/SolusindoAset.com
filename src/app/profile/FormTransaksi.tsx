"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================
type TransaksiStatus = "proses" | "active" | "completed" | "cancelled";

type TransaksiItem = {
  id_transaksi: string;
  judul: string;
  slug: string | null;
  gambar: string | null;
  lokasi: string;
  jenis_transaksi: string;
  tipe_komisi: string;
  tanggal_transaksi: string | null;
  harga_deal: string | null;
  agent_nama: string;
  status: TransaksiStatus;
};

type StatusFilter = "all" | TransaksiStatus;

// =============================================================================
// HELPERS
// =============================================================================
const formatDate = (value: string | null) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "-";
  }
};

const JENIS_LABEL: Record<string, string> = {
  PRIMARY: "Jual Primary",
  SECONDARY: "Jual Secondary",
  LELANG: "Lelang",
  SEWA: "Sewa",
  CESSIE: "Cessie",
};

const detailHref = (item: TransaksiItem) => {
  if (!item.slug) return "#";
  return item.jenis_transaksi === "LELANG"
    ? `/Lelang/${item.slug}`
    : `/Jual/${item.slug}`;
};

// =============================================================================
// STATUS BADGE
// =============================================================================
const STATUS_STYLES: Record<
  TransaksiStatus,
  { bg: string; text: string; border: string; glow: string; label: string; icon: string }
> = {
  proses: {
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    border: "border-amber-400/30",
    glow: "shadow-[0_0_18px_rgba(251,191,36,0.18)]",
    label: "Sedang Diproses",
    icon: "solar:hourglass-line-bold-duotone",
  },
  active: {
    bg: "bg-[#86efac]/10",
    text: "text-[#86efac]",
    border: "border-[#86efac]/30",
    glow: "shadow-[0_0_18px_rgba(134,239,172,0.18)]",
    label: "Sedang Berjalan",
    icon: "solar:rocket-2-bold-duotone",
  },
  completed: {
    bg: "bg-sky-500/10",
    text: "text-sky-300",
    border: "border-sky-400/30",
    glow: "shadow-[0_0_18px_rgba(56,189,248,0.18)]",
    label: "Selesai",
    icon: "solar:verified-check-bold-duotone",
  },
  cancelled: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    glow: "shadow-[0_0_18px_rgba(248,113,113,0.18)]",
    label: "Dibatalkan",
    icon: "solar:close-circle-bold-duotone",
  },
};

const StatusBadge = ({ status }: { status: TransaksiStatus }) => {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border backdrop-blur-sm ${style.bg} ${style.text} ${style.border} ${style.glow}`}
    >
      <Icon icon={style.icon} className="text-sm" />
      {style.label}
    </span>
  );
};

// =============================================================================
// FILTER CHIP
// =============================================================================
const FilterChip = ({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: StatusFilter;
  active: boolean;
  onClick: (v: StatusFilter) => void;
}) => (
  <button
    type="button"
    onClick={() => onClick(value)}
    className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold border transition-all duration-300 ${
      active
        ? "bg-gradient-to-r from-[#86efac] to-[#6ee7b7] text-black border-transparent shadow-[0_0_20px_rgba(134,239,172,0.35)]"
        : "bg-white/[0.03] text-gray-400 border-white/10 hover:border-[#86efac]/40 hover:text-[#86efac] hover:bg-white/[0.06]"
    }`}
  >
    {label}
  </button>
);

// =============================================================================
// SKELETON LOADER
// =============================================================================
const CardSkeleton = () => (
  <div className="rounded-2xl border border-white/5 bg-[#181818] p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-6 overflow-hidden relative animate-pulse">
    <div className="w-full sm:w-32 h-32 rounded-xl bg-white/5 shrink-0" />
    <div className="flex-1 space-y-3">
      <div className="h-4 w-2/3 bg-white/5 rounded-full" />
      <div className="h-3 w-1/3 bg-white/5 rounded-full" />
      <div className="h-10 w-full max-w-sm bg-white/5 rounded-xl" />
    </div>
    <div className="w-32 space-y-2 hidden sm:block">
      <div className="h-3 w-full bg-white/5 rounded-full" />
      <div className="h-5 w-full bg-white/5 rounded-full" />
    </div>
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const BookingHistory = () => {
  const [items, setItems] = useState<TransaksiItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const itemsPerPage = 3;

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/profile/transaksi");
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Gagal memuat data");
        setItems(json.data as TransaksiItem[]);
      } catch (err: any) {
        setError(err.message || "Gagal memuat riwayat transaksi.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredItems =
    statusFilter === "all"
      ? items
      : items.filter((item) => item.status === statusFilter);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const currentData = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const handleNext = () => {
    if (safePage < totalPages) setCurrentPage(safePage + 1);
  };

  const handlePrev = () => {
    if (safePage > 1) setCurrentPage(safePage - 1);
  };

  const handleChangeFilter = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Riwayat Transaksi
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#86efac] shadow-[0_0_10px_rgba(134,239,172,0.8)]" />
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Pantau seluruh transaksi properti dan status terkininya.
          </p>
          <p className="text-[11px] text-gray-500 mt-1 font-mono">
            Total {filteredItems.length} transaksi
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <FilterChip label="Semua" value="all" active={statusFilter === "all"} onClick={handleChangeFilter} />
          <FilterChip label="Diproses" value="proses" active={statusFilter === "proses"} onClick={handleChangeFilter} />
          <FilterChip label="Berjalan" value="active" active={statusFilter === "active"} onClick={handleChangeFilter} />
          <FilterChip label="Selesai" value="completed" active={statusFilter === "completed"} onClick={handleChangeFilter} />
          <FilterChip label="Dibatalkan" value="cancelled" active={statusFilter === "cancelled"} onClick={handleChangeFilter} />
        </div>
      </div>

      {/* LOADING STATE */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {/* ERROR STATE */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-16 bg-[#181818] rounded-2xl border border-red-500/20 min-h-[220px] text-center px-6">
          <Icon icon="solar:danger-triangle-bold-duotone" className="text-4xl text-red-400 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Gagal memuat data</h3>
          <p className="text-xs text-gray-400 max-w-xs">{error}</p>
        </div>
      )}

      {/* LIST */}
      {!isLoading && !error && currentData.length > 0 && (
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {currentData.map((item) => {
              const style = STATUS_STYLES[item.status];
              return (
                <motion.div
                  key={item.id_transaksi}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className={`group relative overflow-hidden rounded-2xl border border-white/5 bg-[#181818] p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-6 transition-colors duration-300 hover:border-white/10`}
                >
                  {/* Accent gradient on hover */}
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-[#86efac]/[0.04] via-transparent to-transparent transition-opacity duration-500" />
                  {/* top accent line colored by status */}
                  <div
                    className={`pointer-events-none absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
                      item.status === "active"
                        ? "via-[#86efac]"
                        : item.status === "proses"
                          ? "via-amber-400"
                          : item.status === "completed"
                            ? "via-sky-400"
                            : "via-red-400"
                    } to-transparent opacity-40 group-hover:opacity-80 transition-opacity duration-500`}
                  />

                  {/* 1. IMAGE THUMBNAIL */}
                  <div className="relative w-full sm:w-32 h-32 sm:h-32 rounded-xl overflow-hidden shrink-0 bg-white/5">
                    {item.gambar ? (
                      <Image
                        src={item.gambar}
                        alt={item.judul}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon icon="solar:home-2-bold-duotone" className="text-3xl text-gray-600" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/60 border border-white/10 text-[9px] font-mono text-gray-200 backdrop-blur-sm">
                      {item.id_transaksi}
                    </div>
                  </div>

                  {/* 2. DETAIL INFO */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h3 className="text-base sm:text-lg font-bold text-white leading-tight group-hover:text-[#86efac] transition-colors truncate">
                          {item.judul}
                        </h3>
                        <StatusBadge status={item.status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {item.lokasi && (
                          <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400">
                            <Icon icon="solar:map-point-bold" className="text-gray-500" />
                            <span className="truncate">{item.lokasi}</span>
                          </div>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-gray-300 tracking-wide">
                          <Icon icon="solar:tag-price-bold" className="text-[#86efac] text-xs" />
                          {JENIS_LABEL[item.jenis_transaksi] ?? item.jenis_transaksi}
                        </span>
                      </div>

                      {/* INFO GRID */}
                      <div className="inline-flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-gray-400 bg-white/5 px-3 py-2.5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-1.5">
                          <Icon icon="solar:user-id-bold" className="text-[#86efac]" />
                          <div className="flex flex-col leading-none">
                            <span className="text-[10px] text-gray-500">Agent</span>
                            <span className="text-[11px] text-white font-semibold truncate max-w-[120px]">
                              {item.agent_nama}
                            </span>
                          </div>
                        </div>
                        <span className="hidden sm:inline w-px h-6 bg-white/10" />
                        <div className="flex items-center gap-1.5">
                          <Icon icon="solar:calendar-bold" className="text-orange-400" />
                          <div className="flex flex-col leading-none">
                            <span className="text-[10px] text-gray-500">Tanggal</span>
                            <span className="text-[11px] text-white font-semibold">
                              {formatDate(item.tanggal_transaksi)}
                            </span>
                          </div>
                        </div>
                        <span className="hidden sm:inline w-px h-6 bg-white/10" />
                        <div className="flex items-center gap-1.5">
                          <Icon icon="solar:wallet-bold" className="text-sky-400" />
                          <div className="flex flex-col leading-none">
                            <span className="text-[10px] text-gray-500">Tipe Komisi</span>
                            <span className="text-[11px] text-white font-semibold capitalize truncate max-w-[120px]">
                              {item.tipe_komisi || "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. PRICE & ACTION */}
                  <div className="flex flex-row sm:flex-col items-end justify-between sm:justify-center gap-3 sm:border-l sm:border-white/5 sm:pl-5">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 mb-0.5">Nilai Transaksi</p>
                      <p className="text-lg font-extrabold text-[#86efac] tracking-tight">
                        {item.harga_deal ? formatCurrency(item.harga_deal) : "-"}
                      </p>
                    </div>

                    <Link
                      href={detailHref(item)}
                      className="px-5 py-2.5 rounded-lg border border-white/10 text-xs sm:text-sm text-white font-semibold hover:bg-white/5 hover:border-[#86efac]/30 transition-all w-fit inline-flex items-center gap-1.5"
                    >
                      <Icon icon="solar:document-text-bold" className="text-sm" />
                      <span>Lihat Detail</span>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* EMPTY STATE */}
      {!isLoading && !error && filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-[#181818] rounded-2xl border border-white/5 min-h-[260px] text-center px-6">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
            <Icon icon="solar:clipboard-list-bold-duotone" className="text-3xl text-gray-600" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            Belum ada transaksi untuk filter ini
          </h3>
          <p className="text-xs text-gray-400 max-w-xs">
            Semua riwayat transaksi propertimu akan muncul di sini.
          </p>
        </div>
      )}

      {/* PAGINATION */}
      {!isLoading && !error && filteredItems.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6 border-t border-white/5 mt-2">
          <button
            onClick={handlePrev}
            disabled={safePage === 1}
            className="p-2 rounded-lg bg-white/5 text-white disabled:opacity-30 hover:bg-[#86efac] hover:text-black transition-all"
          >
            <Icon icon="solar:alt-arrow-left-bold" />
          </button>

          <span className="text-sm font-bold text-gray-400 px-4">
            Halaman <span className="text-white">{safePage}</span> dari {totalPages}
          </span>

          <button
            onClick={handleNext}
            disabled={safePage === totalPages}
            className="p-2 rounded-lg bg-white/5 text-white disabled:opacity-30 hover:bg-[#86efac] hover:text-black transition-all"
          >
            <Icon icon="solar:alt-arrow-right-bold" />
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default BookingHistory;

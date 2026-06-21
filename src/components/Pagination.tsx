"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { getPaginationPages } from "@/lib/pagination";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPage: (page: number) => void;
  /** Margin atas wrapper (default mt-16). */
  className?: string;
}

/**
 * Pagination publik (gaya pill gelap) — SATU sumber kebenaran, dipakai di
 * /Jual, /Lelang, /Sewa, /properti.
 *
 * Deret nomor mengikuti pola situs besar: current ± tetangga + halaman pertama
 * & terakhir dengan ellipsis (mis. page 3 → `1 2 3 4 5 … 6708`). Ukuran tombol
 * responsif — mengecil di mobile supaya seluruh deret muat dalam satu baris
 * tanpa pernah melebihi lebar layar (deret maksimal 7 token).
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPage,
  className = "mt-16",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPaginationPages(currentPage, totalPages);

  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    if (next !== currentPage) onPage(next);
  };

  return (
    <div className={`flex justify-center px-4 ${className}`}>
      <nav
        aria-label="Pagination"
        className="flex items-center gap-0.5 sm:gap-1.5 bg-[#1A1A1A] p-1.5 sm:p-2 rounded-full border border-white/10 shadow-2xl max-w-full"
      >
        <button
          onClick={() => go(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Halaman sebelumnya"
          className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Icon icon="solar:alt-arrow-left-linear" className="text-lg sm:text-xl" />
        </button>

        {pages.map((p, i) =>
          p === "..." ? (
            <span
              key={`gap-${i}`}
              className="shrink-0 w-4 sm:w-7 text-center text-gray-600 select-none text-xs sm:text-sm"
            >
              …
            </span>
          ) : (
            <button
              key={`pg-${p}`}
              onClick={() => go(p as number)}
              aria-current={p === currentPage ? "page" : undefined}
              className={`shrink-0 h-8 sm:h-10 min-w-[1.75rem] sm:min-w-[2.5rem] px-1.5 sm:px-2 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 ${
                p === currentPage
                  ? "bg-primary text-black shadow-[0_0_15px_rgba(74,222,128,0.4)] scale-105 sm:scale-110"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => go(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Halaman berikutnya"
          className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Icon icon="solar:alt-arrow-right-linear" className="text-lg sm:text-xl" />
        </button>
      </nav>
    </div>
  );
}

"use client";

import React from "react";
import { Icon } from "@iconify/react";
import type { PaginationData } from "../types";
import { getPaginationPages } from "@/lib/pagination";

interface KategoriPaginationProps {
  pagination: PaginationData;
  onPage: (page: number) => void;
}

export default function KategoriPagination({
  pagination,
  onPage,
}: KategoriPaginationProps) {
  const { currentPage, totalPages } = pagination;
  if (totalPages <= 1) return null;

  const pages = getPaginationPages(currentPage, totalPages);

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
            <span key={`e${i}`} className="text-gray-600 px-1">
              ...
            </span>
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
}

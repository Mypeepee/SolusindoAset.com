"use client";

import React, { useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import KategoriHero from "./components/KategoriHero";
import KategoriFilterBar from "./components/KategoriFilterBar";
import KategoriGrid from "./components/KategoriGrid";
import type { KategoriPageProps } from "./types";

export default function KategoriPageClient({
  slug,
  label,
  initialData,
  pagination,
  activeTipe,
  activeSort,
  tabCounts,
}: KategoriPageProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();
  const gridRef  = useRef<HTMLDivElement>(null);

  const navigate = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(sp.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="bg-[#0F0F0F] min-h-screen pb-24">
      <KategoriHero slug={slug} label={label} tabCounts={tabCounts} />

      <KategoriFilterBar
        activeTipe={activeTipe}
        activeSort={activeSort}
        tabCounts={tabCounts}
        onTipeChange={(t) => navigate({ tipe: t, page: undefined })}
        onSortChange={(s) => navigate({ sort: s, page: undefined })}
      />

      <div
        className="container mx-auto max-w-screen-xl px-5 sm:px-8 md:px-10 mt-5"
        ref={gridRef}
      >
        <KategoriGrid
          items={initialData}
          pagination={pagination}
          activeTipe={activeTipe}
          onPage={(p) => navigate({ page: String(p) })}
          onResetTipe={() => navigate({ tipe: undefined, page: undefined })}
        />
      </div>

      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}

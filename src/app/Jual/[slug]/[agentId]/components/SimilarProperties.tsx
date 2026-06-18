"use client";

import React, { useRef } from "react";
import { Icon } from "@iconify/react";
import PropertyCard from "@/app/properti/[slug]/components/PropertyCard";
import type { PropertyItem } from "@/app/properti/[slug]/types";

interface SimilarPropertiesProps {
  items?: PropertyItem[];
}

export default function SimilarProperties({ items = [] }: SimilarPropertiesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tidak ada properti relevan → jangan render apa pun.
  if (!items.length) return null;

  const scrollByCard = (dir: number) =>
    scrollRef.current?.scrollBy({ left: dir * 350, behavior: "smooth" });

  return (
    <section className="container mx-auto px-4 mt-10 pt-8 border-t border-white/5 mb-12">
      {/* HEADER */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            <Icon
              icon="solar:magnifer-zoom-in-bold-duotone"
              className="text-[#86efac]"
            />
            Properti Serupa
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Pilihan paling relevan berdasarkan lokasi, tipe &amp; harga
          </p>
        </div>

        {/* Scroll controls (desktop) */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            aria-label="Sebelumnya"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition-all hover:border-[#86efac]/50 hover:bg-[#86efac]/10 hover:text-[#86efac]"
          >
            <Icon icon="solar:alt-arrow-left-linear" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            aria-label="Berikutnya"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition-all hover:border-[#86efac]/50 hover:bg-[#86efac]/10 hover:text-[#86efac]"
          >
            <Icon icon="solar:alt-arrow-right-linear" />
          </button>
        </div>
      </div>

      {/* SCROLLABLE CARDS — kartu sama persis dengan listing primary/secondary */}
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scrollbar-hide pb-6 -mx-4 px-4 md:mx-0 md:px-0"
      >
        {items.map((item) => (
          <div
            key={item.id_property}
            className="w-[290px] shrink-0 snap-start sm:w-[330px]"
          >
            <PropertyCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

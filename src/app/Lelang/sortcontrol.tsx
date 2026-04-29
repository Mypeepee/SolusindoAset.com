"use client";
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SortControl = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const BASE_URL = "/Lelang";

  const sortOptions = [
    { value: "auction_asc", label: "Lelang Terdekat", icon: "solar:calendar-minimalistic-bold-duotone" },
    { value: "auction_desc", label: "Lelang Terjauh", icon: "solar:calendar-minimalistic-bold-duotone" },
    { value: "price_asc", label: "Harga Termurah", icon: "solar:sort-by-time-bold-duotone" },
    { value: "price_desc", label: "Harga Tertinggi", icon: "solar:sort-by-time-bold-duotone" },
    { value: "land_desc", label: "Luas Terbesar", icon: "solar:ruler-angular-bold-duotone" },
    { value: "land_asc", label: "Luas Terkecil", icon: "solar:ruler-angular-bold-duotone" },
  ];

  const currentSort = searchParams.get("sort") || "auction_asc";
  const currentLabel = sortOptions.find(opt => opt.value === currentSort)?.label || "Urutkan";

  const updateSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.set("page", "1");
    router.push(`${BASE_URL}?${params.toString()}`, { scroll: false });
    setIsOpen(false);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3">
        {/* Sort Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-4 md:px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 rounded-xl transition-all text-sm md:text-base font-medium text-white"
          >
            <Icon icon="solar:sort-bold-duotone" className="text-emerald-400 text-lg" />
            <span>{currentLabel}</span>
            <Icon
              icon="solar:alt-arrow-down-linear"
              className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-64 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateSort(option.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      currentSort === option.value
                        ? "bg-emerald-500/10 text-emerald-400 font-bold"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon icon={option.icon} className="text-lg" />
                    <span>{option.label}</span>
                    {currentSort === option.value && (
                      <Icon icon="solar:check-circle-bold" className="ml-auto text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Quick Filter Badges (Optional) */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Quick:</span>
          <button
            onClick={() => updateSort("auction_asc")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              currentSort === "auction_asc"
                ? "bg-emerald-500 text-black"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10"
            }`}
          >
            Terdekat
          </button>
          <button
            onClick={() => updateSort("price_asc")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              currentSort === "price_asc"
                ? "bg-emerald-500 text-black"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10"
            }`}
          >
            Termurah
          </button>
        </div>
      </div>
    </div>
  );
};

export default SortControl;

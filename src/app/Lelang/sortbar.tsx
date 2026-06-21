"use client";
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Konfigurasi ────────────────────────────────────────────────────────────
// Ketiga grup menulis ke SATU param `sort` (mutually exclusive). Hanya satu
// opsi yang bisa aktif pada satu waktu — UI mencerminkan ini: chip yang grupnya
// aktif diberi warna aksen + nilai terpilih, sisanya netral.

type AccentKey = "emerald" | "blue" | "purple";

const ACCENT: Record<
  AccentKey,
  { text: string; chipBg: string; chipBorder: string; dot: string; optBg: string; optText: string }
> = {
  emerald: { text: "text-emerald-300", chipBg: "bg-emerald-500/10", chipBorder: "border-emerald-500/40", dot: "bg-emerald-400", optBg: "bg-emerald-500/12", optText: "text-emerald-300" },
  blue:    { text: "text-blue-300",    chipBg: "bg-blue-500/10",    chipBorder: "border-blue-500/40",    dot: "bg-blue-400",    optBg: "bg-blue-500/12",    optText: "text-blue-300" },
  purple:  { text: "text-purple-300",  chipBg: "bg-purple-500/10",  chipBorder: "border-purple-500/40",  dot: "bg-purple-400",  optBg: "bg-purple-500/12",  optText: "text-purple-300" },
};

interface SortOption { value: string; label: string; icon: string; hint: string }
interface SortGroup {
  key: string;
  label: string;
  icon: string;
  accent: AccentKey;
  align: "left" | "center" | "right";
  options: SortOption[];
}

const GROUPS: SortGroup[] = [
  {
    key: "tanggal", label: "Tanggal", icon: "solar:calendar-minimalistic-bold-duotone", accent: "emerald", align: "left",
    options: [
      { value: "lelang-terdekat", label: "Terdekat", icon: "solar:alarm-bold",       hint: "Jadwal lelang paling dekat" },
      { value: "lelang-terjauh",  label: "Terjauh",  icon: "solar:alarm-sleep-bold", hint: "Jadwal lelang paling jauh" },
      { value: "lelang-berlalu",  label: "Berlalu",  icon: "solar:history-bold",     hint: "Lelang yang sudah lewat" },
    ],
  },
  {
    key: "harga", label: "Harga", icon: "solar:wallet-money-bold-duotone", accent: "blue", align: "center",
    options: [
      { value: "termurah", label: "Termurah", icon: "solar:sort-from-bottom-to-top-bold", hint: "Harga terendah lebih dulu" },
      { value: "termahal", label: "Termahal", icon: "solar:sort-from-top-to-bottom-bold", hint: "Harga tertinggi lebih dulu" },
    ],
  },
  {
    key: "luas", label: "Luas", icon: "solar:ruler-angular-bold-duotone", accent: "purple", align: "right",
    options: [
      { value: "terluas",  label: "Terluas",  icon: "solar:maximize-square-3-bold", hint: "Tanah terbesar lebih dulu" },
      { value: "terkecil", label: "Terkecil", icon: "solar:minimize-square-3-bold", hint: "Tanah terkecil lebih dulu" },
    ],
  },
];

const SortBar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const BASE_URL = "/Lelang";
  const wrapRef = useRef<HTMLDivElement>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const currentSort = searchParams.get("sort") || "terbaru";

  // Tutup dropdown saat klik di luar.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenKey(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Tutup dengan Escape (aksesibilitas).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenKey(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const updateSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "terbaru") params.delete("sort"); // reset → URL bersih
    else params.set("sort", value);
    params.set("page", "1");
    setOpenKey(null);
    router.push(`${BASE_URL}?${params.toString()}`, { scroll: false });
  };

  const alignCls = (a: SortGroup["align"]) =>
    a === "left" ? "left-0" : a === "right" ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <div ref={wrapRef} className="flex items-center gap-2">
      {GROUPS.map((g) => {
        const active = g.options.find((o) => o.value === currentSort);
        const accent = ACCENT[g.accent];
        const isOpen = openKey === g.key;

        return (
          <div key={g.key} className="relative shrink-0">
            {/* CHIP */}
            <button
              onClick={() => setOpenKey(isOpen ? null : g.key)}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              className={`inline-flex items-center gap-1.5 h-9 md:h-10 px-3 md:px-3.5 rounded-full border text-[11px] md:text-xs font-bold transition-all whitespace-nowrap ${
                active
                  ? `${accent.chipBg} ${accent.chipBorder} ${accent.text}`
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/25"
              }`}
            >
              <Icon icon={active?.icon || g.icon} className="text-sm shrink-0" />
              <span>{active ? active.label : g.label}</span>
              {active && <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />}
              <Icon
                icon="solar:alt-arrow-down-linear"
                className={`text-[11px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* DROPDOWN */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className={`absolute top-full mt-2 z-50 w-56 rounded-2xl border border-white/10 bg-[#111316]/95 backdrop-blur-xl shadow-[0_24px_64px_rgba(0,0,0,0.7)] overflow-hidden ${alignCls(g.align)}`}
                >
                  <div className="px-3.5 pt-3 pb-2 flex items-center gap-2 border-b border-white/5">
                    <Icon icon={g.icon} className={`text-base ${accent.text}`} />
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      Urutkan {g.label}
                    </span>
                  </div>

                  <div className="p-1.5">
                    {g.options.map((o) => {
                      const sel = o.value === currentSort;
                      return (
                        <button
                          key={o.value}
                          role="menuitemradio"
                          aria-checked={sel}
                          onClick={() => updateSort(o.value)}
                          className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-colors ${
                            sel ? accent.optBg : "hover:bg-white/5"
                          }`}
                        >
                          <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${sel ? accent.optBg : "bg-white/5"}`}>
                            <Icon icon={o.icon} className={`text-base ${sel ? accent.optText : "text-slate-300"}`} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={`block text-[13px] font-bold ${sel ? accent.optText : "text-slate-200"}`}>{o.label}</span>
                            <span className="block text-[10px] text-slate-500 truncate">{o.hint}</span>
                          </span>
                          {sel && <Icon icon="solar:check-circle-bold" className={`text-lg shrink-0 ${accent.optText}`} />}
                        </button>
                      );
                    })}
                  </div>

                  {active && (
                    <button
                      onClick={() => updateSort("terbaru")}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[11px] font-bold text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border-t border-white/5"
                    >
                      <Icon icon="solar:restart-bold" className="text-sm" />
                      Reset {g.label}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

export default SortBar;

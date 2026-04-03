"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LayoutGrid,
} from "lucide-react";

type TabKey = "semua" | "berjalan" | "selesai";
type SortKey = "termurah" | "termahal" | "terlama" | "tercepat";

type Props = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  totalSemua?: number;
  totalBerjalan?: number;
  totalSelesai?: number;
};

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "berjalan", label: "Sedang Berjalan", icon: Clock3 },
  { key: "selesai", label: "Sudah Selesai", icon: CheckCircle2 },
  { key: "semua", label: "Semua", icon: LayoutGrid },
];

const sortOptions: Array<{
  key: SortKey;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "termurah",
    label: "Harga Paling Murah",
    shortLabel: "Termurah",
    icon: ArrowDownWideNarrow,
  },
  {
    key: "termahal",
    label: "Harga Paling Mahal",
    shortLabel: "Termahal",
    icon: ArrowUpWideNarrow,
  },
  {
    key: "terlama",
    label: "Durasi Paling Lama",
    shortLabel: "Terlama",
    icon: ArrowUpWideNarrow,
  },
  {
    key: "tercepat",
    label: "Durasi Paling Sebentar",
    shortLabel: "Tercepat",
    icon: ArrowDownWideNarrow,
  },
];

function getSortMeta(sort: SortKey) {
  return (
    sortOptions.find((item) => item.key === sort) ?? {
      key: "termurah" as SortKey,
      label: "Harga Paling Murah",
      shortLabel: "Termurah",
      icon: ArrowDownWideNarrow,
    }
  );
}

function CountBadge({
  active,
  value,
}: {
  active: boolean;
  value?: number;
}) {
  if (typeof value !== "number") return null;

  return (
    <span
      className={[
        "ml-0.5 inline-flex min-w-[24px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold transition",
        active
          ? "bg-black/8 text-[#07110b]"
          : "bg-white/[0.06] text-slate-400 group-hover:text-white",
      ].join(" ")}
    >
      {value}
    </span>
  );
}

export default function ProjectCategoryTabs({
  activeTab,
  onTabChange,
  sort,
  onSortChange,
  totalSemua,
  totalBerjalan,
  totalSelesai,
}: Props) {
  const [openSortMenu, setOpenSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  const activeSort = useMemo(() => getSortMeta(sort), [sort]);
  const ActiveSortIcon = activeSort.icon;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target as Node)
      ) {
        setOpenSortMenu(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenSortMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function getCount(tabKey: TabKey) {
    if (tabKey === "berjalan") return totalBerjalan;
    if (tabKey === "selesai") return totalSelesai;
    return totalSemua;
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto scroll-smooth pb-1 pr-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={[
                  "group inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold backdrop-blur-xl transition duration-200 active:scale-[0.99]",
                  active
                    ? "border-emerald-300/20 bg-[linear-gradient(135deg,#34d399_0%,#4ade80_100%)] text-[#07110b] shadow-[0_10px_24px_rgba(52,211,153,0.18)]"
                    : "border-white/10 bg-white/[0.045] text-slate-300 shadow-[0_6px_18px_rgba(0,0,0,0.10)] hover:border-white/15 hover:bg-white/[0.07] hover:text-white",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full transition",
                    active ? "bg-black/10" : "bg-white/[0.06]",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>

                <span className="whitespace-nowrap">{tab.label}</span>

                <CountBadge active={active} value={getCount(tab.key)} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative shrink-0" ref={sortMenuRef}>
        <button
          type="button"
          onClick={() => setOpenSortMenu((prev) => !prev)}
          className={[
            "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold backdrop-blur-xl transition duration-200 active:scale-[0.99]",
            openSortMenu
              ? "border-white/15 bg-white/[0.07] text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)]"
              : "border-white/10 bg-white/[0.045] text-slate-200 hover:border-white/15 hover:bg-white/[0.07]",
          ].join(" ")}
          aria-haspopup="menu"
          aria-expanded={openSortMenu}
        >
          <span className="hidden text-slate-400 sm:inline">Urutkan</span>

          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06]">
            <ActiveSortIcon className="h-3.5 w-3.5" />
          </span>

          <span className="max-w-[92px] truncate sm:max-w-[120px]">
            {activeSort.shortLabel}
          </span>

          <ChevronDown
            className={[
              "h-4 w-4 text-slate-400 transition duration-200",
              openSortMenu ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {openSortMenu ? (
          <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[240px] overflow-hidden rounded-[20px] border border-white/10 bg-[#0a1320]/96 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_28%)]" />

            <div className="relative">
              {sortOptions.map((item) => {
                const Icon = item.icon;
                const active = item.key === sort;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onSortChange(item.key);
                      setOpenSortMenu(false);
                    }}
                    className={[
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition",
                      active
                        ? "bg-emerald-400/12 text-emerald-200"
                        : "text-slate-200 hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        active ? "bg-emerald-400/14" : "bg-white/[0.05]",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span className="truncate font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
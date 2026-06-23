"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

export type TxTab = "semua" | "beli" | "lelang" | "sewa";

/** Urutan tetap: Semua | Beli | Lelang | Sewa */
const TABS: { id: TxTab; label: string; icon: string; href: string }[] = [
  { id: "semua",  label: "Semua",  icon: "solar:map-point-rotate-bold",        href: "/properti/semua" },
  { id: "beli",   label: "Beli",   icon: "solar:home-2-bold",                  href: "/Jual" },
  { id: "lelang", label: "Lelang", icon: "solar:tag-price-bold",               href: "/Lelang" },
  { id: "sewa",   label: "Sewa",   icon: "solar:key-minimalistic-square-bold", href: "/Sewa" },
];

/** Filter yang relevan lintas-section, dibawa serta saat pindah pill. */
const CARRY_KEYS = [
  "q", "idProperty", "kota", "tipe",
  "minHarga", "maxHarga",
  "minLT", "maxLT", "minLB", "maxLB",
];

/**
 * Pill navigasi transaksi yang dipasang di atas SEMUA search bar.
 *
 * Animasi: pakai shared-layout (`layoutId`) untuk pill yang meluncur. Karena tiap
 * section adalah route terpisah, kita pakai pola OPTIMISTIK — saat diklik, pill
 * langsung meluncur ke tujuan (`pending`) sementara halaman berikutnya dimuat,
 * sehingga terasa instan, bukan klik yang "diam dulu baru pindah".
 */
export default function TransactionTabs({ active }: { active: TxTab }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<TxTab | null>(null);

  // Tab yang ditampilkan aktif — optimistik saat sedang berpindah.
  const displayActive = pending ?? active;

  const go = (tab: (typeof TABS)[number]) => {
    if (tab.id === active || isPending) return;
    const params = new URLSearchParams();
    CARRY_KEYS.forEach((k) => {
      const v = sp.get(k);
      if (v) params.set(k, v);
    });
    const qs = params.toString();
    setPending(tab.id);
    startTransition(() => {
      router.push(qs ? `${tab.href}?${qs}` : tab.href);
    });
  };

  return (
    <div className="flex justify-center mb-4">
      <div className="bg-[#1A1A1A]/90 backdrop-blur-md border border-white/15 px-3 py-2 rounded-full flex w-full max-w-md sm:max-w-none sm:w-auto sm:inline-flex shadow-xl">
        {TABS.map((tab) => {
          const isActive = tab.id === displayActive;
          const loading = isPending && pending === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => go(tab)}
              disabled={isPending}
              aria-current={tab.id === active ? "page" : undefined}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`relative flex flex-1 sm:flex-initial items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-colors duration-300 disabled:cursor-not-allowed ${
                isActive ? "text-darkmode" : "text-gray-400 hover:text-white"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="txTabPill"
                  className="absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_2px_rgba(0,0,0,0.18)]"
                  style={{ background: "linear-gradient(180deg,#9af7b5 0%,#4ade80 55%,#37d06d 100%)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                {loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <motion.span
                    initial={false}
                    animate={isActive ? { scale: [1, 1.28, 1] } : { scale: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="flex"
                  >
                    <Icon icon={tab.icon} className="text-base sm:text-lg shrink-0" />
                  </motion.span>
                )}
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

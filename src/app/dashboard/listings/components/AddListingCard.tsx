// app/dashboard/listings/components/AddListingCard.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";

const MotionLink = motion(Link);

export function AddListingCard() {
  const [pressed, setPressed] = useState(false);

  return (
    <MotionLink
      href="/tambah-property"
      onTapStart={() => setPressed(true)}
      onTap={() => setTimeout(() => setPressed(false), 500)}
      onTapCancel={() => setPressed(false)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="
        group relative flex h-full flex-col items-center justify-center gap-2
        overflow-hidden rounded-2xl sm:rounded-3xl
        border border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 via-[#020617]/80 to-cyan-500/10
        px-3 py-4 sm:px-5 sm:py-5
        shadow-[0_0_20px_rgba(16,185,129,0.25)] sm:shadow-[0_0_40px_rgba(16,185,129,0.35)]
        backdrop-blur-xl transition-[border-color,box-shadow] duration-300
        hover:border-emerald-300 hover:shadow-[0_0_30px_rgba(52,211,153,0.5)]
      "
    >
      {/* animated glow blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -right-10 -top-10 h-16 w-16 sm:h-24 sm:w-24 rounded-full bg-emerald-400/30 blur-2xl transition-transform duration-500 group-hover:scale-125" />
        <div className="absolute -left-10 -bottom-10 h-16 w-16 sm:h-24 sm:w-24 rounded-full bg-cyan-400/20 blur-2xl transition-transform duration-500 group-hover:scale-125" />
      </div>

      {/* shimmer sweep */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
      </div>

      {/* press ripple */}
      <AnimatePresence>
        {pressed && (
          <motion.span
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/40"
            initial={{ opacity: 0.55, scale: 0 }}
            animate={{ opacity: 0, scale: 22 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* press flash border */}
      <AnimatePresence>
        {pressed && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl border border-emerald-200"
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center gap-2 sm:gap-3">
        <motion.div
          animate={pressed ? { rotate: 180, scale: 0.85 } : { rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="
            flex h-10 w-10 items-center justify-center rounded-full sm:h-14 sm:w-14
            border border-emerald-300/60 bg-emerald-500/20
            shadow-[0_0_20px_rgba(52,211,153,0.5)]
            transition-transform duration-300 group-hover:scale-110
          "
        >
          <Icon icon="solar:add-circle-bold" className="text-xl text-emerald-200 sm:text-3xl" />
        </motion.div>

        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-100 sm:text-sm sm:tracking-[0.18em]">
            Tambah Listing
          </p>
          <p className="mt-0.5 hidden text-[11px] text-emerald-200/70 sm:block">
            Pasang properti baru
          </p>
        </div>
      </div>
    </MotionLink>
  );
}

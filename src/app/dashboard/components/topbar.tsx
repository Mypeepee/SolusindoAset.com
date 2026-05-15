// src/app/dashboard/components/topbar.tsx
"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import GlobalSearch from "./global-search";

type DashboardTopbarProps = {
  onOpenMobileSidebar?: () => void;
};

export default function DashboardTopbar({
  onOpenMobileSidebar,
}: DashboardTopbarProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <div
      className="
        sticky top-0 z-20
        flex items-center justify-between gap-3
        border-b border-white/5
        bg-[#050608]/90 backdrop-blur
        px-4 sm:px-5 py-4 sm:py-6
      "
    >
      {/* LEFT: burger (mobile) + home (mobile) + search */}
      <div className="flex flex-1 items-center gap-2">
        {/* Burger hanya tampil di < md */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="flex md:hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#050608] text-slate-200 hover:bg-white/5 shrink-0"
        >
          <Icon icon="solar:hamburger-menu-linear" className="h-4 w-4" />
        </button>

        {/* Home button — mobile only */}
        <Link
          href="/"
          className="
            group flex md:hidden items-center gap-1.5
            px-2.5 py-1.5 rounded-full
            border border-emerald-500/25
            bg-emerald-500/8
            hover:bg-emerald-500/18 hover:border-emerald-400/50
            active:scale-95
            transition-all duration-200
            shrink-0
          "
        >
          <Icon icon="solar:home-smile-angle-bold-duotone" className="text-emerald-400 text-base" />
          <span className="text-[11px] font-semibold text-emerald-300 leading-none">Beranda</span>
        </Link>

        <GlobalSearch />

        {/* Home button — desktop only */}
        <Link
          href="/"
          className="
            group hidden md:flex items-center gap-2
            px-3.5 py-2 rounded-full
            border border-emerald-500/20
            bg-emerald-500/5
            hover:bg-emerald-500/12 hover:border-emerald-400/40
            transition-all duration-200
            shrink-0
            overflow-hidden relative
          "
        >
          <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-600 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent" />
          <Icon icon="solar:home-smile-angle-bold-duotone" className="text-emerald-400 text-base shrink-0" />
          <span className="text-[12px] font-semibold text-emerald-300 leading-none whitespace-nowrap">Beranda</span>
        </Link>
      </div>

      {/* RIGHT: notif + profile */}
      <div className="flex items-center gap-2">
        <button className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/10 bg-[#050608] text-slate-200 hover:bg-white/5">
          <Icon icon="solar:bell-linear" className="h-4 w-4" />
        </button>

        {/* Wrapper untuk hover */}
        <div
          className="relative"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {/* Trigger profile */}
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-[#050608] pl-1 pr-2 sm:pr-3 py-1 hover:bg-white/5 transition-colors">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-white/5 border border-white/10 relative">
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt="Profile"
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Icon icon="solar:user-circle-bold" className="text-lg sm:text-xl" />
                </div>
              )}
            </div>
            <span className="hidden md:inline text-xs font-medium text-slate-200 max-w-[140px] truncate">
              {session?.user?.name || "Owner"}
            </span>
            <Icon
              icon="solar:alt-arrow-down-linear"
              className="text-slate-500 text-xs md:text-sm"
            />
          </button>

          {/* Dropdown profil */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="absolute right-0 mt-2 w-52 bg-[#101015] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30"
              >
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-xs text-gray-400">Masuk sebagai</p>
                  <p className="text-sm font-semibold text-white truncate">
                    {session?.user?.name || "Pengguna"}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {session?.user?.email}
                  </p>
                </div>

                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-[#86efac] transition-colors"
                >
                  <Icon icon="solar:user-id-bold" className="text-lg" />
                  Profil Saya
                </Link>

                <button
                  onClick={() => {
                    signOut({ callbackUrl: "/" });
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
                >
                  <Icon icon="solar:logout-2-bold" className="text-lg" />
                  Keluar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

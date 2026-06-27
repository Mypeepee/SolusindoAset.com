"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";

type SidebarTabId = "profile" | "data-penting" | "booking" | "reward";

type Props = {
  activeTab: SidebarTabId;
  setActiveTab: (tab: SidebarTabId) => void;
  onSignOut?: () => void; // kept for backwards-compat, sidebar handles logout internally
  role: "USER" | "AGENT" | string;
};

// ─── Exit Overlay ────────────────────────────────────────────────────────────
const ExitOverlay = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050607]"
  >
    {/* radial glow behind logo */}
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="w-80 h-80 rounded-full bg-emerald-500/10 blur-[100px]" />
    </div>

    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative z-10 flex flex-col items-center gap-5"
    >
      <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-emerald-400/20 shadow-[0_0_40px_rgba(134,239,172,0.2)]">
        <Image src="/images/logo/LogoSolusindoPremier.png" alt="Solusindo" fill className="object-contain p-2" />
      </div>

      {/* spinner ring */}
      <div className="relative w-12 h-12">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(134,239,172,0.12)" strokeWidth="3" />
          <motion.circle
            cx="24" cy="24" r="20"
            fill="none"
            stroke="#86efac"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="125.6"
            initial={{ strokeDashoffset: 125.6 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
          />
        </svg>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-white">Sedang keluar…</p>
        <p className="text-xs text-gray-500 mt-1">Sesi Anda diakhiri dengan aman</p>
      </div>
    </motion.div>
  </motion.div>
);

// ─── Confirmation Modal ───────────────────────────────────────────────────────
const LogoutModal = ({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18 }}
    className="fixed inset-0 z-[9998] flex items-center justify-center px-4"
    style={{ backdropFilter: "blur(16px)", background: "rgba(5,6,7,0.75)" }}
  >
    {/* backdrop tap to cancel */}
    <div className="absolute inset-0" onClick={onCancel} />

    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 16 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.92, opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e0f10] shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden"
    >
      {/* top accent bar */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-red-400/60 to-transparent" />

      <div className="p-6">
        {/* icon */}
        <div className="flex justify-center mb-5">
          <div className="relative w-14 h-14 rounded-full bg-red-500/10 border border-red-400/20 flex items-center justify-center">
            <Icon icon="solar:logout-2-bold" className="text-2xl text-red-400" />
            {/* pulse ring */}
            <span className="absolute inset-0 rounded-full border border-red-400/20 animate-ping opacity-40" />
          </div>
        </div>

        <h3 className="text-center text-base font-bold text-white mb-1">
          Keluar dari akun?
        </h3>
        <p className="text-center text-xs text-gray-400 leading-relaxed mb-6">
          Sesi Anda akan diakhiri secara aman.<br />Anda perlu login kembali untuk melanjutkan.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 relative py-2.5 rounded-xl text-sm font-bold text-white overflow-hidden bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 transition-all disabled:opacity-60 shadow-[0_4px_24px_rgba(239,68,68,0.35)]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Keluar…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                Ya, Keluar
                <Icon icon="solar:arrow-right-bold" className="text-sm" />
              </span>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const ProfileSidebar = ({ activeTab, setActiveTab, role }: Props) => {
  const isAgent = role === "AGENT";
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [loadingLogout, setLoadingLogout] = useState(false);

  const handleLogoutConfirm = async () => {
    setLoadingLogout(true);

    // Show exit overlay immediately — perceived latency drops to ~0
    setShowConfirm(false);
    setIsExiting(true);

    // Run signOut (redirect:false = no extra round-trip for the redirect URL)
    // and a minimum 600ms so the overlay is always visible
    await Promise.all([
      signOut({ redirect: false }),
      new Promise((r) => setTimeout(r, 600)),
    ]);

    router.push("/");
  };

  const agentTabs: { id: SidebarTabId; label: string; icon: string; subtitle?: string }[] = [
    { id: "profile",      label: "Profil",      icon: "solar:user-id-bold",    subtitle: "Data diri & kontak" },
    { id: "data-penting", label: "Data Penting", icon: "solar:shield-user-bold", subtitle: "Data agent & verifikasi" },
    { id: "booking",      label: "Transaksi",    icon: "solar:wallet-money-bold", subtitle: "Riwayat dan status" },
    { id: "reward",       label: "Zona Hadiah",  icon: "solar:gift-bold",        subtitle: "Poin & penukaran" },
  ];

  const userTabs: { id: SidebarTabId; label: string; icon: string; subtitle?: string }[] = [
    { id: "profile", label: "Profil",    icon: "solar:user-id-bold",    subtitle: "Data diri & kontak" },
    { id: "booking", label: "Transaksi", icon: "solar:history-bold",    subtitle: "Riwayat sewa & beli" },
  ];

  const tabs = isAgent ? agentTabs : userTabs;

  return (
    <>
      {/* Exit overlay — rendered outside sidebar stacking context */}
      <AnimatePresence>{isExiting && <ExitOverlay />}</AnimatePresence>

      {/* Confirmation modal */}
      <AnimatePresence>
        {showConfirm && (
          <LogoutModal
            onConfirm={handleLogoutConfirm}
            onCancel={() => setShowConfirm(false)}
            loading={loadingLogout}
          />
        )}
      </AnimatePresence>

      <aside className="w-full lg:w-72 shrink-0 z-30">
        <div className="bg-[#181818] rounded-2xl border border-white/5 p-2 sm:p-3 sticky top-20 lg:top-28">
          <p className="text-[10px] font-bold text-gray-500 px-4 py-2 uppercase tracking-widest lg:block hidden">
            Menu Akun
          </p>

          <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible no-scrollbar pb-1 lg:pb-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center justify-between lg:justify-start gap-2 sm:gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0
                    ${isActive
                      ? "bg-[#86efac] text-black shadow-[0_0_20px_rgba(134,239,172,0.2)]"
                      : "text-gray-400 hover:bg-white/5 hover:text-white bg-white/5 lg:bg-transparent"
                    }
                  `}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Icon
                      icon={tab.icon}
                      className={`text-base sm:text-lg ${isActive ? "text-black" : "text-gray-300"}`}
                    />
                    <div className="flex flex-col items-start min-w-0">
                      <span className="truncate">{tab.label}</span>
                      {tab.subtitle && (
                        <span className="hidden lg:inline text-[10px] font-normal text-gray-500 truncate">
                          {tab.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="h-px bg-white/10 my-2 hidden lg:block" />

            {/* Logout button — subtle until hover, then danger red */}
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="
                group flex items-center gap-3 px-4 py-3 rounded-xl
                text-xs sm:text-sm font-bold
                text-gray-500 hover:text-red-400
                hover:bg-red-500/8
                active:scale-[0.98]
                transition-all duration-150
                flex-shrink-0 lg:w-full
              "
            >
              <Icon
                icon="solar:logout-2-bold"
                className="text-lg text-gray-600 group-hover:text-red-400 transition-colors duration-150"
              />
              <span className="hidden sm:inline">Keluar</span>
              <span className="sm:hidden">Exit</span>
            </button>
          </nav>
        </div>
      </aside>
    </>
  );
};

export default ProfileSidebar;

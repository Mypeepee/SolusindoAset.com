"use client";

import { useEffect } from "react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import { Agent, AgentStatus } from "../../types/agent.types";
import { AgentDetailPanel } from "./AgentDetailPanel";

type Props = {
  open: boolean;
  agent: Agent | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: AgentStatus) => Promise<boolean>;
  onUpdateOffice?: (id: string, nama_kantor: string) => Promise<boolean>;
};

export function AgentDetailDrawer({
  open,
  agent,
  onClose,
  onUpdateStatus,
  onUpdateOffice,
}: Props) {
  // lock scroll saat drawer open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="xl:hidden fixed inset-0 z-[80]">
          {/* backdrop */}
          <motion.button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* SHEET WRAPPER */}
          <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3 sm:p-6">
            {/* SHEET */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className={[
                // ✅ ini kunci: pake dvh + inset biar gak kepotong
                "w-full max-w-[560px]",
                "h-[calc(100dvh-24px)] sm:h-[calc(100dvh-48px)]",
                "rounded-3xl border border-white/10",
                "bg-[#05060A] shadow-2xl overflow-hidden",
                "flex flex-col",
              ].join(" ")}
              role="dialog"
              aria-modal="true"
            >
              {/* HEADER (sticky) */}
              <div className="relative shrink-0 border-b border-white/10 bg-gradient-to-b from-black/40 to-transparent">
                <div className="px-5 pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 uppercase tracking-[0.25em]">
                        Detail Agent
                      </p>
                      <p className="text-sm font-semibold text-white truncate">
                        {agent?.nama_lengkap || "—"}
                      </p>
                    </div>

                    {/* Close button always visible */}
                    <button
                      type="button"
                      onClick={onClose}
                      className="shrink-0 w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center"
                      aria-label="Tutup detail"
                    >
                      <Icon icon="solar:close-circle-bold" className="text-xl text-white/80" />
                    </button>
                  </div>
                </div>
              </div>

              {/* CONTENT (scrollable) */}
              <div
                className={[
                  "flex-1 overflow-y-auto px-5 py-5",
                  // ✅ kasih ruang bawah untuk footer + safe area
                  "pb-[calc(env(safe-area-inset-bottom)+96px)]",
                  "custom-scrollbar",
                ].join(" ")}
              >
                <AgentDetailPanel
                  agent={agent}
                  onUpdateStatus={onUpdateStatus}
                  onUpdateOffice={onUpdateOffice}
                />
              </div>

              {/* FOOTER (fixed inside sheet, safe-area aware) */}
              <div
                className={[
                  "shrink-0 border-t border-white/10",
                  "bg-gradient-to-t from-black/50 to-transparent",
                  // ✅ safe area bottom biar tombol ga kepotong iPhone / iPad
                  "px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full h-12 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold text-white transition"
                >
                  Tutup Detail
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

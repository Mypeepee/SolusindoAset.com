"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ORDER } from "./constants";
import { buildDailyTasks } from "./data";
import { openWA } from "./helpers";
import { CatalogModal } from "./CatalogModal";
import { TaskCard } from "./TaskCard";
import { SectionHeader } from "./SectionHeader";
import { Sidebar } from "./Sidebar";
import { PageHeader } from "./PageHeader";
import type { DailyTask, ActionDef, Category } from "./types";

/* ═══════════════════════════════════════════════════════════════
   STAT CARD
═══════════════════════════════════════════════════════════════ */

type StatAccent = "sky" | "emerald" | "rose" | "amber";

const STAT_CFG: Record<StatAccent, { border: string; bg: string; orb: string; icon: string; val: string }> = {
  sky:     { border:"border-sky-400/[0.18]",     bg:"bg-sky-500/[0.06]",     orb:"bg-sky-500/[0.2]",     icon:"text-sky-400",     val:"text-sky-100"     },
  emerald: { border:"border-emerald-400/[0.18]", bg:"bg-emerald-500/[0.06]", orb:"bg-emerald-500/[0.2]", icon:"text-emerald-400", val:"text-emerald-100" },
  rose:    { border:"border-rose-400/[0.18]",    bg:"bg-rose-500/[0.06]",    orb:"bg-rose-500/[0.2]",    icon:"text-rose-400",    val:"text-rose-100"    },
  amber:   { border:"border-amber-400/[0.18]",   bg:"bg-amber-500/[0.06]",   orb:"bg-amber-500/[0.2]",   icon:"text-amber-400",   val:"text-amber-100"   },
};

function StatCard({ icon, label, value, sub, accent, gradient, urgent }: {
  icon: string; label: string; value: string; sub: string;
  accent: StatAccent; gradient?: boolean; urgent?: boolean;
}) {
  const A = STAT_CFG[accent];
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${A.border} ${A.bg} p-4`}>
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full ${A.orb} blur-2xl`} />
      {urgent && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
        </span>
      )}
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${A.border} bg-black/25 mb-3`}>
        <Icon icon={icon} className={`text-base ${A.icon}`} />
      </div>
      <p className={`text-[1.2rem] font-extrabold leading-none tabular-nums ${gradient ? "bg-gradient-to-br from-emerald-300 to-emerald-500 bg-clip-text text-transparent" : A.val}`}>
        {value}
      </p>
      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-600 mt-1.5">{label}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN LAYOUT
═══════════════════════════════════════════════════════════════ */

export function TugasLayout() {
  const [tasks,       setTasks]       = useState<DailyTask[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);

  const markDone = (id: string) =>
    setTasks((p) => p.map((t) => {
      if (t.id !== id) return t;
      if (!t.done) toast.success("Task selesai! 🔥");
      return { ...t, done: !t.done };
    }));

  const incrTask = (id: string) =>
    setTasks((p) => p.map((t) => {
      if (t.id !== id || t.target == null) return t;
      const next = Math.min((t.current ?? 0) + 1, t.target);
      if (next >= t.target) toast.success(`Target ${t.target} tercapai! 🎯`);
      return { ...t, current: next };
    }));

  useEffect(() => {
    fetch("/api/dashboard/tugas/auto")
      .then((r) => r.json())
      .then(({ tasks: raw }) => {
        if (!Array.isArray(raw)) return;
        const mapped: DailyTask[] = raw.map((t: any) => {
          const actions: ActionDef[] = [];

          if (t.source === "titip") {
            // Titip jual: WA klien + aksi per tahap
            if (t.leadPhone) {
              const waMsg = t.titipStep === 1
                ? `Halo Bapak/Ibu ${t.leadName}, saya dari Solusindo Aset. Saya sudah terima titip jual properti Anda di ${t.propertyTitle}. Boleh saya minta waktu 10 menit untuk ngobrol singkat? 🏡`
                : undefined;
              actions.push({ label: "WA Pemilik", icon: "logos:whatsapp-icon", variant: "green",
                onClick: () => openWA(t.leadPhone, t.leadName ?? "Pemilik", waMsg) });
            }
            if (t.titipStep === 3) {
              actions.push({ label: "Upload Listing", icon: "solar:upload-minimalistic-bold-duotone", variant: "violet",
                onClick: () => window.location.href = "/dashboard/listings" });
            }
            actions.push({ label: "Buka Panduan", icon: "solar:book-2-bold-duotone", variant: "amber",
              onClick: () => window.location.href = "/" });
          } else {
            if (t.leadPhone) {
              actions.push({ label: "WA Sekarang", icon: "logos:whatsapp-icon", variant: "green",
                onClick: () => openWA(t.leadPhone, t.leadName ?? "Klien") });
              actions.push({ label: "Telepon", icon: "solar:phone-bold", variant: "sky",
                onClick: () => window.open(`tel:${t.leadPhone}`) });
            }
            if (t.source === "listing") {
              actions.push({ label: "Lihat Listing", icon: "solar:star-bold-duotone", variant: "amber",
                onClick: () => setShowCatalog(true) });
            }
          }
          actions.push({ label: "Tandai Selesai", icon: "solar:check-circle-bold", variant: "primary",
            onClick: () => markDone(t.id) });
          return {
            id: t.id, category: t.category, title: t.title, why: t.why,
            done: false, overdue: t.overdue ?? false,
            leadName: t.leadName ?? undefined, leadTemp: t.leadTemp ?? undefined,
            leadPhone: t.leadPhone ?? undefined, pipelineStage: t.pipelineStage ?? undefined,
            commissionValue: t.commissionValue ?? undefined, propertyTitle: t.propertyTitle ?? undefined,
            scheduledAt: t.scheduledAt ?? undefined, actions,
          };
        });
        setTasks(mapped);
      })
      .catch(() => {
        setTasks(buildDailyTasks(markDone, incrTask, () => setShowCatalog(true)));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalDone = tasks.filter((t) => t.done || ((t.current ?? 0) >= (t.target ?? 1))).length;

  const byCategory = ORDER.reduce<Record<Category, DailyTask[]>>((a, c) => {
    a[c] = tasks.filter((t) => t.category === c);
    return a;
  }, {} as Record<Category, DailyTask[]>);

  return (
    <div className="flex min-h-screen flex-col bg-[#060810]">

      <PageHeader tasks={tasks} totalDone={totalDone} />

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-6 px-4 py-6 lg:px-6 max-w-screen-xl mx-auto">

          {/* Task list */}
          <div className="flex-1 min-w-0 space-y-8">
            {ORDER.map((cat) => {
              const items = byCategory[cat] ?? [];
              if (items.length === 0) return null;
              const catDone = items.filter((t) => t.done || ((t.current ?? 0) >= (t.target ?? 1))).length;
              return (
                <div key={cat} id={`sec-${cat}`}>
                  <SectionHeader category={cat} total={items.length} done={catDone} />
                  <div className="grid grid-cols-2 gap-4">
                    <AnimatePresence mode="popLayout">
                      {items.map((t) => (
                        <TaskCard key={t.id} task={t} onToggle={() => markDone(t.id)} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar (desktop) */}
          <div className="hidden lg:block w-72 xl:w-80 shrink-0">
            <div className="sticky top-6"><Sidebar tasks={tasks} /></div>
          </div>
        </div>

        {/* Mobile sidebar */}
        <div className="lg:hidden px-4 pb-8">
          <Sidebar tasks={tasks} />
        </div>
      </div>

      {/* Catalog Modal */}
      <AnimatePresence>
        {showCatalog && <CatalogModal onClose={() => setShowCatalog(false)} />}
      </AnimatePresence>
    </div>
  );
}

// Keep StatCard exported in case it gets used elsewhere
export { StatCard };

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Icon } from "@iconify/react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ORDER } from "./constants";
import { openWA, saveTaskMeta } from "./helpers";
import { CatalogModal } from "./CatalogModal";
import { TaskCard } from "./TaskCard";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { TaskToolbar, type TaskFilter, type TaskSort } from "./TaskToolbar";
import { TambahTugasModal } from "./TambahTugasModal";
import { PageHeader } from "./PageHeader";
import type { DailyTask, ActionDef, Category, DbTask } from "./types";

const isDone = (t: DailyTask) => t.done || ((t.current ?? 0) >= (t.target ?? 1));

/* Smart priority: overdue → urgent → HOT → scheduled → category order */
function prioRank(t: DailyTask): number {
  if (t.overdue) return 0;
  if (t.category === "URGENT") return 100;
  if (t.leadTemp === "HOT") return 200;
  if (t.scheduledAt) return 300;
  return 400 + Math.max(0, ORDER.indexOf(t.category));
}

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
  const [showAdd,     setShowAdd]     = useState(false);
  const [openTaskId,  setOpenTaskId]  = useState<string | null>(null);
  const [loaded,      setLoaded]      = useState(false);

  // Command bar state
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("ALL");
  const [sort,   setSort]   = useState<TaskSort>("PRIORITY");

  const markDone = (id: string) =>
    setTasks((p) => p.map((t) => {
      if (t.id !== id) return t;
      const nextDone = !t.done;
      if (nextDone) toast.success("Task selesai! 🔥");
      // Persist completion so it survives refresh & task regeneration.
      const meta = { ...(t.meta ?? {}), done: nextDone, doneAt: nextDone ? new Date().toISOString() : null };
      saveTaskMeta(id, meta);
      return { ...t, done: nextDone, meta };
    }));

  /* Map a freshly-created DB task into the local DailyTask shape */
  const handleCreated = (db: DbTask) => {
    const cat: Category = (db.kategori === "UMUM" ? "PIPELINE" : db.kategori) as Category;
    const phone = db.lead?.client_phone ?? undefined;
    const actions: ActionDef[] = [];
    if (phone) {
      actions.push({ label: "WA Sekarang", icon: "logos:whatsapp-icon", variant: "green",
        onClick: () => openWA(phone, db.lead?.client_name ?? "Klien") });
      actions.push({ label: "Telepon", icon: "solar:phone-bold", variant: "sky",
        onClick: () => window.open(`tel:${phone}`) });
    }
    actions.push({ label: "Tandai Selesai", icon: "solar:check-circle-bold", variant: "primary",
      onClick: () => markDone(db.id_tugas) });

    const mapped: DailyTask = {
      id: db.id_tugas, category: cat, title: db.judul, source: "manual",
      why: db.alasan ?? db.catatan ?? "Tugas baru ditambahkan.",
      done: db.status === "SELESAI", overdue: db.is_overdue ?? false,
      target: db.target ?? undefined, current: db.progress ?? 0,
      leadName: db.lead?.client_name ?? undefined,
      leadPhone: phone,
      commissionValue: db.komisi_potensial ?? undefined,
      propertyTitle: db.listing?.judul ?? undefined,
      scheduledAt: db.jam_terjadwal ?? undefined,
      actions,
    };
    setTasks((p) => [mapped, ...p]);
    setShowAdd(false);
  };

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
            done: t.done ?? false, overdue: t.overdue ?? false,
            source: t.source ?? undefined, sourceId: t.sourceId ?? undefined,
            titipStep: t.titipStep ?? undefined,
            leadName: t.leadName ?? undefined, leadTemp: t.leadTemp ?? undefined,
            leadPhone: t.leadPhone ?? undefined, pipelineStage: t.pipelineStage ?? undefined,
            commissionValue: t.commissionValue ?? undefined, propertyTitle: t.propertyTitle ?? undefined,
            scheduledAt: t.scheduledAt ?? undefined, deadline: t.deadline ?? undefined,
            offerAmount: t.offerAmount ?? undefined, offerStatus: t.offerStatus ?? undefined,
            cobrokeAgentName: t.cobrokeAgentName ?? undefined,
            cobrokeAgentOffice: t.cobrokeAgentOffice ?? undefined,
            cobrokeAgentPhone: t.cobrokeAgentPhone ?? undefined,
            meta: t.meta ?? undefined,
            actions,
          };
        });
        setTasks(mapped);
      })
      .catch(() => {
        // Tidak ada lagi data dummy — tampilkan keadaan kosong yang jujur.
        setTasks([]);
        toast.error("Gagal memuat tugas. Coba muat ulang.");
      })
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalDone = tasks.filter(isDone).length;
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null;

  // Chip counts (based on active/unfinished tasks)
  const counts = useMemo(() => {
    const active = tasks.filter((t) => !isDone(t));
    return {
      ALL:     active.length,
      URGENT:  active.filter((t) => t.category === "URGENT").length,
      OVERDUE: active.filter((t) => t.overdue).length,
      HOT:     active.filter((t) => t.leadTemp === "HOT").length,
    } as Record<TaskFilter, number>;
  }, [tasks]);

  // Filter + search + sort → split into active / done
  const { activeList, doneList } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchFilter = (t: DailyTask) =>
      filter === "ALL" ? true :
      filter === "URGENT" ? t.category === "URGENT" :
      filter === "OVERDUE" ? !!t.overdue :
      /* HOT */ t.leadTemp === "HOT";
    const matchSearch = (t: DailyTask) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.leadName ?? "").toLowerCase().includes(q) ||
      (t.propertyTitle ?? "").toLowerCase().includes(q) ||
      (t.pipelineStage ?? "").toLowerCase().includes(q);

    const filtered = tasks.filter((t) => matchFilter(t) && matchSearch(t));

    const cmp = (a: DailyTask, b: DailyTask) => {
      if (sort === "COMMISSION") return (b.commissionValue ?? 0) - (a.commissionValue ?? 0);
      if (sort === "TIME") {
        const ax = a.scheduledAt ?? "~", bx = b.scheduledAt ?? "~";
        return ax.localeCompare(bx);
      }
      // PRIORITY
      const r = prioRank(a) - prioRank(b);
      if (r !== 0) return r;
      return (a.scheduledAt ?? "~").localeCompare(b.scheduledAt ?? "~");
    };

    return {
      activeList: filtered.filter((t) => !isDone(t)).sort(cmp),
      doneList:   filtered.filter(isDone),
    };
  }, [tasks, search, filter, sort]);

  return (
    <div className="flex min-h-screen flex-col bg-[#060810]">

      <PageHeader tasks={tasks} totalDone={totalDone} />

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 lg:px-6 max-w-screen-xl mx-auto">

          {/* Task workspace — full width */}
          <div id="sec-URGENT" className="min-w-0 space-y-4 scroll-mt-4">
            <TaskToolbar
              search={search} onSearch={setSearch}
              filter={filter} onFilter={setFilter}
              sort={sort} onSort={setSort}
              counts={counts}
              onAdd={() => setShowAdd(true)}
            />

            {/* Active tasks */}
            {activeList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {activeList.map((t) => (
                    <TaskCard key={t.id} domId={`task-${t.id}`} task={t} onToggle={() => markDone(t.id)} onOpen={() => setOpenTaskId(t.id)} />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.01] py-14 text-center">
                <Icon
                  icon={!loaded ? "solar:hourglass-line-duotone" : tasks.length === 0 ? "solar:cup-star-bold-duotone" : "solar:filter-bold-duotone"}
                  className={`text-4xl ${!loaded ? "text-slate-600 animate-pulse" : tasks.length === 0 ? "text-emerald-400/70" : "text-slate-700"}`}
                />
                <p className="text-sm font-bold text-slate-400">
                  {!loaded
                    ? "Memuat tugas dari data real-mu..."
                    : tasks.length === 0
                    ? "Belum ada tugas hari ini 🎉"
                    : "Tidak ada tugas yang cocok."}
                </p>
                {loaded && tasks.length === 0 && (
                  <p className="max-w-xs text-[11.5px] text-slate-600">
                    Tugas otomatis muncul dari lead baru, titip jual, penawaran &amp; jadwal. Tambah manual lewat tombol Tugas.
                  </p>
                )}
                {(search || filter !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setFilter("ALL"); }}
                    className="text-[12px] font-bold text-orange-300 hover:text-orange-200"
                  >
                    Reset filter
                  </button>
                )}
              </div>
            )}

            {/* Completed (collapsed accent) */}
            {doneList.length > 0 && (
              <details className="group rounded-2xl border border-white/[0.06] bg-white/[0.01]">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-[12px] font-bold text-slate-400 [&::-webkit-details-marker]:hidden">
                  <Icon icon="solar:check-circle-bold" className="text-base text-emerald-400" />
                  Selesai
                  <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500">{doneList.length}</span>
                  <Icon icon="solar:alt-arrow-down-line-duotone" className="ml-auto text-base transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <div className="grid grid-cols-1 gap-4 p-4 pt-0 sm:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence mode="popLayout">
                    {doneList.map((t) => (
                      <TaskCard key={t.id} domId={`task-${t.id}`} task={t} onToggle={() => markDone(t.id)} onOpen={() => setOpenTaskId(t.id)} />
                    ))}
                  </AnimatePresence>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>

      {/* Catalog Modal */}
      <AnimatePresence>
        {showCatalog && <CatalogModal onClose={() => setShowCatalog(false)} />}
      </AnimatePresence>

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAdd && <TambahTugasModal onClose={() => setShowAdd(false)} onCreated={handleCreated} />}
      </AnimatePresence>

      {/* Task Detail Sheet */}
      <AnimatePresence>
        {openTask && (
          <TaskDetailSheet
            task={openTask}
            onClose={() => setOpenTaskId(null)}
            onToggleDone={() => markDone(openTask.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Keep StatCard exported in case it gets used elsewhere
export { StatCard };

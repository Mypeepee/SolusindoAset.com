"use client";

import { Icon } from "@iconify/react";
import type { AgentTask } from "./types";
import { cn, humanTime } from "./utils";

function TaskSkeleton() {
  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function priorityPill(p: AgentTask["priority"]) {
  if (p === "HIGH") return "border-rose-400/40 bg-rose-500/10 text-rose-200";
  if (p === "MEDIUM") return "border-amber-400/40 bg-amber-500/10 text-amber-200";
  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
}

function channelIcon(c?: AgentTask["channel"]) {
  if (c === "WA") return "solar:chat-round-call-bold";
  if (c === "CALL") return "solar:phone-calling-rounded-bold";
  if (c === "MEET") return "solar:calendar-bold";
  return "solar:checklist-minimalistic-bold";
}

export function AgentTasksCard({ loading, tasks }: { loading: boolean; tasks?: AgentTask[] }) {
  if (loading) return <TaskSkeleton />;

  const list = tasks || [];

  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">Today</p>
          <h3 className="mt-1 text-base font-bold text-white">Follow-up & Tasks</h3>
          <p className="mt-1 text-[11px] text-slate-500">Yang “due” hari ini harus kelar dulu.</p>
        </div>
        <div className="h-10 w-10 rounded-2xl border border-white/10 bg-black/30 flex items-center justify-center">
          <Icon icon="solar:checklist-bold-duotone" className="text-xl text-emerald-200" />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
          <Icon icon="solar:confetti-bold-duotone" className="text-3xl text-emerald-200 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-white">Aman! Tidak ada task mendesak</p>
          <p className="mt-1 text-xs text-slate-400">Tambahkan follow-up untuk menjaga pipeline tetap bergerak.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {list.slice(0, 6).map((t) => (
            <div
              key={t.id}
              className={cn(
                "rounded-2xl border border-white/10 bg-black/20 p-4",
                "hover:border-emerald-400/20 hover:bg-white/[0.03] transition"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{t.title}</p>
                  <p className="mt-1 text-[11px] text-slate-400 truncate">
                    {t.leadName ? `Lead: ${t.leadName} • ` : ""}Due {humanTime(t.dueAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("px-2 py-1 rounded-full border text-[10px] font-semibold", priorityPill(t.priority))}>
                    {t.priority}
                  </span>
                  <div className="h-9 w-9 rounded-xl border border-white/10 bg-black/30 flex items-center justify-center">
                    <Icon icon={channelIcon(t.channel)} className="text-lg text-emerald-200" />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => alert("TODO: mark done")}
                  className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white/90 transition"
                >
                  Selesai
                </button>
                <button
                  type="button"
                  onClick={() => alert("TODO: open detail")}
                  className="px-3 py-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-xs text-emerald-200 transition flex items-center gap-2"
                >
                  <Icon icon="solar:arrow-right-up-linear" className="text-base" />
                  Buka
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => alert("TODO: open all tasks")}
          className="text-xs text-slate-400 hover:text-emerald-200 transition flex items-center gap-2"
        >
          Lihat semua tasks <Icon icon="solar:alt-arrow-right-linear" className="text-base" />
        </button>
      </div>
    </div>
  );
}
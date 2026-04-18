"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import type { AgentTask } from "./types";
import { cn, humanTime, humanDateShort } from "./utils";

function isOverdue(iso?: string) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function isToday(iso?: string) {
  if (!iso) return false;
  const d   = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth() &&
    d.getDate()     === now.getDate()
  );
}

function TaskSkeleton() {
  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-white/8" />
          <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/8" />
      </div>
      <div className="mt-5 space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function channelIcon(c?: AgentTask["channel"]) {
  if (c === "WA")   return { icon: "solar:chat-round-call-bold-duotone", color: "text-emerald-200 bg-emerald-500/10 border-emerald-400/25" };
  if (c === "CALL") return { icon: "solar:phone-calling-rounded-bold-duotone", color: "text-sky-200 bg-sky-500/10 border-sky-400/25" };
  if (c === "MEET") return { icon: "solar:buildings-3-bold-duotone", color: "text-violet-200 bg-violet-500/10 border-violet-400/25" };
  return                   { icon: "solar:checklist-minimalistic-bold-duotone", color: "text-slate-300 bg-white/5 border-white/10" };
}

function TaskRow({ task, overdue }: { task: AgentTask; overdue?: boolean }) {
  const ch   = channelIcon(task.channel);
  const time = isToday(task.dueAt) ? humanTime(task.dueAt) : humanDateShort(task.dueAt);

  return (
    <div
      className={cn(
        "group rounded-2xl border p-4 transition-all",
        overdue
          ? "border-rose-400/25 bg-rose-500/6 hover:border-rose-400/40"
          : task.priority === "HIGH"
          ? "border-amber-400/20 bg-amber-500/5 hover:border-amber-400/35"
          : "border-white/8 bg-black/20 hover:border-white/15",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Channel icon */}
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base",
            ch.color,
          )}
        >
          <Icon icon={ch.icon} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white leading-tight truncate">
              {task.title}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {overdue && (
                <span className="rounded-md border border-rose-400/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                  OVERDUE
                </span>
              )}
              <span
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                  task.priority === "HIGH"
                    ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                    : task.priority === "MEDIUM"
                    ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                    : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
                )}
              >
                {task.priority}
              </span>
            </div>
          </div>

          <p className="mt-0.5 text-[11px] text-slate-400 truncate">
            {task.leadName ? `${task.leadName} · ` : ""}
            <span className={cn("font-medium", overdue ? "text-rose-300" : "text-slate-300")}>
              {overdue ? "Telat — " : "Due "}{time}
            </span>
          </p>
        </div>
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {task.channel === "WA" && (
            <a
              href={`https://wa.me/`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/15 transition"
            >
              <Icon icon="solar:chat-round-call-bold" className="text-sm" />
              WA
            </a>
          )}
          {task.channel === "CALL" && (
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg border border-sky-400/25 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-medium text-sky-200 hover:bg-sky-500/15 transition"
            >
              <Icon icon="solar:phone-calling-rounded-bold" className="text-sm" />
              Telepon
            </button>
          )}
          {task.channel === "MEET" && (
            <Link
              href="/dashboard/jadwal-acara"
              className="flex items-center gap-1 rounded-lg border border-violet-400/25 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-medium text-violet-200 hover:bg-violet-500/15 transition"
            >
              <Icon icon="solar:map-point-wave-bold" className="text-sm" />
              Viewing
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/10 transition"
          >
            <Icon icon="solar:check-read-linear" className="text-sm" />
            Selesai
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-500/15 transition"
          >
            <Icon icon="solar:eye-bold" className="text-sm" />
            Detail
          </button>
        </div>
      </div>
    </div>
  );
}

export function AgentTasksCard({
  loading,
  tasks,
}: {
  loading: boolean;
  tasks?: AgentTask[];
}) {
  if (loading) return <TaskSkeleton />;

  const list     = tasks ?? [];
  const overdue  = list.filter((t) => isOverdue(t.dueAt)).sort((a, b) => (a.priority > b.priority ? -1 : 1));
  const high     = list.filter((t) => !isOverdue(t.dueAt) && t.priority === "HIGH");
  const rest     = list.filter((t) => !isOverdue(t.dueAt) && t.priority !== "HIGH").slice(0, 4);
  const total    = list.length;

  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Today</p>
          <h3 className="mt-0.5 text-base font-bold text-white">Follow-up & Tasks</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {overdue.length > 0
              ? <span className="text-rose-300 font-semibold">{overdue.length} overdue — selesaikan segera!</span>
              : `${total} tasks aktif — prioritaskan yang HIGH dulu.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {overdue.length > 0 && (
            <div className="flex h-9 w-9 animate-pulse items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10">
              <Icon icon="solar:bell-bing-bold-duotone" className="text-base text-rose-300" />
            </div>
          )}
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
            <Icon icon="solar:checklist-bold-duotone" className="text-xl text-emerald-200" />
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-6 text-center">
          <Icon icon="solar:confetti-bold-duotone" className="mx-auto text-3xl text-emerald-200" />
          <p className="mt-2 text-sm font-semibold text-white">Semua bersih! Tidak ada task mendesak</p>
          <p className="mt-1 text-xs text-slate-400">
            Tambahkan follow-up untuk menjaga pipeline tetap bergerak.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {/* Overdue */}
          {overdue.length > 0 && (
            <>
              <SectionDivider label="Overdue" icon="solar:danger-triangle-bold-duotone" color="rose" />
              {overdue.slice(0, 3).map((t) => (
                <TaskRow key={t.id} task={t} overdue />
              ))}
            </>
          )}

          {/* HIGH priority */}
          {high.length > 0 && (
            <>
              <SectionDivider label="Prioritas Tinggi" icon="solar:fire-bold-duotone" color="amber" />
              {high.slice(0, 3).map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </>
          )}

          {/* Rest */}
          {rest.length > 0 && (
            <>
              {(overdue.length > 0 || high.length > 0) && (
                <SectionDivider label="Lainnya" icon="solar:checklist-minimalistic-bold-duotone" color="slate" />
              )}
              {rest.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <p className="text-[11px] text-slate-500">{total} total tasks</p>
        <Link
          href="/dashboard/tasks"
          className="flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-emerald-200"
        >
          Lihat semua
          <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
        </Link>
      </div>
    </div>
  );
}

function SectionDivider({
  label,
  icon,
  color,
}: {
  label: string;
  icon: string;
  color: "rose" | "amber" | "slate";
}) {
  const c = {
    rose:  "text-rose-300",
    amber: "text-amber-300",
    slate: "text-slate-400",
  };
  return (
    <div className={cn("flex items-center gap-1.5 pt-1 pb-0.5", c[color])}>
      <Icon icon={icon} className="text-sm" />
      <p className="text-[10px] font-bold uppercase tracking-[0.15em]">{label}</p>
      <div className="flex-1 h-px bg-white/5 ml-1" />
    </div>
  );
}

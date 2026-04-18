"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import type { AgentTask } from "./types";
import { cn, humanTime } from "./utils";

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

function isOverdue(iso?: string) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function isPast(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso);
  return d < new Date();
}

function ScheduleSkeleton() {
  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-white/8" />
          <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/8" />
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function channelMeta(channel?: AgentTask["channel"]) {
  if (channel === "MEET")  return { icon: "solar:buildings-3-bold-duotone", label: "Viewing",     color: "text-sky-200",    bg: "bg-sky-500/10 border-sky-400/25" };
  if (channel === "CALL")  return { icon: "solar:phone-calling-rounded-bold-duotone", label: "Call",       color: "text-emerald-200", bg: "bg-emerald-500/10 border-emerald-400/25" };
  if (channel === "WA")    return { icon: "solar:chat-round-call-bold-duotone", label: "WhatsApp",   color: "text-emerald-200", bg: "bg-emerald-500/10 border-emerald-400/25" };
  return                         { icon: "solar:checklist-minimalistic-bold-duotone", label: "Task",       color: "text-slate-300",   bg: "bg-white/5 border-white/10" };
}

function priorityDot(p: AgentTask["priority"]) {
  if (p === "HIGH")   return "bg-rose-400";
  if (p === "MEDIUM") return "bg-amber-400";
  return                     "bg-emerald-400/50";
}

export function AgentTodaySchedule({
  loading,
  tasks,
}: {
  loading: boolean;
  tasks?: AgentTask[];
}) {
  if (loading) return <ScheduleSkeleton />;

  const all = tasks ?? [];

  // All tasks for today ordered by time
  const todayTasks = all
    .filter((t) => isToday(t.dueAt))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  // Split to upcoming vs past
  const upcoming = todayTasks.filter((t) => !isPast(t.dueAt));
  const pastToday = todayTasks.filter((t) => isPast(t.dueAt));

  const overduePastDays = all.filter((t) => !isToday(t.dueAt) && isOverdue(t.dueAt));

  const viewingsToday = todayTasks.filter((t) => t.channel === "MEET");

  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Jadwal</p>
          <h3 className="mt-0.5 text-base font-bold text-white">Hari Ini</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {todayTasks.length
              ? `${todayTasks.length} aktivitas — ${viewingsToday.length} viewing`
              : "Tidak ada jadwal hari ini"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overduePastDays.length > 0 && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-center">
              <p className="text-[10px] font-bold text-rose-300">{overduePastDays.length} overdue</p>
            </div>
          )}
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
            <Icon icon="solar:calendar-date-bold-duotone" className="text-xl text-sky-200" />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {todayTasks.length === 0 && overduePastDays.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-6 text-center">
          <Icon icon="solar:calendar-smile-bold-duotone" className="mx-auto text-3xl text-emerald-200" />
          <p className="mt-2 text-sm font-semibold text-white">Jadwal hari ini kosong</p>
          <p className="mt-1 text-xs text-slate-400">
            Tambahkan viewing atau follow-up dari{" "}
            <Link href="/dashboard/jadwal-acara" className="text-emerald-300 underline underline-offset-2">
              Jadwal & Acara
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {/* Overdue from past days */}
          {overduePastDays.length > 0 && (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="solar:danger-triangle-bold-duotone" className="text-sm text-rose-300" />
                <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">
                  {overduePastDays.length} Overdue dari hari sebelumnya
                </p>
              </div>
              {overduePastDays.slice(0, 2).map((t) => (
                <ScheduleRow key={t.id} task={t} overdue />
              ))}
              {overduePastDays.length > 2 && (
                <Link
                  href="/dashboard/tasks"
                  className="mt-1 flex items-center justify-center gap-1 text-[10px] text-rose-300/70 hover:text-rose-300 transition"
                >
                  +{overduePastDays.length - 2} lainnya <Icon icon="solar:alt-arrow-right-linear" className="text-xs" />
                </Link>
              )}
            </div>
          )}

          {/* Today upcoming */}
          {upcoming.map((t) => (
            <ScheduleRow key={t.id} task={t} />
          ))}

          {/* Past today */}
          {pastToday.map((t) => (
            <ScheduleRow key={t.id} task={t} dimmed />
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Link
          href="/dashboard/jadwal-acara"
          className="flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-sky-200"
        >
          Buka kalender
          <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
        </Link>
      </div>
    </div>
  );
}

function ScheduleRow({
  task,
  overdue,
  dimmed,
}: {
  task: AgentTask;
  overdue?: boolean;
  dimmed?: boolean;
}) {
  const meta = channelMeta(task.channel);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition",
        overdue
          ? "border-rose-400/25 bg-rose-500/8"
          : dimmed
          ? "border-white/5 bg-black/10 opacity-50"
          : "border-white/8 bg-black/20 hover:border-white/15",
      )}
    >
      {/* Time */}
      <div className="flex flex-col items-center gap-0.5 pt-0.5 w-10 shrink-0">
        <p className={cn("text-[11px] font-bold tabular-nums", overdue ? "text-rose-300" : "text-slate-300")}>
          {humanTime(task.dueAt)}
        </p>
        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", priorityDot(task.priority))} />
      </div>

      {/* Icon */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm",
          meta.bg,
          meta.color,
        )}
      >
        <Icon icon={meta.icon} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-white truncate">{task.title}</p>
        <p className="text-[10px] text-slate-400 truncate">
          {task.leadName ? `${task.leadName} · ` : ""}{meta.label}
          {overdue && <span className="ml-1 text-rose-400 font-semibold">· OVERDUE</span>}
        </p>
      </div>
    </div>
  );
}

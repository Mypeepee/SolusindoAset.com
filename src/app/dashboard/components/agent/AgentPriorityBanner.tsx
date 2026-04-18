"use client";

import { Icon } from "@iconify/react";
import type { AgentDashboardData } from "./types";

function isToday(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isOverdue(iso?: string) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

type AlertItem = {
  icon: string;
  label: string;
  count: number;
  color: "rose" | "amber" | "sky" | "emerald" | "violet";
  href?: string;
  urgent?: boolean;
};

export function AgentPriorityBanner({
  loading,
  data,
}: {
  loading: boolean;
  data?: AgentDashboardData | null;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#07090f] p-4">
        <div className="flex items-center gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 flex-1 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const tasks    = data?.tasks ?? [];
  const leads    = data?.leads ?? [];
  const pipeline = data?.pipeline;

  const overdueTasks  = tasks.filter((t) => isOverdue(t.dueAt));
  const todayTasks    = tasks.filter((t) => isToday(t.dueAt) && !isOverdue(t.dueAt));
  const todayViewings = tasks.filter((t) => t.channel === "MEET" && isToday(t.dueAt));
  const hotLeads      = leads.filter((l) => l.status === "HOT");
  const negotiation   = pipeline?.negotiation ?? 0;

  const alerts: AlertItem[] = [
    {
      icon: "solar:danger-triangle-bold-duotone",
      label: "Overdue Tasks",
      count: overdueTasks.length,
      color: "rose",
      urgent: overdueTasks.length > 0,
      href: "/dashboard/tasks",
    },
    {
      icon: "solar:fire-bold-duotone",
      label: "Hot Leads",
      count: hotLeads.length,
      color: "amber",
      urgent: hotLeads.length > 0,
      href: "/dashboard/crm",
    },
    {
      icon: "solar:calendar-mark-bold-duotone",
      label: "Viewing Hari Ini",
      count: todayViewings.length,
      color: "sky",
      href: "/dashboard/jadwal-acara",
    },
    {
      icon: "solar:hand-money-bold-duotone",
      label: "Negotiation",
      count: negotiation,
      color: "violet",
      urgent: negotiation > 0,
      href: "/dashboard/crm",
    },
    {
      icon: "solar:checklist-minimalistic-bold-duotone",
      label: "Tasks Hari Ini",
      count: todayTasks.length,
      color: "emerald",
      href: "/dashboard/tasks",
    },
  ];

  const hasUrgent = alerts.some((a) => a.urgent);

  return (
    <div
      className={`rounded-2xl border p-4 transition-all ${
        hasUrgent
          ? "border-rose-400/20 bg-rose-500/5"
          : "border-white/8 bg-[#07090f]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
        {/* Label */}
        <div className="flex items-center gap-2 sm:w-44 sm:shrink-0">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
              hasUrgent
                ? "border-rose-400/30 bg-rose-500/15"
                : "border-white/10 bg-white/5"
            }`}
          >
            <Icon
              icon={hasUrgent ? "solar:bell-bing-bold-duotone" : "solar:bell-bold-duotone"}
              className={`text-base ${hasUrgent ? "text-rose-300" : "text-slate-400"}`}
            />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Prioritas
            </p>
            <p className={`text-xs font-semibold ${hasUrgent ? "text-rose-300" : "text-slate-300"}`}>
              {hasUrgent ? "Perlu Tindakan!" : "Semua Aman"}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden h-10 w-px bg-white/8 sm:block sm:mx-4" />

        {/* Alert chips */}
        <div className="flex flex-1 flex-wrap gap-2">
          {alerts.map((a) => (
            <AlertChip key={a.label} {...a} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertChip({ icon, label, count, color, urgent }: AlertItem) {
  const styles = {
    rose: {
      chip: urgent
        ? "border-rose-400/40 bg-rose-500/12 text-rose-200"
        : "border-white/8 bg-white/3 text-slate-400",
      badge: "bg-rose-500/20 text-rose-200",
    },
    amber: {
      chip: urgent
        ? "border-amber-400/40 bg-amber-500/12 text-amber-200"
        : "border-white/8 bg-white/3 text-slate-400",
      badge: "bg-amber-500/20 text-amber-200",
    },
    sky: {
      chip: count > 0
        ? "border-sky-400/30 bg-sky-500/10 text-sky-200"
        : "border-white/8 bg-white/3 text-slate-400",
      badge: "bg-sky-500/20 text-sky-200",
    },
    emerald: {
      chip: count > 0
        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
        : "border-white/8 bg-white/3 text-slate-400",
      badge: "bg-emerald-500/20 text-emerald-200",
    },
    violet: {
      chip: urgent
        ? "border-violet-400/30 bg-violet-500/10 text-violet-200"
        : "border-white/8 bg-white/3 text-slate-400",
      badge: "bg-violet-500/20 text-violet-200",
    },
  };

  const s = styles[color];

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all ${s.chip}`}
    >
      <Icon icon={icon} className="text-base shrink-0" />
      <span className="text-[11px] font-medium whitespace-nowrap">{label}</span>
      <span
        className={`ml-0.5 min-w-[20px] rounded-md px-1.5 py-0.5 text-center text-[11px] font-extrabold tabular-nums ${s.badge}`}
      >
        {count}
      </span>
    </div>
  );
}

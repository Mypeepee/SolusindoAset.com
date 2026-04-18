"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { cn } from "./utils";

type Action = {
  icon: string;
  label: string;
  desc: string;
  href: string;
  color: "emerald" | "sky" | "amber" | "violet" | "rose";
  badge?: string | number;
};

const ACTIONS: Action[] = [
  {
    icon: "solar:home-add-bold-duotone",
    label: "Tambah Listing",
    desc: "Publikasikan properti baru ke marketplace",
    href: "/dashboard/listings",
    color: "emerald",
  },
  {
    icon: "solar:user-plus-bold-duotone",
    label: "Tambah Lead",
    desc: "Catat lead baru dari WA, IG, atau referral",
    href: "/dashboard/crm",
    color: "sky",
  },
  {
    icon: "solar:calendar-add-bold-duotone",
    label: "Jadwalkan Viewing",
    desc: "Atur kunjungan properti dengan klien",
    href: "/dashboard/jadwal-acara",
    color: "amber",
  },
  {
    icon: "solar:document-add-bold-duotone",
    label: "Buat Surat",
    desc: "SPK, surat penawaran, atau dokumen legal",
    href: "/dashboard/surat",
    color: "violet",
  },
  {
    icon: "solar:presentation-graph-bold-duotone",
    label: "Lihat Project",
    desc: "Deal aktif dan pipeline investasi",
    href: "/dashboard/project",
    color: "rose",
  },
  {
    icon: "solar:checklist-bold-duotone",
    label: "Kelola Tasks",
    desc: "Follow-up dan reminder harian",
    href: "/dashboard/tasks",
    color: "emerald",
  },
];

const colorMap = {
  emerald: {
    icon:    "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    hover:   "hover:border-emerald-400/30 hover:bg-emerald-500/[0.06]",
    arrow:   "text-emerald-400/50 group-hover:text-emerald-300",
    badge:   "bg-emerald-500/20 text-emerald-200",
  },
  sky: {
    icon:    "border-sky-400/25 bg-sky-500/10 text-sky-200",
    hover:   "hover:border-sky-400/30 hover:bg-sky-500/[0.06]",
    arrow:   "text-sky-400/50 group-hover:text-sky-300",
    badge:   "bg-sky-500/20 text-sky-200",
  },
  amber: {
    icon:    "border-amber-400/25 bg-amber-500/10 text-amber-200",
    hover:   "hover:border-amber-400/30 hover:bg-amber-500/[0.06]",
    arrow:   "text-amber-400/50 group-hover:text-amber-300",
    badge:   "bg-amber-500/20 text-amber-200",
  },
  violet: {
    icon:    "border-violet-400/25 bg-violet-500/10 text-violet-200",
    hover:   "hover:border-violet-400/30 hover:bg-violet-500/[0.06]",
    arrow:   "text-violet-400/50 group-hover:text-violet-300",
    badge:   "bg-violet-500/20 text-violet-200",
  },
  rose: {
    icon:    "border-rose-400/25 bg-rose-500/10 text-rose-200",
    hover:   "hover:border-rose-400/30 hover:bg-rose-500/[0.06]",
    arrow:   "text-rose-400/50 group-hover:text-rose-300",
    badge:   "bg-rose-500/20 text-rose-200",
  },
};

export function AgentQuickActions({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Quick Actions</p>
          <p className="text-sm font-semibold text-white">Akses Cepat</p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-slate-400 transition hover:border-white/15 hover:text-slate-200"
          >
            <Icon icon="solar:refresh-bold" className="text-sm text-emerald-300" />
            Refresh
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {ACTIONS.map((a) => {
          const c = colorMap[a.color];
          return (
            <Link
              key={a.label}
              href={a.href}
              className={cn(
                "group relative flex flex-col rounded-2xl border border-white/8 bg-[#07090f] p-4 transition-all duration-150",
                "active:scale-[0.98]",
                c.hover,
              )}
            >
              {/* Badge */}
              {a.badge !== undefined && (
                <span
                  className={cn(
                    "absolute right-3 top-3 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold",
                    c.badge,
                  )}
                >
                  {a.badge}
                </span>
              )}

              {/* Icon */}
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl border transition",
                  c.icon,
                )}
              >
                <Icon icon={a.icon} className="text-[22px]" />
              </div>

              {/* Text */}
              <p className="mt-3 text-sm font-bold text-white">{a.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{a.desc}</p>

              {/* Arrow */}
              <div className="mt-3 flex justify-end">
                <Icon
                  icon="solar:arrow-right-up-linear"
                  className={cn("text-base transition", c.arrow)}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

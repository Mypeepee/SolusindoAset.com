"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import type { AgentListing } from "./types";
import { cn, compactNumber, formatIDR } from "./utils";

function ListingsSkeleton() {
  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-white/8" />
          <div className="h-5 w-44 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/8" />
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function statusMeta(s: AgentListing["status"]) {
  if (s === "ACTIVE") return { label: "Aktif",  border: "border-emerald-400/30", bg: "bg-emerald-500/10", text: "text-emerald-200" };
  if (s === "SOLD")   return { label: "Terjual", border: "border-sky-400/30",    bg: "bg-sky-500/10",    text: "text-sky-200" };
  return                     { label: "Draft",   border: "border-white/10",       bg: "bg-white/5",       text: "text-slate-300" };
}

function performanceScore(views: number, inquiries: number): { score: number; label: string; color: string } {
  if (views === 0) return { score: 0,  label: "Belum ada data", color: "text-slate-500" };
  const rate = inquiries / views;
  if (rate >= 0.1)  return { score: 5, label: "Excellent",  color: "text-emerald-300" };
  if (rate >= 0.05) return { score: 4, label: "Bagus",      color: "text-emerald-300" };
  if (rate >= 0.02) return { score: 3, label: "Cukup",      color: "text-amber-300" };
  if (rate >= 0.01) return { score: 2, label: "Perlu boost", color: "text-amber-300" };
  return                   { score: 1, label: "Rendah",     color: "text-rose-300" };
}

function PerformanceDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i < score ? "bg-emerald-400" : "bg-white/10",
          )}
        />
      ))}
    </div>
  );
}

function ListingRow({ listing }: { listing: AgentListing }) {
  const status = statusMeta(listing.status);
  const perf   = performanceScore(listing.views7d, listing.inquiries7d);
  const ctr    = listing.views7d > 0
    ? `${((listing.inquiries7d / listing.views7d) * 100).toFixed(1)}%`
    : "—";

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-black/20 p-4 transition-all",
        "hover:border-white/15 hover:bg-black/30",
        listing.status === "SOLD" && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-base",
                status.border, status.bg,
              )}
            >
              <Icon
                icon="solar:home-smile-bold-duotone"
                className={status.text}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{listing.title}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {listing.area} · {formatIDR(listing.price)}
              </p>
            </div>
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold",
            status.border, status.bg, status.text,
          )}
        >
          {status.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatBox
          icon="solar:eye-bold"
          iconColor="text-sky-200"
          label="Views"
          value={compactNumber(listing.views7d)}
          sub="7 hari"
        />
        <StatBox
          icon="solar:inbox-bold"
          iconColor="text-emerald-200"
          label="Inquiry"
          value={compactNumber(listing.inquiries7d)}
          sub="7 hari"
        />
        <div className="rounded-xl border border-white/8 bg-black/20 px-2 py-2">
          <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">CTR</p>
          <p className={cn("mt-0.5 text-sm font-extrabold tabular-nums", perf.color)}>{ctr}</p>
          <PerformanceDots score={perf.score} />
        </div>
      </div>

      {/* Performance label */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon icon="solar:chart-square-bold-duotone" className={cn("text-sm", perf.color)} />
          <span className={cn("text-[10px] font-medium", perf.color)}>{perf.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-1 text-[10px] text-slate-300 hover:bg-white/10 transition"
          >
            Edit
          </button>
          <Link
            href="/dashboard/listings"
            className="flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-500/8 px-2.5 py-1 text-[10px] text-emerald-200 hover:bg-emerald-500/12 transition"
          >
            <Icon icon="solar:arrow-right-up-linear" className="text-[10px]" />
            Lihat
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  icon,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-2 py-2">
      <div className="flex items-center gap-1">
        <Icon icon={icon} className={cn("text-[11px]", iconColor)} />
        <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-0.5 text-sm font-extrabold text-white tabular-nums">{value}</p>
      <p className="text-[9px] text-slate-600">{sub}</p>
    </div>
  );
}

export function AgentListingsCard({
  loading,
  listings,
}: {
  loading: boolean;
  listings?: AgentListing[];
}) {
  if (loading) return <ListingsSkeleton />;

  const list = listings ?? [];

  // Sort: ACTIVE first, then by inquiry count desc
  const sorted = [...list].sort((a, b) => {
    if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
    if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
    return (b.inquiries7d - a.inquiries7d) || (b.views7d - a.views7d);
  });

  const active     = list.filter((l) => l.status === "ACTIVE").length;
  const needsBoost = list.filter((l) => {
    const p = performanceScore(l.views7d, l.inquiries7d);
    return l.status === "ACTIVE" && p.score <= 2;
  }).length;

  const displayed = sorted.slice(0, 6);

  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Listings</p>
          <h3 className="mt-0.5 text-base font-bold text-white">Performa Listing</h3>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-500/8 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
              {active} Aktif
            </span>
            {needsBoost > 0 && (
              <span className="flex items-center gap-1 rounded-md border border-amber-400/25 bg-amber-500/8 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                <Icon icon="solar:danger-triangle-bold-duotone" className="text-[10px]" />
                {needsBoost} perlu boost
              </span>
            )}
          </div>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
          <Icon icon="solar:home-smile-bold-duotone" className="text-xl text-emerald-200" />
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-6 text-center">
          <Icon icon="solar:home-add-bold-duotone" className="mx-auto text-3xl text-emerald-200" />
          <p className="mt-2 text-sm font-semibold text-white">Belum ada listing</p>
          <p className="mt-1 text-xs text-slate-400">
            Mulai dari{" "}
            <Link href="/dashboard/listings" className="text-emerald-300 underline underline-offset-2">
              tambah listing
            </Link>{" "}
            untuk mendapatkan leads.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {displayed.map((l) => (
            <ListingRow key={l.id} listing={l} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <p className="text-[11px] text-slate-500">{list.length} total listings</p>
        <Link
          href="/dashboard/listings"
          className="flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-emerald-200"
        >
          Kelola listing
          <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
        </Link>
      </div>
    </div>
  );
}


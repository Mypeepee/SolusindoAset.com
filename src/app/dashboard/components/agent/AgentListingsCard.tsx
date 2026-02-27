"use client";

import { Icon } from "@iconify/react";
import type { AgentListing } from "./types";
import { cn, compactNumber, formatIDR } from "./utils";

function ListingsSkeleton() {
  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function statusPill(s: AgentListing["status"]) {
  if (s === "ACTIVE") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (s === "SOLD") return "border-sky-400/30 bg-sky-500/10 text-sky-200";
  return "border-white/10 bg-white/5 text-slate-200";
}

export function AgentListingsCard({ loading, listings }: { loading: boolean; listings?: AgentListing[] }) {
  if (loading) return <ListingsSkeleton />;

  const list = listings || [];

  const sorted = [...list].sort((a, b) => (b.inquiries7d - a.inquiries7d) || (b.views7d - a.views7d));
  const top = sorted.slice(0, 7);

  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">Listings</p>
          <h3 className="mt-1 text-base font-bold text-white">Performa Listing</h3>
          <p className="mt-1 text-[11px] text-slate-500">Dorong listing yang inquiry-nya rendah.</p>
        </div>
        <div className="h-10 w-10 rounded-2xl border border-white/10 bg-black/30 flex items-center justify-center">
          <Icon icon="solar:home-smile-bold-duotone" className="text-xl text-emerald-200" />
        </div>
      </div>

      {top.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
          <Icon icon="solar:home-add-bold-duotone" className="text-3xl text-emerald-200 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-white">Belum ada listing</p>
          <p className="mt-1 text-xs text-slate-400">Mulai dari upload listing utama kamu untuk dapat leads.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {top.map((l) => (
            <div
              key={l.id}
              className={cn(
                "rounded-2xl border border-white/10 bg-black/20 p-4",
                "hover:border-emerald-400/20 hover:bg-white/[0.03] transition"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{l.title}</p>
                  <p className="mt-1 text-[11px] text-slate-400 truncate">
                    {l.area} • {formatIDR(l.price)}
                  </p>
                </div>
                <span className={cn("px-2 py-1 rounded-full border text-[10px] font-semibold shrink-0", statusPill(l.status))}>
                  {l.status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 flex items-center gap-2">
                    <Icon icon="solar:eye-bold" className="text-base text-sky-200" />
                    Views (7d)
                  </span>
                  <span className="text-xs font-bold text-white">{compactNumber(l.views7d)}</span>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 flex items-center gap-2">
                    <Icon icon="solar:inbox-bold" className="text-base text-emerald-200" />
                    Inquiry (7d)
                  </span>
                  <span className="text-xs font-bold text-white">{compactNumber(l.inquiries7d)}</span>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => alert("TODO: edit listing")}
                  className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white/90 transition"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => alert("TODO: open listing")}
                  className="px-3 py-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-xs text-emerald-200 transition flex items-center gap-2"
                >
                  <Icon icon="solar:arrow-right-up-linear" className="text-base" />
                  Lihat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => alert("TODO: open all listings")}
          className="text-xs text-slate-400 hover:text-emerald-200 transition flex items-center gap-2"
        >
          Kelola listing <Icon icon="solar:alt-arrow-right-linear" className="text-base" />
        </button>
      </div>
    </div>
  );
}
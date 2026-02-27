"use client";

import { Icon } from "@iconify/react";
import type { AgentLead } from "./types";
import { cn, humanDateShort, safePhoneToWa } from "./utils";

function LeadsSkeleton() {
  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="h-5 w-36 bg-white/10 rounded animate-pulse" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function leadBadge(s: AgentLead["status"]) {
  if (s === "HOT") return "border-rose-400/40 bg-rose-500/10 text-rose-200";
  if (s === "WARM") return "border-amber-400/40 bg-amber-500/10 text-amber-200";
  return "border-slate-400/20 bg-white/5 text-slate-200";
}

export function AgentLeadsInbox({ loading, leads }: { loading: boolean; leads?: AgentLead[] }) {
  if (loading) return <LeadsSkeleton />;

  const list = leads || [];

  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">Inbox</p>
          <h3 className="mt-1 text-base font-bold text-white">Leads Terbaru</h3>
          <p className="mt-1 text-[11px] text-slate-500">Cepat respon = konversi naik.</p>
        </div>
        <div className="h-10 w-10 rounded-2xl border border-white/10 bg-black/30 flex items-center justify-center">
          <Icon icon="solar:inbox-bold-duotone" className="text-xl text-emerald-200" />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
          <Icon icon="solar:chat-round-dots-bold-duotone" className="text-3xl text-emerald-200 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-white">Belum ada lead masuk</p>
          <p className="mt-1 text-xs text-slate-400">Kamu bisa tambahkan lead manual dari WhatsApp / Instagram.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {list.slice(0, 7).map((l) => {
            const wa = safePhoneToWa(l.phone);
            return (
              <div
                key={l.id}
                className={cn(
                  "rounded-2xl border border-white/10 bg-black/20 p-4",
                  "hover:border-emerald-400/20 hover:bg-white/[0.03] transition"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{l.name}</p>
                    <p className="mt-1 text-[11px] text-slate-400 truncate">
                      {l.source} • Last contact: {humanDateShort(l.lastContactAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("px-2 py-1 rounded-full border text-[10px] font-semibold", leadBadge(l.status))}>
                      {l.status}
                    </span>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="h-9 w-9 rounded-xl border border-emerald-400/25 bg-emerald-500/10 hover:bg-emerald-500/15 flex items-center justify-center transition"
                        title="WhatsApp"
                      >
                        <Icon icon="solar:chat-round-call-bold" className="text-lg text-emerald-200" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => alert("No WA tersedia")}
                        className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center"
                        title="WhatsApp"
                      >
                        <Icon icon="solar:chat-round-call-bold" className="text-lg text-slate-400" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => alert("TODO: assign / update status")}
                    className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white/90 transition"
                  >
                    Update Status
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("TODO: open CRM lead detail")}
                    className="px-3 py-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-xs text-emerald-200 transition flex items-center gap-2"
                  >
                    <Icon icon="solar:arrow-right-up-linear" className="text-base" />
                    Detail
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => alert("TODO: open CRM")}
          className="text-xs text-slate-400 hover:text-emerald-200 transition flex items-center gap-2"
        >
          Buka CRM <Icon icon="solar:alt-arrow-right-linear" className="text-base" />
        </button>
      </div>
    </div>
  );
}
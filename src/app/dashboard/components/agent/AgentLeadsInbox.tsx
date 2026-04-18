"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import type { AgentLead } from "./types";
import { cn, humanDateShort, safePhoneToWa } from "./utils";

function LeadsSkeleton() {
  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-white/8" />
          <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/8" />
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function responseUrgency(days: number | null): { label: string; color: string } {
  if (days === null) return { label: "Baru",         color: "text-slate-400" };
  if (days === 0)    return { label: "Hari ini",     color: "text-emerald-300" };
  if (days === 1)    return { label: "Kemarin",      color: "text-amber-300" };
  if (days <= 3)     return { label: `${days}h lalu`, color: "text-amber-300" };
  if (days <= 7)     return { label: `${days}h lalu`, color: "text-rose-300" };
  return               { label: `${days}h — follow-up!`, color: "text-rose-400 font-semibold" };
}

function sourceMeta(source: string): { icon: string; short: string } {
  const s = source.toLowerCase();
  if (s.includes("instagram") || s.includes("ig"))   return { icon: "solar:instagram-linear",      short: "IG" };
  if (s.includes("whatsapp") || s.includes("wa"))     return { icon: "solar:chat-round-call-linear", short: "WA" };
  if (s.includes("referral") || s.includes("ref"))    return { icon: "solar:users-group-two-rounded-linear", short: "Ref" };
  if (s.includes("website") || s.includes("web"))     return { icon: "solar:global-linear",          short: "Web" };
  if (s.includes("facebook") || s.includes("fb"))     return { icon: "solar:facebook-circle-linear", short: "FB" };
  if (s.includes("tiktok"))                            return { icon: "solar:play-circle-linear",     short: "TT" };
  return                                               { icon: "solar:user-linear",                   short: source.slice(0, 3) };
}

function tempMeta(status: AgentLead["status"]) {
  if (status === "HOT")  return { icon: "solar:fire-bold-duotone",   label: "HOT",  border: "border-rose-400/40",   bg: "bg-rose-500/12",   text: "text-rose-200",   glow: "shadow-[0_0_12px_rgba(239,68,68,0.15)]" };
  if (status === "WARM") return { icon: "solar:sun-2-bold-duotone",  label: "WARM", border: "border-amber-400/40",  bg: "bg-amber-500/12",  text: "text-amber-200",  glow: "" };
  return                        { icon: "solar:snowflake-bold-duotone", label: "COLD", border: "border-sky-400/25",    bg: "bg-sky-500/8",     text: "text-sky-200",    glow: "" };
}

function LeadRow({ lead }: { lead: AgentLead }) {
  const temp   = tempMeta(lead.status);
  const src    = sourceMeta(lead.source);
  const days   = daysSince(lead.lastContactAt);
  const urg    = responseUrgency(days);
  const wa     = safePhoneToWa(lead.phone);

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-all",
        lead.status === "HOT"
          ? cn("border-rose-400/20 bg-rose-500/5 hover:border-rose-400/35", temp.glow)
          : lead.status === "WARM"
          ? "border-amber-400/15 bg-amber-500/4 hover:border-amber-400/30"
          : "border-white/8 bg-black/20 hover:border-white/15",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar initial */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold",
            temp.border,
            temp.bg,
            temp.text,
          )}
        >
          {lead.name.charAt(0).toUpperCase()}
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-white truncate">{lead.name}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={cn(
                  "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                  temp.border, temp.bg, temp.text,
                )}
              >
                <Icon icon={temp.icon} className="text-[10px]" />
                {temp.label}
              </span>
            </div>
          </div>

          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Icon icon={src.icon} className="text-[11px]" />
              {src.short}
            </span>
            <span className="text-[10px] text-slate-600">·</span>
            <span className={cn("text-[10px]", urg.color)}>
              {urg.label}
            </span>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/15 transition"
            >
              <Icon icon="solar:chat-round-call-bold" className="text-sm" />
              WhatsApp
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/3 px-2.5 py-1.5 text-[11px] text-slate-500 cursor-not-allowed"
            >
              <Icon icon="solar:chat-round-call-bold" className="text-sm" />
              WA
            </button>
          )}
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg border border-sky-400/20 bg-sky-500/8 px-2.5 py-1.5 text-[11px] font-medium text-sky-200 hover:bg-sky-500/12 transition"
          >
            <Icon icon="solar:calendar-add-bold" className="text-sm" />
            Jadwalkan
          </button>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/10 transition"
        >
          <Icon icon="solar:pen-bold" className="text-sm" />
          Update
        </button>
      </div>
    </div>
  );
}

export function AgentLeadsInbox({
  loading,
  leads,
}: {
  loading: boolean;
  leads?: AgentLead[];
}) {
  if (loading) return <LeadsSkeleton />;

  const list = leads ?? [];

  // Sort: HOT first, then WARM, then COLD; within same temp sort by last contact (oldest first = most urgent)
  const sorted = [...list].sort((a, b) => {
    const order = { HOT: 0, WARM: 1, COLD: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    const da = a.lastContactAt ? new Date(a.lastContactAt).getTime() : 0;
    const db = b.lastContactAt ? new Date(b.lastContactAt).getTime() : 0;
    return da - db; // oldest first (most urgent)
  });

  const hot  = sorted.filter((l) => l.status === "HOT").length;
  const warm = sorted.filter((l) => l.status === "WARM").length;
  const displayed = sorted.slice(0, 7);

  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">CRM</p>
          <h3 className="mt-0.5 text-base font-bold text-white">Leads Inbox</h3>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {hot > 0 && (
              <span className="flex items-center gap-1 rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                <Icon icon="solar:fire-bold-duotone" className="text-[10px]" />
                {hot} HOT
              </span>
            )}
            {warm > 0 && (
              <span className="flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                <Icon icon="solar:sun-2-bold-duotone" className="text-[10px]" />
                {warm} WARM
              </span>
            )}
            {list.length === 0 && (
              <p className="text-[11px] text-slate-500">Belum ada leads</p>
            )}
          </div>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
          <Icon icon="solar:inbox-bold-duotone" className="text-xl text-amber-200" />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-6 text-center">
          <Icon icon="solar:user-plus-bold-duotone" className="mx-auto text-3xl text-sky-200" />
          <p className="mt-2 text-sm font-semibold text-white">Belum ada lead masuk</p>
          <p className="mt-1 text-xs text-slate-400">
            Tambahkan lead dari{" "}
            <Link href="/dashboard/crm" className="text-emerald-300 underline underline-offset-2">
              CRM
            </Link>{" "}
            atau WhatsApp / Instagram.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {displayed.map((l) => (
            <LeadRow key={l.id} lead={l} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <p className="text-[11px] text-slate-500">{list.length} total leads</p>
        <Link
          href="/dashboard/crm"
          className="flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-amber-200"
        >
          Buka CRM
          <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
        </Link>
      </div>
    </div>
  );
}

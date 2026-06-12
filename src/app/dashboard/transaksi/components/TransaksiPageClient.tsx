"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import PilihListingView from "./PilihListingView";
import ProgressTransaksiView from "./ProgressTransaksiView";

export default function TransaksiPageClient({ jabatan }: { jabatan?: string | null; initialListings?: unknown[] }) {
  const isPrivileged = jabatan === "OWNER" || jabatan === "PRINCIPAL";
  const searchParams = useSearchParams();
  const initialTab = isPrivileged && searchParams.get("tab") === "pilih" ? "pilih" : "progress";
  const highlightKode = searchParams.get("kode") ?? undefined;
  const [tab, setTab] = useState<"pilih" | "progress">(initialTab);
  const [closingCount, setClosingCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/transaksi/progress?take=1")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.stats?.total != null) setClosingCount(json.stats.total);
      })
      .catch(() => {});
  }, []);

  const TabButton = (props: {
    active: boolean;
    onClick: () => void;
    icon: string;
    label: string;
    hint: string;
    accent: "emerald" | "cyan";
    badge?: number | null;
  }) => {
    const { active, onClick, icon, label, hint, accent, badge } = props;

    const activeStyle =
      accent === "emerald"
        ? "bg-gradient-to-b from-emerald-300/15 to-emerald-500/10 border-emerald-400/25 shadow-[0_0_0_1px_rgba(52,211,153,0.18),0_18px_50px_rgba(16,185,129,0.18)]"
        : "bg-gradient-to-b from-cyan-300/12 to-blue-500/10 border-cyan-400/20 shadow-[0_0_0_1px_rgba(34,211,238,0.14),0_18px_50px_rgba(59,130,246,0.14)]";

    const inactiveStyle =
      "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/30 hover:border-zinc-700/80";

    const iconActive = accent === "emerald" ? "text-emerald-200" : "text-cyan-200";
    const iconInactive = "text-zinc-400 group-hover:text-zinc-200";

    return (
      <button
        type="button"
        onClick={onClick}
        className={`
          group relative w-full rounded-2xl border px-4 py-3 text-left transition
          focus:outline-none focus:ring-2 focus:ring-emerald-400/10
          ${active ? activeStyle : inactiveStyle}
        `}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`
                grid h-10 w-10 place-items-center rounded-2xl border
                ${active ? "border-white/10 bg-white/5" : "border-zinc-800/70 bg-zinc-950/30"}
              `}
            >
              <Icon icon={icon} className={`text-xl ${active ? iconActive : iconInactive}`} />
            </div>
            {badge != null && badge > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white shadow-[0_0_0_2px_rgba(0,0,0,0.85),0_0_8px_rgba(239,68,68,0.5)]">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className={`truncate text-sm font-black ${active ? "text-white" : "text-zinc-200"}`}>
                {label}
              </div>
              {active ? (
                <span
                  className={`
                    inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black
                    ${accent === "emerald" ? "bg-emerald-400/15 text-emerald-200" : "bg-cyan-400/12 text-cyan-200"}
                  `}
                >
                  Active
                </span>
              ) : null}
            </div>
            <div className="truncate text-[11px] text-zinc-400">{hint}</div>
          </div>

          <Icon
            icon="solar:alt-arrow-right-linear"
            className={`text-lg transition ${active ? "text-zinc-200" : "text-zinc-600 group-hover:text-zinc-300"}`}
          />
        </div>

        {/* glow line */}
        {active ? (
          <div
            className={`
              pointer-events-none absolute inset-x-6 -bottom-px h-px
              ${accent === "emerald" ? "bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" : "bg-gradient-to-r from-transparent via-cyan-300/55 to-transparent"}
            `}
          />
        ) : null}
      </button>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
      {/* Futuristic header */}
      <div className="relative overflow-hidden rounded-[28px] border border-emerald-400/18 bg-gradient-to-b from-emerald-400/[0.16] via-zinc-950/60 to-zinc-950/35 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.10),0_30px_90px_rgba(0,0,0,0.65)]">
        {/* subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(134,239,172,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(134,239,172,0.10) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        {/* glow orbs */}
        <div className="pointer-events-none absolute -top-24 left-10 h-56 w-56 rounded-full bg-emerald-400/18 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-200 ring-1 ring-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.55)]" />
                Dashboard • Transaksi
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5">
                  <Icon icon="solar:bill-list-bold-duotone" className="text-2xl text-emerald-200" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-black tracking-tight text-white">Transaksi</h1>
                  <p className="mt-1 text-sm text-zinc-300/90">
                    Pilih listing untuk closing, lalu pantau progress transaksi—tanpa pindah konteks.
                  </p>
                </div>
              </div>
            </div>

            {/* right hint
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <Icon icon="solar:shield-check-bold-duotone" className="text-xl text-emerald-200/90" />
              <div className="leading-tight">
                <div className="text-xs font-black text-white">Workspace Mode</div>
                <div className="text-[11px] text-zinc-400">Fokus, cepat, dan rapi.</div>
              </div>
            </div> */}
          </div>

          {/* Tabs */}
          <div className={`mt-6 grid grid-cols-1 gap-3 ${isPrivileged ? "md:grid-cols-2" : ""}`}>
            {isPrivileged && (
              <TabButton
                active={tab === "pilih"}
                onClick={() => setTab("pilih")}
                icon="solar:list-check-bold-duotone"
                label="Pilih Listing"
                hint="Filter listing dan pilih untuk closing."
                accent="emerald"
              />
            )}
            <TabButton
              active={tab === "progress"}
              onClick={() => setTab("progress")}
              icon="solar:chart-2-bold-duotone"
              label="Progress Transaksi"
              hint={isPrivileged ? "Pantau semua transaksi seluruh agent." : "Pantau progress transaksi Anda."}
              accent="cyan"
              badge={closingCount}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6">
        {isPrivileged && tab === "pilih" ? (
          <PilihListingView />
        ) : (
          <ProgressTransaksiView highlightKode={highlightKode} />
        )}
      </div>
    </div>
  );
}
"use client";

import { Icon } from "@iconify/react";
import type { ActivityRow } from "./PilihListingView";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function StatusChip({ status }: { status: string }) {
  const s = (status || "").toLowerCase();

  const cls =
    s.includes("deal") || s.includes("akad") || s.includes("sold")
      ? "border-emerald-700/30 bg-emerald-500/10 text-emerald-200"
      : s.includes("nego") || s.includes("follow")
      ? "border-amber-700/30 bg-amber-500/10 text-amber-200"
      : "border-zinc-800 bg-zinc-950/40 text-zinc-200";

  const icon =
    s.includes("deal") || s.includes("akad") || s.includes("sold")
      ? "solar:check-circle-linear"
      : s.includes("nego") || s.includes("follow")
      ? "solar:chat-round-linear"
      : "solar:clock-circle-linear";

  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", cls)}>
      <Icon icon={icon} className="text-sm" />
      {status || "Aktivitas"}
    </span>
  );
}

export default function ActivityFeed({
  rows,
  loading,
  onPick,
}: {
  rows: ActivityRow[];
  loading: boolean;
  onPick: (listingId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/40 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/60 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-2xl border border-zinc-800 bg-zinc-950/40 text-zinc-200">
            <Icon icon="solar:clock-circle-linear" className="text-lg" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Riwayat Transaksi</div>
            <div className="text-xs text-zinc-400">Aktivitas closing terbaru</div>
          </div>
        </div>

        <span className="rounded-full border border-zinc-800 bg-zinc-950/50 px-3 py-1 text-xs font-semibold text-zinc-200">
          {loading ? "…" : `${rows.length} aktivitas`}
        </span>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-3">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-14 rounded-2xl bg-zinc-900/60" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded bg-zinc-900/60" />
                    <div className="h-3 w-56 rounded bg-zinc-900/40" />
                    <div className="h-3 w-28 rounded bg-zinc-900/40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/30 p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl border border-zinc-800 bg-zinc-950/40 text-zinc-300">
              <Icon icon="solar:history-linear" className="text-3xl" />
            </div>
            <div className="mt-3 text-sm font-semibold text-white">Belum ada aktivitas transaksi</div>
            <p className="mt-1 text-xs text-zinc-400">
              Setelah kamu mulai proses closing, riwayat akan muncul di sini (timeline).
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onPick(a.listingId)}
                className={cx(
                  "group w-full rounded-2xl border border-zinc-800 bg-zinc-950/30 p-3 text-left transition",
                  "hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-12 w-14 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-white truncate">
                            {a.kode || a.id}
                          </div>
                          <StatusChip status={a.status} />
                        </div>
                        <div className="mt-1 truncate text-xs text-zinc-400">
                          {a.title}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-white">
                          {formatIDR(a.price || 0)}
                        </div>
                        <div className="text-xs text-zinc-500">{a.date}</div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                      <Icon icon="solar:map-point-linear" className="text-base text-emerald-300/90" />
                      <span className="truncate">{a.addressShort || "-"}</span>

                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500">
                        <Icon icon="solar:arrow-right-linear" className="text-base" />
                        Buka detail
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
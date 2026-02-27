"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import PilihListingView from "./PilihListingView";

export default function TransaksiPageClient() {
  const [tab, setTab] = useState<"pilih" | "progress">("pilih");

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Dashboard • Transaksi
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Transaksi</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Pilih listing untuk closing, lalu pantau progress transaksi—tanpa pindah konteks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-200 shadow-sm transition hover:bg-zinc-900/40"
            onClick={() => toast("Export", { description: "Nanti bisa export CSV/PDF." })}
          >
            <Icon icon="solar:document-download-linear" className="text-lg" />
            Export
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            onClick={() => toast("Create", { description: "Create transaksi manual." })}
          >
            <Icon icon="solar:add-circle-linear" className="text-lg" />
            Buat Transaksi
          </button>
        </div>
      </div>

      <div className="mt-6 inline-flex rounded-2xl border border-zinc-800 bg-zinc-950/40 p-1">
        <button
          onClick={() => setTab("pilih")}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            tab === "pilih" ? "bg-white text-zinc-950" : "text-zinc-300 hover:text-white"
          }`}
        >
          Pilih Listing
        </button>
        <button
          onClick={() => setTab("progress")}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            tab === "progress" ? "bg-white text-zinc-950" : "text-zinc-300 hover:text-white"
          }`}
        >
          Progress Transaksi
        </button>
      </div>

      <div className="mt-6">
        {tab === "pilih" ? (
          <PilihListingView />
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 shadow-sm">
            <div className="text-white font-semibold">Progress Transaksi</div>
            <div className="mt-3 text-sm text-zinc-400">
              Placeholder dulu. Nanti kita buat pipeline stage + timeline.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
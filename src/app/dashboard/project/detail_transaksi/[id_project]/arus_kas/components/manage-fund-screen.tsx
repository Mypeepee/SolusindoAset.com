"use client";

import { useMemo, useState } from "react";
import type { ManageFundData, WalletKey } from "../types";
import WalletGrid from "./wallet-grid";
import CashflowTable from "./cashflow-table";

function getRowTimestamp(row: unknown) {
  if (!row || typeof row !== "object") return 0;

  const record = row as Record<string, unknown>;
  const candidates = [
    record.tanggal_transaksi,
    record.transaction_date,
    record.tanggal,
    record.created_at,
    record.createdAt,
    record.dibuat_tanggal,
  ];

  for (const value of candidates) {
    if (value instanceof Date) {
      const time = value.getTime();
      if (Number.isFinite(time)) return time;
    }

    if (typeof value === "string" && value.trim()) {
      const time = new Date(value).getTime();
      if (Number.isFinite(time)) return time;
    }
  }

  return 0;
}

export default function ManageFundScreen({
  data,
}: {
  data: ManageFundData;
}) {
  const [selectedWallet, setSelectedWallet] = useState<WalletKey | "all">("all");
  const [selectedKind, setSelectedKind] = useState<"all" | "masuk" | "keluar">(
    "all"
  );

  const latestRows = useMemo(() => {
    const source = Array.isArray(data.transactions) ? data.transactions : [];

    return [...source]
      .filter((row) => {
        const matchWallet =
          selectedWallet === "all" ? true : row.wallet_key === selectedWallet;

        const matchKind =
          selectedKind === "all" ? true : row.jenis_transaksi === selectedKind;

        return matchWallet && matchKind;
      })
      .sort((a, b) => getRowTimestamp(b) - getRowTimestamp(a));
  }, [data.transactions, selectedWallet, selectedKind]);

  return (
    <div className="space-y-8">
      <WalletGrid
        wallets={data.wallets}
        selectedWallet={selectedWallet}
        onSelectWallet={setSelectedWallet}
      />

      <section className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">
              History of transaction
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Transaksi terbaru
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Riwayat transaksi terbaru dari dompet yang sedang dipilih.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "masuk", "keluar"] as const).map((kind) => {
              const active = selectedKind === kind;

              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setSelectedKind(kind)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition",
                    active
                      ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  {kind === "all" ? "Semua" : kind}
                </button>
              );
            })}

            <div className="ml-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
              {latestRows.length} transaksi
            </div>
          </div>
        </div>

        <CashflowTable rows={latestRows} />
      </section>
    </div>
  );
}
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, FileSpreadsheet } from "lucide-react";
import type { DbCashflow, ManageFundData, WalletKey } from "../types";
import WalletGrid from "./wallet-grid";
import CashflowTable from "./cashflow-table";
import CashflowEntrySheet from "./cashflow-entry-sheet";
import { exportArusKasToExcel } from "../lib/export-excel";

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

const WALLET_OPTIONS: Array<{ value: WalletKey | "all"; label: string }> = [
  { value: "all", label: "Semua dompet" },
  { value: "utama", label: "Dompet Utama" },
  { value: "dokumen", label: "Dokumen" },
  { value: "eksekusi", label: "Eksekusi" },
  { value: "renovasi", label: "Renovasi" },
  { value: "cadangan", label: "Cadangan" },
];

export default function ManageFundScreen({
  data,
}: {
  data: ManageFundData;
}) {
  const router = useRouter();
  const [selectedWallet, setSelectedWallet] = useState<WalletKey | "all">("all");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<DbCashflow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const latestRows = useMemo(() => {
    const source = Array.isArray(data.transactions) ? data.transactions : [];

    return [...source]
      .filter((row) => {
        return selectedWallet === "all"
          ? true
          : row.wallet_key === selectedWallet;
      })
      .sort((a, b) => getRowTimestamp(b) - getRowTimestamp(a));
  }, [data.transactions, selectedWallet]);

  const defaultWallet =
    editingTransaction?.wallet_key
      ? (editingTransaction.wallet_key as WalletKey)
      : selectedWallet === "all"
        ? data.wallets?.[0]?.walletKey
        : selectedWallet;

  function handleOpenCreate() {
    setEditingTransaction(null);
    setIsComposerOpen(true);
  }

  function handleEditTransaction(row: DbCashflow) {
    setEditingTransaction(row);
    setIsComposerOpen(true);
  }

  async function handleDeleteTransaction(row: DbCashflow) {
    const transactionId = String(row.id_project_arus_kas ?? "");

    if (!transactionId) {
      window.alert("ID transaksi tidak ditemukan.");
      return;
    }

    const confirmed = window.confirm(
      `Hapus transaksi "${row.judul_transaksi || "Tanpa judul"}"?`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/project/catat_arus_kas/${transactionId}`,
        {
          method: "DELETE",
        }
      );

      let responseJson: { message?: string } | null = null;

      try {
        responseJson = await response.json();
      } catch {
        responseJson = null;
      }

      if (!response.ok) {
        throw new Error(
          responseJson?.message || "Gagal menghapus transaksi."
        );
      }

      if (
        editingTransaction &&
        String(editingTransaction.id_project_arus_kas) === transactionId
      ) {
        setEditingTransaction(null);
        setIsComposerOpen(false);
      }

      window.location.reload();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menghapus transaksi."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCloseComposer() {
    setIsComposerOpen(false);
    setEditingTransaction(null);
  }

  function handleSubmitted() {
    setIsComposerOpen(false);
    setEditingTransaction(null);
    window.location.reload();
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await exportArusKasToExcel(data, latestRows, selectedWallet);
    } catch {
      window.alert("Gagal mengekspor data. Coba lagi.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <div className="space-y-8">
        <WalletGrid
          wallets={data.wallets}
          selectedWallet={selectedWallet}
          onSelectWallet={setSelectedWallet}
          onBack={() => router.back()}
        />

        <section className="space-y-5 rounded-[30px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/38">
                History of transaction
              </div>

              <h2 className="mt-3 text-[clamp(1.4rem,2vw,1.9rem)] font-semibold text-white">
                Transaksi terbaru
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Riwayat transaksi terbaru dari dompet yang sedang dipilih.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px]">
                  <select
                    value={selectedWallet}
                    onChange={(event) =>
                      setSelectedWallet(event.target.value as WalletKey | "all")
                    }
                    className="h-11 w-full appearance-none rounded-full border border-white/10 bg-white/[0.04] px-4 pr-11 text-sm font-medium text-slate-200 outline-none transition hover:bg-white/[0.06] focus:border-cyan-300/35 focus:bg-white/[0.06]"
                  >
                    {WALLET_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="bg-slate-950 text-white"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
                  {latestRows.length} transaksi
                </div>

                {editingTransaction ? (
                  <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
                    Sedang edit:{" "}
                    <span className="font-medium">
                      {editingTransaction.judul_transaksi || "Transaksi"}
                    </span>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/16 disabled:opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {isExporting ? "Mengekspor..." : "Export Excel"}
              </button>

              <button
                type="button"
                onClick={handleOpenCreate}
                className="hidden lg:inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/12 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/16"
              >
                <Plus className="h-4 w-4" />
                Catat transaksi
              </button>
            </div>
          </div>

          <CashflowTable
            rows={latestRows}
            onCreateTransaction={handleOpenCreate}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />

          {isDeleting ? (
            <div className="rounded-[18px] border border-rose-300/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              Sedang menghapus transaksi...
            </div>
          ) : null}
        </section>
      </div>

      <button
        type="button"
        onClick={handleOpenCreate}
        className="fixed bottom-6 right-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/15 text-cyan-100 shadow-[0_20px_50px_rgba(34,211,238,0.18)] backdrop-blur-xl transition hover:bg-cyan-400/20 lg:hidden"
        aria-label="Catat transaksi"
      >
        <Plus className="h-5 w-5" />
      </button>

      <CashflowEntrySheet
        open={isComposerOpen}
        onClose={handleCloseComposer}
        idProject={data.project.id_project}
        wallets={data.wallets}
        defaultWallet={defaultWallet}
        editingTransaction={editingTransaction}
        onSubmitted={handleSubmitted}
      />
    </>
  );
}
"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import type { DbCashflow } from "../types";
import { formatCurrency } from "../lib/format-currency";

type Props = {
  transaction: DbCashflow | null;
  onClose: () => void;
  onSubmitted: () => void;
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const formatDigits = (value: string) =>
  value ? new Intl.NumberFormat("id-ID").format(Number(value)) : "";

export default function LegacyCapitalCorrectionSheet({
  transaction,
  onClose,
  onSubmitted,
}: Props) {
  const inputId = useId();
  const [nominal, setNominal] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!transaction) return;
    setNominal(onlyDigits(String(transaction.nominal)));
    setError("");
  }, [transaction]);

  useEffect(() => {
    if (!transaction) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [transaction]);

  if (!transaction) return null;

  const investorId = transaction.id_project_investor;
  const currentNominal = Number(transaction.nominal) || 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!investorId) {
      setError("Investor untuk setoran ini tidak ditemukan.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/project/catat_arus_kas/koreksi-modal-legacy/${encodeURIComponent(investorId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nominal_historis: Number(nominal || 0) }),
        }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Gagal mengoreksi setoran historis.");
      }
      onSubmitted();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal mengoreksi setoran historis."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Tutup koreksi"
        onClick={onClose}
        disabled={pending}
        className="absolute inset-0"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
        className="relative w-full max-w-lg overflow-hidden rounded-t-[28px] border border-white/10 bg-[#09131e] shadow-2xl sm:rounded-[28px]"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-5 sm:px-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-200/70">
              Setoran sebelum buku kas
            </p>
            <h2
              id={`${inputId}-title`}
              className="mt-1 text-xl font-semibold text-white"
            >
              Koreksi nominal setoran
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {transaction.investor_nama || "Investor"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Tutup"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 hover:bg-white/[0.06]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
              Nominal saat ini: <strong className="text-white">{formatCurrency(currentNominal)}</strong>
            </div>
            <div>
              <label
                htmlFor={inputId}
                className="text-sm font-medium text-slate-200"
              >
                Nominal setoran yang benar
              </label>
              <div className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 focus-within:border-cyan-300/40 focus-within:ring-2 focus-within:ring-cyan-300/10">
                <span className="text-sm text-slate-400">Rp</span>
                <input
                  id={inputId}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formatDigits(nominal)}
                  onChange={(event) => setNominal(onlyDigits(event.target.value))}
                  aria-describedby={`${inputId}-help`}
                  className="min-w-0 flex-1 bg-transparent text-base font-semibold tabular-nums text-white outline-none placeholder:text-slate-600"
                  placeholder="0"
                  disabled={pending}
                />
              </div>
              <p id={`${inputId}-help`} className="mt-2 text-xs leading-5 text-slate-400">
                Ubah Rp25.000.000 menjadi Rp20.000.000 jika itulah dana yang benar-benar diterima.
                Setoran yang sudah tercatat terpisah tetap dipertahankan.
              </p>
            </div>
            <p className="rounded-xl border border-amber-300/15 bg-amber-400/[0.06] px-3 py-3 text-xs leading-5 text-amber-100/80">
              Koreksi ini juga memperbarui modal disetor, status pembayaran,
              dan persentase kepemilikan investor. Jika dana tersebut sudah
              dipakai, saldo dapat menunjukkan kekurangan yang perlu ditutup
              dengan setoran yang benar-benar diterima.
            </p>
            {error ? (
              <p role="alert" className="text-sm text-rose-300">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex gap-3 border-t border-white/10 p-5 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/[0.05] disabled:opacity-60"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {pending ? "Menyimpan…" : "Simpan koreksi"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

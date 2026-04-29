import { Activity, TrendingDown, TrendingUp } from "lucide-react";

import type { MonthlyPulseRow } from "./types";
import { cn, formatCompactIDR } from "./utils";

export default function CashPulseCard({
  rows,
}: {
  rows: MonthlyPulseRow[];
}) {
  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [row.pemasukan, row.pengeluaran])
  );

  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
            Cash Pulse
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Ritme kas 6 bulan terakhir
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Bukan chart yang ramai, tapi pembacaan cepat: setiap bulan langsung
            terlihat inflow, outflow, dan saldo akhirnya.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200">
          <Activity className="h-3.5 w-3.5" />
          Pulse terbaru
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {rows.length > 0 ? (
          rows.map((row) => {
            const incomeWidth = (row.pemasukan / maxValue) * 100;
            const expenseWidth = (row.pengeluaran / maxValue) * 100;

            return (
              <div
                key={row.key}
                className="rounded-3xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="lg:min-w-[92px]">
                    <div className="text-sm font-semibold text-white">
                      {row.label}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Saldo {formatCompactIDR(row.saldo)}
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
                          Pemasukan
                        </span>
                        <span>{formatCompactIDR(row.pemasukan)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300"
                          style={{ width: `${incomeWidth}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <TrendingDown className="h-3.5 w-3.5 text-rose-300" />
                          Pengeluaran
                        </span>
                        <span>{formatCompactIDR(row.pengeluaran)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-rose-400 to-orange-300"
                          style={{ width: `${expenseWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "inline-flex min-w-[120px] items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold",
                      row.saldo >= 0
                        ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-200"
                        : "border-rose-400/15 bg-rose-400/10 text-rose-200"
                    )}
                  >
                    {row.saldo >= 0 ? "Surplus" : "Defisit"}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 px-5 py-10 text-center text-sm text-slate-400">
            Belum ada ritme kas yang bisa divisualisasikan.
          </div>
        )}
      </div>
    </section>
  );
}
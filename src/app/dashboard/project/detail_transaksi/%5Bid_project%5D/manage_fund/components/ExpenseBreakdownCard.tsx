import { FileText, Hammer, Home, ShieldAlert } from "lucide-react";

import type { ExpenseBreakdownRow } from "./types";
import { cn, formatCompactIDR, formatIDR } from "./utils";

function CategoryIcon({ category }: { category: ExpenseBreakdownRow["kategori"] }) {
  const className = "h-4 w-4";

  switch (category) {
    case "pembelian_aset":
      return <Home className={className} />;
    case "biaya_dokumen_balik_nama":
      return <FileText className={className} />;
    case "biaya_eksekusi_pengosongan":
      return <ShieldAlert className={className} />;
    case "biaya_renovasi":
      return <Hammer className={className} />;
    default:
      return <Home className={className} />;
  }
}

export default function ExpenseBreakdownCard({
  rows,
}: {
  rows: ExpenseBreakdownRow[];
}) {
  const totalPengeluaran = rows.reduce((sum, row) => sum + row.total, 0);
  const dominant = [...rows].sort((a, b) => b.total - a.total)[0];

  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
            Expense Map
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Breakdown pengeluaran proyek
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Empat biaya inti dipisahkan supaya kamu cepat tahu dana paling
            besar terserap di area mana.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Total
            </div>
            <div className="mt-2 text-sm font-semibold text-white">
              {formatCompactIDR(totalPengeluaran)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Dominan
            </div>
            <div className="mt-2 truncate text-sm font-semibold text-white">
              {dominant?.label ?? "Belum ada"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((row) => (
          <div
            key={row.kategori}
            className="rounded-3xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-cyan-200">
                    <CategoryIcon category={row.kategori} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {row.label}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {row.deskripsi}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Total
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {formatCompactIDR(row.total)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Item
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {row.jumlah} transaksi
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Share
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {row.persentase.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>Komposisi pengeluaran</span>
                <span>{formatIDR(row.total)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className={cn(
                    "h-2 rounded-full bg-gradient-to-r",
                    row.kategori === "pembelian_aset" &&
                      "from-cyan-400 to-sky-300",
                    row.kategori === "biaya_dokumen_balik_nama" &&
                      "from-violet-400 to-fuchsia-300",
                    row.kategori === "biaya_eksekusi_pengosongan" &&
                      "from-amber-400 to-orange-300",
                    row.kategori === "biaya_renovasi" &&
                      "from-emerald-400 to-lime-300"
                  )}
                  style={{ width: `${Math.min(row.persentase, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}

        {rows.every((row) => row.total <= 0) && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 px-5 py-10 text-center text-sm text-slate-400">
            Belum ada pengeluaran yang tercatat.
          </div>
        )}
      </div>
    </section>
  );
}
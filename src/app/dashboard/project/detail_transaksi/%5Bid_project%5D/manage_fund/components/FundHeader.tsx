import Link from "next/link";
import { ArrowLeft, Banknote, PiggyBank, Target, Wallet2 } from "lucide-react";

import type { DashboardStats, DbProject } from "./types";
import { formatIDR, humanizeText, toNumber } from "./utils";

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Wallet2;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-white/60">{label}</span>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/70">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 text-xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/45">{helper}</div>
    </div>
  );
}

export default function FundHeader({
  project,
  stats,
}: {
  project: DbProject;
  stats: DashboardStats;
}) {
  const remainingTargetLabel =
    stats.remainingTarget >= 0 ? "Sisa ke target" : "Surplus target";

  const remainingBudgetLabel =
    stats.remainingBudget >= 0 ? "Sisa anggaran proyek" : "Over budget proyek";

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.20),_transparent_35%),linear-gradient(180deg,_#0f172a_0%,_#08101d_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link
            href={`/dashboard/project/detail_transaksi/${project.id_project}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke detail transaksi
          </Link>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-white">
                Manage Fund · {project.nama_project}
              </h1>

              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                {humanizeText(project.status)}
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70">
                {project.id_project}
              </span>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Fokus halaman ini cuma 2 hal: tahu posisi kas sekarang dan mencatat
              transaksi secepat mungkin. Saldo awal virtual diambil dari{" "}
              <span className="font-medium text-white/80">total_pendanaan</span>.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
          <div>Target pendanaan: {formatIDR(stats.targetFunding)}</div>
          <div>Total biaya akuisisi: {formatIDR(stats.acquisitionBudget)}</div>
          <div>Estimasi harga jual: {formatIDR(toNumber(project.estimasi_harga_jual))}</div>
        </div>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Saldo kas sekarang"
          value={formatIDR(stats.currentBalance)}
          helper={`Saldo awal ${formatIDR(stats.openingBalance)}`}
          icon={Wallet2}
        />
        <StatCard
          label="Arus kas masuk"
          value={formatIDR(stats.totalInflow)}
          helper="Pemasukan tambahan di luar saldo awal"
          icon={PiggyBank}
        />
        <StatCard
          label="Arus kas keluar"
          value={formatIDR(stats.totalOutflow)}
          helper="Total pengeluaran yang sudah dicatat"
          icon={Banknote}
        />
        <StatCard
          label={remainingBudgetLabel}
          value={formatIDR(Math.abs(stats.remainingBudget))}
          helper={`${remainingTargetLabel}: ${formatIDR(
            Math.abs(stats.remainingTarget)
          )}`}
          icon={Target}
        />
      </div>
    </section>
  );
}
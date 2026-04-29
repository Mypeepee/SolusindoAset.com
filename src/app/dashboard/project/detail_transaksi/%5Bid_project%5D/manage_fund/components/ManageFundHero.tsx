import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Landmark,
  MapPin,
  Sparkles,
  Wallet,
} from "lucide-react";

import type { ManageFundProjectMeta, OverviewMetrics } from "./types";
import { formatCompactIDR, formatIDR, titleizeSnake } from "./utils";

export default function ManageFundHero({
  project,
  overview,
}: {
  project: ManageFundProjectMeta;
  overview: OverviewMetrics;
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(52,211,153,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_25px_120px_rgba(2,6,23,0.55)] backdrop-blur-xl sm:p-7">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
      <div className="relative grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <Link
            href={`/dashboard/project/detail_transaksi/${project.id_project}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke detail project
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" />
            Manage Fund
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                {titleizeSnake(project.jenis_pendanaan)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                {titleizeSnake(project.status)}
              </span>
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Ledger kas proyek yang terasa seperti money tracker premium
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Monitor pemasukan, pengeluaran, dan posisi kas proyek dalam satu
                dashboard yang cepat dibaca. Fokusnya bukan sekadar tabel, tapi
                ritme uang proyek: masuk dari mana, keluar ke mana, dan apakah
                saldo masih sehat.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:max-w-3xl">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur-md">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Project
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {project.nama_project}
              </div>
              <div className="mt-2 inline-flex items-center gap-2 text-sm text-slate-300">
                <Landmark className="h-4 w-4 text-cyan-300" />
                {project.id_project}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur-md">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Lokasi
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {project.lokasi || "Lokasi belum diisi"}
              </div>
              <div className="mt-2 inline-flex items-center gap-2 text-sm text-slate-300">
                <MapPin className="h-4 w-4 text-emerald-300" />
                Area project
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#081423]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />

          <div className="relative flex h-full flex-col justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                <Wallet className="h-3.5 w-3.5 text-cyan-300" />
                Posisi Kas Saat Ini
              </div>

              <div className="mt-4 text-4xl font-semibold tracking-tight text-white">
                {formatCompactIDR(overview.posisiKas)}
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {formatIDR(overview.posisiKas)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="inline-flex items-center justify-between rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-4 py-3 text-left text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15"
              >
                Tambah pemasukan
                <ArrowUpRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-white/10"
              >
                Tambah pengeluaran
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Inflow
                </div>
                <div className="mt-2 text-sm font-semibold text-emerald-200">
                  {formatCompactIDR(overview.totalPemasukan)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Outflow
                </div>
                <div className="mt-2 text-sm font-semibold text-rose-200">
                  {formatCompactIDR(overview.totalPengeluaran)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Entri
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {overview.totalTransaksiAktif}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
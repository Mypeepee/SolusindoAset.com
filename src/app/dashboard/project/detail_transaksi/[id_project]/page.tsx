import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  Sparkles,
  Users2,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

import BloombergHeroCard from "../components/BloombergHeroCard";
import InvestmentSnapshotCard from "../components/InvestmentSnapshotCard";
import ReturnFrameworkCard from "../components/ReturnFrameworkCard";
import CapitalDeploymentCard from "../components/CapitalDeploymentCard";
import LifecycleCard from "../components/LifecycleCard";
import CmaCard from "../components/CmaCard";
import InvestorBookCard from "../components/InvestorBookCard";
import AssetFactsCard from "../components/AssetFactsCard";

import type { ProjectDetailViewModel } from "../components/types";
import { formatDate } from "../components/utils";

export default async function DetailTransaksiPage({
  params,
}: {
  params: { id_project: string };
}) {
  const project = await prisma.project.findUnique({
    where: { id_project: params.id_project },
    include: {
      pembuat: true,
      investorProject: {
        include: {
          agent: true,
        },
      },
      cmaEntries: true,
    },
  });

  if (!project) {
    notFound();
  }

  const creator = project.pembuat as
    | {
        nama_lengkap?: string | null;
        nama_agent?: string | null;
        nama?: string | null;
        name?: string | null;
        foto_profil?: string | null;
        avatar?: string | null;
        gambar_thumbnail?: string | null;
      }
    | null;

  const viewModel: ProjectDetailViewModel = {
    id: project.id_project,
    listingId: project.id_listing,
    name: project.nama_project,
    address: project.alamat_property,
    province: project.provinsi,
    city: project.kota,
    district: project.kecamatan,
    village: project.kelurahan,
    image: project.gambar_thumbnail,
    purchaseDate: project.tanggal_pembelian,

    purchasePrice: Number(project.harga_pembelian),
    estimatedSellPrice: Number(project.estimasi_harga_jual),
    estimatedNetProfit: Number(project.estimasi_profit_bersih),
    fundingTarget: Number(project.target_pendanaan),
    totalFunded: Number(project.total_pendanaan),

    fundingType: project.jenis_pendanaan,
    status: project.status,

    startDate: project.mulai_tanggal,
    estimatedFinish: project.estimasi_selesai,
    estimatedMonths: project.estimasi_bulan,
    fundingClosedAt: project.pendanaan_ditutup_pada,

    description: project.deskripsi_project,

    createdById: project.dibuat_oleh,
    createdByName:
      creator?.nama_lengkap ??
      creator?.nama_agent ??
      creator?.nama ??
      creator?.name ??
      project.dibuat_oleh,
    createdByAvatar:
      creator?.foto_profil ??
      creator?.avatar ??
      creator?.gambar_thumbnail ??
      null,

    auctionLimitValue: Number(project.nilai_limit_lelang),
    spareBidding: Number(project.spare_bidding),
    executionCost: Number(project.biaya_eksekusi),
    renovationCost: Number(project.biaya_renov),
    transferCost: Number(project.biaya_balik_nama),
    totalAcquisitionCost: Number(project.total_biaya_akuisisi),
    reserveFund: Number(project.dana_cadangan),

    createdAt: project.dibuat_tanggal,
    updatedAt: project.diupdate_tanggal,

    investors: project.investorProject.map((item) => {
      const agent = item.agent as
        | {
            nama_lengkap?: string | null;
            nama_agent?: string | null;
            nama?: string | null;
            name?: string | null;
            foto_profil?: string | null;
            avatar?: string | null;
            gambar_thumbnail?: string | null;
          }
        | null;

      return {
        id: String(item.id_project_investor),
        name:
          agent?.nama_lengkap ??
          agent?.nama_agent ??
          agent?.nama ??
          agent?.name ??
          item.id_agent,
        avatar:
          agent?.foto_profil ??
          agent?.avatar ??
          agent?.gambar_thumbnail ??
          null,
        committed: Number(item.nominal_komitmen),
        paid: Number(item.nominal_terbayar),
        ownership:
          item.persentase_kepemilikan != null
            ? Number(item.persentase_kepemilikan)
            : null,
        status: item.status,
        note: item.catatan,
      };
    }),

    cma: project.cmaEntries.map((item) => ({
      id: item.id_project_cma,
      name: item.nama,
      landArea: Number(item.luas_tanah),
      price: Number(item.harga),
      note: item.catatan,
    })),
  };

  const investorCount = viewModel.investors.length;
  const comparableCount = viewModel.cma.length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070b] px-4 py-5 text-white md:px-6 md:py-6 xl:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_20%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_18%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.08),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_20%,rgba(255,255,255,0)_80%,rgba(255,255,255,0.02)_100%)]" />

      <div className="relative mx-auto max-w-[1600px] space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.025)_46%,rgba(255,255,255,0.015)_100%)] shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.09),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_22%)]" />
          <div className="pointer-events-none absolute inset-[1px] rounded-[31px] border border-white/5" />

          <div className="relative flex flex-col gap-5 px-4 py-4 md:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard/project"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition duration-200 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali
                </Link>

                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16)_0%,rgba(45,212,191,0.10)_100%)] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100 shadow-[0_10px_30px_rgba(16,185,129,0.10)]">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  Live deal room
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
                  <span>Dashboard</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                  <span>Project</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                  <span className="text-slate-400">Detail transaksi</span>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                  <h2 className="max-w-[900px] truncate text-2xl font-semibold tracking-tight text-white md:text-3xl">
                    {viewModel.name}
                  </h2>

                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                    <LayoutGrid className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono tracking-[0.14em] text-white">
                      {viewModel.id}
                    </span>
                  </div>
                </div>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  Workspace eksekusi proyek untuk melihat progress pendanaan,
                  struktur return, comparable market, investor book, dan fakta
                  aset dalam satu tampilan yang lebih tajam.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[520px] lg:max-w-[560px] lg:flex-1">
              <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]" />
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-200">
                    <Clock3 className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      Updated
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {formatDate(viewModel.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.28),transparent)]" />
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-200">
                    <Users2 className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      Investor book
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {investorCount} investor
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(168,85,247,0.28),transparent)]" />
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-200">
                    <LayoutGrid className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      CMA set
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {comparableCount} comparable
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none h-px w-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]" />
        </section>

        <BloombergHeroCard project={viewModel} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <CapitalDeploymentCard project={viewModel} />
            <CmaCard project={viewModel} />
            <InvestorBookCard project={viewModel} />
          </div>

          <div className="space-y-6 xl:col-span-4">
            <div className="xl:sticky xl:top-6 xl:space-y-6">
              <InvestmentSnapshotCard project={viewModel} />
              <ReturnFrameworkCard project={viewModel} />
              <LifecycleCard project={viewModel} />
              <AssetFactsCard project={viewModel} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
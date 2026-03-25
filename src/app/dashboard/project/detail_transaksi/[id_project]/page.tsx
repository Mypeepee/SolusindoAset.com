import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Wallet2 } from "lucide-react";
import { prisma } from "@/lib/prisma";

import BloombergHeroCard from "../components/BloombergHeroCard";
import CapitalDeploymentCard from "../components/CapitalDeploymentCard";
import CmaCard from "../components/CmaCard";
import InvestorBookCard from "../components/InvestorBookCard";
import ReturnFrameworkCard from "../components/ReturnFrameworkCard";

import type { ProjectDetailViewModel } from "../components/types";

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullableText(value: unknown) {
  const text = toText(value);
  return text.length ? text : null;
}

function getRecordValue(
  record: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const key of keys) {
    if (key in record && record[key] != null) return record[key];
  }

  return undefined;
}

function getNestedRecordValue(source: unknown, paths: string[][]): unknown {
  for (const path of paths) {
    let current: unknown = source;
    let valid = true;

    for (const key of path) {
      if (!current || typeof current !== "object" || !(key in current)) {
        valid = false;
        break;
      }

      current = (current as Record<string, unknown>)[key];
    }

    if (valid && current != null) return current;
  }

  return undefined;
}

function normalizeProjectStatus(raw: unknown): ProjectDetailViewModel["status"] {
  const value = toText(raw).toLowerCase();

  const allowed: ProjectDetailViewModel["status"][] = [
    "pendanaan_terbuka",
    "pendanaan_penuh",
    "pengurusan_dokumen",
    "eksekusi_pengosongan",
    "renovasi",
    "sedang_dijual",
    "terjual",
    "dibatalkan",
  ];

  if (allowed.includes(value as ProjectDetailViewModel["status"])) {
    return value as ProjectDetailViewModel["status"];
  }

  if (value.includes("dokumen")) return "pengurusan_dokumen";
  if (value.includes("eksekusi")) return "eksekusi_pengosongan";
  if (value.includes("renovasi")) return "renovasi";
  if (value.includes("jual")) return "sedang_dijual";
  if (value.includes("batal")) return "dibatalkan";
  if (value.includes("penuh")) return "pendanaan_penuh";

  return "pendanaan_terbuka";
}

function mapInvestorRow(row: unknown, index: number) {
  const record =
    row && typeof row === "object" ? (row as Record<string, unknown>) : {};

  const name =
    toText(
      getNestedRecordValue(record, [
        ["agent", "pengguna", "nama_lengkap"],
        ["agent", "pengguna", "nama"],
        ["investor", "pengguna", "nama_lengkap"],
        ["investor", "pengguna", "nama"],
        ["pengguna", "nama_lengkap"],
        ["pengguna", "nama"],
      ])
    ) ||
    toText(
      getRecordValue(record, [
        "nama_investor",
        "nama",
        "investor_name",
        "full_name",
      ])
    ) ||
    `Investor ${index + 1}`;

  const avatar = toNullableText(
    getNestedRecordValue(record, [
      ["agent", "pengguna", "avatar_url"],
      ["agent", "pengguna", "avatar"],
      ["investor", "pengguna", "avatar_url"],
      ["investor", "pengguna", "avatar"],
      ["pengguna", "avatar_url"],
      ["pengguna", "avatar"],
    ]) ?? getRecordValue(record, ["avatar_url", "avatar", "foto"])
  );

  return {
    id: String(
      getRecordValue(record, [
        "id_investor_project",
        "id_project_investor",
        "id",
      ]) ?? `investor-${index}`
    ),
    name,
    avatar,
    note: toNullableText(
      getRecordValue(record, ["catatan", "note", "keterangan"])
    ),
    committed: toNumber(
      getRecordValue(record, [
        "nominal_investasi",
        "nilai_investasi",
        "committed",
        "amount",
      ])
    ),
    paid: toNumber(
      getRecordValue(record, [
        "nominal_pembayaran",
        "total_pembayaran",
        "paid",
        "paid_amount",
      ])
    ),
    ownership: toNumber(
      getRecordValue(record, [
        "persentase_kepemilikan",
        "persentase_ownership",
        "ownership",
      ])
    ),
    status:
      toText(
        getRecordValue(record, [
          "status_pembayaran",
          "payment_status",
          "status",
        ])
      ) || "menunggu",
  };
}

function mapCmaRow(row: unknown, index: number) {
  const record =
    row && typeof row === "object" ? (row as Record<string, unknown>) : {};

  return {
    id: String(
      getRecordValue(record, ["id_project_cma", "id_cma", "id"]) ?? `cma-${index}`
    ),
    landArea: toNumber(
      getRecordValue(record, ["landArea", "land_area", "luas_tanah", "luas"])
    ),
    price: toNumber(
      getRecordValue(record, ["price", "harga", "harga_jual", "nilai"])
    ),
  };
}

export default async function DetailTransaksiPage({
  params,
}: {
  params: { id_project: string };
}) {
  const project = await prisma.project.findUnique({
    where: { id_project: params.id_project },
    select: {
      id_project: true,
      nama_project: true,
      alamat_property: true,
      provinsi: true,
      kota: true,
      kecamatan: true,
      kelurahan: true,
      gambar_thumbnail: true,
      tanggal_pembelian: true,
      harga_pembelian: true,
      estimasi_harga_jual: true,
      estimasi_profit_bersih: true,
      target_pendanaan: true,
      total_pendanaan: true,
      jenis_pendanaan: true,
      status: true,
      dibuat_tanggal: true,

      mulai_tanggal: true,
      estimasi_selesai: true,
      estimasi_bulan: true,
      deskripsi_project: true,
      dibuat_oleh: true,
      nilai_limit_lelang: true,
      spare_bidding: true,
      biaya_eksekusi: true,
      biaya_renov: true,
      biaya_balik_nama: true,
      total_biaya_akuisisi: true,
      dana_cadangan: true,

      investorProject: true,
      cmaEntries: true,
      _count: {
        select: {
          investorProject: true,
          cmaEntries: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const projectRecord = project as Record<string, unknown>;

  const investors = Array.isArray(project.investorProject)
    ? project.investorProject.map(mapInvestorRow)
    : [];

  const cma = Array.isArray(project.cmaEntries)
    ? project.cmaEntries.map(mapCmaRow)
    : [];

  const viewModel = {
    id: project.id_project,
    name: project.nama_project,
    description: toText(project.deskripsi_project),
    image: project.gambar_thumbnail,
    address: project.alamat_property,
    city: project.kota,
    province: project.provinsi,
    district: project.kecamatan,
    subdistrict: project.kelurahan,
    purchaseDate: project.tanggal_pembelian,
    startDate: project.mulai_tanggal ?? project.dibuat_tanggal,
    estimatedMonths: toNumber(project.estimasi_bulan),
    fundingType:
      project.jenis_pendanaan === "tertutup" ? "tertutup" : "terbuka",
    status: normalizeProjectStatus(project.status),

    createdByName: null,
    createdByAvatar: null,

    fundingTarget: toNumber(project.target_pendanaan),
    totalFunded: toNumber(project.total_pendanaan),
    estimatedNetProfit: toNumber(project.estimasi_profit_bersih),
    estimatedSellPrice: toNumber(project.estimasi_harga_jual),
    purchasePrice: toNumber(project.harga_pembelian),
    totalAcquisitionCost: toNumber(project.total_biaya_akuisisi),

    landArea: toNumber(
      getRecordValue(projectRecord, [
        "luas_tanah",
        "land_area",
        "landArea",
        "asset_land_area",
      ])
    ),

    auctionLimitValue: toNumber(project.nilai_limit_lelang),
    spareBidding: toNumber(project.spare_bidding),
    executionCost: toNumber(project.biaya_eksekusi),
    renovationCost: toNumber(project.biaya_renov),
    transferCost: toNumber(project.biaya_balik_nama),
    reserveFund: toNumber(project.dana_cadangan),

    cma,
    investors,
  } as ProjectDetailViewModel;

  const manageFundHref = `/dashboard/project/detail_transaksi/${encodeURIComponent(
    project.id_project
  )}/arus_kas`;

  return (
    <main className="min-h-screen bg-[#05070b] text-white">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-white/40">
          <Link
            href="/dashboard/project"
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:bg-white/[0.06]"
          >
            Project
          </Link>

          <ChevronRight className="h-3.5 w-3.5 text-white/20" />

          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
            {project.id_project}
          </span>
        </div>

        <BloombergHeroCard
          project={viewModel}
          backHref="/dashboard/project"
          topBarLabel="Detail transaksi"
        />

        <div className="mt-5 rounded-[28px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(34,211,238,0.03))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/60">
                Finance workspace
              </div>
              <div className="mt-1 text-base font-semibold text-white">
                Kelola arus kas, dompet, dan histori transaksi project
              </div>
              <div className="mt-1 text-sm text-slate-300">
                Masuk ke halaman manage fund untuk pencatatan cashflow yang lebih operasional.
              </div>
            </div>

            <Link
              href={manageFundHref}
              className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-cyan-300/25 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/16"
            >
              <Wallet2 className="h-4 w-4" />
              Manage Fund
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-5">
            <ReturnFrameworkCard project={viewModel} />
            <CapitalDeploymentCard project={viewModel} />
          </div>

          <div className="space-y-5">
            <CmaCard project={viewModel} />
            <InvestorBookCard project={viewModel} />
          </div>
        </div>
      </div>
    </main>
  );
}
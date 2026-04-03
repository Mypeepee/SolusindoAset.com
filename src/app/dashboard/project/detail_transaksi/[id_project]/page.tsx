import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

import BloombergHeroCard from "../components/BloombergHeroCard";
import ReturnFrameworkCard from "../components/ReturnFrameworkCard";
import CapitalDeploymentCard from "../components/CapitalDeploymentCard";
import CmaCard from "../components/CmaCard";
import InvestorBookCard from "../components/InvestorBookCard";

import type { ProjectDetailViewModel } from "../components/types";

function toNumeric(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRecordValue(
  record: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  if (!record) return undefined;

  for (const key of keys) {
    if (key in record && record[key] != null) {
      return record[key];
    }
  }

  const lowered = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key.toLowerCase(), value])
  );

  for (const key of keys) {
    const value = lowered[key.toLowerCase()];
    if (value != null) return value;
  }

  return undefined;
}

function findExistingColumn(columns: string[], candidates: string[]) {
  const lowered = new Set(columns.map((column) => column.toLowerCase()));
  return (
    candidates.find((candidate) => lowered.has(candidate.toLowerCase())) ?? null
  );
}

function pickDisplayName(
  record: Record<string, unknown> | null | undefined,
  fallback: string
) {
  const name = toText(
    getRecordValue(record, [
      "nama_lengkap",
      "full_name",
      "fullName",
      "namaLengkap",
      "nama_agent",
      "display_name",
      "displayName",
      "nama",
      "name",
    ])
  );

  return name || fallback;
}

function pickAvatar(record: Record<string, unknown> | null | undefined) {
  const avatar = getRecordValue(record, [
    "foto_profil_url",
    "foto_profil",
    "fotoProfil",
    "avatar",
    "profile_picture",
    "profilePicture",
    "profile_image",
    "profileImage",
    "gambar_profil",
    "gambarProfil",
    "gambar_thumbnail",
    "thumbnail",
    "image",
    "image_url",
    "imageUrl",
    "photo",
    "photo_url",
    "photoUrl",
    "foto",
  ]);

  return typeof avatar === "string" && avatar.trim() ? avatar.trim() : null;
}

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

  const creator = project.pembuat as Record<string, unknown> | null;

  const relatedAgentIds = Array.from(
    new Set(
      [project.dibuat_oleh, ...project.investorProject.map((item) => item.id_agent)]
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
    )
  );

  const agentIdentityRows =
    relatedAgentIds.length > 0
      ? await prisma.$queryRaw<
          Array<{
            id_agent: string;
            id_pengguna: string | null;
            nama_lengkap: string | null;
            foto_profil_url: string | null;
          }>
        >(Prisma.sql`
          SELECT
            a.id_agent,
            a.id_pengguna,
            a.foto_profil_url,
            p.nama_lengkap
          FROM public.agent a
          LEFT JOIN public.pengguna p
            ON p.id_pengguna = a.id_pengguna
          WHERE a.id_agent IN (${Prisma.join(relatedAgentIds)})
        `)
      : [];

  const agentIdentityMap = new Map(
    agentIdentityRows.map((row) => [
      row.id_agent,
      {
        name: toText(row.nama_lengkap),
        avatar: toText(row.foto_profil_url),
      },
    ])
  );

  const listingColumnRows = await prisma.$queryRaw<
    Array<{ table_schema: string; column_name: string }>
  >`
    SELECT table_schema, column_name
    FROM information_schema.columns
    WHERE table_name = 'listing'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, ordinal_position
  `;

  const availableSchemas = Array.from(
    new Set(listingColumnRows.map((row) => row.table_schema))
  );

  const listingSchema =
    availableSchemas.find((schema) => schema === "public") ??
    availableSchemas[0] ??
    null;

  const listingColumns = listingColumnRows
    .filter((row) => row.table_schema === listingSchema)
    .map((row) => row.column_name);

  const listingKeyColumn = findExistingColumn(listingColumns, [
    "id_listing",
    "listing_id",
    "id_property",
    "property_id",
    "id",
    "idlisting",
    "idproperty",
  ]);

  const listingRows =
    project.id_listing != null && listingSchema && listingKeyColumn
      ? await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT *
           FROM "${listingSchema}"."listing"
           WHERE "${listingKeyColumn}" = $1
           LIMIT 1`,
          project.id_listing
        )
      : [];

  const listing = listingRows[0] ?? null;

  const listingLandArea = toNumeric(
    getRecordValue(listing, [
      "luas_tanah",
      "land_area",
      "landArea",
      "lt",
      "luastanah",
    ])
  );

  const listingBuildingArea = toNumeric(
    getRecordValue(listing, [
      "luas_bangunan",
      "building_area",
      "buildingArea",
      "lb",
      "luasbangunan",
    ])
  );

  const listingKind = toText(
    getRecordValue(listing, [
      "jenis_listing",
      "tipe_listing",
      "kategori_listing",
      "jenis_property",
      "property_type",
      "jenis",
      "tipe",
      "category",
    ])
  ).toLowerCase();

  const isSecondary =
    listingKind.includes("secondary") || listingKind.includes("sekunder");

  const assetArea =
    isSecondary && listingBuildingArea > 0
      ? listingBuildingArea
      : listingLandArea > 0
      ? listingLandArea
      : listingBuildingArea;

  const creatorIdentity = agentIdentityMap.get(project.dibuat_oleh);

  const projectSelesaiRows = await prisma.$queryRaw<
    Array<{
      id_project: string;
      id_listing: number | null;
      tanggal_pembelian: Date | string | null;
      tanggal_terjual: Date | string | null;
      durasi_hari: number | null;
      harga_jual: Prisma.Decimal | number | string | null;
      total_biaya_akuisisi: Prisma.Decimal | number | string | null;
      profit_kotor: Prisma.Decimal | number | string | null;
      pph_percent: Prisma.Decimal | number | string | null;
      ajb_percent: Prisma.Decimal | number | string | null;
      agent_fee_percent: Prisma.Decimal | number | string | null;
      total_biaya_transaksi: Prisma.Decimal | number | string | null;
      profit_bersih: Prisma.Decimal | number | string | null;
      roi_bersih: Prisma.Decimal | number | string | null;
      dibuat_tanggal: Date | string | null;
      diupdate_tanggal: Date | string | null;
    }>
  >(Prisma.sql`
    SELECT
      id_project,
      id_listing,
      tanggal_pembelian,
      tanggal_terjual,
      durasi_hari,
      harga_jual,
      total_biaya_akuisisi,
      profit_kotor,
      pph_percent,
      ajb_percent,
      agent_fee_percent,
      total_biaya_transaksi,
      profit_bersih,
      roi_bersih,
      dibuat_tanggal,
      diupdate_tanggal
    FROM public.project_selesai
    WHERE id_project = ${params.id_project}
    LIMIT 1
  `);

  const projectSelesai = projectSelesaiRows[0] ?? null;

  const viewModel = {
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

    landArea: assetArea,

    purchasePrice: toNumeric(project.harga_pembelian),
    estimatedSellPrice: toNumeric(project.estimasi_harga_jual),
    estimatedNetProfit: toNumeric(project.estimasi_profit_bersih),
    fundingTarget: toNumeric(project.target_pendanaan),
    totalFunded: toNumeric(project.total_pendanaan),

    fundingType: project.jenis_pendanaan,
    status: project.status,

    startDate: project.mulai_tanggal,
    estimatedFinish: project.estimasi_selesai,
    estimatedMonths:
      project.estimasi_bulan != null ? toNumeric(project.estimasi_bulan) : null,
    fundingClosedAt: project.pendanaan_ditutup_pada,

    description: project.deskripsi_project,

    createdById: project.dibuat_oleh,
    createdByName:
      creatorIdentity?.name || pickDisplayName(creator, project.dibuat_oleh),
    createdByAvatar: creatorIdentity?.avatar || pickAvatar(creator),

    auctionLimitValue: toNumeric(project.nilai_limit_lelang),
    spareBidding: toNumeric(project.spare_bidding),
    executionCost: toNumeric(project.biaya_eksekusi),
    renovationCost: toNumeric(project.biaya_renov),
    transferCost: toNumeric(project.biaya_balik_nama),
    totalAcquisitionCost: toNumeric(project.total_biaya_akuisisi),
    reserveFund: toNumeric(project.dana_cadangan),

    createdAt: project.dibuat_tanggal,
    updatedAt: project.diupdate_tanggal,

    investors: project.investorProject.map((item) => {
      const agent = item.agent as Record<string, unknown> | null;
      const identity = agentIdentityMap.get(item.id_agent);

      return {
        id: String(item.id_project_investor),
        name: identity?.name || pickDisplayName(agent, item.id_agent),
        avatar: identity?.avatar || pickAvatar(agent),
        committed: toNumeric(item.nominal_komitmen),
        ownership:
          item.persentase_kepemilikan != null
            ? toNumeric(item.persentase_kepemilikan)
            : null,
        status: item.status,
        note: item.catatan,
      };
    }),

    cma: project.cmaEntries.map((item) => ({
      id: item.id_project_cma,
      name: item.nama,
      landArea: toNumeric(item.luas_tanah),
      price: toNumeric(item.harga),
      note: item.catatan,
    })),

    // flatten ke root biar BloombergHeroCard lama/baru sama-sama bisa baca
    tanggal_terjual: projectSelesai?.tanggal_terjual ?? null,
    harga_jual: toNumeric(projectSelesai?.harga_jual),
    total_biaya_transaksi: toNumeric(projectSelesai?.total_biaya_transaksi),
    profit_kotor: toNumeric(projectSelesai?.profit_kotor),
    profit_bersih: toNumeric(projectSelesai?.profit_bersih),
    pph_percent: toNumeric(projectSelesai?.pph_percent),
    ajb_percent: toNumeric(projectSelesai?.ajb_percent),
    agent_fee_percent: toNumeric(projectSelesai?.agent_fee_percent),
    roi_bersih_percent: toNumeric(projectSelesai?.roi_bersih),

    // nested relation-style object untuk debug/compatibility
    projectSelesai: projectSelesai
      ? {
          id_project: projectSelesai.id_project,
          id_listing: projectSelesai.id_listing,
          tanggal_pembelian: projectSelesai.tanggal_pembelian,
          tanggal_terjual: projectSelesai.tanggal_terjual,
          durasi_hari: projectSelesai.durasi_hari,
          harga_jual: toNumeric(projectSelesai.harga_jual),
          total_biaya_akuisisi: toNumeric(projectSelesai.total_biaya_akuisisi),
          profit_kotor: toNumeric(projectSelesai.profit_kotor),
          pph_percent: toNumeric(projectSelesai.pph_percent),
          ajb_percent: toNumeric(projectSelesai.ajb_percent),
          agent_fee_percent: toNumeric(projectSelesai.agent_fee_percent),
          total_biaya_transaksi: toNumeric(projectSelesai.total_biaya_transaksi),
          profit_bersih: toNumeric(projectSelesai.profit_bersih),
          roi_bersih: toNumeric(projectSelesai.roi_bersih),
          dibuat_tanggal: projectSelesai.dibuat_tanggal,
          diupdate_tanggal: projectSelesai.diupdate_tanggal,
        }
      : null,
  } as ProjectDetailViewModel & {
    tanggal_terjual?: Date | string | null;
    harga_jual?: number;
    total_biaya_transaksi?: number;
    profit_kotor?: number;
    profit_bersih?: number;
    pph_percent?: number;
    ajb_percent?: number;
    agent_fee_percent?: number;
    roi_bersih_percent?: number;
    projectSelesai?: {
      id_project: string;
      id_listing: number | null;
      tanggal_pembelian: Date | string | null;
      tanggal_terjual: Date | string | null;
      durasi_hari: number | null;
      harga_jual: number;
      total_biaya_akuisisi: number;
      profit_kotor: number;
      pph_percent: number;
      ajb_percent: number;
      agent_fee_percent: number;
      total_biaya_transaksi: number;
      profit_bersih: number;
      roi_bersih: number;
      dibuat_tanggal: Date | string | null;
      diupdate_tanggal: Date | string | null;
    } | null;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070b] px-4 py-5 text-white md:px-6 md:py-6 xl:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_20%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_18%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.08),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_20%,rgba(255,255,255,0)_80%,rgba(255,255,255,0.02)_100%)]" />

      <div className="relative mx-auto max-w-[1600px] space-y-6">
        <BloombergHeroCard
          project={viewModel}
          backHref="/dashboard/project"
          topBarLabel="Detail transaksi"
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <CapitalDeploymentCard project={viewModel} />
            <CmaCard project={viewModel} />
            <InvestorBookCard project={viewModel} />
          </div>

          <div className="space-y-6 xl:col-span-4">
            <div className="xl:sticky xl:top-6 xl:space-y-6">
              <ReturnFrameworkCard project={viewModel} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type ProjectSelesaiItem = {
  id_project: string;
  id_listing: number;
  tanggal_pembelian: string | null;
  tanggal_terjual: string;
  durasi_hari: number;
  harga_jual: number;
  total_biaya_akuisisi: number;
  profit_kotor: number;
  pph_percent: number;
  ajb_percent: number;
  agent_fee_percent: number;
  total_biaya_transaksi: number;
  profit_bersih: number;
  roi_bersih: number;
  dibuat_tanggal: string | null;
  diupdate_tanggal: string | null;
};

type ProjectListItem = {
  id: string;
  nama: string;
  lokasi: string;
  status: string;
  jenisPendanaan: "terbuka" | "tertutup";
  thumbnail: string;
  targetPendanaan: number;
  totalPendanaan: number;
  estimasiHargaJual: number;
  estimasiProfit: number;
  hariTersisa: number;
  investor: number;
  avatarInvestor: string[];
  estimasiSelesaiBulan?: number;
  createdById?: string | null;
  projectSelesai?: ProjectSelesaiItem | null;
  userInvestment?: {
    nominalKomitmen: number;
    persentaseKepemilikan: number | null;
    status: string;
    updatedAt?: string | null;
  } | null;
};

type ProjectListResponse = {
  success: boolean;
  data?: ProjectListItem[];
  message?: string;
};

type RawProjectSelesaiRow = {
  id_project: string;
  id_listing: bigint | number;
  tanggal_pembelian: Date | null;
  tanggal_terjual: Date;
  durasi_hari: number;
  harga_jual: Prisma.Decimal | number | string;
  total_biaya_akuisisi: Prisma.Decimal | number | string;
  profit_kotor: Prisma.Decimal | number | string;
  pph_percent: Prisma.Decimal | number | string;
  ajb_percent: Prisma.Decimal | number | string;
  agent_fee_percent: Prisma.Decimal | number | string;
  total_biaya_transaksi: Prisma.Decimal | number | string;
  profit_bersih: Prisma.Decimal | number | string;
  roi_bersih: Prisma.Decimal | number | string;
  dibuat_tanggal: Date | null;
  diupdate_tanggal: Date | null;
};

function toNumber(
  value:
    | { toString(): string }
    | number
    | bigint
    | string
    | null
    | undefined
) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);

  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTitleCaseStatus(value?: string | null) {
  if (!value) return "-";

  return String(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getLokasi(kota?: string | null, provinsi?: string | null) {
  const parts = [kota, provinsi].filter(Boolean);
  return parts.length ? parts.join(", ") : "-";
}

function getHariTersisa(
  jenisPendanaan: "terbuka" | "tertutup",
  pendanaanDitutupPada?: Date | null
) {
  if (jenisPendanaan === "tertutup") return 0;
  if (!pendanaanDitutupPada) return 0;

  const now = new Date();
  const diffMs = pendanaanDitutupPada.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

function mapFinishedRow(row: RawProjectSelesaiRow): ProjectSelesaiItem {
  return {
    id_project: row.id_project,
    id_listing: toNumber(row.id_listing),
    tanggal_pembelian: row.tanggal_pembelian
      ? row.tanggal_pembelian.toISOString()
      : null,
    tanggal_terjual: row.tanggal_terjual.toISOString(),
    durasi_hari: toNumber(row.durasi_hari),
    harga_jual: toNumber(row.harga_jual),
    total_biaya_akuisisi: toNumber(row.total_biaya_akuisisi),
    profit_kotor: toNumber(row.profit_kotor),
    pph_percent: toNumber(row.pph_percent),
    ajb_percent: toNumber(row.ajb_percent),
    agent_fee_percent: toNumber(row.agent_fee_percent),
    total_biaya_transaksi: toNumber(row.total_biaya_transaksi),
    profit_bersih: toNumber(row.profit_bersih),
    roi_bersih: toNumber(row.roi_bersih),
    dibuat_tanggal: row.dibuat_tanggal
      ? row.dibuat_tanggal.toISOString()
      : null,
    diupdate_tanggal: row.diupdate_tanggal
      ? row.diupdate_tanggal.toISOString()
      : null,
  };
}

export async function GET() {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    const agentId = String(session?.user?.agentId || "").trim();

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { jenis_pendanaan: "terbuka" },
          ...(agentId
            ? [
                {
                  pembuat: {
                    is: {
                      id_agent: agentId,
                    },
                  },
                },
                {
                  jenis_pendanaan: "tertutup",
                  investorProject: {
                    some: {
                      id_agent: agentId,
                    },
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: [{ dibuat_tanggal: "desc" }],
      select: {
        id_project: true,
        nama_project: true,
        kota: true,
        provinsi: true,
        status: true,
        jenis_pendanaan: true,
        gambar_thumbnail: true,
        target_pendanaan: true,
        total_pendanaan: true,
        estimasi_harga_jual: true,
        estimasi_profit_bersih: true,
        pendanaan_ditutup_pada: true,
        estimasi_bulan: true,
        pembuat: {
          select: {
            id_agent: true,
          },
        },
        investorProject: {
          orderBy: {
            nominal_komitmen: "desc",
          },
          select: {
            id_agent: true,
            nominal_komitmen: true,
            persentase_kepemilikan: true,
            status: true,
            diupdate_tanggal: true,
            agent: {
              select: {
                foto_profil_url: true,
              },
            },
          },
        },
      },
    });

    const projectIds = projects.map((item) => item.id_project);

    let finishedMap = new Map<string, ProjectSelesaiItem>();

    if (projectIds.length > 0) {
      const finishedRows = await prisma.$queryRaw<RawProjectSelesaiRow[]>(
        Prisma.sql`
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
          WHERE id_project IN (${Prisma.join(projectIds)})
        `
      );

      finishedMap = new Map(
        finishedRows.map((row) => [row.id_project, mapFinishedRow(row)])
      );
    }

    const data: ProjectListItem[] = projects.map((project) => {
      const jenisPendanaan = project.jenis_pendanaan as "terbuka" | "tertutup";

      const sortedInvestorAvatars = project.investorProject
        .map((item) => item.agent?.foto_profil_url || "")
        .filter(Boolean);

      const myInvestment = agentId
        ? project.investorProject.find((item) => item.id_agent === agentId)
        : null;

      const projectSelesai = finishedMap.get(project.id_project) ?? null;

      const displayStatus = projectSelesai
        ? "Sudah Terjual"
        : jenisPendanaan === "tertutup" &&
          String(project.status).toLowerCase().includes("pendanaan")
        ? "Pendanaan Tertutup"
        : toTitleCaseStatus(project.status);

      return {
        id: project.id_project,
        nama: project.nama_project,
        lokasi: getLokasi(project.kota, project.provinsi),
        status: displayStatus,
        jenisPendanaan,
        thumbnail:
          project.gambar_thumbnail?.trim() ||
          "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
        targetPendanaan: toNumber(project.target_pendanaan),
        totalPendanaan: toNumber(project.total_pendanaan),
        estimasiHargaJual: toNumber(project.estimasi_harga_jual),
        estimasiProfit: toNumber(project.estimasi_profit_bersih),
        hariTersisa: projectSelesai
          ? 0
          : getHariTersisa(jenisPendanaan, project.pendanaan_ditutup_pada),
        investor: project.investorProject.length,
        avatarInvestor: sortedInvestorAvatars,
        estimasiSelesaiBulan: project.estimasi_bulan ?? 0,
        createdById: project.pembuat?.id_agent ?? null,
        projectSelesai,
        userInvestment: myInvestment
          ? {
              nominalKomitmen: toNumber(myInvestment.nominal_komitmen),
              persentaseKepemilikan:
                myInvestment.persentase_kepemilikan == null
                  ? null
                  : toNumber(myInvestment.persentase_kepemilikan),
              status: String(myInvestment.status || "menunggu_pembayaran"),
              updatedAt: myInvestment.diupdate_tanggal
                ? myInvestment.diupdate_tanggal.toISOString()
                : null,
            }
          : null,
      };
    });

    return NextResponse.json<ProjectListResponse>({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[GET_PROJECT_LIST_ERROR]", error);

    return NextResponse.json<ProjectListResponse>(
      {
        success: false,
        message: "Gagal mengambil daftar project.",
      },
      { status: 500 }
    );
  }
}
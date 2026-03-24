import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
};

type ProjectListResponse = {
  success: boolean;
  data?: ProjectListItem[];
  message?: string;
};

function toNumber(value: { toString(): string } | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

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
                // project yang dibuat oleh agent yang sedang login
                {
                  pembuat: {
                    is: {
                      id_agent: agentId,
                    },
                  },
                },

                // project tertutup yang agent ini ikuti sebagai investor
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
            agent: {
              select: {
                foto_profil_url: true,
              },
            },
          },
        },
      },
    });

    const data: ProjectListItem[] = projects.map((project) => {
      const jenisPendanaan = project.jenis_pendanaan as "terbuka" | "tertutup";

      const sortedInvestorAvatars = project.investorProject
        .map((item) => item.agent?.foto_profil_url || "")
        .filter(Boolean);

      const displayStatus =
        jenisPendanaan === "tertutup" &&
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
        hariTersisa: getHariTersisa(
          jenisPendanaan,
          project.pendanaan_ditutup_pada
        ),
        investor: project.investorProject.length,
        avatarInvestor: sortedInvestorAvatars,
        estimasiSelesaiBulan: project.estimasi_bulan ?? 0,
        createdById: project.pembuat?.id_agent ?? null,
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
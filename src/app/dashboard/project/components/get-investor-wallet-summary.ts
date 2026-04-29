import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value instanceof Prisma.Decimal) return value.toNumber();

  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export async function getInvestorWalletSummary(idAgent: string) {
  const validStatuses = [
    "menunggu_pembayaran",
    "dibayar_sebagian",
    "lunas",
  ] as const;

  const [fundingAggregate, fundedProjects] = await Promise.all([
    prisma.projectInvestor.aggregate({
      where: {
        id_agent: idAgent,
        status: {
          in: validStatuses,
        },
      },
      _sum: {
        nominal_komitmen: true,
        nominal_terbayar: true,
      },
    }),

    prisma.project.findMany({
      where: {
        investorProject: {
          some: {
            id_agent: idAgent,
            status: {
              in: validStatuses,
            },
          },
        },
      },
      select: {
        id_project: true,
        id_listing: true,
        status: true,
      },
    }),
  ]);

  const totalDanaKomitmen = toNumber(fundingAggregate._sum.nominal_komitmen);
  const totalDanaTerbayar = toNumber(fundingAggregate._sum.nominal_terbayar);

  const activeProjects = fundedProjects.filter(
    (project) => project.status !== "terjual" && project.status !== "dibatalkan"
  );

  const jumlahPropertyDidanai = new Set(
    fundedProjects.map((project) => String(project.id_listing))
  ).size;

  return {
    totalDana: totalDanaKomitmen,
    totalDanaTerbayar,
    projectAktif: activeProjects.length,
    jumlahPropertyDidanai,
  };
}
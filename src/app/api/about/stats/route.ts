import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StatsResponse = {
  activeListings: number;
  transactionVolume: number;
  professionalAgents: number;
  clientSatisfaction: number;
};

export async function GET() {
  try {
    const [activeListings, professionalAgents, mouRows] = await Promise.all([
      prisma.listing.count(),
      prisma.pengguna.count({ where: { peran: "AGENT" } }),
      prisma.mou.findMany({
        select: {
          tipe_komisi: true,
          harga_deal: true,
          maksimum_bidding: true,
        },
      }),
    ]);

    const transactionVolume = mouRows.reduce((sum, m) => {
      const isPersen = (m.tipe_komisi ?? "").toUpperCase() === "PERSENTASE";
      const value = isPersen
        ? Number(m.maksimum_bidding ?? 0)
        : Number(m.harga_deal ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const payload: StatsResponse = {
      activeListings,
      transactionVolume,
      professionalAgents,
      clientSatisfaction: 98.7,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("[GET /api/about/stats]", error);
    return NextResponse.json(
      {
        activeListings: 0,
        transactionVolume: 0,
        professionalAgents: 0,
        clientSatisfaction: 98.7,
      } satisfies StatsResponse,
      { status: 200 }
    );
  }
}

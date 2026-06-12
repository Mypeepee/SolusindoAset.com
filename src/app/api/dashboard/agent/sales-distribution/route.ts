import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId) {
      return NextResponse.json({ ok: false, message: "Agent ID tidak ditemukan" }, { status: 403 });
    }

    // Group listing by kota, ambil top 5
    const grouped = await prisma.listing.groupBy({
      by: ["kota"],
      where: {
        id_agent: agentId,
        status_tayang: { not: "TARIK_LISTING" },
      },
      _count: { kota: true },
      orderBy: { _count: { kota: "desc" } },
      take: 5,
    });

    const total = grouped.reduce((sum, g) => sum + g._count.kota, 0);

    const regions = grouped.map((g) => ({
      name: g.kota,
      count: g._count.kota,
      pct: total > 0 ? Math.round((g._count.kota / total) * 100) : 0,
    }));

    return NextResponse.json({ ok: true, regions, total });
  } catch (e: any) {
    console.error("[sales-distribution]", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

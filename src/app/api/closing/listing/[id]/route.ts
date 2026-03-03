import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonSafeNumber } from "@/lib/jsonSafeNumber";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const raw = decodeURIComponent(params.id);

  try {
    const isNumericId = /^\d+$/.test(raw);

    const listing = await prisma.listing.findFirst({
      where: isNumericId ? { id_property: BigInt(raw) } : { slug: raw },
      include: { agent: true },
    });

    if (!listing) {
      return NextResponse.json({ ok: false, message: "listing_not_found" }, { status: 404 });
    }

    let leader = null as any;
    const tlId = (listing.agent as any)?.team_leader_id;
    if (tlId) {
      leader = await prisma.agent.findUnique({ where: { id_agent: tlId } });
    }

    return NextResponse.json(
      jsonSafeNumber({
        ok: true,
        data: { listing, agent: listing.agent ?? null, leader },
      })
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "server_error" },
      { status: 500 }
    );
  }
}
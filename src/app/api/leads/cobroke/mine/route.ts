import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/leads/cobroke/mine?id_property=123
// Klaim co-broke terbaru milik agent yang login untuk properti tersebut.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const agentId = (session?.user as any)?.agentId as string | null | undefined;
    if (!agentId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idPropertyRaw = searchParams.get("id_property");
    if (!idPropertyRaw) {
      return NextResponse.json({ ok: false, error: "id_property wajib diisi" }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id_agent_cobroke: agentId,
        id_property: BigInt(idPropertyRaw),
        source: "cobroke",
      },
      orderBy: { created_at: "desc" },
    });

    if (!lead) {
      return NextResponse.json({ ok: true, claim: null });
    }

    return NextResponse.json({
      ok: true,
      claim: {
        id_lead: lead.id_lead.toString(),
        client_name: lead.client_name,
        client_phone: lead.client_phone,
        catatan: lead.catatan,
        status_penawaran: lead.status_penawaran,
        catatan_agent: lead.catatan_agent,
        tanggal_keputusan: lead.tanggal_keputusan?.toISOString() ?? null,
        created_at: lead.created_at.toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ /api/leads/cobroke/mine error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

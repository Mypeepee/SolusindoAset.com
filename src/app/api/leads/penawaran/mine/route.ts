import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/leads/penawaran/mine?id_property=123
// Penawaran terbaru milik user yang login untuk properti tersebut.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idPropertyRaw = searchParams.get("id_property");
    if (!idPropertyRaw) {
      return NextResponse.json({ ok: false, error: "id_property wajib diisi" }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id_pengguna: String(session.user.id),
        id_property: BigInt(idPropertyRaw),
        source: "penawaran",
      },
      orderBy: { created_at: "desc" },
    });

    if (!lead) {
      return NextResponse.json({ ok: true, offer: null });
    }

    return NextResponse.json({
      ok: true,
      offer: {
        id_lead: lead.id_lead.toString(),
        penawaran: lead.penawaran ? Number(lead.penawaran) : null,
        diskon: lead.diskon ? Number(lead.diskon) : null,
        pembayaran: lead.pembayaran,
        catatan: lead.catatan,
        status_penawaran: lead.status_penawaran,
        catatan_agent: lead.catatan_agent,
        tanggal_keputusan: lead.tanggal_keputusan?.toISOString() ?? null,
        created_at: lead.created_at.toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ /api/leads/penawaran/mine error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

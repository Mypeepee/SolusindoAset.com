import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/leads/penawaran/inbox — daftar penawaran baru untuk agent yang login
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const agentId = (session?.user as any)?.agentId as string | null | undefined;
    if (!agentId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const leads = await prisma.lead.findMany({
      where: { id_agent: agentId, source: "penawaran", status: "new" },
      orderBy: { created_at: "desc" },
      take: 20,
      include: {
        listing: {
          select: { id_property: true, judul: true, slug: true, gambar: true, harga: true },
        },
        pengguna: {
          select: { wa_terverifikasi: true },
        },
      },
    });

    const items = leads.map((l) => {
      const firstImage =
        (l.listing?.gambar && l.listing.gambar.split(",").map((s) => s.trim())[0]) || null;

      return {
        id_lead: l.id_lead.toString(),
        id_property: l.id_property.toString(),
        judul: l.listing?.judul || null,
        slug: l.listing?.slug || null,
        gambar: firstImage,
        harga_listing: l.listing ? Number(l.listing.harga) : null,
        client_name: l.client_name,
        client_phone: l.client_phone,
        offer_amount: l.penawaran ? Number(l.penawaran) : null,
        notes: l.catatan,
        verified: l.pengguna?.wa_terverifikasi ?? false,
        created_at: l.created_at.toISOString(),
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("❌ /api/leads/penawaran/inbox error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

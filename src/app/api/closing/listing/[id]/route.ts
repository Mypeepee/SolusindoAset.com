// src/app/api/closing/listing/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonSafeNumber } from "@/lib/jsonSafeNumber";

function splitImages(gambar: any): string[] {
  const raw = (gambar ?? "").toString();
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function firstImage(gambar: any): string {
  const arr = splitImages(gambar);
  return arr[0] || "/placeholder.jpg";
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const raw = decodeURIComponent(params.id);

  try {
    const isNumericId = /^\d+$/.test(raw);

    const listing = await prisma.listing.findFirst({
      where: isNumericId ? { id_property: BigInt(raw) } : { slug: raw },
      include: {
        agent: {
          // biar FE bisa pakai agent_nama tanpa bingung
          include: { pengguna: true },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { ok: false, message: "listing_not_found" },
        { status: 404 }
      );
    }

    // Leader (optional)
    let leader = null as any;
    const tlId = (listing.agent as any)?.team_leader_id;
    if (tlId) {
      leader = await prisma.agent.findUnique({
        where: { id_agent: tlId },
        include: { pengguna: true },
      });
    }

    // ✅ normalize gambar => imageUrl + list
    const gambarList = splitImages((listing as any).gambar);
    const imageUrl = firstImage((listing as any).gambar);

    // ✅ optional: agent display name (CO PIC)
    const agentNama =
      (listing.agent as any)?.pengguna?.nama_lengkap ??
      (listing.agent as any)?.nama_kantor ??
      (listing as any).id_agent ??
      "-";

    return NextResponse.json(
      jsonSafeNumber({
        ok: true,
        data: {
          listing: {
            ...listing,
            imageUrl, // ✅ foto pertama
            gambar_list: gambarList, // ✅ array semua foto
            agent_nama: agentNama, // ✅ display name
          },
          agent: listing.agent ?? null,
          leader,
        },
      })
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "server_error" },
      { status: 500 }
    );
  }
}
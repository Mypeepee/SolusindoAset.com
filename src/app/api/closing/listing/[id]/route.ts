import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonSafeNumber } from "@/lib/jsonSafeNumber";

function splitImages(gambar: any): string[] {
  const raw = (gambar ?? "").toString();
  return raw.split(",").map((x: string) => x.trim()).filter(Boolean);
}

function firstImage(gambar: any): string {
  return splitImages(gambar)[0] || "/placeholder.jpg";
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
        agent: { include: { pengguna: true } },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { ok: false, message: "listing_not_found" },
        { status: 404 }
      );
    }

    // Team Leader
    let leader = null as any;
    const tlId = (listing.agent as any)?.id_team_leader;
    if (tlId) {
      leader = await prisma.agent.findUnique({
        where: { id_agent: tlId },
        include: { pengguna: true },
      });
    }

    // MOU aktif (bukan kalah/batal)
    const mouAktif = await prisma.mou.findFirst({
      where: {
        id_listing: listing.id_property,
        status: { notIn: ["kalah", "batal"] },
      },
      orderBy: { dibuat_pada: "desc" },
      select: {
        id: true,
        id_transaksi: true,
        status: true,
        mou_generated: true,
        invoice_utm_generated: true,
      },
    });

    const gambarList = splitImages((listing as any).gambar);
    const imageUrl   = firstImage((listing as any).gambar);
    const agentNama  =
      (listing.agent as any)?.pengguna?.nama_lengkap ??
      (listing.agent as any)?.nama_kantor ??
      "-";

    return NextResponse.json(
      jsonSafeNumber({
        ok: true,
        data: {
          listing: { ...listing, imageUrl, gambar_list: gambarList, agent_nama: agentNama },
          agent: listing.agent ?? null,
          leader,
          mou: mouAktif
            ? {
                id: mouAktif.id.toString(),
                kode: mouAktif.id_transaksi,
                status: mouAktif.status,
                mou_generated: mouAktif.mou_generated,
                invoice_utm_generated: mouAktif.invoice_utm_generated,
              }
            : null,
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

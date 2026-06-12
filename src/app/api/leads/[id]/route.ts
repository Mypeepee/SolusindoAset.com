// app/api/leads/[id]/route.ts
// PATCH untuk update status / data klien.
// GET untuk detail lead.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

const VALID_STATUS = ["new", "contacted", "hot", "closing", "cold"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const agentId = (session?.user as any)?.agentId as string | null | undefined;
    if (!agentId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const id = BigInt(params.id);
    const lead = await prisma.lead.findFirst({
      where: { id_lead: id, id_agent: agentId },
      include: {
        listing: {
          select: { id_property: true, judul: true, slug: true, harga: true, gambar: true },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      lead: {
        ...lead,
        id_lead: lead.id_lead.toString(),
        listing: lead.listing
          ? {
              ...lead.listing,
              id_property: lead.listing.id_property.toString(),
              harga: Number(lead.listing.harga),
            }
          : null,
      },
    });
  } catch (err) {
    console.error("❌ /api/leads/[id] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const agentId = (session?.user as any)?.agentId as string | null | undefined;
    if (!agentId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = BigInt(params.id);

    const lead = await prisma.lead.findFirst({
      where: { id_lead: id, id_agent: agentId },
      select: { id_lead: true, status: true },
    });
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead tidak ditemukan" }, { status: 404 });
    }

    const updateData: any = { last_activity: new Date() };

    if (body.status) {
      if (!VALID_STATUS.includes(body.status)) {
        return NextResponse.json({ ok: false, error: "Status tidak valid" }, { status: 400 });
      }
      updateData.status = body.status;
    }

    if (typeof body.client_name === "string") {
      updateData.client_name = body.client_name;
    }
    if (typeof body.client_phone === "string") {
      updateData.client_phone = body.client_phone;
    }

    const updated = await prisma.lead.update({
      where: { id_lead: id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      lead: {
        ...updated,
        id_lead: updated.id_lead.toString(),
        id_property: updated.id_property.toString(),
      },
    });
  } catch (err) {
    console.error("❌ /api/leads/[id] PATCH error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

// app/api/leads/[id]/route.ts
// PATCH untuk update status / data klien.
// GET untuk detail lead.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";
import { notifyCobrokeDecision } from "@/lib/notifications";

const VALID_STATUS = ["new", "contacted", "hot", "closing", "cold"] as const;
const VALID_DECISION = ["diterima", "ditolak"] as const;

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
        // Identitas klien co-broke adalah privat milik agent pengaju — disembunyikan dari agent pemilik listing.
        client_name: lead.source === "cobroke" ? null : lead.client_name,
        client_phone: lead.source === "cobroke" ? null : lead.client_phone,
        client_email: lead.source === "cobroke" ? null : lead.client_email,
        id_lead: lead.id_lead.toString(),
        id_property: lead.id_property.toString(),
        penawaran: lead.penawaran ? Number(lead.penawaran) : null,
        diskon: lead.diskon ? Number(lead.diskon) : null,
        tanggal_keputusan: lead.tanggal_keputusan?.toISOString() ?? null,
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
      select: {
        id_lead: true,
        id_property: true,
        id_pengguna: true,
        id_agent_cobroke: true,
        status: true,
        source: true,
        status_penawaran: true,
        penawaran: true,
        listing: { select: { judul: true } },
      },
    });
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead tidak ditemukan" }, { status: 404 });
    }

    // ── Keputusan agent terhadap penawaran / klaim co-broke (terima/tolak) ──
    if (body.decision) {
      if (!VALID_DECISION.includes(body.decision)) {
        return NextResponse.json({ ok: false, error: "Keputusan tidak valid" }, { status: 400 });
      }
      if (lead.source !== "penawaran" && lead.source !== "cobroke") {
        return NextResponse.json({ ok: false, error: "Lead ini bukan penawaran atau co-broke" }, { status: 400 });
      }
      if (lead.status_penawaran !== "pending") {
        return NextResponse.json({ ok: false, error: "Pengajuan ini sudah diproses sebelumnya" }, { status: 409 });
      }
      if (body.decision === "ditolak" && !String(body.catatan_agent || "").trim()) {
        return NextResponse.json({ ok: false, error: "Catatan wajib diisi untuk menolak pengajuan" }, { status: 400 });
      }

      const updated = await prisma.lead.update({
        where: { id_lead: id },
        data: {
          status_penawaran: body.decision,
          catatan_agent: String(body.catatan_agent || "").trim() || null,
          tanggal_keputusan: new Date(),
          status: body.decision === "diterima" ? "closing" : "cold",
          last_activity: new Date(),
        },
      });

      if (lead.source === "penawaran" && lead.id_pengguna) {
        pusherServer
          .trigger(`user-${lead.id_pengguna}`, "penawaran:decision", {
            id_lead: lead.id_lead.toString(),
            id_property: lead.id_property.toString(),
            status_penawaran: body.decision,
            catatan_agent: updated.catatan_agent,
            penawaran: lead.penawaran ? Number(lead.penawaran) : null,
          })
          .catch((e) => console.warn("pusher trigger penawaran:decision failed:", e));
      }

      if (lead.source === "cobroke" && lead.id_agent_cobroke) {
        const claimerAgent = await prisma.agent.findUnique({
          where: { id_agent: lead.id_agent_cobroke },
          select: { id_pengguna: true },
        });

        if (claimerAgent) {
          pusherServer
            .trigger(`user-${claimerAgent.id_pengguna}`, "cobroke:decision", {
              id_lead: lead.id_lead.toString(),
              id_property: lead.id_property.toString(),
              status_penawaran: body.decision,
              catatan_agent: updated.catatan_agent,
            })
            .catch((e) => console.warn("pusher trigger cobroke:decision failed:", e));

          await notifyCobrokeDecision({
            id_pengguna_claimer: claimerAgent.id_pengguna,
            status: body.decision,
            judul_listing: lead.listing?.judul || "",
            catatan_agent: updated.catatan_agent,
          }).catch((e) => console.warn("notifyCobrokeDecision failed:", e));
        }
      }

      return NextResponse.json({
        ok: true,
        lead: {
          ...updated,
          id_lead: updated.id_lead.toString(),
          id_property: updated.id_property.toString(),
          penawaran: updated.penawaran ? Number(updated.penawaran) : null,
          diskon: updated.diskon ? Number(updated.diskon) : null,
          tanggal_keputusan: updated.tanggal_keputusan?.toISOString() ?? null,
        },
      });
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
        penawaran: updated.penawaran ? Number(updated.penawaran) : null,
        diskon: updated.diskon ? Number(updated.diskon) : null,
        tanggal_keputusan: updated.tanggal_keputusan?.toISOString() ?? null,
      },
    });
  } catch (err) {
    console.error("❌ /api/leads/[id] PATCH error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

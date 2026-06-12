// app/api/leads/click/route.ts
// Capture lead saat klien klik tombol WhatsApp / Telepon / Survei
// di halaman detail listing properti.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type ClickSource = "whatsapp" | "telepon" | "survei";

interface ClickBody {
  id_property: string | number;
  id_agent: string;
  source: ClickSource;
  session_id?: string;
  referrer?: string;
}

function detectDeviceType(ua: string): string {
  if (/mobile/i.test(ua)) return "mobile";
  if (/tablet|ipad/i.test(ua)) return "tablet";
  return "desktop";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ClickBody;

    if (!body.id_property || !body.id_agent || !body.source) {
      return NextResponse.json(
        { ok: false, error: "id_property, id_agent, source wajib diisi" },
        { status: 400 },
      );
    }

    if (!["whatsapp", "telepon", "survei"].includes(body.source)) {
      return NextResponse.json(
        { ok: false, error: "source tidak valid" },
        { status: 400 },
      );
    }

    const id_property = BigInt(body.id_property);

    // Validasi listing & agent
    const listing = await prisma.listing.findUnique({
      where: { id_property },
      select: { id_property: true, id_agent: true },
    });

    if (!listing) {
      return NextResponse.json(
        { ok: false, error: "Properti tidak ditemukan" },
        { status: 404 },
      );
    }

    // Gunakan id_agent dari listing (lebih akurat daripada dari client)
    const id_agent = listing.id_agent;

    // Tracking metadata
    const userAgent = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const realIp = req.headers.get("x-real-ip") || "";
    const ip = forwardedFor.split(",")[0]?.trim() || realIp || null;
    const referrer = body.referrer || req.headers.get("referer") || null;
    const deviceType = detectDeviceType(userAgent);

    // Anti-spam ringan: jangan buat lead duplikat dalam 5 menit
    // untuk session+property+source yang sama
    if (body.session_id) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recent = await prisma.lead.findFirst({
        where: {
          session_id: body.session_id,
          id_property,
          source: body.source,
          created_at: { gte: fiveMinAgo },
        },
        select: { id_lead: true },
      });

      if (recent) {
        return NextResponse.json({
          ok: true,
          id_lead: recent.id_lead.toString(),
          deduped: true,
        });
      }
    }

    const lead = await prisma.lead.create({
      data: {
        id_property,
        id_agent,
        source: body.source,
        status: "new",
        ip_address: ip,
        user_agent: userAgent || null,
        device_type: deviceType,
        referrer,
        session_id: body.session_id || null,
        last_activity: new Date(),
      },
      select: {
        id_lead: true,
      },
    });

    // Tambah counter di listing (kolom wa_click_count sudah ada)
    if (body.source === "whatsapp") {
      await prisma.listing
        .update({
          where: { id_property },
          data: { wa_click_count: { increment: 1 } },
        })
        .catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      id_lead: lead.id_lead.toString(),
    });
  } catch (error) {
    console.error("❌ /api/leads/click error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

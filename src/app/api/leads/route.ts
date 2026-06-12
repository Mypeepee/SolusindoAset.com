// app/api/leads/route.ts
// GET /api/leads?status=&source=&limit=
// Mengembalikan daftar lead milik agent yang sedang login.
// Dipakai oleh Hot Leads card di dashboard.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type LeadStatus = "new" | "contacted" | "hot" | "closing" | "cold";

type LeadSource =
  | "whatsapp"
  | "telepon"
  | "survei"
  | "titip_jual"
  | "form_inquiry";

const ACTIVE_STATUSES: LeadStatus[] = ["new", "contacted", "hot"];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const agentId = (session?.user as any)?.agentId as string | null | undefined;

    if (!agentId) {
      return NextResponse.json(
        { ok: false, error: "Bukan akun agent atau belum login" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") as LeadStatus | null;
    const sourceFilter = searchParams.get("source") as LeadSource | null;
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    const where: any = {
      id_agent: agentId,
      status: statusFilter ? statusFilter : { in: ACTIVE_STATUSES },
    };
    if (sourceFilter) where.source = sourceFilter;

    const leads = await prisma.lead.findMany({
      where,
      orderBy: [{ created_at: "desc" }],
      take: limit,
      include: {
        listing: {
          select: {
            id_property: true,
            judul: true,
            slug: true,
            kota: true,
            kecamatan: true,
            alamat_lengkap: true,
            harga: true,
            gambar: true,
            kategori: true,
            jenis_transaksi: true,
          },
        },
      },
    });

    const serialized = leads.map((l) => {
      const firstImage =
        (l.listing?.gambar &&
          l.listing.gambar.split(",").map((s) => s.trim())[0]) ||
        null;

      return {
        id_lead: l.id_lead.toString(),
        source: l.source,
        status: l.status,
        client_name: l.client_name,
        client_phone: l.client_phone,
        client_email: l.client_email,
        device_type: l.device_type,
        last_activity: l.last_activity?.toISOString() || null,
        created_at: l.created_at.toISOString(),
        listing: l.listing
          ? {
              id_property: l.listing.id_property.toString(),
              judul: l.listing.judul,
              slug: l.listing.slug,
              kota: l.listing.kota,
              kecamatan: l.listing.kecamatan,
              alamat_lengkap: l.listing.alamat_lengkap,
              harga: Number(l.listing.harga),
              gambar_utama: firstImage,
              kategori: l.listing.kategori,
              jenis_transaksi: l.listing.jenis_transaksi,
            }
          : null,
      };
    });

    return NextResponse.json({ ok: true, leads: serialized });
  } catch (error) {
    console.error("❌ /api/leads GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

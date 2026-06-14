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
  | "form_inquiry"
  | "penawaran"
  | "cobroke";

// "cold" ikut diambil supaya lead yang sudah diarsipkan tetap muncul
// di pill "Arsip" pada Hot Leads card setelah refresh.
const ACTIVE_STATUSES: LeadStatus[] = ["new", "contacted", "hot", "closing", "cold"];

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
        bookingSurvei: {
          select: { status: true },
          take: 1,
          orderBy: { tanggal_dibuat: "desc" },
        },
        pengguna: {
          select: { wa_terverifikasi: true },
        },
        agentCobroke: {
          select: {
            id_agent: true,
            nama_kantor: true,
            nomor_whatsapp: true,
            pengguna: { select: { nama_lengkap: true } },
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
        // Untuk lead co-broke, identitas klien adalah privat milik agent pengaju —
        // tidak dibagikan ke agent pemilik listing. Koordinasi survei lewat agentCobroke.
        client_name: l.source === "cobroke" ? null : l.client_name,
        client_phone: l.source === "cobroke" ? null : l.client_phone,
        client_email: l.source === "cobroke" ? null : l.client_email,
        offer_amount: l.penawaran ? Number(l.penawaran) : null,
        notes: l.catatan,
        diskon: l.diskon ? Number(l.diskon) : null,
        pembayaran: l.pembayaran,
        status_penawaran: l.status_penawaran,
        catatan_agent: l.catatan_agent,
        tanggal_keputusan: l.tanggal_keputusan?.toISOString() || null,
        id_pengguna: l.id_pengguna,
        verified: l.pengguna?.wa_terverifikasi ?? false,
        cobroke_agent: l.agentCobroke
          ? {
              id_agent: l.agentCobroke.id_agent,
              nama: l.agentCobroke.pengguna.nama_lengkap,
              kantor: l.agentCobroke.nama_kantor,
              whatsapp: l.agentCobroke.nomor_whatsapp,
            }
          : null,
        booking_survei_status: l.bookingSurvei[0]?.status || null,
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

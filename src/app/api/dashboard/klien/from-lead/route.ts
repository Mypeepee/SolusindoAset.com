import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Urutan status — semakin tinggi indeks = semakin maju
const STATUS_RANK: Record<string, number> = {
  lost_iseng:     0,
  lead_baru:      1,
  sudah_dikontak: 2,
  hot_buyer:      3,
  closing:        4,
};

const LEAD_TO_KLIEN_STATUS: Record<string, string> = {
  new:       "lead_baru",
  contacted: "sudah_dikontak",
  hot:       "hot_buyer",
  closing:   "closing",
  cold:      "lost_iseng",
};

const LEAD_TO_KLIEN_SUMBER: Record<string, string> = {
  whatsapp:     "wa_organik",
  telepon:      "wa_organik",
  survei:       "wa_organik",
  titip_jual:   "titip_jual",
  form_inquiry: "website",
};

/**
 * POST /api/dashboard/klien/from-lead
 *
 * Dipanggil otomatis saat agen menekan "Simpan Perubahan" di modal hot leads.
 * Upsert klien berdasarkan nomor_whatsapp + id_agent:
 *   - Sudah ada WA yang sama → update (status yang lebih maju menang)
 *   - Belum ada → buat baru
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId)
      return NextResponse.json({ ok: false, message: "Bukan akun agent" }, { status: 403 });

    const body = await req.json();
    const { nama, nomor_whatsapp, lead_status, source_raw, id_lead, id_property } = body;

    const klienStatus = LEAD_TO_KLIEN_STATUS[lead_status] ?? "lead_baru";
    const klienSumber = LEAD_TO_KLIEN_SUMBER[source_raw]  ?? "wa_organik";

    const leadBigInt     = id_lead     ? BigInt(id_lead)     : null;
    const propertyBigInt = id_property ? BigInt(id_property) : null;

    // ── Cari klien yang sudah ada (dedup by WA + agent, fallback by lead) ─
    let existing: { id_klien: string; status: string; id_lead_asal: bigint | null } | null = null;

    if (nomor_whatsapp) {
      existing = await prisma.klien.findFirst({
        where: { id_agent: agentId, nomor_whatsapp },
        select: { id_klien: true, status: true, id_lead_asal: true },
      });
    }

    // Kalau tidak ada WA, fallback by id_lead_asal (UNIQUE, hindari conflict)
    if (!existing && leadBigInt) {
      existing = await prisma.klien.findFirst({
        where: { id_lead_asal: leadBigInt },
        select: { id_klien: true, status: true, id_lead_asal: true },
      });
    }

    if (existing) {
      // Status yang lebih maju menang
      const existingRank = STATUS_RANK[existing.status] ?? 0;
      const incomingRank = STATUS_RANK[klienStatus]     ?? 0;
      const betterStatus = incomingRank > existingRank ? klienStatus : existing.status;

      const updateData: any = {
        status:                  betterStatus,
        tanggal_kontak_terakhir: new Date(),
        diperbarui_pada:         new Date(),
      };

      // Update nama kalau ada dan belum terisi
      if (nama?.trim()) updateData.nama = nama.trim();

      // Set id_lead_asal hanya kalau belum ada (jangan override yang lama)
      if (!existing.id_lead_asal && leadBigInt)     updateData.id_lead_asal    = leadBigInt;
      if (!existing.id_lead_asal && propertyBigInt) updateData.id_properti_asal = propertyBigInt;

      const updated = await prisma.klien.update({
        where:  { id_klien: existing.id_klien },
        data:   updateData,
        select: { id_klien: true },
      });

      return NextResponse.json({ ok: true, action: "updated", id_klien: updated.id_klien });
    }

    // ── Buat klien baru ──────────────────────────────────────────────────
    const createData: any = {
      id_agent:               agentId,
      nama:                   nama?.trim() || "Klien dari Lead",
      nomor_whatsapp:         nomor_whatsapp || null,
      sumber:                 klienSumber,
      status:                 klienStatus,
      tanggal_kontak_terakhir: new Date(),
    };

    if (leadBigInt)     createData.id_lead_asal     = leadBigInt;
    if (propertyBigInt) createData.id_properti_asal = propertyBigInt;

    const created = await prisma.klien.create({
      data:   createData,
      select: { id_klien: true },
    });

    return NextResponse.json({ ok: true, action: "created", id_klien: created.id_klien }, { status: 201 });

  } catch (e: any) {
    console.error("[from-lead]", e);
    return NextResponse.json({ ok: false, message: e?.message ?? "Server error" }, { status: 500 });
  }
}

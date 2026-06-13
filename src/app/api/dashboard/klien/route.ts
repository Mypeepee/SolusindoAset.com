import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q      = searchParams.get("q") || "";
  const status = searchParams.get("status") || "";
  const page   = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit  = Math.min(50, parseInt(searchParams.get("limit") || "20"));
  const skip   = (page - 1) * limit;

  const where: any = { id_agent: agentId };
  if (status) where.status = status;
  if (q) where.OR = [
    { nama: { contains: q, mode: "insensitive" } },
    { nomor_whatsapp: { contains: q } },
    { email: { contains: q, mode: "insensitive" } },
  ];

  const [items, total] = await Promise.all([
    prisma.klien.findMany({
      where,
      include: { preferensi: { orderBy: { dibuat_pada: "asc" } } },
      orderBy: { dibuat_pada: "desc" },
      skip,
      take: limit,
    }),
    prisma.klien.count({ where }),
  ]);

  return NextResponse.json({
    ok: true,
    data: items.map(serializeKlien),
    total,
    page,
    limit,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await req.json();
  const { preferensi, ...rest } = body;

  if (!rest.nama?.trim())
    return NextResponse.json({ ok: false, message: "Nama wajib diisi" }, { status: 400 });

  const klienData: any = {
    id_agent:         agentId,
    nama:             rest.nama.trim(),
    nomor_whatsapp:   rest.nomor_whatsapp || null,
    email:            rest.email || null,
    sumber:           rest.sumber || "wa_organik",
    status:           rest.status || "lead_baru",
    catatan:          rest.catatan || null,
    metode_pembayaran: rest.metode_pembayaran || null,
    bank_kpr:         rest.bank_kpr || null,
    tenor_kpr:        rest.tenor_kpr ? Number(rest.tenor_kpr) : null,
    tanggal_follow_up: rest.tanggal_follow_up ? new Date(rest.tanggal_follow_up) : null,
    tanggal_kontak_terakhir: rest.tanggal_kontak_terakhir
      ? new Date(rest.tanggal_kontak_terakhir)
      : null,
  };

  if (rest.id_lead_asal)    klienData.id_lead_asal    = BigInt(rest.id_lead_asal);
  if (rest.id_properti_asal) klienData.id_properti_asal = BigInt(rest.id_properti_asal);

  const klien = await prisma.klien.create({
    data: {
      ...klienData,
      ...(preferensi?.length ? {
        preferensi: { create: preferensi.map(sanitizePreferensi) },
      } : {}),
    },
    include: { preferensi: true },
  });

  return NextResponse.json({ ok: true, data: serializeKlien(klien) }, { status: 201 });
}

function sanitizePreferensi(p: any) {
  return {
    tipe_properti:   p.tipe_properti,
    jenis_transaksi: p.jenis_transaksi || null,
    lokasi_dicari:   p.lokasi_dicari || null,
    budget_min:      p.budget_min ? Number(p.budget_min) : null,
    budget_max:      p.budget_max ? Number(p.budget_max) : null,
    luas_min:        p.luas_min   ? Number(p.luas_min)   : null,
    luas_max:        p.luas_max   ? Number(p.luas_max)   : null,
    tujuan_beli:     p.tujuan_beli || null,
    catatan:         p.catatan || null,
  };
}

function serializeKlien(k: any) {
  return {
    ...k,
    id_lead_asal:     k.id_lead_asal     ? String(k.id_lead_asal)     : null,
    id_properti_asal: k.id_properti_asal ? String(k.id_properti_asal) : null,
    preferensi: (k.preferensi || []).map((p: any) => ({
      ...p,
      id_preferensi: String(p.id_preferensi),
      budget_min: p.budget_min ? Number(p.budget_min) : null,
      budget_max: p.budget_max ? Number(p.budget_max) : null,
      luas_min:   p.luas_min   ? Number(p.luas_min)   : null,
      luas_max:   p.luas_max   ? Number(p.luas_max)   : null,
    })),
  };
}

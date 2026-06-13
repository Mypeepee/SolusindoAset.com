import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const klien = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
    include: { preferensi: { orderBy: { dibuat_pada: "asc" } } },
  });

  if (!klien) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, data: serializeKlien(klien) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const existing = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
  });
  if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

  const body = await req.json();

  const data: any = {};
  if (body.nama             !== undefined) data.nama             = body.nama.trim();
  if (body.nomor_whatsapp   !== undefined) data.nomor_whatsapp   = body.nomor_whatsapp || null;
  if (body.email            !== undefined) data.email            = body.email || null;
  if (body.sumber           !== undefined) data.sumber           = body.sumber;
  if (body.status           !== undefined) data.status           = body.status;
  if (body.catatan          !== undefined) data.catatan          = body.catatan || null;
  if (body.metode_pembayaran !== undefined) data.metode_pembayaran = body.metode_pembayaran || null;
  if (body.bank_kpr         !== undefined) data.bank_kpr         = body.bank_kpr || null;
  if (body.tenor_kpr        !== undefined) data.tenor_kpr        = body.tenor_kpr ? Number(body.tenor_kpr) : null;
  if (body.tanggal_follow_up !== undefined)
    data.tanggal_follow_up = body.tanggal_follow_up ? new Date(body.tanggal_follow_up) : null;
  if (body.tanggal_kontak_terakhir !== undefined)
    data.tanggal_kontak_terakhir = body.tanggal_kontak_terakhir
      ? new Date(body.tanggal_kontak_terakhir) : null;

  if (Object.keys(data).length === 0)
    return NextResponse.json({ ok: false, message: "Tidak ada data yang diubah" }, { status: 400 });

  data.diperbarui_pada = new Date();

  const updated = await prisma.klien.update({
    where: { id_klien: params.id },
    data,
    include: { preferensi: { orderBy: { dibuat_pada: "asc" } } },
  });

  return NextResponse.json({ ok: true, data: serializeKlien(updated) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const existing = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
  });
  if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

  await prisma.klien.delete({ where: { id_klien: params.id } });
  return NextResponse.json({ ok: true });
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

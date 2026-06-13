import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const owned = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
    select: { id_klien: true },
  });
  if (!owned) return NextResponse.json({ ok: false }, { status: 404 });

  const body = await req.json();

  if (!body.tipe_properti)
    return NextResponse.json({ ok: false, message: "Tipe properti wajib dipilih" }, { status: 400 });

  const pref = await prisma.preferensiKlien.create({
    data: {
      id_klien:       params.id,
      tipe_properti:  body.tipe_properti,
      jenis_transaksi: body.jenis_transaksi || null,
      lokasi_dicari:  body.lokasi_dicari || null,
      budget_min:     body.budget_min ? Number(body.budget_min) : null,
      budget_max:     body.budget_max ? Number(body.budget_max) : null,
      luas_min:       body.luas_min   ? Number(body.luas_min)   : null,
      luas_max:       body.luas_max   ? Number(body.luas_max)   : null,
      tujuan_beli:    body.tujuan_beli || null,
      catatan:        body.catatan || null,
    },
  });

  return NextResponse.json({
    ok: true,
    data: { ...pref, id_preferensi: String(pref.id_preferensi) },
  }, { status: 201 });
}

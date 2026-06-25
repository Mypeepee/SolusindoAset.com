import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { matchListingsForPreferensi } from "@/lib/preferenceMatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; prefId: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  // Pastikan preferensi ini milik klien si agent.
  const pref = await prisma.preferensiKlien.findFirst({
    where: { id_preferensi: BigInt(params.prefId), klien: { id_klien: params.id, id_agent: agentId } },
    select: {
      tipe_properti: true,
      jenis_transaksi: true,
      loc_provinsi: true,
      loc_kota: true,
      loc_kecamatan: true,
      loc_kelurahan: true,
      budget_min: true,
      budget_max: true,
      luas_min: true,
      luas_max: true,
    },
  });
  if (!pref) return NextResponse.json({ ok: false }, { status: 404 });

  const items = await matchListingsForPreferensi(pref);

  return NextResponse.json({ ok: true, count: items.length, items });
}

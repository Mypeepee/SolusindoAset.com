import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; prefId: string } };

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const owned = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
    select: { id_klien: true },
  });
  if (!owned) return NextResponse.json({ ok: false }, { status: 404 });

  await prisma.preferensiKlien.delete({
    where: { id_preferensi: BigInt(params.prefId) },
  });

  return NextResponse.json({ ok: true });
}

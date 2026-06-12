// src/app/api/leads/titip-jual/[id]/reject/route.ts
// Agent tolak titip-jual. Tidak mengubah status titip — agent lain tetap bisa
// menerima. Hanya update row distribusi agent ini ke 'ditolak' supaya tidak
// muncul lagi di inbox-nya.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    let id_agent: string | null =
      (session as any)?.agentId || (session?.user as any)?.agentId || null;
    if (!id_agent) {
      const a = await prisma.agent.findFirst({
        where: { id_pengguna: session.user.id as string },
        select: { id_agent: true },
      });
      id_agent = a?.id_agent ?? null;
    }
    if (!id_agent) {
      return NextResponse.json(
        { ok: false, error: "Akun ini bukan agent" },
        { status: 403 },
      );
    }

    const id_titip = BigInt(ctx.params.id);

    const updated = await prisma.propertyTitipDistribution.updateMany({
      where: { id_titip, id_agent, status: "pending" },
      data: { status: "ditolak", direspon_pada: new Date() },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { ok: false, error: "Titip tidak tersedia atau sudah direspon" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ /api/leads/titip-jual/[id]/reject error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/notifications — daftar notifikasi sistem untuk user yang login
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const idPengguna = (session?.user as any)?.id as string | null | undefined;
    if (!idPengguna) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const rows = await prisma.notifikasi.findMany({
      where: { id_pengguna: idPengguna },
      orderBy: { dibuat_pada: "desc" },
      take: 30,
    });

    const items = rows.map((n) => ({
      id_notifikasi: n.id_notifikasi.toString(),
      tipe: n.tipe,
      judul: n.judul,
      pesan: n.pesan,
      link: n.link,
      id_agent_ref: n.id_agent_ref,
      dibaca: n.dibaca,
      dibuat_pada: n.dibuat_pada.toISOString(),
    }));

    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    console.error("GET /api/notifications error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

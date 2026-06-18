import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH /api/notifications/[id] — tandai satu notifikasi sebagai dibaca
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const idPengguna = (session?.user as any)?.id as string | null | undefined;
    if (!idPengguna) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    let id_notifikasi: bigint;
    try {
      id_notifikasi = BigInt(params.id);
    } catch {
      return NextResponse.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
    }

    const result = await prisma.notifikasi.updateMany({
      where: { id_notifikasi, id_pengguna: idPengguna },
      data: { dibaca: true },
    });

    if (result.count === 0) {
      return NextResponse.json({ ok: false, error: "Notifikasi tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("PATCH /api/notifications/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

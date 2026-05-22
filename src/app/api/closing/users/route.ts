import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.pengguna.findMany({
      where: { peran: "USER" },
      select: {
        id_pengguna: true,
        nama_lengkap: true,
        nomor_telepon: true,
        email: true,
      },
      orderBy: { nama_lengkap: "asc" },
    });

    return NextResponse.json({ ok: true, users });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

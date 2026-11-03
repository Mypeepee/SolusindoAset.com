import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

export async function requireStoryOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json(
      { error: "Silakan masuk sebagai owner untuk menambahkan proyek." },
      { status: 401 },
    );
  const agent = await prisma.agent.findUnique({
    where: { id_pengguna: session.user.id },
    select: {
      id_agent: true,
      jabatan: true,
      status_keanggotaan: true,
      pengguna: { select: { status_akun: true } },
    },
  });
  if (
    agent?.jabatan !== "OWNER" ||
    agent.status_keanggotaan !== "AKTIF" ||
    agent.pengguna.status_akun !== "AKTIF"
  ) {
    return NextResponse.json(
      { error: "Hanya owner aktif yang dapat menambahkan proyek selesai." },
      { status: 403 },
    );
  }
  return agent;
}

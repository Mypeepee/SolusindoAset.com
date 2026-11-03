import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";
import { isOwner } from "@/lib/sessionJabatan";
export const investorPrivateHeaders = { "Cache-Control": "private, no-store" };
export async function requireInvestorOwner() {
  const headers = investorPrivateHeaders;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json(
      { error: "Silakan masuk kembali." },
      { status: 401, headers },
    );
  if (session.user.peran !== "AGENT" || !isOwner(session.user))
    return NextResponse.json(
      { error: "Investor hanya dapat diakses owner." },
      { status: 403, headers },
    );
  // Read the current role rather than relying only on a five-minute-old JWT.
  const agent = await prisma.agent.findUnique({
    where: { id_pengguna: session.user.id },
    select: {
      jabatan: true,
      status_keanggotaan: true,
      pengguna: { select: { status_akun: true } },
    },
  });
  if (
    agent?.jabatan !== "OWNER" ||
    agent.status_keanggotaan !== "AKTIF" ||
    agent.pengguna.status_akun !== "AKTIF"
  )
    return NextResponse.json(
      { error: "Akses owner Anda sudah tidak aktif." },
      { status: 403, headers },
    );
  return null;
}

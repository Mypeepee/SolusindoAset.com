import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SEKARANG KITA BISA CARI PAKAI ID (Lebih Aman & Cepat)
  const user = await prisma.pengguna.findUnique({
    where: { 
      id_pengguna: session.user.id // <--- Ambil ID dari session
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Format data untuk frontend
  const formattedUser = {
    ...user,
    tanggal_lahir: user.tanggal_lahir 
      ? new Date(user.tanggal_lahir).toISOString().split("T")[0] 
      : "",
  };

  return NextResponse.json(formattedUser);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  try {
    const updatedUser = await prisma.pengguna.update({
      where: { 
        id_pengguna: session.user.id // <--- Update juga pakai ID
      },
      data: {
        nama_lengkap: body.nama_lengkap,
        kota_asal: body.kota_asal,
        pekerjaan: body.pekerjaan,
        jenis_kelamin: body.jenis_kelamin,
        tanggal_lahir: body.tanggal_lahir ? new Date(body.tanggal_lahir) : null,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    return NextResponse.json({ error: "Gagal update profile" }, { status: 500 });
  }
}
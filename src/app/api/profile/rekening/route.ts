import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { nama_bank, nomor_rekening, atas_nama_rekening } = body as {
    nama_bank?: string;
    nomor_rekening?: string;
    atas_nama_rekening?: string;
  };

  if (!nama_bank || !nomor_rekening || !atas_nama_rekening) {
    return NextResponse.json(
      { message: "Data rekening tidak lengkap" },
      { status: 400 }
    );
  }

  try {
    const agent = await prisma.agent.update({
      where: { id_pengguna: session.user.id },
      data: {
        nama_bank,
        nomor_rekening,
        atas_nama_rekening,
      },
      select: {
        id_agent: true,
        nama_bank: true,
        nomor_rekening: true,
        atas_nama_rekening: true,
      },
    });

    return NextResponse.json({ agent });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Gagal memperbarui rekening agent" },
      { status: 500 }
    );
  }
}

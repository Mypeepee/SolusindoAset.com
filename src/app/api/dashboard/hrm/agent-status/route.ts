// src/app/api/dashboard/hrm/agent-status/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient, status_agent_enum } from "@prisma/client";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id_agent, status_keanggotaan } = body as {
      id_agent?: string;
      status_keanggotaan?: status_agent_enum;
    };

    if (!id_agent || !status_keanggotaan) {
      return NextResponse.json(
        { error: "id_agent dan status_keanggotaan wajib diisi" },
        { status: 400 }
      );
    }

    const updated = await prisma.agent.update({
      where: { id_agent },
      data: {
        status_keanggotaan,
        diperbarui_pada: new Date(),
      },
      include: {
        pengguna: {
          select: { nama_lengkap: true },
        },
      },
    });

    return NextResponse.json({ agent: updated });
  } catch (err) {
    console.error("Error update status agent:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui status agent" },
      { status: 500 }
    );
  }
}

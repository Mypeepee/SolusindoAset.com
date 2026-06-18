import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

// PATCH /api/closing/dokumen-flag
// Body: { id_mou: string, jenis: "mou" | "invoice_utm" }
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id_mou, jenis } = await req.json() as {
      id_mou?: string;
      jenis?: "mou" | "invoice_utm";
    };

    if (!id_mou || !jenis) {
      return NextResponse.json({ error: "id_mou dan jenis wajib diisi" }, { status: 400 });
    }
    if (!["mou", "invoice_utm"].includes(jenis)) {
      return NextResponse.json({ error: "jenis tidak valid" }, { status: 400 });
    }

    const data =
      jenis === "mou"
        ? { mou_generated: true }
        : { invoice_utm_generated: true };

    await prisma.mou.update({
      where: { id: BigInt(id_mou) },
      data,
      select: { id: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[dokumen-flag]", err);
    return NextResponse.json({ error: err?.message ?? "Gagal update" }, { status: 500 });
  }
}

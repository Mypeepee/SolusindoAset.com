import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await prisma.berita.updateMany({
      where: {
        status_publish: "SCHEDULED",
        tanggal_publish: { lte: new Date() },
      },
      data: {
        status_publish: "PUBLISHED",
        review_requested_at: null,
        requested_publish_at: null,
        tanggal_diupdate: new Date(),
      },
    });
    if (result.count) revalidatePath("/blog", "layout");
    return NextResponse.json({ published: result.count });
  } catch (error) {
    console.error("Scheduled berita publish:", error);
    return NextResponse.json(
      { error: "Gagal menerbitkan artikel terjadwal." },
      { status: 500 },
    );
  }
}

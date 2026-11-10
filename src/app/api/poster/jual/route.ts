import { NextRequest, NextResponse } from "next/server";
import type { JualPosterData } from "@/lib/jualPoster";
import { renderJualPosterImage } from "@/lib/server/posterTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let data: JualPosterData;
  try {
    data = (await req.json()) as JualPosterData;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!data || typeof data.judul !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const buffer = await renderJualPosterImage(data);
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="poster-properti.jpg"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[poster/jual] gagal render:", err);
    return NextResponse.json({ error: "Gagal membuat poster" }, { status: 500 });
  }
}

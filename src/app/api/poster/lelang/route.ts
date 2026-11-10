import { NextRequest, NextResponse } from "next/server";
import type { LelangPosterPayload } from "@/lib/lelangPoster";
import { renderLelangPosterImage } from "@/lib/server/posterTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let payload: LelangPosterPayload;
  try {
    payload = (await req.json()) as LelangPosterPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload || typeof payload.heroTitle !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const buffer = await renderLelangPosterImage(payload);
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="poster-lelang.jpg"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[poster/lelang] gagal render:", err);
    return NextResponse.json({ error: "Gagal membuat poster" }, { status: 500 });
  }
}

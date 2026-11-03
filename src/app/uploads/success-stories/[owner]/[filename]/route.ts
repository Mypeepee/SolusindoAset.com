import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Next 14 indexes public files at production startup. This route also serves
// images uploaded afterwards, so publication never requires a server restart.
export async function GET(
  _request: NextRequest,
  { params }: { params: { owner: string; filename: string } },
) {
  if (
    !/^[A-Za-z0-9_-]{1,20}$/.test(params.owner) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/.test(
      params.filename,
    )
  ) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const image = await readFile(
      path.join(
        process.cwd(),
        "public",
        "uploads",
        "success-stories",
        params.owner,
        params.filename,
      ),
    );
    return new NextResponse(image, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(image.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[GET success story image]", error);
    }
    return new NextResponse(null, {
      status: (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

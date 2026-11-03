import { NextRequest, NextResponse } from "next/server";
import { mediaSignature, sameSecret } from "@/lib/marketing/security.server";
import {
  readMarketingMedia,
  validMediaPath,
} from "@/lib/marketing/media.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: { job: string; name: string } },
) {
  const expires = Number(request.nextUrl.searchParams.get("expires"));
  try {
    if (
      !validMediaPath(params.job, params.name) ||
      !Number.isSafeInteger(expires) ||
      expires < Date.now() ||
      expires > Date.now() + 49 * 3600000 ||
      !sameSecret(
        request.nextUrl.searchParams.get("signature") || "",
        mediaSignature(params.job, params.name, expires),
      )
    )
      return new NextResponse("Tautan media tidak berlaku", {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    return new NextResponse(
      (await readMarketingMedia(
        params.job,
        params.name,
      )) as unknown as BodyInit,
      {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch {
    return new NextResponse("Media belum tersedia", { status: 404 });
  }
}

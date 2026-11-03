import { NextRequest, NextResponse } from "next/server";
import {
  apiFailure,
  requireMarketingOwner,
  privateHeaders,
} from "@/lib/marketing/security.server";
import { readMarketingMedia } from "@/lib/marketing/media.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireMarketingOwner();
    const buffer = await readMarketingMedia(
      request.nextUrl.searchParams.get("job") || "",
      request.nextUrl.searchParams.get("name") || "",
    );
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: { ...privateHeaders, "Content-Type": "image/jpeg" },
    });
  } catch (error) {
    return (error as NodeJS.ErrnoException)?.code === "ENOENT"
      ? new NextResponse("Media belum tersedia", {
          status: 404,
          headers: privateHeaders,
        })
      : apiFailure(error);
  }
}

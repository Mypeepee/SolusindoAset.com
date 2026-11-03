import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  apiFailure,
  encryptionKey,
  requireMarketingOwner,
  requireInstagramOrigin,
  marketingRequestOrigin,
} from "@/lib/marketing/security.server";
import { instagramAuthorization } from "@/lib/marketing/instagram.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireMarketingOwner();
    encryptionKey();
    requireInstagramOrigin(marketingRequestOrigin(request));
    const state = randomBytes(32).toString("base64url");
    const response = NextResponse.redirect(instagramAuthorization(state));
    response.cookies.set("marketing_ig_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/api/dashboard/pemasaran/instagram",
    });
    return response;
  } catch (error) {
    return apiFailure(error);
  }
}

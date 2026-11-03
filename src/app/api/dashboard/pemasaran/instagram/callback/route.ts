import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/marketing/instagram.server";
import {
  instagramOAuthIssue,
  type InstagramOAuthIssue,
} from "@/lib/marketing/instagram-oauth";
import {
  requireMarketingOwner,
  sameSecret,
  publicOrigin,
  MarketingError,
} from "@/lib/marketing/security.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  let result = "error";
  let issue: InstagramOAuthIssue = "INSTAGRAM_CONNECTION_FAILED";
  let stage = "owner";
  try {
    await requireMarketingOwner();
    stage = "state";
    if (
      !sameSecret(
        request.nextUrl.searchParams.get("state") || "",
        request.cookies.get("marketing_ig_state")?.value || "",
      )
    )
      throw new MarketingError("OAUTH_STATE_INVALID");
    stage = "authorization";
    if (request.nextUrl.searchParams.has("error"))
      throw new MarketingError(
        request.nextUrl.searchParams.get("error") === "access_denied"
          ? "OAUTH_ACCESS_DENIED"
          : "OAUTH_PROVIDER_REJECTED",
      );
    const code = request.nextUrl.searchParams.get("code");
    if (!code || code.length > 4096)
      throw new MarketingError("OAUTH_CODE_MISSING");
    stage = "exchange";
    await exchangeCode(code);
    result = "success";
  } catch (error) {
    const code = error instanceof MarketingError ? error.code : null;
    issue = instagramOAuthIssue(
      code === "UNAUTHENTICATED"
        ? "OAUTH_SESSION_REQUIRED"
        : code === "FORBIDDEN"
          ? "OAUTH_FORBIDDEN"
          : code === "TOKEN_EXPIRED"
            ? "OAUTH_TOKEN_REJECTED"
            : code,
    );
    // Deliberately omit the request URL, authorization code, cookies and raw error.
    console.warn("[Pemasaran Instagram OAuth]", { stage, issue });
  }
  let origin: string;
  try {
    origin = publicOrigin();
  } catch {
    origin = request.nextUrl.origin;
  }
  const destination = new URL("/dashboard/pemasaran", origin);
  destination.searchParams.set("tab", "pengaturan");
  destination.searchParams.set("instagram", result);
  if (result === "error") destination.searchParams.set("instagramError", issue);
  const response = NextResponse.redirect(destination);
  response.cookies.set("marketing_ig_state", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/api/dashboard/pemasaran/instagram",
  });
  return response;
}

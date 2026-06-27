// src/app/r/[code]/route.ts
//
// Short-link referral klien: https://<domain>/r/AG108
//
// 1) Normalisasi kode -> "AG###"
// 2) Set cookie `ref_code` (3 hari, dibaca client untuk prefill modal daftar)
// 3) Redirect ke "/?ref=AG###&daftar=1" -> Header otomatis membuka modal Daftar.
//
// middleware.ts tidak menyentuh path /r, jadi route ini aman.

import { NextRequest, NextResponse } from "next/server";
import { normalizeAgentCode } from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 3; // 3 hari

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const origin = req.nextUrl.origin;
  const code = normalizeAgentCode(decodeURIComponent(params?.code || ""));

  // Kode tidak valid -> ke home tanpa atribusi.
  if (!code || !/^AG\d+$/.test(code)) {
    return NextResponse.redirect(new URL("/", origin));
  }

  const dest = new URL("/", origin);
  dest.searchParams.set("ref", code);
  dest.searchParams.set("daftar", "1");

  const res = NextResponse.redirect(dest);
  res.cookies.set("ref_code", code, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false, // perlu dibaca di client untuk prefill kode di modal daftar
  });
  return res;
}

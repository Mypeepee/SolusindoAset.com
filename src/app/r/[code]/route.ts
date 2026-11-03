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
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  // Next sudah men-decode route params; jangan decode dua kali (mis. "%").
  const code = normalizeAgentCode(params?.code || "");

  // Location relatif selalu mengikuti domain yang dibuka pengunjung. Origin
  // Next bisa berupa localhost:3000 di balik reverse proxy / Cloudflare Tunnel.
  const redirect = (location: string) =>
    new NextResponse(null, { status: 307, headers: { Location: location } });

  // Kode tidak valid -> ke home tanpa atribusi.
  if (!code || !/^AG\d+$/.test(code)) {
    return redirect("/");
  }

  const query = new URLSearchParams({ ref: code, daftar: "1" });

  const res = redirect(`/?${query}`);
  res.cookies.set("ref_code", code, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false, // perlu dibaca di client untuk prefill kode di modal daftar
  });
  return res;
}

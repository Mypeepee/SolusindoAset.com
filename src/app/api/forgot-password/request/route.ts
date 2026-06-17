// POST /api/forgot-password/request
// Body: { email }
// Membuat OTP, mengirim ke email user (bila terdaftar & pakai password),
// dan mengembalikan token (stateless) untuk langkah verifikasi.
//
// Demi keamanan, respon dibuat seragam agar tidak membocorkan email mana yang
// terdaftar (anti user-enumeration) — kecuali untuk akun Google yang memang
// lebih membantu bila diberi tahu agar login lewat Google.

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  generateOtp,
  hashOtp,
  createOtpToken,
  limitRequest,
  OTP_TTL_SEC,
  RESEND_COOLDOWN_SEC,
} from "@/lib/otp";
import { sendOtpEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string) {
  return String(raw || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, code: "EMAIL_INVALID", message: "Format email tidak valid." },
        { status: 400 }
      );
    }

    // Rate limit per email + IP (best effort)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const rl = limitRequest(`${email}|${ip}`);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: "RATE_LIMITED",
          message: "Terlalu banyak permintaan. Coba lagi dalam beberapa menit.",
        },
        { status: 429 }
      );
    }

    const user = await prisma.pengguna.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id_pengguna: true, kata_sandi: true, google_id: true, status_akun: true },
    });

    // Akun Google tanpa password -> arahkan login Google (lebih membantu)
    if (user && !user.kata_sandi && user.google_id) {
      return NextResponse.json(
        {
          ok: false,
          code: "GOOGLE_ONLY",
          message:
            "Akun ini terdaftar melalui Google. Silakan masuk dengan tombol Google.",
        },
        { status: 409 }
      );
    }

    // Buat OTP + token. Bila user tidak ada / nonaktif, kita tetap kembalikan
    // token agar respon seragam, tapi tidak mengirim email apa pun.
    const eligible = Boolean(user && user.kata_sandi && user.status_akun === "AKTIF");
    const otp = generateOtp();
    const token = createOtpToken(email, hashOtp(otp, email));

    let delivered = false;
    if (eligible) {
      const r = await sendOtpEmail(email, otp);
      delivered = r.delivered;
    }

    return NextResponse.json(
      {
        ok: true,
        code: "OTP_SENT",
        message:
          "Jika email terdaftar, kami telah mengirim kode verifikasi ke email tersebut.",
        token,
        expiresIn: OTP_TTL_SEC,
        resendIn: RESEND_COOLDOWN_SEC,
        delivered,
        // Hanya di dev & hanya untuk akun valid: tampilkan OTP supaya bisa dites
        // tanpa setup email. TIDAK PERNAH muncul di production.
        devOtp:
          process.env.NODE_ENV !== "production" && eligible && !delivered ? otp : undefined,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("forgot-password/request error:", err);
    return NextResponse.json(
      { ok: false, code: "SERVER_ERROR", message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

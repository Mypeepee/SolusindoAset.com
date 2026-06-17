// POST /api/forgot-password/verify
// Body: { token, otp }
// Memverifikasi kode OTP. Bila benar, menerbitkan resetToken untuk langkah
// ganti password.

import { NextResponse } from "next/server";
import { verifyOtpToken, createResetToken, limitVerify, clearVerify } from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "");
    const otp = String(body?.otp || "").replace(/\D/g, "");

    if (!token || otp.length !== 6) {
      return NextResponse.json(
        { ok: false, code: "INVALID_INPUT", message: "Kode harus 6 digit." },
        { status: 400 }
      );
    }

    // Buka token dulu (untuk dapat email) tanpa mengungkap kecocokan OTP.
    const peek = verifyOtpToken(token, "______"); // pasti gagal, tapi memberi email bila token valid
    const email = peek.email;
    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          code: "TOKEN_EXPIRED",
          message: "Sesi verifikasi kedaluwarsa. Silakan minta kode baru.",
        },
        { status: 400 }
      );
    }

    // Batasi percobaan salah OTP
    const rl = limitVerify(email);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: "TOO_MANY_ATTEMPTS",
          message: "Terlalu banyak percobaan. Minta kode baru lalu coba lagi.",
        },
        { status: 429 }
      );
    }

    const result = verifyOtpToken(token, otp);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: "OTP_INCORRECT",
          message: "Kode salah. Coba lagi.",
          attemptsLeft: rl.remaining,
        },
        { status: 400 }
      );
    }

    clearVerify(email);
    const resetToken = createResetToken(email);

    return NextResponse.json(
      { ok: true, code: "OTP_VERIFIED", message: "Kode benar.", resetToken },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("forgot-password/verify error:", err);
    return NextResponse.json(
      { ok: false, code: "SERVER_ERROR", message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

// POST /api/forgot-password/update
// Body: { resetToken, password }
// Menyetel kata sandi baru setelah OTP terverifikasi.

import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import { verifyResetToken } from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const resetToken = String(body?.resetToken || "");
    const password = String(body?.password || "");

    const { ok, email } = verifyResetToken(resetToken);
    if (!ok || !email) {
      return NextResponse.json(
        {
          ok: false,
          code: "RESET_EXPIRED",
          message: "Sesi sudah berakhir. Silakan ulangi proses lupa kata sandi.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          code: "WEAK_PASSWORD",
          message: "Kata sandi minimal 8 karakter.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.pengguna.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id_pengguna: true, status_akun: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, code: "USER_NOT_FOUND", message: "Akun tidak ditemukan." },
        { status: 404 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.pengguna.update({
      where: { id_pengguna: user.id_pengguna },
      data: { kata_sandi: hashed, diperbarui_pada: new Date() },
    });

    return NextResponse.json(
      {
        ok: true,
        code: "PASSWORD_UPDATED",
        message: "Kata sandi berhasil diperbarui. Silakan masuk.",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("forgot-password/update error:", err);
    return NextResponse.json(
      { ok: false, code: "SERVER_ERROR", message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

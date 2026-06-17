// src/lib/otp.ts
// ---------------------------------------------------------------------------
// Sistem OTP lupa-password yang STATELESS (tanpa tabel DB).
//
// Cara kerja:
//  1) Server membuat kode OTP 6 digit, lalu di-"hash" dan dibungkus ke dalam
//     sebuah TOKEN yang ditandatangani (HMAC-SHA256 memakai NEXTAUTH_SECRET).
//  2) Token dikirim ke client; KODE OTP dikirim ke email user.
//  3) Saat verifikasi, client mengirim {token, otp}. Server membuka token,
//     mengecek tanda tangan + masa berlaku, lalu membandingkan hash OTP.
//  4) Bila cocok, server menerbitkan RESET TOKEN (umur pendek) untuk langkah
//     ganti password.
//
// Token tidak pernah memuat OTP mentah — hanya hash-nya — jadi aman walau
// token sempat terbaca pihak lain.
// ---------------------------------------------------------------------------

import crypto from "crypto";

const SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.OTP_SECRET ||
  "dev-only-insecure-secret-change-me";

export const OTP_TTL_SEC = 10 * 60; // OTP berlaku 10 menit
export const RESET_TTL_SEC = 10 * 60; // reset token berlaku 10 menit
export const RESEND_COOLDOWN_SEC = 60; // jeda kirim ulang (dipakai UI)
export const MAX_VERIFY_ATTEMPTS = 6; // maksimum salah OTP per email

type TokenPurpose = "otp" | "reset";

interface TokenPayload {
  p: TokenPurpose; // purpose
  e: string; // email (lowercase)
  oh?: string; // otp hash (khusus purpose "otp")
  iat: number; // issued at (detik)
  exp: number; // expires at (detik)
}

// ── helper base64url ──────────────────────────────────────────────────────
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
}

// ── OTP ────────────────────────────────────────────────────────────────────
/** Kode OTP 6 digit yang aman secara kriptografis (selalu 6 karakter). */
export function generateOtp(): string {
  // 0..999999, di-pad jadi 6 digit
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

/** Hash OTP terikat pada email + secret, supaya tidak bisa dipakai lintas email. */
export function hashOtp(otp: string, email: string): string {
  return crypto
    .createHash("sha256")
    .update(`${otp}:${email.toLowerCase()}:${SECRET}`)
    .digest("hex");
}

// ── Token signing/verification ──────────────────────────────────────────────
function createToken(payload: Omit<TokenPayload, "iat" | "exp">, ttlSec: number): string {
  const now = Math.floor(Date.now() / 1000);
  const full: TokenPayload = { ...payload, iat: now, exp: now + ttlSec };
  const body = b64url(JSON.stringify(full));
  const sig = sign(body);
  return `${body}.${sig}`;
}

function readToken(token: string): TokenPayload | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  // verifikasi tanda tangan (constant-time)
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload?.exp || payload.exp < now) return null; // kadaluarsa
  return payload;
}

/** Token yang membawa hash OTP (dikirim ke client saat minta kode). */
export function createOtpToken(email: string, otpHash: string): string {
  return createToken({ p: "otp", e: email.toLowerCase(), oh: otpHash }, OTP_TTL_SEC);
}

/** Verifikasi token OTP + kecocokan kode. */
export function verifyOtpToken(token: string, otp: string): { ok: boolean; email?: string } {
  const payload = readToken(token);
  if (!payload || payload.p !== "otp" || !payload.oh || !payload.e) return { ok: false };

  const expected = Buffer.from(payload.oh);
  const got = Buffer.from(hashOtp(String(otp || ""), payload.e));
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) {
    return { ok: false, email: payload.e };
  }
  return { ok: true, email: payload.e };
}

/** Token bukti "OTP sudah benar", dipakai untuk menyetel password baru. */
export function createResetToken(email: string): string {
  return createToken({ p: "reset", e: email.toLowerCase() }, RESET_TTL_SEC);
}

export function verifyResetToken(token: string): { ok: boolean; email?: string } {
  const payload = readToken(token);
  if (!payload || payload.p !== "reset" || !payload.e) return { ok: false };
  return { ok: true, email: payload.e };
}

// ── Rate limiting (in-memory, best-effort) ───────────────────────────────────
// Catatan: ini reset saat server restart & tidak shared antar-instance.
// Cukup sebagai pengaman dasar dari brute-force. Untuk skala besar, ganti Redis.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function hit(key: string, limit: number, windowSec: number): { ok: boolean; remaining: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, remaining: limit - 1 };
  }
  b.count += 1;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count) };
}

/** Batasi permintaan kirim OTP: maks 5 per 15 menit per kunci. */
export function limitRequest(key: string) {
  return hit(`req:${key}`, 5, 15 * 60);
}

/** Batasi percobaan verifikasi OTP: maks MAX_VERIFY_ATTEMPTS per 10 menit. */
export function limitVerify(email: string) {
  return hit(`vrf:${email.toLowerCase()}`, MAX_VERIFY_ATTEMPTS, OTP_TTL_SEC);
}

/** Reset hitungan verifikasi setelah berhasil. */
export function clearVerify(email: string) {
  buckets.delete(`vrf:${email.toLowerCase()}`);
}

// occasional cleanup supaya Map tidak bocor
if (typeof setInterval !== "undefined") {
  const t = setInterval(() => {
    const now = Date.now();
    Array.from(buckets.entries()).forEach(([k, v]) => {
      if (v.resetAt < now) buckets.delete(k);
    });
  }, 5 * 60 * 1000);
  // jangan menahan proses tetap hidup
  (t as any)?.unref?.();
}

"use client";

import { signIn } from "next-auth/react";
import { toast } from "sonner";
import Loader from "@/components/Common/Loader";
import { useMemo, useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

type Mode = "email" | "phone";

interface SignUpProps {
  closeModal?: () => void;
  openSigninModal?: () => void;
  /** Sembunyikan header brand (logo + judul). Dipakai saat shell modal sudah menampilkan brand sendiri. */
  hideBrand?: boolean;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    // Eye Off
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M10.58 10.58a3 3 0 104.24 4.24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9.88 5.08A10.77 10.77 0 0112 4.8c5.2 0 9.27 3.83 10.8 7.2a11.7 11.7 0 01-3.02 4.14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6.2 6.2A11.6 11.6 0 001.2 12c1.6 3.52 5.86 7.2 10.8 7.2 1.78 0 3.44-.36 4.92-.98"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ) : (
    // Eye
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M1.2 12c1.6-3.52 5.86-7.2 10.8-7.2s9.2 3.68 10.8 7.2c-1.6 3.52-5.86 7.2-10.8 7.2S2.8 15.52 1.2 12z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

/**
 * Normalisasi input phone untuk UI +62|:
 * - buang semua non-digit
 * - buang prefix 62 kalau kepaste
 * - buang semua 0 di depan
 * output: "8123..."
 */
function normalizePhoneDigits(raw: string) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  digits = digits.slice(0, 12);
  // Format: tambahkan "-" setiap 4 digit => 8812-3456-7890
  return digits.replace(/(\d{4})(?=\d)/g, "$1-");
}

/* ── kekuatan kata sandi ──────────────────────────────────────────────────── */
function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4); // 0..4
}
const STRENGTH = [
  { label: "Terlalu pendek", color: "bg-white/15", text: "text-white/40" },
  { label: "Lemah", color: "bg-red-500", text: "text-red-400" },
  { label: "Sedang", color: "bg-amber-500", text: "text-amber-400" },
  { label: "Kuat", color: "bg-emerald-500", text: "text-emerald-400" },
  { label: "Sangat kuat", color: "bg-primary", text: "text-primary" },
];

/**
 * Parse response secara kebal:
 * - kalau JSON => parse json
 * - kalau bukan JSON => ambil text
 * - kalau gagal => {}
 */
async function parseResponse(res: Response): Promise<any> {
  const contentType = res.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) return await res.json();
    const text = await res.text();
    return { message: text };
  } catch {
    return {};
  }
}

/* ── shared premium field style ───────────────────────────────────────────── */
const fieldBase =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] py-3.5 text-[15px] text-white " +
  "placeholder:text-white/30 outline-none transition-all duration-300 " +
  "focus:border-primary/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(153,227,158,0.10)]";

export default function SignUp({ closeModal, openSigninModal, hideBrand }: SignUpProps) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("email");

  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const score = useMemo(() => passwordScore(password), [password]);

  const openSignin = () => {
    if (closeModal) closeModal();
    if (openSigninModal) openSigninModal();
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signIn("google", { callbackUrl: "/profile" });
    } catch (error) {
      console.error(error);
      toast.error("Gagal koneksi ke Google");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      const data = new FormData(e.currentTarget);
      const name = String(data.get("name") || "").trim();
      const password = String(data.get("password") || "");

      if (!name) {
        toast.error("Nama wajib diisi.");
        return;
      }
      if (!password || password.length < 8) {
        toast.error("Password minimal 8 karakter.");
        return;
      }

      const finalData: any = { name, password };

      if (mode === "email") {
        const emailValue = email.trim();
        if (!emailValue) {
          toast.error("Email wajib diisi.");
          return;
        }
        finalData.email = emailValue;
        finalData.login_mode = "email";
      } else {
        // UI +62| => yang disimpan harus tanpa 0 di depan
        const normalized = normalizePhoneDigits(phoneDigits);
        if (!normalized) {
          toast.error("No. HP wajib diisi.");
          return;
        }
        finalData.phone = `+62${normalized.replace(/-/g, "")}`;
        finalData.login_mode = "phone";
      }

      const res = await fetch("/api/auth/Register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalData),
      });

      const payload = await parseResponse(res);

      // ✅ sukses
      if (res.ok) {
        toast.success(payload?.message || "Pendaftaran berhasil. Silakan masuk.");
        openSignin();
        return;
      }

      // ✅ ini yang kamu mau: kalau sudah terdaftar, WAJIB ada info + arahkan login
      if (res.status === 409) {
        const msg =
          payload?.message ||
          (mode === "email"
            ? "Email ini sudah terdaftar. Silakan login."
            : "Nomor HP ini sudah terdaftar. Silakan login.");

        toast.error(msg);

        // Kalau backend kasih action LOGIN_GOOGLE, kamu bisa arahkan user (optional)
        // contoh: payload?.action === "LOGIN_GOOGLE" => tampilkan toast tambahan
        if (payload?.action === "LOGIN_GOOGLE") {
          toast("Gunakan tombol Google untuk masuk.", { icon: "🔐" });
        }

        openSignin();
        return;
      }

      // error lain
      toast.error(payload?.message || "Pendaftaran gagal.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header brand */}
      {!hideBrand && (
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-transparent">
            <div className="absolute inset-0 rounded-2xl bg-primary/15 blur-xl" />
            <div className="relative h-9 w-9">
              <Image
                src="/images/logo/LogoSolusindoPremier.png"
                alt="Premier"
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>
          <h2 className="text-[1.6rem] font-bold leading-tight tracking-tight text-white">
            Buat akun baru
          </h2>
          <p className="mt-1.5 text-sm text-white/45">
            Bergabung dengan{" "}
            <span className="font-semibold text-white/70">
              Solusindo<span className="text-primary"> Aset</span>
            </span>
          </p>
        </div>
      )}

      {/* Google */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="
          group flex w-full items-center justify-center gap-3
          rounded-xl border border-white/10 bg-white/[0.03]
          px-5 py-3.5 text-[15px] font-semibold text-white
          transition-all duration-300
          hover:border-white/20 hover:bg-white/[0.06]
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true" className="transition-transform duration-300 group-hover:scale-110">
          <path
            fill="#FFC107"
            d="M43.611 20.083H42V20H24v8h11.303C33.659 32.659 29.197 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
          />
          <path
            fill="#FF3D00"
            d="M6.306 14.691l6.571 4.819C14.655 16.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.092 0 9.797-1.953 13.333-5.127l-6.153-5.207C29.125 35.091 26.7 36 24 36c-5.176 0-9.627-3.317-11.297-7.946l-6.522 5.025C9.49 39.556 16.227 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.611 20.083H42V20H24v8h11.303c-.792 2.246-2.23 4.148-4.123 5.46l.003-.002 6.153 5.207C36.9 39.018 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
          />
        </svg>
        Daftar dengan Google
      </button>

      {/* Divider */}
      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/35">atau</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
      </div>

      {/* Mode switch — segmented control beranimasi */}
      <div className="mb-5 flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {(["email", "phone"] as Mode[]).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="relative flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors"
            >
              {active && (
                <motion.span
                  layoutId="signup-seg-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-secondary shadow-[0_4px_14px_-2px_rgba(153,227,158,0.45)]"
                />
              )}
              <span
                className={`relative z-10 flex items-center justify-center gap-1.5 ${
                  active ? "text-darkmode" : "text-white/55 hover:text-white"
                }`}
              >
                <Icon icon={m === "email" ? "solar:letter-linear" : "solar:smartphone-linear"} className="text-base" />
                {m === "email" ? "Email" : "No. HP"}
              </span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Nama */}
        <div className="mb-4">
          <div className="relative">
            <Icon icon="solar:user-linear" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-white/30" />
            <input
              type="text"
              placeholder="Nama lengkap"
              name="name"
              required
              autoComplete="name"
              className={`${fieldBase} pl-11 pr-4`}
            />
          </div>
        </div>

        {/* Email / Phone */}
        <AnimatePresence mode="wait" initial={false}>
          {mode === "email" ? (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.22 }}
              className="mb-4"
            >
              <div className="relative">
                <Icon icon="solar:letter-linear" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-white/30" />
                <input
                  type="email"
                  placeholder="nama@email.com"
                  name="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={`${fieldBase} pl-11 pr-4`}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.22 }}
              className="mb-4"
            >
              <div className="flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 focus-within:border-primary/50 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_4px_rgba(153,227,158,0.10)]">
                <span className="flex items-center gap-1.5 border-r border-white/10 px-4 text-sm font-semibold text-white/60">
                  <Icon icon="solar:smartphone-linear" className="text-base text-white/40" />
                  +62
                </span>
                <input
                  type="tel"
                  name="phone"
                  required
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="8812-3456-7890"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(normalizePhoneDigits(e.target.value))}
                  className="flex-1 bg-transparent px-4 py-3.5 text-[15px] tracking-wide text-white placeholder:text-white/30 outline-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password */}
        <div className="mb-3">
          <div className="relative">
            <Icon icon="solar:lock-password-linear" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-white/30" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Kata sandi (min. 8 karakter)"
              name="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={`${fieldBase} pl-11 pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-white/90"
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              title={showPassword ? "Sembunyikan" : "Tampilkan"}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>

          {/* Strength meter */}
          <AnimatePresence>
            {password && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${i < score ? STRENGTH[score].color : "bg-transparent"}`}
                        style={{ width: i < score ? "100%" : "0%" }}
                      />
                    </div>
                  ))}
                </div>
                <p className={`mt-1.5 text-xs font-medium ${STRENGTH[score].text}`}>
                  Kekuatan: {STRENGTH[score].label}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="
            group relative mb-5 mt-2 flex w-full items-center justify-center gap-2
            overflow-hidden rounded-xl bg-gradient-to-r from-primary to-secondary
            px-5 py-3.5 text-[15px] font-bold text-darkmode
            shadow-[0_10px_30px_-10px_rgba(153,227,158,0.6)]
            transition-all duration-300
            hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-10px_rgba(153,227,158,0.7)]
            active:translate-y-0
            disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0
          "
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative flex items-center gap-2">
            Buat akun
            {loading ? <Loader /> : <Icon icon="solar:arrow-right-linear" className="text-lg transition-transform duration-300 group-hover:translate-x-1" />}
          </span>
        </button>
      </form>

      <p className="mb-4 text-center text-xs leading-relaxed text-white/40">
        Dengan membuat akun, Anda setuju dengan{" "}
        <a href="/privacy" className="text-white/60 underline-offset-2 hover:text-primary hover:underline">
          Kebijakan Privasi
        </a>{" "}
        dan{" "}
        <a href="/policy" className="text-white/60 underline-offset-2 hover:text-primary hover:underline">
          Ketentuan
        </a>
        .
      </p>

      <p className="text-center text-sm text-white/50">
        Sudah punya akun?{" "}
        <button
          type="button"
          className="font-semibold text-primary transition-colors hover:text-secondary"
          onClick={openSignin}
        >
          Masuk
        </button>
      </p>
    </motion.div>
  );
}

"use client";

import { signIn } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import Loader from "@/components/Common/Loader";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

type Mode = "email" | "phone";

interface SigninProps {
  closeModal?: () => void;
  openSignupModal?: () => void;
  /** Buka modal "Lupa kata sandi". Jika tidak diberikan, fallback ke halaman /forgot-password. */
  openForgotModal?: () => void;
  /** Jika true, setelah login sukses tidak melakukan router.push ke callbackUrl — cukup panggil onSuccess. */
  skipRedirect?: boolean;
  onSuccess?: () => void;
  /** Sembunyikan header brand (logo + judul). Dipakai saat shell modal sudah menampilkan brand sendiri. */
  hideBrand?: boolean;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    // Eye Off (modern)
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
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
    // Eye (modern)
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

function normalizePhoneDigits(raw: string) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  digits = digits.slice(0, 12);
  // Format: tambahkan "-" setiap 4 digit => 8812-3456-7890
  return digits.replace(/(\d{4})(?=\d)/g, "$1-");
}

/* ── shared premium field style ───────────────────────────────────────────── */
const fieldBase =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] py-3.5 text-[15px] text-white " +
  "placeholder:text-white/30 outline-none transition-all duration-300 " +
  "focus:border-primary/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(153,227,158,0.10)]";

const Signin = ({ closeModal, openSignupModal, openForgotModal, skipRedirect, onSuccess, hideBrand }: SigninProps) => {
  const router = useRouter();
  const pathname = usePathname(); // path saat ini

  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // URL tujuan setelah login: full URL kalau di browser, fallback ke pathname
  const getReturnUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.href;
    }
    return pathname || "/";
  };

  const handleGoogle = async () => {
    setLoading(true);

    const callbackUrl = getReturnUrl();

    // Tutup modal dulu biar transisi halus
    if (closeModal) closeModal();

    try {
      await signIn("google", { callbackUrl });
    } catch (error) {
      console.error(error);
      toast.error("Gagal koneksi ke Google");
    } finally {
      setLoading(false);
    }
  };

  const loginUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      const callbackUrl = getReturnUrl();

      const payload: any =
        mode === "email"
          ? { email: email.trim(), password, redirect: false, callbackUrl }
          : { phone: `+62${phoneDigits.replace(/-/g, "")}`, password, redirect: false, callbackUrl };

      if (mode === "email" && !payload.email) {
        throw new Error("Email wajib diisi.");
      }
      if (mode === "phone" && !phoneDigits) {
        throw new Error("No. HP wajib diisi.");
      }
      if (!password) {
        throw new Error("Kata sandi wajib diisi.");
      }

      // signIn dengan redirect:false -> kita handle manual
      const res = await signIn("credentials", payload);

      // Di NextAuth v4/v5, kalau redirect:false kadang balikan adalah URL string.
      // Kita handle dua kemungkinan: object atau string.
      if (typeof res === "string") {
        // asumsikan ini URL sukses
        toast.success("Berhasil masuk.");
        setLoading(false);
        if (skipRedirect) {
          onSuccess?.();
          return;
        }
        if (closeModal) closeModal();
        router.push(callbackUrl);
        return;
      }

      if (res?.error) {
        toast.error(res.error);
        setLoading(false);
        return;
      }

      if (res?.ok) {
        toast.success("Berhasil masuk.");
        setLoading(false);
        if (skipRedirect) {
          onSuccess?.();
          return;
        }
        if (closeModal) closeModal();
        router.push(callbackUrl);
        return;
      }

      // fallback kalau format tidak sesuai ekspektasi
      toast.success("Berhasil masuk.");
      setLoading(false);
      if (skipRedirect) {
        onSuccess?.();
        return;
      }
      if (closeModal) closeModal();
      router.push(callbackUrl);
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Terjadi kesalahan.");
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
            Selamat datang kembali
          </h2>
          <p className="mt-1.5 text-sm text-white/45">
            Masuk ke akun{" "}
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
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.659 32.659 29.197 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.092 0 9.797-1.953 13.333-5.127l-6.153-5.207C29.125 35.091 26.7 36 24 36c-5.176 0-9.627-3.317-11.297-7.946l-6.522 5.025C9.49 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.246-2.23 4.148-4.123 5.46l.003-.002 6.153 5.207C36.9 39.018 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        Lanjut dengan Google
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
                  layoutId="signin-seg-pill"
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

      <form onSubmit={loginUser}>
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
                  required
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="8812-3456-7890"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(normalizePhoneDigits(e.target.value))}
                  onKeyDown={(e) => {
                    if (phoneDigits.length === 0 && e.key === "0") {
                      e.preventDefault();
                    }
                  }}
                  className="flex-1 bg-transparent px-4 py-3.5 text-[15px] tracking-wide text-white placeholder:text-white/30 outline-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password */}
        <div className="mb-2">
          <div className="relative">
            <Icon icon="solar:lock-password-linear" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-white/30" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Kata sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
        </div>

        {/* Lupa kata sandi */}
        <div className="mb-5 flex justify-end">
          {openForgotModal ? (
            <button
              type="button"
              onClick={() => {
                if (closeModal) closeModal();
                openForgotModal();
              }}
              className="text-sm font-medium text-white/55 transition-colors hover:text-primary"
            >
              Lupa kata sandi?
            </button>
          ) : (
            <a
              href="/forgot-password"
              className="text-sm font-medium text-white/55 transition-colors hover:text-primary"
            >
              Lupa kata sandi?
            </a>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="
            group relative mb-6 flex w-full items-center justify-center gap-2
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
            Masuk
            {loading ? <Loader /> : <Icon icon="solar:arrow-right-linear" className="text-lg transition-transform duration-300 group-hover:translate-x-1" />}
          </span>
        </button>
      </form>

      <p className="text-center text-sm text-white/50">
        Belum punya akun?{" "}
        <button
          type="button"
          className="font-semibold text-primary transition-colors hover:text-secondary"
          onClick={() => {
            if (closeModal) closeModal();
            if (openSignupModal) openSignupModal();
          }}
        >
          Daftar sekarang
        </button>
      </p>
    </motion.div>
  );
};

export default Signin;

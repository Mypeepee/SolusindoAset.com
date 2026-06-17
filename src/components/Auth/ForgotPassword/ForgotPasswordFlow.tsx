"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Loader from "@/components/Common/Loader";

type Step = "email" | "otp" | "password" | "done";

interface Props {
  /** Tutup modal (opsional, dipakai saat dipakai di dalam modal Header). */
  onClose?: () => void;
  /** Kembali ke modal Masuk (opsional). */
  onBackToSignin?: () => void;
  /** Sembunyikan header brand (logo + judul). Dipakai saat shell modal sudah menampilkan brand sendiri. */
  hideBrand?: boolean;
}

const OTP_LENGTH = 6;

/* ── util ─────────────────────────────────────────────────────────────────── */
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const safe =
    name.length <= 2 ? name[0] + "*" : name[0] + "*".repeat(Math.max(1, name.length - 2)) + name.slice(-1);
  return `${safe}@${domain}`;
}

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
  { label: "Sangat kuat", color: "bg-emerald-400", text: "text-emerald-300" },
];

/* ── eye icon (samakan dgn SignIn) ────────────────────────────────────────── */
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.58 10.58a3 3 0 104.24 4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M9.88 5.08A10.77 10.77 0 0112 4.8c5.2 0 9.27 3.83 10.8 7.2a11.7 11.7 0 01-3.02 4.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M6.2 6.2A11.6 11.6 0 001.2 12c1.6 3.52 5.86 7.2 10.8 7.2 1.78 0 3.44-.36 4.92-.98" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M1.2 12c1.6-3.52 5.86-7.2 10.8-7.2s9.2 3.68 10.8 7.2c-1.6 3.52-5.86 7.2-10.8 7.2S2.8 15.52 1.2 12z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <path d="M12 15.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4z" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

const inputClass =
  "w-full rounded-xl border border-dark_border/60 bg-transparent px-5 py-3.5 text-base outline-none transition " +
  "text-white placeholder:text-white/35 focus:border-primary focus:bg-white/5";

/* ── animasi antar-langkah ────────────────────────────────────────────────── */
const stepVariants = {
  enter: { opacity: 0, x: 28 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -28 },
};
const STEP_INDEX: Record<Step, number> = { email: 0, otp: 1, password: 2, done: 2 };

export default function ForgotPasswordFlow({ onClose, onBackToSignin, hideBrand }: Props) {
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [resendIn, setResendIn] = useState(0);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  /* hitung mundur kirim-ulang */
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  /* fokus ke kotak OTP pertama saat masuk langkah otp */
  useEffect(() => {
    if (step === "otp") setTimeout(() => otpRefs.current[0]?.focus(), 120);
  }, [step]);

  const score = useMemo(() => passwordScore(password), [password]);

  /* ── Langkah 1: minta OTP ──────────────────────────────────────────────── */
  const requestOtp = useCallback(
    async (silent = false) => {
      const value = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        toast.error("Masukkan alamat email yang valid.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/forgot-password/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: value }),
        });
        const data = await res.json().catch(() => ({}));

        if (data?.code === "GOOGLE_ONLY") {
          toast("Akun ini memakai Google.", { icon: "🔐", description: data.message });
          return;
        }
        if (!res.ok || !data?.ok) {
          toast.error(data?.message || "Gagal mengirim kode. Coba lagi.");
          return;
        }

        setToken(data.token);
        setResendIn(data.resendIn || 60);
        setOtp(Array(OTP_LENGTH).fill(""));
        setStep("otp");

        if (data.devOtp) {
          // Mode uji (email belum dikonfigurasi): bantu user dengan kodenya.
          toast.success(`Mode uji — kode OTP: ${data.devOtp}`, { duration: 8000 });
        } else if (!silent) {
          toast.success("Kode verifikasi telah dikirim ke email Anda.");
        } else {
          toast.success("Kode baru telah dikirim.");
        }
      } catch {
        toast.error("Terjadi kesalahan jaringan.");
      } finally {
        setLoading(false);
      }
    },
    [email]
  );

  /* ── Langkah 2: input OTP ──────────────────────────────────────────────── */
  const setOtpAt = (i: number, val: string) => {
    setOtp((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  };

  const handleOtpChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setOtpAt(i, digit);
    if (digit && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
      setOtpAt(i - 1, "");
    } else if (e.key === "ArrowLeft" && i > 0) {
      otpRefs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
      otpRefs.current[i + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!text) return;
    const next = Array(OTP_LENGTH).fill("");
    text.split("").forEach((c, idx) => (next[idx] = c));
    setOtp(next);
    const last = Math.min(text.length, OTP_LENGTH) - 1;
    otpRefs.current[last]?.focus();
  };

  const verifyOtp = useCallback(
    async (code?: string) => {
      const otpStr = (code ?? otp.join("")).replace(/\D/g, "");
      if (otpStr.length !== OTP_LENGTH) {
        toast.error("Masukkan 6 digit kode.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/forgot-password/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, otp: otpStr }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          toast.error(data?.message || "Kode salah.");
          setOtp(Array(OTP_LENGTH).fill(""));
          otpRefs.current[0]?.focus();
          return;
        }
        setResetToken(data.resetToken);
        setStep("password");
      } catch {
        toast.error("Terjadi kesalahan jaringan.");
      } finally {
        setLoading(false);
      }
    },
    [otp, token]
  );

  // auto-submit saat 6 digit terisi
  useEffect(() => {
    const code = otp.join("");
    if (step === "otp" && code.length === OTP_LENGTH && !loading) {
      verifyOtp(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  /* ── Langkah 3: password baru ──────────────────────────────────────────── */
  const updatePassword = useCallback(async () => {
    if (password.length < 8) {
      toast.error("Kata sandi minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      toast.error("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/forgot-password/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        toast.error(data?.message || "Gagal menyimpan kata sandi.");
        return;
      }
      setStep("done");
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }, [password, confirm, resetToken]);

  /* ── UI ────────────────────────────────────────────────────────────────── */
  return (
    <div className="w-full">
      {/* Logo + brand */}
      {!hideBrand && (
        <div className="mb-5 flex w-full items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0">
              <Image src="/images/logo/LogoSolusindoPremier.png" alt="Premier" fill priority className="object-contain" />
            </div>
            <div className="text-left leading-tight">
              <div className="text-xl font-semibold text-white">
                Solusindo<span className="text-primary"> Aset</span>
              </div>
              <div className="text-xs text-white/60">Pemulihan akun</div>
            </div>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="mb-7 flex items-center justify-center gap-2">
        {["Email", "Verifikasi", "Sandi Baru"].map((label, i) => {
          const cur = STEP_INDEX[step];
          const active = i <= cur;
          return (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                    i < cur || step === "done"
                      ? "bg-primary text-darkmode"
                      : active
                      ? "bg-primary/20 text-primary ring-2 ring-primary/50"
                      : "bg-white/5 text-white/40"
                  }`}
                >
                  {i < cur || step === "done" ? <Icon icon="solar:check-read-linear" /> : i + 1}
                </div>
                <span className={`hidden text-[11px] font-medium sm:block ${active ? "text-white/80" : "text-white/35"}`}>
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div className={`h-px w-5 transition-colors duration-300 ${i < cur ? "bg-primary/60" : "bg-white/10"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {/* ══════════ STEP 1 — EMAIL ══════════ */}
        {step === "email" && (
          <motion.div key="email" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28 }}>
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                <Icon icon="solar:lock-password-bold-duotone" className="text-3xl text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white">Lupa Kata Sandi?</h3>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-white/55">
                Tidak masalah. Masukkan email akun Anda dan kami kirim kode verifikasi 6 digit.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                requestOtp();
              }}
            >
              <div className="relative mb-4">
                <Icon icon="solar:letter-linear" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-white/35" />
                <input
                  type="email"
                  autoFocus
                  placeholder="Email terdaftar Anda"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={`${inputClass} pl-11`}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-5 py-3.5 text-18 font-medium text-darkmode transition duration-300 ease-in-out hover:bg-transparent hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Kirim Kode OTP {loading && <Loader />}
              </button>
            </form>

            <button
              type="button"
              onClick={onBackToSignin ?? onClose}
              className="mt-5 flex w-full items-center justify-center gap-1.5 text-sm text-white/55 transition-colors hover:text-primary"
            >
              <Icon icon="solar:arrow-left-linear" /> Kembali ke halaman masuk
            </button>
          </motion.div>
        )}

        {/* ══════════ STEP 2 — OTP ══════════ */}
        {step === "otp" && (
          <motion.div key="otp" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28 }}>
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                <Icon icon="solar:letter-opened-bold-duotone" className="text-3xl text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white">Cek Email Anda</h3>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-white/55">
                Kami mengirim 6 digit kode ke{" "}
                <span className="font-semibold text-white/80">{maskEmail(email)}</span>.{" "}
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-primary hover:underline"
                >
                  Ganti
                </button>
              </p>
            </div>

            {/* kotak OTP */}
            <div className="mb-5 flex justify-center gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
              {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={otp[i]}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  className={`h-12 w-11 rounded-xl border bg-white/[0.03] text-center text-xl font-bold text-white outline-none transition-all sm:h-14 sm:w-12 ${
                    otp[i]
                      ? "border-primary/70 bg-primary/5 shadow-[0_0_0_3px_rgba(153,227,158,0.12)]"
                      : "border-dark_border/60 focus:border-primary focus:shadow-[0_0_0_3px_rgba(153,227,158,0.12)]"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => verifyOtp()}
              disabled={loading || otp.join("").length !== OTP_LENGTH}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-5 py-3.5 text-18 font-medium text-darkmode transition duration-300 ease-in-out hover:bg-transparent hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Verifikasi Kode {loading && <Loader />}
            </button>

            {/* kirim ulang */}
            <div className="mt-5 text-center text-sm text-white/50">
              Tidak menerima kode?{" "}
              {resendIn > 0 ? (
                <span className="text-white/40">
                  Kirim ulang dalam{" "}
                  <span className="tabular-nums text-white/70">
                    0:{String(resendIn).padStart(2, "0")}
                  </span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => requestOtp(true)}
                  disabled={loading}
                  className="font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  Kirim ulang kode
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ══════════ STEP 3 — PASSWORD BARU ══════════ */}
        {step === "password" && (
          <motion.div key="password" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28 }}>
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                <Icon icon="solar:shield-keyhole-bold-duotone" className="text-3xl text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white">Buat Kata Sandi Baru</h3>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-white/55">
                Pilih kata sandi yang kuat dan belum pernah Anda gunakan sebelumnya.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updatePassword();
              }}
            >
              <div className="relative mb-3">
                <input
                  type={showPw ? "text" : "password"}
                  autoFocus
                  placeholder="Kata sandi baru (min. 8 karakter)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45 transition hover:text-white/90"
                  aria-label={showPw ? "Sembunyikan" : "Tampilkan"}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>

              {/* strength meter */}
              {password && (
                <div className="mb-3.5">
                  <div className="flex gap-1.5">
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
                </div>
              )}

              <div className="relative mb-5">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Ulangi kata sandi baru"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputClass} pr-12 ${confirm && confirm !== password ? "border-red-500/60" : confirm && confirm === password ? "border-emerald-500/60" : ""}`}
                />
                {confirm && (
                  <Icon
                    icon={confirm === password ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 text-xl ${confirm === password ? "text-emerald-400" : "text-red-400"}`}
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-5 py-3.5 text-18 font-medium text-darkmode transition duration-300 ease-in-out hover:bg-transparent hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Simpan & Lanjutkan {loading && <Loader />}
              </button>
            </form>
          </motion.div>
        )}

        {/* ══════════ STEP 4 — SUKSES ══════════ */}
        {step === "done" && (
          <motion.div key="done" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="text-center">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 14 }}
              className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/10"
            >
              <Icon icon="solar:check-circle-bold" className="text-5xl text-emerald-400" />
            </motion.div>
            <h3 className="text-2xl font-bold text-white">Berhasil!</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/55">
              Kata sandi Anda telah diperbarui. Sekarang Anda bisa masuk menggunakan kata sandi baru.
            </p>
            <button
              type="button"
              onClick={onBackToSignin ?? onClose}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-5 py-3.5 text-18 font-medium text-darkmode transition duration-300 ease-in-out hover:bg-transparent hover:text-primary"
            >
              Masuk Sekarang <Icon icon="solar:arrow-right-linear" className="text-xl" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

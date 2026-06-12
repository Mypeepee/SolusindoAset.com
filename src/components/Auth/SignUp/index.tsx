"use client";

import { signIn } from "next-auth/react";
import { toast } from "sonner";
import Loader from "@/components/Common/Loader";
import { useState } from "react";
import Image from "next/image";

type Mode = "email" | "phone";

interface SignUpProps {
  closeModal?: () => void;
  openSigninModal?: () => void;
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
  // Format: 3-4-4
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 12)}`;
}

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

export default function SignUp({ closeModal, openSigninModal }: SignUpProps) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("email");

  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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

      const res = await fetch("/api/auth/register", {
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

  const inputClass =
    "w-full rounded-md border border-dark_border/60 bg-transparent px-5 py-3 text-base outline-none transition " +
    "text-white placeholder:text-white/35 " +
    "focus:border-primary focus:bg-white/5 focus-visible:shadow-none";

  return (
    <>
      {/* Header */}
      <div className="mb-6 w-full flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0">
            <Image
              src="/images/logo/LogoSolusindoPremier.png"
              alt="Premier"
              fill
              priority
              className="object-contain"
            />
          </div>

          <div className="leading-tight text-left">
            <div className="text-white font-semibold text-xl">
              Solusindo<span className="text-primary"> Aset</span>
            </div>
            <div className="text-white/60 text-xs">Daftar akun baru</div>
          </div>
        </div>
      </div>

      {/* Google */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="
          flex w-full items-center justify-center gap-3
          rounded-md border border-dark_border/60
          bg-transparent px-5 py-3
          text-base font-medium text-white
          transition hover:bg-white/5 hover:border-primary/60
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
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
      <span className="z-1 relative my-6 block text-center before:content-[''] before:absolute before:h-px before:w-[40%] before:bg-dark_border before:bg-opacity-60 before:left-0 before:top-3 after:content-[''] after:absolute after:h-px after:w-[40%] after:bg-dark_border after:bg-opacity-60 after:top-3 after:right-0">
        <span className="text-body-secondary relative z-10 inline-block px-3 text-sm text-white/70">
          ATAU
        </span>
      </span>

      {/* Mode switch */}
      <div className="mb-4">
        <div className="inline-flex w-full rounded-md border border-dark_border/60 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setMode("email")}
            className={[
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
              mode === "email" ? "bg-primary text-darkmode" : "text-white/80 hover:bg-white/5",
            ].join(" ")}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setMode("phone")}
            className={[
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
              mode === "phone" ? "bg-primary text-darkmode" : "text-white/80 hover:bg-white/5",
            ].join(" ")}
          >
            No. HP
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Nama */}
        <div className="mb-[18px]">
          <input
            type="text"
            placeholder="Nama lengkap"
            name="name"
            required
            autoComplete="name"
            className={inputClass}
          />
        </div>

        {/* Email / Phone */}
        {mode === "email" ? (
          <div className="mb-[18px]">
            <input
              type="email"
              placeholder="Email (contoh: nama@email.com)"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={inputClass}
            />
          </div>
        ) : (
          <div className="mb-[18px]">
            <div className="flex">
              <span className="inline-flex items-center rounded-l-md border border-dark_border/60 bg-white/5 px-4 text-white/80 text-sm">
                +62
              </span>
              <input
                type="tel"
                name="phone"
                required
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="812-3456-7890"
                value={phoneDigits}
                onChange={(e) => setPhoneDigits(normalizePhoneDigits(e.target.value))}
                className={[inputClass, "rounded-l-none border-l-0"].join(" ")}
              />
            </div>
          </div>
        )}

        {/* Password */}
        <div className="mb-[22px]">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Kata sandi (minimal 8 karakter)"
              name="password"
              required
              autoComplete="new-password"
              className={[inputClass, "pr-12"].join(" ")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/90 transition"
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              title={showPassword ? "Sembunyikan" : "Tampilkan"}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        <div className="mb-7">
          <button
            type="submit"
            disabled={loading}
            className="
              flex w-full items-center justify-center gap-2
              text-18 font-medium rounded-md
              bg-primary px-5 py-3 text-darkmode
              transition duration-300 ease-in-out
              hover:bg-transparent hover:text-primary
              border-primary border
              disabled:opacity-60 disabled:cursor-not-allowed
            "
          >
            Daftar {loading && <Loader />}
          </button>
        </div>
      </form>

      <p className="text-body-secondary mb-4 text-white text-sm">
        Dengan membuat akun, Anda setuju dengan{" "}
        <a href="/privacy" className="text-primary hover:underline">
          Kebijakan Privasi
        </a>{" "}
        dan{" "}
        <a href="/policy" className="text-primary hover:underline">
          Ketentuan
        </a>
        .
      </p>

      <p className="text-body-secondary text-white text-sm">
        Sudah punya akun?
        <button
          type="button"
          className="pl-2 text-primary hover:underline"
          onClick={openSignin}
        >
          Masuk
        </button>
      </p>
    </>
  );
}

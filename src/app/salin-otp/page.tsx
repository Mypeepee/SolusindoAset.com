"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

/**
 * Halaman bantu "Salin Kode OTP".
 * Tautan dari email membawa kode lewat fragment URL (mis. /salin-otp#482913),
 * sehingga kode TIDAK pernah terkirim ke server (fragment tidak dikirim ke
 * server, tidak masuk log/Referer). Halaman ini menyalin kode ke clipboard
 * lalu menghapusnya dari address bar.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* lanjut ke fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function SalinOtpPage() {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    const parsed = (raw.includes("=") ? raw.split("=").pop() || "" : raw)
      .replace(/\D/g, "")
      .slice(0, 8);
    setCode(parsed);

    // Bersihkan kode dari address bar / history (privasi).
    if (raw) {
      try {
        history.replaceState(null, "", window.location.pathname);
      } catch {
        /* abaikan */
      }
    }

    // Coba salin otomatis (best-effort; sebagian browser butuh gesture).
    if (parsed) {
      copyText(parsed).then((ok) => ok && setCopied(true));
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    const ok = await copyText(code);
    setCopied(ok);
  }, [code]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#04100B] px-4 py-28">
      {/* ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(16,185,129,0.14),transparent_70%)]" />
        <div className="absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[140px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#181818]/90 p-8 text-center shadow-2xl backdrop-blur-xl"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
          <Icon icon="solar:copy-bold-duotone" className="text-3xl text-primary" />
        </div>

        <h1 className="text-xl font-bold text-white">Kode Verifikasi Anda</h1>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-white/55">
          {code
            ? "Salin kode di bawah, lalu kembali ke halaman verifikasi dan tempel."
            : "Kode tidak ditemukan. Buka tautan dari email Anda, atau ketik kode manual."}
        </p>

        {code ? (
          <>
            <div className="mt-6 rounded-2xl border border-primary/30 bg-[#08180f] px-4 py-5">
              <div
                className="font-mono text-4xl font-bold tracking-[0.4em] text-white"
                style={{ paddingLeft: "0.4em" }}
              >
                {code}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3.5 text-[15px] font-semibold transition-all duration-300 ${
                copied
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-primary bg-primary text-darkmode hover:bg-transparent hover:text-primary"
              }`}
            >
              {copied ? (
                <>
                  <Icon icon="solar:check-circle-bold" className="text-xl" /> Kode Tersalin
                </>
              ) : (
                <>
                  <Icon icon="solar:copy-bold" className="text-xl" /> Salin Kode
                </>
              )}
            </button>

            <p className="mt-4 text-xs text-white/40">
              Kode berlaku 10 menit. Jangan bagikan kepada siapa pun.
            </p>
          </>
        ) : (
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-5 py-3.5 text-[15px] font-semibold text-darkmode transition hover:bg-transparent hover:text-primary"
          >
            Ke Halaman Verifikasi
          </Link>
        )}
      </motion.div>
    </main>
  );
}

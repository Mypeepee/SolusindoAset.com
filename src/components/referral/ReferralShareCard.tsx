"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Link, Share2 } from "lucide-react";
import { toast } from "sonner";
import { URL_PUBLIK } from "@/lib/site";
import styles from "./ReferralShareCard.module.css";

/**
 * Kartu berbagi ajakan bergabung lewat kode referral agent.
 *
 * Memberi agent cara mudah membagikan kode + LINK yang, saat diklik penerima,
 * otomatis mengisi kode di modal daftar (lewat route /r/<code>).
 *
 * Dipakai di halaman Profil agent.
 */
export default function ReferralShareCard({
  code,
  className = "",
}: {
  code: string;
  className?: string;
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const codeTimer = useRef<ReturnType<typeof setTimeout>>();
  const linkTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => {
    clearTimeout(codeTimer.current);
    clearTimeout(linkTimer.current);
  }, []);

  const normalized = (code || "").trim().toUpperCase();
  const prefix = normalized.replace(/\d+$/, "") || "AG";
  const number = normalized.replace(/^\D+/, "");

  const shareUrl = `${URL_PUBLIK}/r/${encodeURIComponent(normalized)}`;

  const shareText =
    `Halo! 👋 Yuk, bergabung jadi agent properti bersama aku di Solusindo Aset!\n\n` +
    `Mari belajar, berbagi peluang properti, dan berkembang bersama. ` +
    `Aku senang kalau kamu ikut menjadi bagian dari jaringan kami.\n\n` +
    `Mulai dengan daftar akun lewat link ini. Kode referral ${normalized} otomatis terisi. ` +
    `Setelah masuk, pilih “Gabung Jadi Agent” untuk melanjutkan pendaftaran agent.\n\n` +
    `Sampai ketemu di Solusindo Aset!`;
  const invitation = `${shareText}\n${shareUrl}`;

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const el = document.createElement("textarea");
      const previousFocus = document.activeElement;
      try {
        el.value = text;
        el.readOnly = true;
        el.style.cssText = "position:fixed;left:-9999px;top:0;resize:none";
        document.body.appendChild(el);
        el.select();
        return document.execCommand("copy");
      } catch {
        return false;
      } finally {
        el.remove();
        if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
      }
    }
  }, []);

  const handleShare = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Yuk, Gabung Jadi Agent di Solusindo Aset!",
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        // Perangkat tidak mendukung berbagi: lanjut ke WhatsApp.
      }
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(invitation)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [shareText, shareUrl, invitation]);

  const handleCopyCode = useCallback(async () => {
    if (await copy(normalized)) {
      setCopiedCode(true);
      toast.success("Kode referral disalin.");
      clearTimeout(codeTimer.current);
      codeTimer.current = setTimeout(() => setCopiedCode(false), 2000);
    } else {
      toast.error("Gagal menyalin kode.");
    }
  }, [copy, normalized]);

  const handleCopyLink = useCallback(async () => {
    if (await copy(invitation)) {
      setCopiedLink(true);
      toast.success("Pesan ajakan dan link referral disalin.");
      clearTimeout(linkTimer.current);
      linkTimer.current = setTimeout(() => setCopiedLink(false), 2000);
    } else {
      toast.error("Gagal menyalin pesan dan link. Coba lagi.");
    }
  }, [copy, invitation]);

  return (
    <div
      className={`${styles.card} relative overflow-hidden rounded-2xl border border-[#86efac]/20 bg-gradient-to-br from-[#86efac]/[0.06] to-transparent p-3 sm:p-4 ${className}`}
    >
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full bg-[#86efac]/10 blur-3xl" />

      <div className="relative flex items-center justify-between gap-2">
        {/* Code display */}
        <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-white/10 bg-[#0F0F0F]" title={normalized}>
          <div className={`${styles.prefix} flex shrink-0 items-center justify-center border-r border-white/10 bg-[#86efac]/10 px-1.5 py-2.5`}>
            <span className="text-[13px] font-black tracking-widest text-[#86efac]">
              {prefix}
            </span>
          </div>
          <div className={`${styles.number} min-w-0 px-1 py-2.5`}>
            <span className="block truncate text-[22px] font-black tabular-nums leading-none tracking-tight text-white">
              {number}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            aria-label={copiedCode ? "Kode referral tersalin" : `Salin kode referral ${normalized}`}
            title="Salin kode referral"
            className={`${styles.copyCode} flex min-h-11 w-9 shrink-0 cursor-pointer items-center justify-center border-l border-white/10 bg-white/[0.03] text-gray-400 transition hover:bg-[#86efac]/10 hover:text-[#86efac] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#86efac] active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100`}
          >
            {copiedCode ? (
              <Check size={18} className="text-[#86efac]" aria-hidden="true" />
            ) : (
              <Copy size={18} aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Bagikan ajakan bergabung jadi agent"
            title="Bagikan ajakan bergabung jadi agent"
            className={`${styles.action} group inline-flex min-h-11 w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#86efac] text-[12px] font-extrabold text-black shadow-[0_0_18px_rgba(134,239,172,0.25)] transition hover:shadow-[0_0_26px_rgba(134,239,172,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100`}
          >
            <span aria-hidden="true" className="flex w-4 shrink-0 items-center justify-center">
              <Share2 size={16} className="transition-transform group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
            </span>
            <span className={styles.actionLabel}>Bagikan</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            aria-label={copiedLink ? "Pesan ajakan dan link referral tersalin" : "Salin pesan ajakan dan link referral"}
            title="Salin pesan ajakan dan link referral"
            className={`${styles.action} inline-flex min-h-11 w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#0F0F0F] text-[12px] font-semibold text-gray-300 transition hover:border-[#86efac]/40 hover:text-[#86efac] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#86efac] active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100`}
          >
            <span aria-hidden="true" className="flex w-4 shrink-0 items-center justify-center">
              {copiedLink ? <Check size={16} className="text-[#86efac]" /> : <Link size={16} />}
            </span>
            <span className={`${styles.actionLabel} ${styles.copyLabel} text-center`}>
              {copiedLink ? "Tersalin" : "Salin Link"}
            </span>
          </button>
        </div>
      </div>

      <p className="relative mt-3 text-[11px] leading-relaxed text-gray-400">
        Ajak teman bergabung jadi agent di Solusindo Aset. Bagikan atau salin pesan ajakan beserta
        link; kode referral otomatis terisi saat daftar akun.
      </p>
    </div>
  );
}

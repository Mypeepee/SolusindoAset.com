"use client";

import React, { useCallback, useState } from "react";
import { Icon } from "@iconify/react";
import { toast } from "sonner";

/**
 * Kartu berbagi KODE REFERRAL KLIEN untuk agent.
 *
 * Memberi agent cara mudah membagikan kode + LINK yang, saat diklik klien,
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

  const normalized = (code || "").toUpperCase();
  const prefix = normalized.replace(/\d+$/, "") || "AG";
  const number = normalized.replace(/^\D+/, "");

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://solusindoaset.com";
  const shareUrl = `${origin}/r/${normalized}`;

  const shareText =
    `Halo! 👋 Aku agen properti di *Solusindo Aset*.\n` +
    `Daftar pakai kode referral aku *${normalized}* — kamu dapat agen properti pribadi ` +
    `yang bantu cari & urus lelang properti incaranmu.\n` +
    `👉 Daftar di sini (kode otomatis terisi):`;
  const waText = `${shareText}\n${shareUrl}`;

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  const handleShare = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Daftar di Solusindo Aset",
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        /* user batal / tidak didukung — lanjut fallback WhatsApp */
      }
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(waText)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [shareText, shareUrl, waText]);

  const handleCopyCode = useCallback(async () => {
    if (await copy(normalized)) {
      setCopiedCode(true);
      toast.success("Kode referral disalin.");
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      toast.error("Gagal menyalin kode.");
    }
  }, [copy, normalized]);

  const handleCopyLink = useCallback(async () => {
    if (await copy(shareUrl)) {
      setCopiedLink(true);
      toast.success("Link daftar disalin.");
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      toast.error("Gagal menyalin link.");
    }
  }, [copy, shareUrl]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#86efac]/20 bg-gradient-to-br from-[#86efac]/[0.06] to-transparent p-4 ${className}`}
    >
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full bg-[#86efac]/10 blur-3xl" />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Code display */}
        <div className="flex items-center self-start overflow-hidden rounded-xl border border-white/10 bg-[#0F0F0F]">
          <div className="flex items-center justify-center border-r border-white/10 bg-[#86efac]/10 px-3 py-2.5">
            <span className="text-[13px] font-black tracking-widest text-[#86efac]">
              {prefix}
            </span>
          </div>
          <div className="px-4 py-2.5">
            <span className="text-[22px] font-black tabular-nums leading-none tracking-tight text-white">
              {number}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            aria-label="Salin kode"
            className="flex h-full items-center justify-center border-l border-white/10 bg-white/[0.03] px-3 text-gray-400 transition hover:bg-[#86efac]/10 hover:text-[#86efac] active:scale-95"
          >
            <Icon
              icon={copiedCode ? "solar:check-circle-bold-duotone" : "solar:copy-bold-duotone"}
              className={`text-lg ${copiedCode ? "text-[#86efac]" : ""}`}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="group inline-flex items-center gap-1.5 rounded-xl bg-[#86efac] px-4 py-2.5 text-[12px] font-extrabold text-black shadow-[0_0_18px_rgba(134,239,172,0.25)] transition hover:shadow-[0_0_26px_rgba(134,239,172,0.45)] active:scale-95"
          >
            <Icon icon="solar:share-bold" className="text-sm transition-transform group-hover:scale-110" />
            Bagikan
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0F0F0F] px-3 py-2.5 text-[12px] font-semibold text-gray-300 transition hover:border-[#86efac]/40 hover:text-[#86efac] active:scale-95"
          >
            <Icon
              icon={copiedLink ? "solar:check-circle-bold-duotone" : "solar:link-bold-duotone"}
              className={`text-sm ${copiedLink ? "text-[#86efac]" : ""}`}
            />
            {copiedLink ? "Tersalin" : "Salin Link"}
          </button>
        </div>
      </div>

      <p className="relative mt-3 text-[11px] leading-relaxed text-gray-400">
        Bagikan link ini ke calon klien. Saat mereka membukanya, kode kamu otomatis terisi di halaman
        daftar — begitu mereka mendaftar, klien langsung terhubung ke akunmu, tercatat di CRM, dan kamu
        dapat <span className="font-semibold text-[#86efac]">+10.000 poin</span>.
      </p>
    </div>
  );
}

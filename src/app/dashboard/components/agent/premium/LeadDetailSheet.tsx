"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";

type LeadStatus = "new" | "contacted" | "hot" | "closing" | "cold";
type SourceRaw =
  | "whatsapp"
  | "telepon"
  | "survei"
  | "titip_jual"
  | "form_inquiry";

export interface LeadDetail {
  id: string;
  idProperty: string | null;
  address: string;
  image: string | null;
  listing: string;
  budget?: string;
  status: LeadStatus;
  source: string;
  sourceIcon: string;
  sourceRaw: SourceRaw;
  ageMinutes: number;
  phone?: string | null;
  clientName?: string | null;
}

interface SavedUpdates {
  status: LeadStatus;
  clientName: string | null;
  phone: string | null; // format: "62812..." atau null
}

interface Props {
  lead: LeadDetail | null;
  onClose: () => void;
  onSaved: (updates: SavedUpdates) => void;
}

/* ─────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────── */

type AccentKey = "rose" | "sky" | "amber" | "emerald" | "slate";

const ACCENT_MAP: Record<
  AccentKey,
  {
    active: string;
    icon: string;
    check: string;
    glow: string;
    topAccent: string;
  }
> = {
  rose: {
    active:
      "border-rose-400/40 bg-gradient-to-br from-rose-500/[0.12] to-rose-500/[0.04] shadow-[0_0_28px_-8px_rgba(244,63,94,0.55)]",
    icon: "text-rose-300",
    check: "bg-rose-500",
    glow: "shadow-[0_0_60px_-20px_rgba(244,63,94,0.5)]",
    topAccent: "from-rose-500 via-rose-400 to-transparent",
  },
  sky: {
    active:
      "border-sky-400/40 bg-gradient-to-br from-sky-500/[0.12] to-sky-500/[0.04] shadow-[0_0_28px_-8px_rgba(14,165,233,0.55)]",
    icon: "text-sky-300",
    check: "bg-sky-500",
    glow: "shadow-[0_0_60px_-20px_rgba(14,165,233,0.5)]",
    topAccent: "from-sky-500 via-sky-400 to-transparent",
  },
  amber: {
    active:
      "border-amber-400/40 bg-gradient-to-br from-amber-500/[0.12] to-amber-500/[0.04] shadow-[0_0_28px_-8px_rgba(245,158,11,0.55)]",
    icon: "text-amber-300",
    check: "bg-amber-500",
    glow: "shadow-[0_0_60px_-20px_rgba(245,158,11,0.5)]",
    topAccent: "from-amber-500 via-amber-400 to-transparent",
  },
  emerald: {
    active:
      "border-emerald-400/40 bg-gradient-to-br from-emerald-500/[0.12] to-emerald-500/[0.04] shadow-[0_0_28px_-8px_rgba(16,185,129,0.55)]",
    icon: "text-emerald-300",
    check: "bg-emerald-500",
    glow: "shadow-[0_0_60px_-20px_rgba(16,185,129,0.5)]",
    topAccent: "from-emerald-500 via-emerald-400 to-transparent",
  },
  slate: {
    active: "border-slate-400/30 bg-slate-500/[0.08]",
    icon: "text-slate-300",
    check: "bg-slate-500",
    glow: "",
    topAccent: "from-slate-500 to-transparent",
  },
};

const STATUS_OPTIONS: Array<{
  key: LeadStatus;
  label: string;
  desc: string;
  icon: string;
  accent: AccentKey;
}> = [
  { key: "new",       label: "Lead Baru",      desc: "Belum dihubungi",  icon: "solar:bell-bing-bold-duotone",     accent: "rose" },
  { key: "contacted", label: "Sudah Dikontak", desc: "Chat sudah masuk", icon: "solar:phone-calling-bold-duotone", accent: "sky" },
  { key: "hot",       label: "Hot Buyer",      desc: "Serius minat",     icon: "solar:fire-bold-duotone",          accent: "amber" },
  { key: "closing",   label: "Closing",        desc: "Menuju deal",      icon: "solar:document-text-bold-duotone", accent: "emerald" },
  { key: "cold",      label: "Lost / Iseng",   desc: "Tidak lanjut",     icon: "solar:close-circle-bold-duotone",  accent: "slate" },
];

const CHANNEL_GRADIENT: Record<SourceRaw, string> = {
  whatsapp:     "bg-gradient-to-br from-emerald-400 to-emerald-600",
  telepon:      "bg-gradient-to-br from-sky-400 to-sky-600",
  survei:       "bg-gradient-to-br from-violet-400 to-violet-600",
  titip_jual:   "bg-gradient-to-br from-amber-400 to-amber-600",
  form_inquiry: "bg-gradient-to-br from-slate-400 to-slate-600",
};

/* ─────────────────────────────────────────
   PHONE HELPERS
   62 prefix, no leading 0
   ───────────────────────────────────────── */

// Ambil bagian setelah country prefix dari nomor existing.
// "62812..." → "812..."
// "0812..." → "812..."
// "+62 812 …" → "812…"
function stripCountryPrefix(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("62")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.replace(/^0+/, "");
  return d;
}

// Format untuk display: "8810-2675-7313" (4-4-4 dengan dash)
function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 4) return d;
  if (d.length <= 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  if (d.length <= 12) return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8, 12)}-${d.slice(12, 13)}`;
}

// Bersihkan input dari char non-digit, dan hapus leading 0
function sanitizePhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  d = d.replace(/^0+/, "");
  return d.slice(0, 13);
}

function humanTime(min: number) {
  if (min < 1) return "Baru saja";
  if (min < 60) return `${min} menit lalu`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} jam lalu`;
  return `${Math.floor(min / (60 * 24))} hari lalu`;
}

/* ─────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────── */

export default function LeadDetailSheet({ lead, onClose, onSaved }: Props) {
  const [shown, setShown] = useState(false);
  const [status, setStatus] = useState<LeadStatus>("new");
  const [name, setName] = useState("");
  const [phoneDigits, setPhoneDigits] = useState(""); // tanpa "62"/0
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Baseline saat modal dibuka atau terakhir disimpan — dipakai untuk deteksi perubahan
  const [baseline, setBaseline] = useState<{ status: LeadStatus; name: string; phone: string } | null>(null);
  const [statusManuallyChanged, setStatusManuallyChanged] = useState(false);
  const [showAutoPromoteNotif, setShowAutoPromoteNotif] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  // mount animation
  useEffect(() => {
    if (lead) {
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
  }, [lead]);

  // sync form setiap kali lead berubah (termasuk reopen lead yg sama dgn data fresh)
  useEffect(() => {
    if (lead) {
      const initStatus = lead.status;
      const initName   = lead.clientName || "";
      const initPhone  = stripCountryPrefix(lead.phone);
      setStatus(initStatus);
      setName(initName);
      setPhoneDigits(initPhone);
      setBaseline({ status: initStatus, name: initName, phone: initPhone });
      setErr(null);
      setSavedSuccess(false);
      setStatusManuallyChanged(false);
      setShowAutoPromoteNotif(false);
    }
  }, [lead]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-promote "new" → "contacted" saat nomor WA valid
  // Logika: kalau ada nomor, berarti klien sudah confirm (chat masuk)
  useEffect(() => {
    if (statusManuallyChanged) return;
    if (status === "new" && phoneDigits.length >= 8) {
      setStatus("contacted");
      setShowAutoPromoteNotif(true);
      const t = setTimeout(() => setShowAutoPromoteNotif(false), 4500);
      return () => clearTimeout(t);
    }
  }, [phoneDigits, statusManuallyChanged, status]);

  function handleStatusClick(s: LeadStatus) {
    setStatus(s);
    setStatusManuallyChanged(true);
    setShowAutoPromoteNotif(false);
  }

  // ESC to close
  useEffect(() => {
    if (!lead) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);

  // lock body scroll
  useEffect(() => {
    if (!lead) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [lead]);

  function handleClose() {
    setShown(false);
    setTimeout(onClose, 220);
  }

  if (!lead) return null;

  const phoneValid = phoneDigits.length >= 8;
  const phoneRecommended = status !== "cold" && status !== "new";
  const fullPhone = phoneDigits ? `62${phoneDigits}` : "";
  const isDirty = !baseline ||
    status !== baseline.status ||
    name.trim() !== baseline.name ||
    phoneDigits !== baseline.phone;

  const activeAccent = ACCENT_MAP[
    STATUS_OPTIONS.find((s) => s.key === status)?.accent ?? "rose"
  ];

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/leads/${lead!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          client_name: name.trim() || undefined,
          client_phone: fullPhone || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setSavedSuccess(true);
      const trimmedName = name.trim();
      setBaseline({ status, name: trimmedName, phone: phoneDigits });
      onSaved({ status, clientName: trimmedName || null, phone: fullPhone || null });

      // Auto-simpan ke tabel klien (upsert by WA)
      fetch("/api/dashboard/klien/from-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama:           trimmedName || null,
          nomor_whatsapp: fullPhone || null,
          lead_status:    status,
          source_raw:     lead!.sourceRaw,
          id_lead:        lead!.id,
          id_property:    lead!.idProperty,
        }),
      })
        .then(r => r.json().then(j => {
          if (r.ok) console.log("[CRM from-lead] ok:", j.action, j.id_klien);
          else      console.warn("[CRM from-lead] error:", j);
        }))
        .catch(e => console.warn("[CRM from-lead network]", e));

      // Close setelah animasi success
      setTimeout(() => handleClose(), 900);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* keyframes untuk animasi premium */}
      <style jsx global>{`
        @keyframes lead-sheet-rise {
          from {
            transform: translateY(40px) scale(0.96);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes lead-stagger {
          from {
            transform: translateY(8px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes lead-shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        @keyframes lead-success-pop {
          0% {
            transform: scale(0.4);
            opacity: 0;
          }
          60% {
            transform: scale(1.1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes lead-pulse-glow {
          0%,
          100% {
            box-shadow: 0 4px 16px -4px rgba(16, 185, 129, 0.45);
          }
          50% {
            box-shadow:
              0 4px 24px -2px rgba(16, 185, 129, 0.75),
              0 0 0 2px rgba(16, 185, 129, 0.15);
          }
        }
        @keyframes lead-success-overlay {
          0% {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
          100% {
            opacity: 1;
            backdrop-filter: blur(8px);
          }
        }
        @keyframes lead-check-draw {
          0% {
            transform: scale(0.3) rotate(-20deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.15) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        @keyframes lead-ripple {
          0% {
            transform: scale(0.5);
            opacity: 0.6;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
      `}</style>

      <div
        className={`fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-xl transition-opacity duration-200 sm:items-center ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      >
        {/* subtle radial vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%)",
          }}
        />

        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border-t border-white/[0.1] bg-gradient-to-b from-[#1a1a1d] via-[#121214] to-[#08080a] shadow-[0_-30px_80px_rgba(0,0,0,0.7)] sm:max-h-[88vh] sm:rounded-[28px] sm:border ${
            activeAccent.glow
          }`}
          style={{
            animation: shown
              ? "lead-sheet-rise 280ms cubic-bezier(0.16, 1, 0.3, 1) both"
              : undefined,
          }}
        >
          {/* Top accent gradient bar — warna sesuai status */}
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${activeAccent.topAccent} transition-all duration-500`}
          />

          {/* ─── SUCCESS OVERLAY (premium feel saat tersimpan) ─── */}
          {savedSuccess && (
            <div
              className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-500/[0.15] via-[#08080a]/95 to-[#08080a]/95"
              style={{
                animation:
                  "lead-success-overlay 260ms cubic-bezier(0.16, 1, 0.3, 1) both",
              }}
            >
              <div className="relative">
                {/* Ripple rings */}
                <span
                  className="absolute inset-0 rounded-full bg-emerald-400/30"
                  style={{
                    animation:
                      "lead-ripple 900ms cubic-bezier(0.16, 1, 0.3, 1) both",
                  }}
                />
                <span
                  className="absolute inset-0 rounded-full bg-emerald-400/20"
                  style={{
                    animation:
                      "lead-ripple 1100ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both",
                  }}
                />
                {/* Check disc */}
                <div
                  className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_40px_rgba(16,185,129,0.6),0_8px_24px_rgba(0,0,0,0.4)]"
                  style={{
                    animation:
                      "lead-check-draw 420ms cubic-bezier(0.22, 1.5, 0.36, 1) both",
                  }}
                >
                  <Icon
                    icon="solar:check-circle-bold"
                    className="text-4xl text-white drop-shadow-md"
                  />
                </div>
              </div>
              <p
                className="mt-5 text-base font-extrabold tracking-tight text-white"
                style={{
                  animation:
                    "lead-stagger 320ms cubic-bezier(0.16, 1, 0.3, 1) 280ms both",
                }}
              >
                Tersimpan!
              </p>
              <p
                className="mt-1 text-[11px] text-slate-400"
                style={{
                  animation:
                    "lead-stagger 320ms cubic-bezier(0.16, 1, 0.3, 1) 340ms both",
                }}
              >
                Perubahan status berhasil disimpan
              </p>
            </div>
          )}

          {/* Subtle grid pattern overlay di header (futuristic) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-[0.035]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              maskImage:
                "linear-gradient(to bottom, black 0%, transparent 100%)",
            }}
          />

          {/* drag handle (mobile) */}
          <div className="absolute left-1/2 top-2.5 z-20 h-1 w-12 -translate-x-1/2 rounded-full bg-white/20 sm:hidden" />

          {/* close button */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup"
            className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-white/[0.06] text-slate-200 backdrop-blur-xl transition-all hover:scale-105 hover:border-white/[0.2] hover:bg-white/[0.12] active:scale-95"
          >
            <Icon icon="solar:close-circle-bold" className="text-lg" />
          </button>

          {/* ─── HEADER: konteks lead ─── */}
          <header className="relative shrink-0 border-b border-white/[0.06] px-5 pb-5 pt-9 sm:pt-6">
            <div className="flex gap-4">
              <div
                className="relative shrink-0"
                style={{
                  animation: shown
                    ? "lead-stagger 320ms cubic-bezier(0.16, 1, 0.3, 1) 60ms both"
                    : undefined,
                }}
              >
                {lead.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lead.image}
                    alt={lead.listing}
                    className="h-20 w-20 rounded-2xl object-cover shadow-[0_8px_24px_rgba(0,0,0,0.4)] ring-1 ring-white/[0.1]"
                  />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-[0_8px_24px_rgba(0,0,0,0.4)] ring-1 ring-white/[0.08]">
                    <Icon
                      icon="solar:home-bold-duotone"
                      className="text-3xl text-slate-500"
                    />
                  </div>
                )}
                {/* channel chip — gradient + glow */}
                <span
                  className={`absolute -bottom-1.5 -right-1.5 grid h-7 w-7 place-items-center rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-[2.5px] ring-[#08080a] ${CHANNEL_GRADIENT[lead.sourceRaw]}`}
                >
                  <Icon icon={lead.sourceIcon} className="text-sm text-white" />
                </span>
              </div>

              <div
                className="min-w-0 flex-1 pt-1"
                style={{
                  animation: shown
                    ? "lead-stagger 320ms cubic-bezier(0.16, 1, 0.3, 1) 100ms both"
                    : undefined,
                }}
              >
                <p className="line-clamp-2 pr-10 text-[15px] font-bold leading-snug text-white">
                  {lead.address}
                </p>
                <p className="mt-1 truncate text-[11px] text-slate-400">
                  {lead.listing}
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {lead.budget && (
                    <span className="text-base font-extrabold tabular-nums text-emerald-300">
                      {lead.budget}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <Icon
                      icon="solar:clock-circle-linear"
                      className="text-[11px]"
                    />
                    {humanTime(lead.ageMinutes)} · via {lead.source}
                  </span>
                </div>
              </div>
            </div>

            {/* Hint untuk lead anonim */}
            {!lead.phone && (
              <div
                className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-400/15 bg-gradient-to-br from-amber-500/[0.08] to-amber-500/[0.02] p-3"
                style={{
                  animation: shown
                    ? "lead-stagger 320ms cubic-bezier(0.16, 1, 0.3, 1) 140ms both"
                    : undefined,
                }}
              >
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-amber-500/15">
                  <Icon
                    icon="solar:lightbulb-bold-duotone"
                    className="text-base text-amber-300"
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-amber-100/85">
                  <span className="font-bold">Lead belum punya nomor.</span>{" "}
                  Kalau klien tidak chat WA, tandai{" "}
                  <span className="font-bold text-amber-200">Lost / Iseng</span>
                  . Kalau sudah chat, isi nomor & ubah ke{" "}
                  <span className="font-bold text-amber-200">Sudah Dikontak</span>
                  .
                </p>
              </div>
            )}
          </header>

          {/* ─── BODY ─── */}
          <div className="relative flex-1 overflow-y-auto px-5 py-4">
            {/* Status segmented */}
            <section
              style={{
                animation: shown
                  ? "lead-stagger 320ms cubic-bezier(0.16, 1, 0.3, 1) 180ms both"
                  : undefined,
              }}
            >
              <SectionLabel
                icon="solar:tag-bold-duotone"
                title="Status Lead"
              />

              {/* Auto-promote notification */}
              {showAutoPromoteNotif && (
                <div
                  className="mb-2.5 flex items-start gap-2 overflow-hidden rounded-xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500/[0.12] via-emerald-500/[0.06] to-transparent p-2.5"
                  style={{
                    animation:
                      "lead-stagger 320ms cubic-bezier(0.16, 1, 0.3, 1) both",
                  }}
                >
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-500/20">
                    <Icon
                      icon="solar:magic-stick-3-bold-duotone"
                      className="text-sm text-emerald-300"
                    />
                  </div>
                  <p className="pt-0.5 text-[10px] leading-relaxed text-emerald-100/90">
                    Status otomatis diubah ke{" "}
                    <b className="text-emerald-200">Sudah Dikontak</b> karena
                    nomor WhatsApp sudah ada.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {STATUS_OPTIONS.map((opt, idx) => {
                  const active = status === opt.key;
                  const accent = ACCENT_MAP[opt.accent];
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleStatusClick(opt.key)}
                      style={{
                        animation: shown
                          ? `lead-stagger 360ms cubic-bezier(0.16, 1, 0.3, 1) ${220 + idx * 40}ms both`
                          : undefined,
                      }}
                      className={`group relative flex flex-col items-start gap-0.5 rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] ${
                        active
                          ? accent.active
                          : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.16] hover:bg-white/[0.04]"
                      }`}
                    >
                      <Icon
                        icon={opt.icon}
                        className={`mb-0.5 text-lg transition-colors ${
                          active ? accent.icon : "text-slate-500"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-bold leading-tight transition-colors ${
                          active ? "text-white" : "text-slate-300"
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] leading-tight text-slate-500">
                        {opt.desc}
                      </span>
                      {active && (
                        <span
                          className={`absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full ${accent.check}`}
                          style={{
                            animation:
                              "lead-success-pop 280ms cubic-bezier(0.22, 1.5, 0.36, 1) both",
                          }}
                        >
                          <Icon
                            icon="solar:check-circle-bold"
                            className="text-[10px] text-white"
                          />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {status === "cold" ? (
              /* Konfirmasi lead akan ditutup — tidak perlu input data */
              <div
                className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-400/15 bg-gradient-to-br from-slate-500/[0.08] to-slate-500/[0.02] p-4"
                style={{
                  animation:
                    "lead-stagger 280ms cubic-bezier(0.16, 1, 0.3, 1) both",
                }}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-500/15">
                  <Icon
                    icon="solar:close-circle-bold-duotone"
                    className="text-xl text-slate-300"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-slate-100">
                    Lead akan ditandai sebagai Lost / Iseng
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    Lead ini akan dikeluarkan dari antrian Follow Up. Tidak
                    perlu mengisi nama atau nomor WhatsApp.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Divider */}
                <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

                {/* Kontak — Nama & WA */}
                <section
                  style={{
                    animation: shown
                      ? "lead-stagger 320ms cubic-bezier(0.16, 1, 0.3, 1) 380ms both"
                      : undefined,
                  }}
                >
                  <SectionLabel
                    icon="solar:phone-calling-bold-duotone"
                    title="Data Kontak"
                  />

                  {/* Nama */}
                  <FieldLabel
                    icon="solar:user-bold-duotone"
                    label="Nama Klien"
                    hint="opsional"
                  />
                  <div className="relative mb-3.5">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Mis. Budi Santoso"
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all duration-200 focus:border-emerald-400/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(16,185,129,0.1)]"
                    />
                  </div>

                  {/* Phone — dengan country prefix */}
                  <FieldLabel
                    icon="solar:phone-bold-duotone"
                    label="Nomor WhatsApp"
                    badge={
                      phoneRecommended ? (
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-amber-300 normal-case">
                          Direkomendasikan
                        </span>
                      ) : null
                    }
                  />
                  <div className="relative">
                    <div
                      className={`flex items-stretch overflow-hidden rounded-xl border bg-white/[0.03] transition-all duration-200 ${
                        phoneRecommended && !phoneValid
                          ? "border-amber-400/25 shadow-[0_0_0_3px_rgba(245,158,11,0.07)]"
                          : "border-white/[0.08]"
                      } focus-within:border-emerald-400/50 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.1)]`}
                    >
                      {/* Country prefix chip */}
                      <div className="flex shrink-0 items-center gap-2 border-r border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] px-3.5">
                        <span className="text-lg leading-none">🇮🇩</span>
                        <span className="text-sm font-bold tabular-nums tracking-tight text-slate-100">
                          +62
                        </span>
                      </div>
                      <input
                        ref={phoneRef}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="off"
                        value={formatPhoneDisplay(phoneDigits)}
                        onChange={(e) =>
                          setPhoneDigits(sanitizePhoneInput(e.target.value))
                        }
                        placeholder="8812-3456-789"
                        className="flex-1 bg-transparent px-3.5 py-2.5 text-sm tabular-nums tracking-wide text-white placeholder-slate-600 outline-none"
                      />
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Icon
                        icon="solar:info-circle-bold-duotone"
                        className="text-sm text-slate-500"
                      />
                      Masukkan tanpa angka 0 di depan. Contoh: 8810-2675-7313
                    </p>
                    {phoneRecommended && !phoneValid && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-400/90">
                        <Icon
                          icon="solar:danger-triangle-bold-duotone"
                          className="text-sm text-amber-400"
                        />
                        Isi nomor WA agar lead bisa dihubungi langsung
                      </p>
                    )}
                  </div>
                </section>
              </>
            )}

            {err && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                <Icon
                  icon="solar:danger-triangle-bold-duotone"
                  className="mt-0.5 shrink-0 text-base"
                />
                <span>{err}</span>
              </div>
            )}
          </div>

          {/* ─── FOOTER ─── */}
          <footer
            className="shrink-0 space-y-2 border-t border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            style={{
              animation: shown
                ? "lead-stagger 320ms cubic-bezier(0.16, 1, 0.3, 1) 460ms both"
                : undefined,
            }}
          >
            {phoneValid && (
              <a
                href={`https://wa.me/${fullPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 py-3 text-sm font-bold text-emerald-100 transition-all hover:border-emerald-400/50 hover:from-emerald-500/20 hover:to-emerald-600/20 active:scale-[0.99]"
              >
                <Icon
                  icon="ic:baseline-whatsapp"
                  className="text-base transition-transform group-hover:scale-110"
                />
                Buka Chat WhatsApp
              </a>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.02] py-3 text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.06] active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                style={{
                  animation:
                    isDirty && !saving
                      ? "lead-pulse-glow 2.4s ease-in-out infinite"
                      : undefined,
                }}
                className="group relative flex-[2] overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 py-3 text-sm font-extrabold text-white transition-all hover:from-emerald-400 hover:via-emerald-300 hover:to-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {/* shimmer overlay */}
                <span
                  aria-hidden
                  className="absolute inset-0 opacity-50 transition-opacity group-hover:opacity-100"
                  style={{
                    backgroundImage:
                      "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
                    backgroundSize: "200% 100%",
                    animation: "lead-shimmer 2.5s linear infinite",
                  }}
                />
                <span className="relative inline-flex items-center justify-center gap-2">
                  {savedSuccess ? (
                    <span
                      className="inline-flex items-center gap-2"
                      style={{
                        animation:
                          "lead-success-pop 320ms cubic-bezier(0.22, 1.5, 0.36, 1) both",
                      }}
                    >
                      <Icon icon="solar:check-circle-bold" className="text-base" />
                      Tersimpan!
                    </span>
                  ) : saving ? (
                    <>
                      <Icon
                        icon="solar:refresh-circle-bold-duotone"
                        className="animate-spin text-base"
                      />
                      Menyimpan…
                    </>
                  ) : (
                    <>
                      <Icon
                        icon="solar:check-circle-bold-duotone"
                        className="text-base transition-transform group-hover:rotate-[-8deg]"
                      />
                      Simpan Perubahan
                    </>
                  )}
                </span>
              </button>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────
   SMALL HELPERS
   ───────────────────────────────────────── */

function SectionLabel({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <Icon icon={icon} className="text-[14px] text-slate-400" />
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">
        {title}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
    </div>
  );
}

function FieldLabel({
  icon,
  label,
  hint,
  badge,
}: {
  icon: string;
  label: string;
  hint?: string;
  badge?: React.ReactNode;
}) {
  return (
    <label className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-slate-200">
      <Icon icon={icon} className="text-[15px] text-slate-400" />
      {label}
      {hint && (
        <span className="text-[10px] font-normal text-slate-500">
          ({hint})
        </span>
      )}
      {badge}
    </label>
  );
}

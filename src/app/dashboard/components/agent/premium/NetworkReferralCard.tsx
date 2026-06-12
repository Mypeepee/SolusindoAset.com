"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";

/* ────────────────────────────────────────────────────────────────────
   Google Drive URL builder — sama persis dengan ProfileHeader.tsx
   yang terbukti bekerja di codebase ini.
   foto_profil_url bisa berupa:
     • Plain file ID  (tidak ada "http") → langsung jadikan uc URL
     • Full share URL (?id= atau /d/)   → ekstrak ID → uc URL
   ──────────────────────────────────────────────────────────────────── */
function buildDriveUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;

  if (!t.includes("http")) {
    return `https://drive.google.com/uc?export=view&id=${t}`;
  }

  try {
    const u = new URL(t);
    const id = u.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    const m = t.match(/\/d\/([^/?#]+)/);
    if (m?.[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    return t;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────── */

type SubDownline = {
  id_agent: string;
  nama_lengkap: string;
  foto_profil_url: string | null;
  jabatan: string;
  kota_area: string;
  status_keanggotaan: string;
  tanggal_gabung: string | null;
  jumlah_closing: number;
  total_omset: number;
  poin: number;
  jumlah_downline: number;
};

type Downline = SubDownline & {
  nomor_telepon: string | null;
  downlines: SubDownline[];
};

type NetworkStats = {
  total_direct: number;
  total_network: number;
  total_active: number;
  total_closing_network: number;
  total_omset_network: number;
};

type NetworkData = {
  ok: boolean;
  stats: NetworkStats;
  downlines: Downline[];
};

/* ────────────────────────────────────────────────────────────────────
   Hook
   ──────────────────────────────────────────────────────────────────── */

function useNetworkData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NetworkData | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/agent/network", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok || !json?.ok) throw new Error(json?.message || `HTTP ${res.status}`);
        setData(json);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Gagal memuat jaringan");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { loading, error, data };
}

/* ────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────── */

function formatOmsetShort(n: number) {
  if (n <= 0) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000).toLocaleString("id-ID")} Jt`;
  return `${Math.round(n / 1_000).toLocaleString("id-ID")} Rb`;
}

function relativeJoin(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays < 30) return `${diffDays} hari lalu`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} bln lalu`;
  return `${Math.floor(diffMonths / 12)} thn lalu`;
}

const JABATAN_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  PRINCIPAL:  { label: "Principal",   bg: "bg-violet-500/15", text: "text-violet-300",  border: "border-violet-400/25" },
  OWNER:      { label: "Owner",       bg: "bg-rose-500/15",   text: "text-rose-300",    border: "border-rose-400/25"   },
  TEAMLEADER: { label: "Team Leader", bg: "bg-teal-500/15",   text: "text-teal-300",    border: "border-teal-400/25"   },
  STOKER:     { label: "Stoker",      bg: "bg-amber-500/15",  text: "text-amber-300",   border: "border-amber-400/25"  },
  ADMIN:      { label: "Admin",       bg: "bg-sky-500/15",    text: "text-sky-300",     border: "border-sky-400/25"    },
  AGENT:      { label: "Agent",       bg: "bg-emerald-500/15",text: "text-emerald-300", border: "border-emerald-400/25"},
};

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  AKTIF:   { dot: "bg-emerald-400", label: "Aktif"   },
  PENDING: { dot: "bg-amber-400",   label: "Pending" },
  SUSPEND: { dot: "bg-rose-400",    label: "Suspend" },
};

/* ────────────────────────────────────────────────────────────────────
   Avatar
   ──────────────────────────────────────────────────────────────────── */

const AVATAR_PALETTE = [
  "from-emerald-500/30 to-teal-500/20 text-emerald-200",
  "from-blue-500/30 to-sky-500/20 text-blue-200",
  "from-violet-500/30 to-purple-500/20 text-violet-200",
  "from-amber-500/30 to-orange-500/20 text-amber-200",
  "from-rose-500/30 to-pink-500/20 text-rose-200",
  "from-cyan-500/30 to-teal-500/20 text-cyan-200",
];

const AVATAR_PX = { sm: 28, md: 36, lg: 48 } as const;
const AVATAR_TEXT = { sm: "text-[10px]", md: "text-xs", lg: "text-base" } as const;

function Avatar({ src, name, size = "md" }: { src: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);

  const px      = AVATAR_PX[size];
  const text    = AVATAR_TEXT[size];
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  const palette  = AVATAR_PALETTE[(name.charCodeAt(0) || 0) % AVATAR_PALETTE.length]!;
  const url      = buildDriveUrl(src);
  const showImg  = url && !failed;

  return (
    <div
      className="relative flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white/[0.08]"
      style={{ width: px, height: px }}
    >
      {showImg ? (
        <Image
          src={url}
          alt={name}
          fill
          sizes={`${px}px`}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${palette} ${text} font-bold`}>
          {initials}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Jabatan & Status Pills
   ──────────────────────────────────────────────────────────────────── */

function JabatanPill({ jabatan }: { jabatan: string }) {
  const cfg = JABATAN_CONFIG[jabatan] ?? JABATAN_CONFIG.AGENT!;
  return (
    <span className={`inline-flex items-center rounded-lg border px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING!;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`relative flex h-1.5 w-1.5`}>
        {status === "AKTIF" && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cfg.dot} opacity-60`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      </span>
      <span className={`text-[10px] font-semibold ${status === "AKTIF" ? "text-emerald-400" : status === "SUSPEND" ? "text-rose-400" : "text-amber-400"}`}>
        {cfg.label}
      </span>
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Stat Chip — mini metric di header strip
   ──────────────────────────────────────────────────────────────────── */

function StatChip({
  icon, label, value, accent,
}: {
  icon: string;
  label: string;
  value: string | number;
  accent: "emerald" | "violet" | "sky" | "amber";
}) {
  const cls = {
    emerald: { icon: "text-emerald-300", bg: "bg-emerald-500/[0.08]", border: "border-emerald-400/20", val: "text-emerald-100", orb: "rgba(52,211,153,0.15)" },
    violet:  { icon: "text-violet-300",  bg: "bg-violet-500/[0.08]",  border: "border-violet-400/20",  val: "text-violet-100",  orb: "rgba(167,139,250,0.15)" },
    sky:     { icon: "text-sky-300",     bg: "bg-sky-500/[0.08]",     border: "border-sky-400/20",     val: "text-sky-100",     orb: "rgba(56,189,248,0.15)"  },
    amber:   { icon: "text-amber-300",   bg: "bg-amber-500/[0.08]",   border: "border-amber-400/20",   val: "text-amber-100",   orb: "rgba(251,191,36,0.15)"  },
  }[accent];

  return (
    <div className={`group relative flex min-w-0 flex-1 flex-col items-center gap-1 overflow-hidden rounded-2xl border ${cls.border} ${cls.bg} px-3 py-3 text-center transition hover:brightness-110`}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 -right-6 h-16 w-16 rounded-full blur-2xl"
        style={{ background: cls.orb }}
      />
      <Icon icon={icon} className={`relative text-xl ${cls.icon}`} />
      <p className={`relative text-lg font-extrabold tabular-nums leading-tight tracking-tight ${cls.val}`}>
        {value}
      </p>
      <p className="relative text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Sub-Downline Row (level 2)
   ──────────────────────────────────────────────────────────────────── */

function SubDownlineRow({ agent }: { agent: SubDownline }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 transition hover:border-white/[0.1] hover:bg-white/[0.04]">
      {/* Tree connector */}
      <div className="flex h-full flex-col items-center">
        <div className="h-full w-px bg-gradient-to-b from-emerald-400/30 to-transparent" />
      </div>

      <Avatar src={agent.foto_profil_url} name={agent.nama_lengkap} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[11.5px] font-semibold text-slate-200">{agent.nama_lengkap}</p>
          <JabatanPill jabatan={agent.jabatan} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <StatusDot status={agent.status_keanggotaan} />
          {agent.kota_area && (
            <span className="text-[10px] text-slate-500">{agent.kota_area}</span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-[11px] font-bold tabular-nums text-white">{agent.jumlah_closing} closing</p>
        {agent.jumlah_downline > 0 && (
          <p className="mt-0.5 text-[9.5px] text-emerald-400/70">↳ {agent.jumlah_downline} downline</p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Downline Row (level 1) — expandable
   ──────────────────────────────────────────────────────────────────── */

function DownlineRow({ agent, rank }: { agent: Downline; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasSubDownlines = agent.jumlah_downline > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.035] via-white/[0.01] to-transparent transition-all duration-300">
      {/* Main row */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${hasSubDownlines ? "cursor-pointer select-none" : ""}`}
        onClick={() => hasSubDownlines && setExpanded((p) => !p)}
      >
        {/* Rank badge */}
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-[10px] font-extrabold text-slate-500 ring-1 ring-white/[0.07]">
          {String(rank).padStart(2, "0")}
        </div>

        <Avatar src={agent.foto_profil_url} name={agent.nama_lengkap} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold text-white">{agent.nama_lengkap}</p>
            <JabatanPill jabatan={agent.jabatan} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <StatusDot status={agent.status_keanggotaan} />
            <span className="text-[10px] text-slate-500">
              {agent.kota_area}
            </span>
            <span className="text-[10px] text-slate-600">
              Bergabung {relativeJoin(agent.tanggal_gabung)}
            </span>
          </div>
        </div>

        {/* Right stats */}
        <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            <Icon icon="solar:medal-star-bold-duotone" className="text-[13px] text-amber-400" />
            <span className="text-[12px] font-extrabold tabular-nums text-white">
              {agent.jumlah_closing}
            </span>
            <span className="text-[10px] text-slate-500">closing</span>
          </div>
          {agent.total_omset > 0 && (
            <p className="text-[10px] font-semibold tabular-nums text-emerald-400/80">
              {formatOmsetShort(agent.total_omset)}
            </p>
          )}
          {hasSubDownlines && (
            <span className="mt-0.5 text-[9.5px] font-bold text-emerald-400/60">
              ↳ {agent.jumlah_downline} downline
            </span>
          )}
        </div>

        {/* Expand toggle */}
        {hasSubDownlines && (
          <div
            className={`ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-transform duration-300 ${expanded ? "rotate-180 border-emerald-400/25 bg-emerald-500/[0.06] text-emerald-300" : ""}`}
          >
            <Icon icon="solar:alt-arrow-down-bold" className="text-[12px]" />
          </div>
        )}
      </div>

      {/* Sub-downlines panel */}
      {hasSubDownlines && (
        <div
          className={`overflow-hidden transition-all duration-500 ease-in-out ${expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
        >
          {/* separator */}
          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
          <div className="space-y-1.5 px-4 py-2.5">
            {agent.downlines.length > 0 ? (
              agent.downlines.map((sub) => (
                <SubDownlineRow key={sub.id_agent} agent={sub} />
              ))
            ) : null}
            {agent.jumlah_downline > agent.downlines.length && (
              <p className="pt-0.5 text-center text-[10px] text-slate-500">
                +{agent.jumlah_downline - agent.downlines.length} downline lainnya tidak ditampilkan
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Motivational Banner — pesan semangat kontekstual berdasarkan
   ukuran jaringan. Makin besar network → tier lebih tinggi.
   ──────────────────────────────────────────────────────────────────── */

type MotivTier = {
  icon: string;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  glowColor: string;
  titleColor: string;
  title: string;
  message: string;
};

function getMotivTier(total: number): MotivTier {
  if (total === 0) return {
    icon: "solar:fire-bold-duotone",
    iconColor: "text-amber-300",
    iconBg: "bg-amber-500/15",
    borderColor: "border-amber-400/20",
    glowColor: "rgba(251,191,36,0.12)",
    titleColor: "text-amber-200",
    title: "Mulai sekarang, jangan tunda!",
    message: "Setiap agent sukses dimulai dari 1 orang yang diajak. Ajak rekan terbaikmu hari ini — satu undangan bisa jadi sumber passive income selamanya.",
  };
  if (total <= 3) return {
    icon: "solar:leaf-bold-duotone",
    iconColor: "text-emerald-300",
    iconBg: "bg-emerald-500/15",
    borderColor: "border-emerald-400/20",
    glowColor: "rgba(52,211,153,0.12)",
    titleColor: "text-emerald-200",
    title: "Benihmu sudah ditanam!",
    message: "Jaringanmu mulai tumbuh. Setiap downline yang closing = komisi upline yang masuk ke kantongmu tanpa kamu harus turun tangan langsung.",
  };
  if (total <= 9) return {
    icon: "solar:rocket-bold-duotone",
    iconColor: "text-sky-300",
    iconBg: "bg-sky-500/15",
    borderColor: "border-sky-400/20",
    glowColor: "rgba(56,189,248,0.12)",
    titleColor: "text-sky-200",
    title: "Momentum-mu sedang naik!",
    message: `${total} orang sudah percaya ikut bersamamu. Semakin aktif kamu membimbing mereka closing, semakin deras aliran komisi yang kembali ke kamu.`,
  };
  if (total <= 19) return {
    icon: "solar:stars-bold-duotone",
    iconColor: "text-violet-300",
    iconBg: "bg-violet-500/15",
    borderColor: "border-violet-400/20",
    glowColor: "rgba(167,139,250,0.12)",
    titleColor: "text-violet-200",
    title: "Double digit — kamu serius!",
    message: `${total} jaringan aktif artinya ${total} peluang komisi pasif setiap bulannya. Bantu mereka tutup 1 deal saja — efeknya berlipat untuk penghasilan kamu.`,
  };
  return {
    icon: "solar:crown-bold-duotone",
    iconColor: "text-amber-300",
    iconBg: "bg-gradient-to-br from-amber-500/20 to-orange-500/10",
    borderColor: "border-amber-400/30",
    glowColor: "rgba(251,191,36,0.18)",
    titleColor: "text-amber-200",
    title: `Luar biasa — ${total} orang di jaringanmu!`,
    message: "Kamu sudah membangun mesin penghasil uang yang sesungguhnya. Jaringan besar = income terus mengalir bahkan saat kamu sedang istirahat. Jaga dan terus perluas!",
  };
}

function MotivationalBanner({ totalNetwork }: { totalNetwork: number }) {
  const tier = getMotivTier(totalNetwork);

  return (
    <div
      className="relative mx-6 mb-4 overflow-hidden rounded-2xl border px-4 py-3.5"
      style={{
        borderColor: tier.borderColor.replace("border-", ""),
        background: `linear-gradient(135deg, ${tier.glowColor} 0%, rgba(7,10,11,0.6) 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 40px -12px ${tier.glowColor}`,
      }}
    >
      {/* Shimmer line top */}
      <div
        className="pointer-events-none absolute top-0 inset-x-8 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${tier.glowColor.replace("0.12", "0.6")}, transparent)` }}
      />

      {/* Decorative dots right */}
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex gap-1 opacity-30">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-full bg-white"
            style={{ width: 3 - i, height: 3 - i, opacity: 1 - i * 0.3 }}
          />
        ))}
      </div>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${tier.iconBg}`}>
          <Icon icon={tier.icon} className={`text-xl ${tier.iconColor}`} />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1 pr-6">
          <p className={`text-[12px] font-extrabold leading-tight tracking-tight ${tier.titleColor}`}>
            {tier.title}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            {tier.message}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Skeleton
   ──────────────────────────────────────────────────────────────────── */

function NetworkSkeleton() {
  return (
    <div className="space-y-3 p-6">
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-px bg-white/[0.05]" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Empty State
   ──────────────────────────────────────────────────────────────────── */

function NetworkEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent">
        <Icon icon="solar:users-group-two-rounded-bold-duotone" className="text-3xl text-slate-600" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-400">Belum ada jaringan</p>
        <p className="mt-1 text-xs text-slate-600">
          Ajak agent lain bergabung — kamu akan menjadi upline mereka.
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Main Card
   ──────────────────────────────────────────────────────────────────── */

export function NetworkReferralCard() {
  const { loading, error, data } = useNetworkData();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#0a0f10] to-[#070a0b]">
      {/* Top hairline glow */}
      <div className="pointer-events-none absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />

      {/* Background aurora */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-emerald-400/[0.05] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-teal-400/[0.04] blur-3xl"
      />

      {/* ─── Header ─── */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 ring-1 ring-emerald-300/30 shadow-[0_10px_28px_-10px_rgba(16,185,129,0.7)]">
            <Icon icon="solar:users-group-two-rounded-bold-duotone" className="text-xl text-white drop-shadow" />
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent opacity-50" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-white">Jaringan Referral</h3>
            <p className="text-[10.5px] text-slate-500">
              Downline langsung &amp; seluruh jaringan kamu
            </p>
          </div>
        </div>

        {/* Live badge */}
        {!loading && !error && (
          <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300/90">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        )}
      </div>

      {loading ? (
        <NetworkSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-rose-400">
          <Icon icon="solar:danger-bold-duotone" className="text-3xl" />
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <>
          {/* ─── Stats Strip ─── */}
          <div className="relative grid grid-cols-2 gap-2.5 px-6 pb-4 sm:grid-cols-4">
            <StatChip
              icon="solar:users-group-rounded-bold-duotone"
              label="Total Jaringan"
              value={data!.stats.total_network.toLocaleString("id-ID")}
              accent="emerald"
            />
            <StatChip
              icon="solar:user-check-rounded-bold-duotone"
              label="Aktif"
              value={data!.stats.total_active.toLocaleString("id-ID")}
              accent="sky"
            />
            <StatChip
              icon="solar:medal-ribbons-star-bold-duotone"
              label="Closing Jaringan"
              value={data!.stats.total_closing_network.toLocaleString("id-ID")}
              accent="amber"
            />
            <StatChip
              icon="solar:graph-up-bold-duotone"
              label="Omset Jaringan"
              value={formatOmsetShort(data!.stats.total_omset_network)}
              accent="violet"
            />
          </div>

          {/* ─── Motivational Banner ─── */}
          <MotivationalBanner totalNetwork={data!.stats.total_network} />

          {/* ─── Divider ─── */}
          <div className="relative mx-6 mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              <Icon icon="solar:layers-bold-duotone" className="text-[12px] text-emerald-400/70" />
              {data!.stats.total_direct} Agent Langsung
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-white/[0.06] to-transparent" />
          </div>

          {/* ─── Tree List ─── */}
          <div className="relative px-6 pb-6">
            {data!.downlines.length === 0 ? (
              <NetworkEmpty />
            ) : (
              <div className="relative">
                {/* Scroll container — ~10 rows @ ±72px each = 720px max */}
                <div
                  className="space-y-2 overflow-y-auto pr-1"
                  style={{ maxHeight: 720 }}
                >
                  {data!.downlines.map((agent, idx) => (
                    <DownlineRow key={agent.id_agent} agent={agent} rank={idx + 1} />
                  ))}
                </div>

                {/* Fade-out gradient di bawah sebagai cue "ada konten lagi" */}
                {data!.downlines.length > 10 && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-1 h-16 bg-gradient-to-t from-[#070a0b] to-transparent" />
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Bottom hairline glow */}
      <div className="pointer-events-none absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-400/15 to-transparent" />
    </div>
  );
}

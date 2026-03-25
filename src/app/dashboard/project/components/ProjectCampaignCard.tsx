"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ProjectCampaign = {
  id: string;
  nama: string;
  lokasi: string;
  status: string;
  jenisPendanaan: "terbuka" | "tertutup";
  thumbnail: string;
  targetPendanaan: number;
  totalPendanaan: number;
  estimasiHargaJual: number;
  estimasiProfit: number;
  hariTersisa: number;
  investor: number;
  avatarInvestor?: string[];
  estimasiExit?: string;
  estimasiSelesaiBulan?: number;
  createdById?: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\s/g, " ");
}

function formatCompactIDR(value: number) {
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} M`;
  }

  if (abs >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} Jt`;
  }

  return formatCurrency(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function isLikelyGoogleDriveId(value: string) {
  return /^[A-Za-z0-9_-]{20,}$/.test(value);
}

function extractGoogleDriveId(rawUrl: string) {
  const patterns = [
    /[?&]id=([^&#]+)/i,
    /\/file\/d\/([^/]+)/i,
    /\/d\/([^/]+)/i,
    /\/thumbnail\?id=([^&#]+)/i,
    /\/uc\?(?:[^#]*&)?id=([^&#]+)/i,
  ];

  for (const pattern of patterns) {
    const match = rawUrl.match(pattern);
    if (match?.[1]) return match[1];
  }

  if (isLikelyGoogleDriveId(rawUrl)) return rawUrl;
  return null;
}

function getImageCandidates(url?: string | null, size = 1600): string[] {
  if (!url) return [];

  const trimmed = String(url).trim();
  if (!trimmed) return [];

  const driveId = extractGoogleDriveId(trimmed);

  if (driveId) {
    return [
      `https://drive.google.com/thumbnail?id=${driveId}&sz=w${size}`,
      `https://drive.google.com/uc?export=view&id=${driveId}`,
      `https://drive.google.com/uc?id=${driveId}`,
    ];
  }

  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return [trimmed];
  }

  if (trimmed.startsWith("//")) return [`https:${trimmed}`];
  if (trimmed.startsWith("/")) return [trimmed];

  return [];
}

function resolveEstimasiSelesaiBulan(project: ProjectCampaign) {
  if (
    typeof project.estimasiSelesaiBulan === "number" &&
    Number.isFinite(project.estimasiSelesaiBulan) &&
    project.estimasiSelesaiBulan > 0
  ) {
    return project.estimasiSelesaiBulan;
  }

  if (project.estimasiExit) {
    const matched = project.estimasiExit.match(/\d+/);
    if (matched) return Number(matched[0]);
  }

  return Math.max(1, Math.ceil(project.hariTersisa / 30) || 1);
}

function getProgress(project: ProjectCampaign) {
  if (project.targetPendanaan <= 0) return 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round((project.totalPendanaan / project.targetPendanaan) * 100)
    )
  );
}

function getROI(project: ProjectCampaign) {
  if (project.targetPendanaan <= 0) return 0;

  return Math.max(
    0,
    Number(
      ((project.estimasiProfit / project.targetPendanaan) * 100).toFixed(1)
    )
  );
}

function getStatusTone(status: string) {
  const value = status.toLowerCase();

  if (value.includes("tertutup")) {
    return {
      pill: "border-sky-400/20 bg-sky-400/10 text-sky-100",
      dot: "bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.95)]",
    };
  }

  if (value.includes("pendanaan")) {
    return {
      pill: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
      dot: "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.95)]",
    };
  }

  if (value.includes("renovasi")) {
    return {
      pill: "border-amber-400/20 bg-amber-400/10 text-amber-100",
      dot: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.9)]",
    };
  }

  if (value.includes("jual")) {
    return {
      pill: "border-violet-400/20 bg-violet-400/10 text-violet-100",
      dot: "bg-violet-300 shadow-[0_0_14px_rgba(196,181,253,0.95)]",
    };
  }

  return {
    pill: "border-white/15 bg-white/[0.06] text-white/85",
    dot: "bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.55)]",
  };
}

function SmartImage({
  src,
  alt,
  className,
  size = 1600,
}: {
  src?: string | null;
  alt: string;
  className: string;
  size?: number;
}) {
  const candidates = useMemo(() => getImageCandidates(src, size), [src, size]);
  const [index, setIndex] = useState(0);

  const currentSrc = candidates[index] || "";

  if (!currentSrc) {
    return (
      <div
        className={cn(
          className,
          "flex items-center justify-center bg-[linear-gradient(180deg,#102033_0%,#08111d_100%)]"
        )}
      >
        <div className="h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (index < candidates.length - 1) {
          setIndex((prev) => prev + 1);
        } else {
          setIndex(candidates.length);
        }
      }}
    />
  );
}

function SmartAvatar({
  src,
  alt,
  fallbackText,
  className,
  size = 120,
}: {
  src?: string | null;
  alt: string;
  fallbackText: string;
  className: string;
  size?: number;
}) {
  const candidates = useMemo(() => getImageCandidates(src, size), [src, size]);
  const [index, setIndex] = useState(0);

  const currentSrc = candidates[index] || "";
  const initial = (fallbackText || "?").slice(0, 1).toUpperCase();

  if (!currentSrc) {
    return (
      <div
        className={cn(
          className,
          "flex items-center justify-center bg-white/10 text-[10px] font-semibold text-white backdrop-blur-md"
        )}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (index < candidates.length - 1) {
          setIndex((prev) => prev + 1);
        } else {
          setIndex(candidates.length);
        }
      }}
    />
  );
}

function InvestorStack({
  totalInvestor,
  avatars = [],
}: {
  totalInvestor: number;
  avatars?: string[];
}) {
  if (totalInvestor <= 0) return null;

  const safeAvatars = avatars.filter(Boolean);
  const visible =
    totalInvestor > 4 ? safeAvatars.slice(0, 3) : safeAvatars.slice(0, 4);
  const overflow = totalInvestor > 4 ? totalInvestor - 3 : 0;

  return (
    <div className="flex items-center">
      {visible.map((src, index) => (
        <SmartAvatar
          key={`${src}-${index}`}
          src={src}
          alt={`Investor ${index + 1}`}
          fallbackText={`Investor ${index + 1}`}
          className={cn(
            "h-9 w-9 rounded-full border border-white/20 object-cover shadow-[0_12px_28px_rgba(0,0,0,0.38)] ring-1 ring-black/20",
            index !== 0 && "-ml-2.5"
          )}
        />
      ))}

      {overflow > 0 ? (
        <div className="-ml-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[10px] font-semibold text-white backdrop-blur-md">
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}

function InfoChip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "emerald" | "sky" | "violet";
}) {
  const toneMap = {
    default: "border-white/15 bg-black/25 text-white/85",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    sky: "border-sky-400/20 bg-sky-400/10 text-sky-100",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-100",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] backdrop-blur-md",
        toneMap[tone]
      )}
    >
      {children}
    </span>
  );
}

function MetricPanel({
  label,
  value,
  helper,
  accent = "default",
}: {
  label: string;
  value: string;
  helper: string;
  accent?: "default" | "emerald" | "sky" | "violet";
}) {
  const panelMap = {
    default:
      "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%)]",
    emerald:
      "border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.10)_0%,rgba(16,185,129,0.04)_100%)]",
    sky: "border-sky-400/15 bg-[linear-gradient(180deg,rgba(56,189,248,0.10)_0%,rgba(56,189,248,0.04)_100%)]",
    violet:
      "border-violet-400/15 bg-[linear-gradient(180deg,rgba(139,92,246,0.10)_0%,rgba(139,92,246,0.04)_100%)]",
  };

  const valueMap = {
    default: "text-white",
    emerald: "text-emerald-200",
    sky: "text-sky-100",
    violet: "text-violet-100",
  };

  return (
    <div
      className={cn(
        "rounded-[24px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        panelMap[accent]
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p
        className={cn(
          "mt-2 text-[clamp(22px,3vw,34px)] font-semibold leading-none tracking-[-0.045em]",
          valueMap[accent]
        )}
      >
        {value}
      </p>

      <p className="mt-2 text-sm leading-5 text-slate-400">{helper}</p>
    </div>
  );
}

function FundingPanel({
  progress,
  totalPendanaan,
  targetPendanaan,
  sisaPendanaan,
  investor,
}: {
  progress: number;
  totalPendanaan: number;
  targetPendanaan: number;
  sisaPendanaan: number;
  investor: number;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.018)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Funding Progress
          </p>

          <div className="mt-2 flex items-end gap-2">
            <p className="text-[clamp(32px,4vw,44px)] font-semibold leading-none tracking-[-0.05em] text-white">
              {progress}%
            </p>

            <span className="mb-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-emerald-200">
              ACTIVE
            </span>
          </div>
        </div>

        <div
          className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-right"
          title={formatCurrency(sisaPendanaan)}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Sisa Target
          </p>
          <p className="mt-1.5 text-base font-semibold text-emerald-300">
            {formatCompactIDR(sisaPendanaan)}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/7">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#10b981_0%,#34d399_40%,#7dd3fc_100%)] shadow-[0_0_18px_rgba(52,211,153,0.45)] transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div title={formatCurrency(totalPendanaan)}>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Raised
          </p>
          <p className="mt-1.5 text-base font-semibold text-white">
            {formatCompactIDR(totalPendanaan)}
          </p>
        </div>

        <div className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Investor
          </p>
          <p className="mt-1.5 text-base font-semibold text-white">
            {investor}
          </p>
        </div>

        <div className="text-right" title={formatCurrency(targetPendanaan)}>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Target
          </p>
          <p className="mt-1.5 text-base font-semibold text-white">
            {formatCompactIDR(targetPendanaan)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ProjectFundraisingCard({
  project,
  adminMode = false,
}: {
  project: ProjectCampaign;
  adminMode?: boolean;
}) {
  const progress = getProgress(project);
  const roi = getROI(project);
  const exitMonths = resolveEstimasiSelesaiBulan(project);
  const sisaPendanaan = Math.max(
    0,
    project.targetPendanaan - project.totalPendanaan
  );
  const statusTone = getStatusTone(project.status);

  const detailHref = `/dashboard/project/detail_transaksi/${encodeURIComponent(
    project.id
  )}`;
  const manageFundHref = `${detailHref}/arus_kas`;

  return (
    <article className="group relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,#08111d_0%,#050a12_100%)] shadow-[0_28px_90px_rgba(0,0,0,0.42)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_34px_110px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_22%)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[33px] border border-white/5" />

      <div className="relative h-[290px] overflow-hidden">
        <SmartImage
          src={project.thumbnail}
          alt={project.nama}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]"
        />

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,16,0.08)_0%,rgba(5,9,16,0.18)_22%,rgba(5,9,16,0.58)_64%,rgba(5,9,16,0.94)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_100%)]" />

        <div className="absolute left-5 right-5 top-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] backdrop-blur-md",
                statusTone.pill
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", statusTone.dot)} />
              {project.status}
            </span>

            <InfoChip>
              {project.jenisPendanaan === "tertutup"
                ? "PRIVATE ACCESS"
                : `${project.hariTersisa} HARI LAGI`}
            </InfoChip>
          </div>

          <InfoChip tone="default">ASSET BACKED</InfoChip>
        </div>

        <div className="absolute bottom-5 left-5 right-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
            {project.id}
          </p>

          <div className="mt-2 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h3 className="max-w-[90%] text-[28px] font-semibold leading-[1.02] tracking-[-0.05em] text-white">
                {project.nama}
              </h3>
              <p className="mt-3 text-sm text-white/65">{project.lokasi}</p>
            </div>

            <InvestorStack
              totalInvestor={project.investor}
              avatars={project.avatarInvestor}
            />
          </div>
        </div>
      </div>

      <div className="relative p-5">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.035] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <p className="text-[11px] leading-5 text-slate-300">
            Peluang fundraising properti dengan momentum pendanaan yang sudah
            terbentuk, return yang kuat, dan horizon exit yang tetap jelas.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricPanel
            label="Estimasi ROI"
            value={formatPercent(roi)}
            helper={`Estimasi laba bersih ${formatCurrency(
              project.estimasiProfit
            )}`}
            accent="emerald"
          />

          <MetricPanel
            label="Estimasi Exit"
            value={`${exitMonths} bln`}
            helper={project.estimasiExit || "Horizon exit terukur"}
            accent="sky"
          />
        </div>

        <div className="mt-4">
          <FundingPanel
            progress={progress}
            totalPendanaan={project.totalPendanaan}
            targetPendanaan={project.targetPendanaan}
            sisaPendanaan={sisaPendanaan}
            investor={project.investor}
          />
        </div>

        <div className="mt-4 rounded-[24px] border border-violet-400/15 bg-[linear-gradient(180deg,rgba(139,92,246,0.10)_0%,rgba(139,92,246,0.04)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Estimasi Harga Jual
              </p>
              <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.04em] text-violet-100">
                {formatCurrency(project.estimasiHargaJual)}
              </p>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Premium Asset
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
  <Link
    href={detailHref}
    onClick={() => console.log("DETAIL CLICK", detailHref)}
    className="flex-1 rounded-[20px] bg-[linear-gradient(135deg,#e7ffe9_0%,#a7f3d0_42%,#34d399_100%)] px-5 py-3.5 text-center text-sm font-semibold text-[#04110a] shadow-[0_18px_34px_rgba(52,211,153,0.28)] transition duration-200 hover:brightness-105 active:scale-[0.99]"
  >
    Lihat Detail
  </Link>

  {adminMode ? (
    <Link
      href={manageFundHref}
      onClick={() => console.log("MANAGE CLICK", manageFundHref)}
      className="flex-1 rounded-[20px] border border-white/15 bg-white/[0.04] px-5 py-3.5 text-center text-sm font-semibold text-white backdrop-blur-md transition duration-200 hover:bg-white/[0.07] active:scale-[0.99]"
    >
      Manage Fund
    </Link>
  ) : null}
</div>
      </div>
    </article>
  );
}
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type UserInvestment = {
  nominalKomitmen: number;
  persentaseKepemilikan?: number | null;
  status: "lunas" | "menunggu_pembayaran" | string;
  updatedAt?: string | null;
} | null;

type ProjectSelesai = {
  id_project: string;
  id_listing: number | string;
  tanggal_pembelian?: string | Date | null;
  tanggal_terjual: string | Date;
  durasi_hari: number;
  harga_jual: number;
  total_biaya_akuisisi: number;
  profit_kotor: number;
  pph_percent: number;
  ajb_percent: number;
  agent_fee_percent: number;
  total_biaya_transaksi: number;
  profit_bersih: number;
  roi_bersih: number;
  dibuat_tanggal?: string | Date;
  diupdate_tanggal?: string | Date;
};

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
  userInvestment?: UserInvestment;
  projectSelesai?: ProjectSelesai | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(toNumber(value))
    .replace(/\s/g, " ");
}

function formatCompactIDR(value: number) {
  const safe = toNumber(value);
  const abs = Math.abs(safe);

  if (abs >= 1_000_000_000) {
    return `Rp ${(safe / 1_000_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} M`;
  }

  if (abs >= 1_000_000) {
    return `Rp ${(safe / 1_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} Jt`;
  }

  return formatCurrency(safe);
}

function formatPercent(value: number, max = 1) {
  const safe = toNumber(value);
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: safe % 1 === 0 ? 0 : Math.min(max, 1),
    maximumFractionDigits: max,
  }).format(safe)}%`;
}

function formatDurationDetailedParts(days: number) {
  const safe = Math.max(0, Math.round(toNumber(days)));
  const months = Math.floor(safe / 30);
  const remainingDays = safe % 30;
  return { months, days: remainingDays };
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

function getImageCandidates(url?: string | null, size = 800): string[] {
  if (!url) return [];

  const trimmed = String(url).trim();
  if (!trimmed) return [];

  const driveId = extractGoogleDriveId(trimmed);

  if (driveId) {
    return [`/api/drive-image?id=${driveId}&sz=w${size}`];
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
  if (toNumber(project.targetPendanaan) <= 0) return 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (toNumber(project.totalPendanaan) / toNumber(project.targetPendanaan)) *
          100
      )
    )
  );
}

function getProjectedROI(project: ProjectCampaign) {
  if (toNumber(project.targetPendanaan) <= 0) return 0;

  return Math.max(
    0,
    Number(
      (
        (toNumber(project.estimasiProfit) / toNumber(project.targetPendanaan)) *
        100
      ).toFixed(1)
    )
  );
}

function getStatusTone(status: string, isSold?: boolean) {
  if (isSold) {
    return {
      pill: "border-violet-400/20 bg-violet-400/12 text-violet-100",
      dot: "bg-violet-300 shadow-[0_0_14px_rgba(196,181,253,0.95)]",
    };
  }

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

function getPaymentTone(status?: string | null, isSold?: boolean) {
  const value = String(status || "").toLowerCase();

  if (isSold) {
    return {
      wrap: "border-violet-400/18 bg-[linear-gradient(135deg,rgba(139,92,246,0.12)_0%,rgba(99,102,241,0.05)_50%,rgba(15,23,42,0.02)_100%)]",
      amount: "text-violet-100",
      statusBadge:
        "border-violet-400/20 bg-violet-400/10 text-violet-100",
      ownershipBadge:
        "border-white/12 bg-white/[0.05] text-white/85",
      glow: "from-violet-400/12 via-fuchsia-300/0 to-transparent",
    };
  }

  if (value === "lunas") {
    return {
      wrap: "border-emerald-400/16 bg-[linear-gradient(135deg,rgba(16,185,129,0.10)_0%,rgba(16,185,129,0.04)_45%,rgba(6,78,59,0.04)_100%)]",
      amount: "text-emerald-200",
      statusBadge:
        "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
      ownershipBadge:
        "border-white/12 bg-white/[0.05] text-white/80",
      glow: "from-emerald-400/10 via-emerald-300/0 to-transparent",
    };
  }

  if (value.includes("menunggu")) {
    return {
      wrap: "border-amber-400/16 bg-[linear-gradient(135deg,rgba(245,158,11,0.11)_0%,rgba(245,158,11,0.05)_45%,rgba(120,53,15,0.04)_100%)]",
      amount: "text-amber-100",
      statusBadge:
        "border-amber-400/20 bg-amber-400/10 text-amber-100",
      ownershipBadge:
        "border-white/12 bg-white/[0.05] text-white/80",
      glow: "from-amber-300/10 via-amber-200/0 to-transparent",
    };
  }

  return {
    wrap: "border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.025)_100%)]",
    amount: "text-white",
    statusBadge: "border-white/15 bg-white/[0.06] text-white/85",
    ownershipBadge: "border-white/12 bg-white/[0.05] text-white/80",
    glow: "from-white/10 via-white/0 to-transparent",
  };
}

function getGrowthTone(percent: number) {
  if (percent < 0) {
    return {
      wrap: "border-rose-400/25 bg-rose-400/12 text-rose-100",
      icon: "text-rose-200",
      down: true,
    };
  }

  if (percent <= 20) {
    return {
      wrap: "border-amber-300/25 bg-amber-300/12 text-amber-100",
      icon: "text-amber-200",
      down: false,
    };
  }

  if (percent <= 45) {
    return {
      wrap: "border-sky-400/25 bg-sky-400/12 text-sky-100",
      icon: "text-sky-200",
      down: false,
    };
  }

  return {
    wrap: "border-emerald-400/25 bg-emerald-400/12 text-emerald-100",
    icon: "text-emerald-200",
    down: false,
  };
}

function SmartImage({
  src,
  alt,
  className,
  size = 800,
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
  compactValue = false,
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
  accent?: "default" | "emerald" | "sky" | "violet";
  compactValue?: boolean;
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
        "min-h-[114px] rounded-[24px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        panelMap[accent]
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <div
        className={cn(
          "mt-2 font-semibold leading-none tracking-[-0.045em]",
          compactValue ? "text-[clamp(18px,2.2vw,28px)]" : "text-[clamp(22px,3vw,34px)]",
          valueMap[accent]
        )}
      >
        {value}
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-400">
        {helper}
      </p>
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

function getActualInvestorProfit(
  investment: UserInvestment,
  projectSelesai?: ProjectSelesai | null
) {
  if (!investment || !projectSelesai) return 0;

  const modal = toNumber(investment.nominalKomitmen);
  const roiAktual = toNumber(projectSelesai.roi_bersih);
  const porsi = toNumber(investment.persentaseKepemilikan);

  if (porsi > 0) {
    return Number(
      ((toNumber(projectSelesai.profit_bersih) * porsi) / 100).toFixed(0)
    );
  }

  return Number(((modal * roiAktual) / 100).toFixed(0));
}

function UserInvestmentPanel({
    investment,
    projectSelesai,
  }: {
    investment?: UserInvestment;
    projectSelesai?: ProjectSelesai | null;
  }) {
    const isSold = !!projectSelesai;
  
    if (!investment) {
      return (
        <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] text-white/75 backdrop-blur-md">
              BELUM ADA KOMITMEN
            </span>
          </div>
  
          <p className="mt-4 text-[clamp(28px,4vw,38px)] font-semibold leading-none tracking-[-0.06em] text-white">
            Rp 0
          </p>
        </div>
      );
    }
  
    const tone = getPaymentTone(investment.status, isSold);
  
    const ownership =
      typeof investment.persentaseKepemilikan === "number" &&
      Number.isFinite(investment.persentaseKepemilikan)
        ? `${new Intl.NumberFormat("id-ID", {
            minimumFractionDigits:
              investment.persentaseKepemilikan % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2,
          }).format(investment.persentaseKepemilikan)}%`
        : null;
  
    if (isSold && projectSelesai) {
      const modalAwal = toNumber(investment.nominalKomitmen);
      const profitInvestor = getActualInvestorProfit(investment, projectSelesai);
      const modalAkhir = modalAwal + profitInvestor;
      const growthPercent =
        modalAwal > 0 ? Number(((profitInvestor / modalAwal) * 100).toFixed(1)) : 0;
      const growthTone = getGrowthTone(growthPercent);
  
      return (
        <div
          className={cn(
            "relative overflow-hidden rounded-[24px] border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
            tone.wrap
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 bg-gradient-to-r opacity-100",
              tone.glow
            )}
          />
  
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] backdrop-blur-md",
                  tone.statusBadge
                )}
              >
                INVESTASI SAYA
              </span>
  
              {ownership ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] backdrop-blur-md",
                    tone.ownershipBadge
                  )}
                >
                  PORSI {ownership}
                </span>
              ) : null}
  
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] backdrop-blur-md",
                  growthTone.wrap
                )}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn("h-3.5 w-3.5", growthTone.icon)}
                >
                  {growthTone.down ? (
                    <path d="M12 5v14m0 0-6-6m6 6 6-6" />
                  ) : (
                    <path d="M12 19V5m0 0-6 6m6-6 6 6" />
                  )}
                </svg>
                {formatPercent(Math.abs(growthPercent))}
              </span>
            </div>
  
            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="min-w-0">
                <p className="text-[clamp(28px,4vw,38px)] font-semibold leading-none tracking-[-0.06em] text-white/92">
                  {formatCompactIDR(modalAwal)}
                </p>
              </div>
  
              <div className="text-white/35">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7"
                >
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </div>
  
              <div className="min-w-0 text-right">
                <p
                  className={cn(
                    "text-[clamp(28px,4vw,38px)] font-semibold leading-none tracking-[-0.06em]",
                    tone.amount
                  )}
                >
                  {formatCompactIDR(modalAkhir)}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
  
    return (
      <div
        className={cn(
          "relative min-h-[110px] overflow-hidden rounded-[24px] border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
          tone.wrap
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-r opacity-100",
            tone.glow
          )}
        />
  
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] backdrop-blur-md",
                tone.statusBadge
              )}
            >
              {String(investment.status).replace(/_/g, " ").toUpperCase()}
            </span>
  
            {ownership ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] backdrop-blur-md",
                  tone.ownershipBadge
                )}
              >
                PORSI {ownership}
              </span>
            ) : null}
          </div>
  
          <p
            className={cn(
              "mt-3 text-[clamp(28px,4vw,38px)] font-semibold leading-none tracking-[-0.06em]",
              tone.amount
            )}
          >
            {formatCurrency(investment.nominalKomitmen)}
          </p>
        </div>
      </div>
    );
  }

function SoldFundingPanel({
  projectSelesai,
}: {
  projectSelesai: ProjectSelesai;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.018)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Hasil Aktual
          </p>

          <div className="mt-2 flex items-end gap-2">
            <p className="text-[clamp(32px,4vw,44px)] font-semibold leading-none tracking-[-0.05em] text-white">
              {formatCurrency(projectSelesai.profit_bersih)}
            </p>

            <span className="mb-1 rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-violet-100">
              REALIZED
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/7">
        <div className="h-full w-full rounded-full bg-[linear-gradient(90deg,#8b5cf6_0%,#a78bfa_55%,#c4b5fd_100%)] shadow-[0_0_18px_rgba(167,139,250,0.35)]" />
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Biaya Akuisisi
          </p>
          <p className="mt-1.5 text-base font-semibold text-white">
            {formatCompactIDR(projectSelesai.total_biaya_akuisisi)}
          </p>
        </div>

        <div className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Biaya Transaksi
          </p>
          <p className="mt-1.5 text-base font-semibold text-white">
            {formatCompactIDR(projectSelesai.total_biaya_transaksi)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Profit Bersih
          </p>
          <p className="mt-1.5 text-base font-semibold text-white">
            {formatCurrency(projectSelesai.profit_bersih)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ProjectFundraisingCard({
  project,
  adminMode = false,
  isDeleting = false,
  onDelete,
}: {
  project: ProjectCampaign;
  adminMode?: boolean;
  isDeleting?: boolean;
  onDelete?: (project: ProjectCampaign) => void | Promise<void>;
}) {
  const isSold = !!project.projectSelesai;
  const progress = getProgress(project);
  const projectedRoi = getProjectedROI(project);
  const exitMonths = resolveEstimasiSelesaiBulan(project);
  const sisaPendanaan = Math.max(
    0,
    toNumber(project.targetPendanaan) - toNumber(project.totalPendanaan)
  );
  const statusTone = getStatusTone(project.status, isSold);

  const detailHref = `/dashboard/project/detail_transaksi/${encodeURIComponent(
    project.id
  )}`;
  const manageFundHref = `${detailHref}/arus_kas`;

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDeleting || !onDelete) return;
    void onDelete(project);
  };

  const durasiActualParts = project.projectSelesai
    ? formatDurationDetailedParts(project.projectSelesai.durasi_hari)
    : null;

  return (
    <article className="group relative h-fit self-start overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,#08111d_0%,#050a12_100%)] shadow-[0_28px_90px_rgba(0,0,0,0.42)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_34px_110px_rgba(0,0,0,0.5)]">
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          isSold
            ? "bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_22%)]"
            : "bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_22%)]"
        )}
      />
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
              {isSold ? "SUDAH TERJUAL" : project.status}
            </span>

            {isSold ? (
              <InfoChip tone="violet">ACTUAL PERFORMANCE</InfoChip>
            ) : (
              <InfoChip>
                {project.jenisPendanaan === "tertutup"
                  ? "PRIVATE ACCESS"
                  : `${project.hariTersisa} HARI LAGI`}
              </InfoChip>
            )}
          </div>

          {adminMode ? (
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isDeleting || !onDelete}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] backdrop-blur-md transition",
                "border-rose-400/25 bg-rose-400/10 text-rose-100",
                "hover:bg-rose-400/15 hover:text-white",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
              title={`Hapus project ${project.nama}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4.75A1.75 1.75 0 0 1 9.75 3h4.5A1.75 1.75 0 0 1 16 4.75V6" />
                <path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>

              {isDeleting ? "DELETING..." : "DELETE"}
            </button>
          ) : (
            <InfoChip tone={isSold ? "violet" : "default"}>
              {isSold ? "REALIZED ASSET" : "ASSET BACKED"}
            </InfoChip>
          )}
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
        <UserInvestmentPanel
          investment={project.userInvestment}
          projectSelesai={project.projectSelesai}
        />

        {isSold && project.projectSelesai ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricPanel
                label="ROI Aktual"
                value={formatPercent(project.projectSelesai.roi_bersih)}
                helper="Return bersih yang sudah terealisasi"
                accent="emerald"
              />

              <MetricPanel
                label="Durasi Aktual"
                value={
                  <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
                    <span>{durasiActualParts?.months ?? 0}</span>
                    <span className="text-[0.62em] font-medium tracking-[-0.01em] opacity-90">
                      bulan
                    </span>
                    <span>{durasiActualParts?.days ?? 0}</span>
                    <span className="text-[0.62em] font-medium tracking-[-0.01em] opacity-90">
                      hari
                    </span>
                  </span>
                }
                helper="Durasi real project hingga terjual"
                accent="sky"
                compactValue
              />
            </div>

            <div className="mt-4">
              <SoldFundingPanel projectSelesai={project.projectSelesai} />
            </div>

            <div className="mt-4 rounded-[24px] border border-violet-400/15 bg-[linear-gradient(180deg,rgba(139,92,246,0.10)_0%,rgba(139,92,246,0.04)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Harga Jual Aktual
                  </p>
                  <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.04em] text-violet-100">
                    {formatCurrency(project.projectSelesai.harga_jual)}
                  </p>
                </div>

                <div className="rounded-full border border-violet-400/18 bg-violet-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-100">
                  Closed Deal
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricPanel
                label="Estimasi ROI"
                value={formatPercent(projectedRoi)}
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
                totalPendanaan={toNumber(project.totalPendanaan)}
                targetPendanaan={toNumber(project.targetPendanaan)}
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
          </>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href={detailHref}
            className={cn(
              "flex-1 rounded-[20px] px-5 py-3.5 text-center text-sm font-semibold transition duration-200 active:scale-[0.99]",
              isSold
                ? "bg-[linear-gradient(135deg,#f3e8ff_0%,#ddd6fe_45%,#a78bfa_100%)] text-[#12091f] shadow-[0_18px_34px_rgba(167,139,250,0.28)] hover:brightness-105"
                : "bg-[linear-gradient(135deg,#e7ffe9_0%,#a7f3d0_42%,#34d399_100%)] text-[#04110a] shadow-[0_18px_34px_rgba(52,211,153,0.28)] hover:brightness-105"
            )}
          >
            {isSold ? "Lihat Hasil Aktual" : "Lihat Detail"}
          </Link>

          {adminMode ? (
            <Link
              href={manageFundHref}
              className="flex-1 rounded-[20px] border border-white/15 bg-white/[0.04] px-5 py-3.5 text-center text-sm font-semibold text-white backdrop-blur-md transition duration-200 hover:bg-white/[0.07] active:scale-[0.99]"
            >
              {isSold ? "Lihat Arus Kas" : "Kelola Dana"}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
"use client";

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
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\s/g, " ");
}

function formatSmartCurrency(value: number) {
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

  if (isLikelyGoogleDriveId(rawUrl)) {
    return rawUrl;
  }

  return null;
}

function getImageCandidates(url?: string | null, size = 200): string[] {
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

  if (trimmed.startsWith("//")) {
    return [`https:${trimmed}`];
  }

  if (trimmed.startsWith("/")) {
    return [trimmed];
  }

  return [];
}

function getPrimaryImage(url?: string | null, size = 1200) {
  const candidates = getImageCandidates(url, size);
  return candidates[0] || "";
}

function getStatusStyle(status: string) {
  const value = status.toLowerCase();

  if (value.includes("tertutup")) {
    return {
      pill: "border-sky-400/25 bg-sky-400/10 text-sky-200",
      dot: "bg-sky-300",
    };
  }

  if (value.includes("pendanaan")) {
    return {
      pill: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
      dot: "bg-emerald-300",
    };
  }

  if (value.includes("renovasi")) {
    return {
      pill: "border-amber-400/25 bg-amber-400/10 text-amber-200",
      dot: "bg-amber-300",
    };
  }

  if (value.includes("dokumen") || value.includes("eksekusi")) {
    return {
      pill: "border-sky-400/25 bg-sky-400/10 text-sky-200",
      dot: "bg-sky-300",
    };
  }

  if (value.includes("jual")) {
    return {
      pill: "border-violet-400/25 bg-violet-400/10 text-violet-200",
      dot: "bg-violet-300",
    };
  }

  return {
    pill: "border-white/15 bg-white/[0.06] text-slate-200",
    dot: "bg-slate-300",
  };
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
        className={`${className} flex items-center justify-center bg-white/10 text-[11px] font-semibold text-white backdrop-blur-md`}
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
  const visibleAvatars =
    totalInvestor > 4 ? safeAvatars.slice(0, 3) : safeAvatars.slice(0, 4);

  const overflow = totalInvestor > 4 ? totalInvestor - 3 : 0;

  return (
    <div className="flex shrink-0 items-center">
      {visibleAvatars.map((src, index) => (
        <SmartAvatar
          key={`${src}-${index}`}
          src={src}
          alt={`Investor ${index + 1}`}
          fallbackText={`Investor ${index + 1}`}
          size={120}
          className={`h-9 w-9 rounded-full border border-white/20 object-cover shadow-[0_8px_18px_rgba(0,0,0,0.28)] sm:h-10 sm:w-10 ${
            index === 0 ? "" : "-ml-2.5"
          }`}
        />
      ))}

      {overflow > 0 ? (
        <div className="-ml-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[11px] font-semibold text-white backdrop-blur-md sm:h-10 sm:w-10">
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}

function HorizontalInfoRow({
  label,
  badge,
  value,
  helper,
  accent = "default",
}: {
  label: string;
  badge?: string;
  value: string;
  helper?: string;
  accent?: "default" | "emerald" | "sky" | "violet";
}) {
  const toneMap = {
    default: "border-white/10 bg-white/[0.04]",
    emerald: "border-emerald-400/15 bg-emerald-400/[0.05]",
    sky: "border-sky-400/15 bg-sky-400/[0.05]",
    violet: "border-violet-400/15 bg-violet-400/[0.05]",
  };

  const valueMap = {
    default: "text-white",
    emerald: "text-emerald-300",
    sky: "text-sky-200",
    violet: "text-violet-200",
  };

  const badgeMap = {
    default: "border-white/10 bg-white/[0.05] text-white/75",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    sky: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  };

  return (
    <div
      className={`rounded-[18px] border p-4 backdrop-blur-xl ${toneMap[accent]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-medium tracking-[0.08em] text-slate-500">
          {label}
        </p>

        {badge ? (
          <>
            <span className="text-slate-600">|</span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] ${badgeMap[accent]}`}
            >
              {badge}
            </span>
          </>
        ) : null}
      </div>

      <p
        className={`mt-3 break-words text-[clamp(20px,2.3vw,28px)] font-semibold leading-tight tracking-[-0.025em] ${valueMap[accent]}`}
      >
        {value}
      </p>

      <div className="mt-3 border-t border-white/8 pt-3">
        <p className="text-sm leading-5 text-slate-400">{helper}</p>
      </div>
    </div>
  );
}

export default function ProjectCampaignCard({
  project,
}: {
  project: ProjectCampaign;
}) {
  const progress =
    project.targetPendanaan > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round((project.totalPendanaan / project.targetPendanaan) * 100)
          )
        )
      : 0;

  const roiPersen =
    project.targetPendanaan > 0
      ? Math.max(
          0,
          Number(
            ((project.estimasiProfit / project.targetPendanaan) * 100).toFixed(1)
          )
        )
      : 0;

  const sisaPendanaan = Math.max(
    0,
    project.targetPendanaan - project.totalPendanaan
  );

  const estimasiSelesaiBulan = resolveEstimasiSelesaiBulan(project);
  const statusStyle = getStatusStyle(project.status);
  const thumbnailUrl = getPrimaryImage(project.thumbnail, 1200) || project.thumbnail;

  return (
    <article className="group relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#08111c_0%,#050b14_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_70px_rgba(0,0,0,0.34)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.06),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[29px] border border-white/5" />

      <div className="relative h-[220px] overflow-hidden sm:h-[250px] lg:h-[270px]">
        <img
          src={thumbnailUrl}
          alt={project.nama}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,18,0.10)_0%,rgba(4,10,18,0.18)_24%,rgba(4,10,18,0.52)_58%,rgba(4,10,18,0.92)_100%)]" />

        <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center gap-2 sm:left-5 sm:right-5 sm:top-5">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] backdrop-blur-md ${statusStyle.pill}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />
            {project.status}
          </span>

          {project.jenisPendanaan === "terbuka" ? (
            <span className="inline-flex items-center rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/80 backdrop-blur-md">
              {project.hariTersisa} hari lagi
            </span>
          ) : null}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
          <p className="mb-2 text-[10px] font-medium tracking-[0.18em] text-white/40">
            {project.id}
          </p>

          <h3 className="max-w-[90%] text-[24px] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-[28px] lg:text-[30px]">
            {project.nama}
          </h3>

          <div className="mt-3 flex items-end justify-between gap-4">
            <p className="min-w-0 text-sm text-white/68 sm:text-[15px]">
              {project.lokasi}
            </p>

            <InvestorStack
              totalInvestor={project.investor}
              avatars={project.avatarInvestor}
            />
          </div>
        </div>
      </div>

      <div className="relative p-4 sm:p-5 lg:p-6">
        <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,28,0.96)_0%,rgba(8,13,22,0.98)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
          <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-[0.08em] text-slate-500">
                  Funding Progress
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <p className="text-[clamp(28px,4vw,40px)] font-semibold leading-none tracking-[-0.04em] text-white">
                    {progress}%
                  </p>

                  <span className="mb-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-emerald-200">
                    LIVE
                  </span>
                </div>
              </div>

              <div
                className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-md sm:min-w-[220px]"
                title={formatCurrency(sisaPendanaan)}
              >
                <p className="text-[10px] font-medium tracking-[0.12em] text-slate-500">
                  Sisa menuju target
                </p>
                <p className="mt-2 text-base font-semibold text-emerald-300">
                  {formatSmartCurrency(sisaPendanaan)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  dana belum terpenuhi
                </p>
              </div>
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#10b981_0%,#34d399_55%,#67e8f9_100%)] transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-4 flex items-start justify-between gap-4">
              <div
                className="min-w-0"
                title={formatCurrency(project.totalPendanaan)}
              >
                <p className="text-[10px] font-medium tracking-[0.12em] text-slate-500">
                  Terkumpul
                </p>
                <p className="mt-1.5 text-base font-semibold text-white sm:text-lg">
                  {formatSmartCurrency(project.totalPendanaan)}
                </p>
              </div>

              <div
                className="min-w-0 text-right"
                title={formatCurrency(project.targetPendanaan)}
              >
                <p className="text-[10px] font-medium tracking-[0.12em] text-slate-500">
                  Target
                </p>
                <p className="mt-1.5 text-base font-semibold text-white sm:text-lg">
                  {formatSmartCurrency(project.targetPendanaan)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <HorizontalInfoRow
              label="Estimasi Imbal Hasil"
              badge={formatPercent(roiPersen)}
              value={formatCurrency(project.estimasiProfit)}
              helper={`Perkiraan keuntungan bersih proyek dengan ROI sekitar ${formatPercent(
                roiPersen
              )}.`}
              accent="emerald"
            />

            <HorizontalInfoRow
              label="Perkiraan Selesai"
              value={`${estimasiSelesaiBulan} Bulan`}
              helper="Estimasi durasi penyelesaian proyek hingga siap masuk fase exit."
              accent="sky"
            />

            <HorizontalInfoRow
              label="Estimasi Harga Jual"
              value={formatCurrency(project.estimasiHargaJual)}
              helper={`Proyeksi nilai jual akhir sekitar ${formatSmartCurrency(
                project.estimasiHargaJual
              )}.`}
              accent="violet"
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
            <button className="flex-1 rounded-[18px] bg-[linear-gradient(135deg,#dcfce7_0%,#86efac_45%,#34d399_100%)] px-5 py-3 text-sm font-semibold text-[#04110a] shadow-[0_14px_30px_rgba(52,211,153,0.20)] transition duration-200 hover:brightness-105 active:scale-[0.99]">
              Lihat Detail
            </button>

            <button className="flex-1 rounded-[18px] border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition duration-200 hover:bg-white/[0.07] active:scale-[0.99]">
              Manage Fund
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
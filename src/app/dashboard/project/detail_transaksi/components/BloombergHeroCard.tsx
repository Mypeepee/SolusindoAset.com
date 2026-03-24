import Link from "next/link";
import type {
  NullableDate,
  ProjectDetailViewModel,
  ProjectStatus,
} from "./types";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  cn,
  compactIDR,
  formatDate,
  formatMultiple,
  formatPercent,
  getInitials,
  getLocation,
  normalizeImage,
  safeDivide,
  toNumber,
} from "./utils";
import { ArrowLeft, CalendarDays, Clock3, MapPin } from "lucide-react";

type Tone = "amber" | "emerald" | "cyan" | "fuchsia" | "rose" | "slate";

const TONE_STYLES: Record<
  Tone,
  {
    text: string;
    border: string;
    softBg: string;
    glow: string;
    dot: string;
    progress: string;
    line: string;
  }
> = {
  amber: {
    text: "text-amber-200",
    border: "border-amber-300/20",
    softBg: "bg-amber-400/10",
    glow: "bg-amber-300/18",
    dot: "bg-amber-300",
    progress: "from-amber-400 via-amber-300 to-lime-300",
    line: "from-amber-300/80 via-amber-200/30 to-transparent",
  },
  emerald: {
    text: "text-emerald-200",
    border: "border-emerald-300/20",
    softBg: "bg-emerald-400/10",
    glow: "bg-emerald-300/18",
    dot: "bg-emerald-300",
    progress: "from-emerald-400 via-emerald-300 to-cyan-300",
    line: "from-emerald-300/80 via-emerald-200/30 to-transparent",
  },
  cyan: {
    text: "text-cyan-200",
    border: "border-cyan-300/20",
    softBg: "bg-cyan-400/10",
    glow: "bg-cyan-300/18",
    dot: "bg-cyan-300",
    progress: "from-sky-400 via-cyan-300 to-indigo-300",
    line: "from-cyan-300/80 via-cyan-200/30 to-transparent",
  },
  fuchsia: {
    text: "text-fuchsia-200",
    border: "border-fuchsia-300/20",
    softBg: "bg-fuchsia-400/10",
    glow: "bg-fuchsia-300/18",
    dot: "bg-fuchsia-300",
    progress: "from-fuchsia-400 via-violet-300 to-pink-300",
    line: "from-fuchsia-300/80 via-fuchsia-200/30 to-transparent",
  },
  rose: {
    text: "text-rose-200",
    border: "border-rose-300/20",
    softBg: "bg-rose-400/10",
    glow: "bg-rose-300/18",
    dot: "bg-rose-300",
    progress: "from-rose-400 via-rose-300 to-orange-300",
    line: "from-rose-300/80 via-rose-200/30 to-transparent",
  },
  slate: {
    text: "text-slate-200",
    border: "border-white/10",
    softBg: "bg-white/[0.06]",
    glow: "bg-white/10",
    dot: "bg-slate-300",
    progress: "from-slate-300 via-slate-200 to-white",
    line: "from-slate-300/80 via-slate-200/30 to-transparent",
  },
};

const STATUS_TONE: Record<ProjectStatus, Tone> = {
  pendanaan_terbuka: "amber",
  pendanaan_penuh: "amber",
  pengurusan_dokumen: "cyan",
  eksekusi_pengosongan: "cyan",
  renovasi: "cyan",
  sedang_dijual: "emerald",
  terjual: "emerald",
  dibatalkan: "rose",
};

function resolveDate(value?: NullableDate) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonthsSafe(date: Date, months: number) {
  const next = new Date(date);
  const originalDay = next.getDate();

  next.setDate(1);
  next.setMonth(next.getMonth() + months);

  const lastDayOfTargetMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0
  ).getDate();

  next.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return next;
}

function formatRelativeDays(days: number) {
  const safeDays = Math.max(0, days);
  const months = Math.floor(safeDays / 30);
  const remainderDays = safeDays % 30;

  if (months > 0 && remainderDays > 0) {
    return `${months} bulan ${remainderDays} hari`;
  }

  if (months > 0) {
    return `${months} bulan`;
  }

  return `${remainderDays} hari`;
}

function getTimelineMeta(
  startDate?: NullableDate,
  purchaseDate?: NullableDate,
  estimatedMonths?: number | string | null
) {
  const baseDate = resolveDate(startDate) ?? resolveDate(purchaseDate);
  const months = Math.max(0, Math.round(toNumber(estimatedMonths)));

  if (!baseDate || !months) {
    return {
      headline: "Belum diatur",
      subline: "Timeline belum lengkap",
      deadlineLabel: "—",
      progress: undefined as number | undefined,
      tone: "slate" as Tone,
    };
  }

  const deadline = addMonthsSafe(baseDate, months);
  const now = new Date();

  const totalMs = deadline.getTime() - baseDate.getTime();
  const elapsedMs = now.getTime() - baseDate.getTime();
  const progress =
    totalMs > 0 ? Math.max(0, Math.min(1, elapsedMs / totalMs)) : undefined;

  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 0) {
    return {
      headline: `${formatRelativeDays(diffDays)} lagi`,
      subline: `Target ${formatDate(deadline)}`,
      deadlineLabel: formatDate(deadline),
      progress,
      tone: diffDays <= 45 ? ("amber" as Tone) : ("emerald" as Tone),
    };
  }

  const overdueDays = Math.abs(diffDays);

  return {
    headline: `Lewat ${formatRelativeDays(overdueDays)}`,
    subline: `Target ${formatDate(deadline)}`,
    deadlineLabel: formatDate(deadline),
    progress: 1,
    tone: "rose" as Tone,
  };
}

function resolveBackHref(backHref?: string | null) {
  const value = typeof backHref === "string" ? backHref.trim() : "";
  return value.length > 0 ? value : "/dashboard/project";
}

function HeroTopBar({
  backHref,
  label,
}: {
  backHref?: string | null;
  label: string;
}) {
  const href = resolveBackHref(backHref);

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4 md:p-6 lg:p-7">
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/35 px-3 py-2 text-sm font-medium text-white backdrop-blur-2xl transition hover:border-white/20 hover:bg-black/45"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
          <ArrowLeft className="h-3.5 w-3.5" />
        </span>
        <span className="pr-1">Kembali</span>
      </Link>

      <div className="inline-flex items-center rounded-full bg-white/90 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-950 shadow-[0_10px_30px_rgba(255,255,255,0.12)] backdrop-blur-xl md:px-4 md:text-[11px]">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const tone = STATUS_TONE[status];
  const styles = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-xl",
        styles.border,
        styles.softBg,
        styles.text
      )}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", styles.dot)} />
      {STATUS_LABEL[status]}
    </div>
  );
}

function ManagerChip({
  name,
  avatar,
}: {
  name: string;
  avatar?: string | null;
}) {
  const src = normalizeImage(avatar);

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/30 py-2 pl-2 pr-4 backdrop-blur-xl">
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-10 w-10 rounded-full border border-white/15 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-xs font-semibold text-white">
          {getInitials(name)}
        </div>
      )}

      <div className="leading-tight">
        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
          Dikelola oleh
        </p>
        <p className="mt-0.5 text-sm font-medium text-white">{name}</p>
      </div>
    </div>
  );
}

function LifecycleRail({ status }: { status: ProjectStatus }) {
  const currentIndex = STATUS_ORDER.indexOf(status);

  if (status === "dibatalkan") {
    return (
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
            Lifecycle
          </span>
          <span className="text-sm font-medium text-rose-200">
            Proyek dibatalkan
          </span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-white/10">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-rose-400 via-rose-300 to-orange-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
          Lifecycle
        </span>
        <span className="text-sm font-medium text-white">
          Tahap {currentIndex + 1} / {STATUS_ORDER.length}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {STATUS_ORDER.map((item, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;

          return (
            <div
              key={item}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                isDone &&
                  "bg-gradient-to-r from-emerald-400 to-cyan-300 opacity-95",
                isActive &&
                  "bg-white shadow-[0_0_18px_rgba(255,255,255,0.45)]",
                !isDone && !isActive && "bg-white/10"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function InfoPanel({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: Tone;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <div className="relative min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,15,23,0.96),rgba(7,10,16,0.9))] p-4 backdrop-blur-xl sm:rounded-[26px] sm:p-5">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-px bg-gradient-to-r",
          styles.line
        )}
      />
      <div
        className={cn(
          "absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl",
          styles.glow
        )}
      />

      <div className="relative min-w-0">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:text-[11px] sm:tracking-[0.24em]">
          {label}
        </div>

        <div
          className={cn(
            "mt-3 break-words text-[26px] font-semibold leading-none tracking-[-0.04em] sm:mt-4 sm:text-3xl",
            styles.text
          )}
        >
          {value}
        </div>

        <div className="mt-3 text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6">
          {helper}
        </div>
      </div>
    </div>
  );
}

function FundingTerminal({
  totalFunded,
  fundingTarget,
  fundingProgress,
  remainingFunding,
}: {
  totalFunded: number;
  fundingTarget: number;
  fundingProgress: number;
  remainingFunding: number;
}) {
  const progressWidth = Math.max(6, Math.min(100, fundingProgress * 100));

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,13,21,0.98),rgba(6,8,12,0.96))] p-5 md:p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-sky-300/80 via-white/30 to-transparent" />
      <div className="absolute -right-12 top-0 h-40 w-40 rounded-full bg-sky-300/12 blur-3xl" />
      <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-cyan-300/8 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
              Dana terhimpun
            </p>
            <div className="mt-4 text-[40px] font-semibold leading-none tracking-[-0.06em] text-white sm:text-[54px] xl:text-[62px]">
              {compactIDR(totalFunded)}
            </div>
            <p className="mt-3 text-sm text-slate-300">
              {formatPercent(fundingProgress)} dari target pendanaan
            </p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              Target
            </p>
            <p className="mt-2 text-lg font-medium text-white">
              {compactIDR(fundingTarget)}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="relative h-2.5 rounded-full bg-white/10">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 shadow-[0_0_24px_rgba(56,189,248,0.25)]"
              style={{ width: `${progressWidth}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
                <div className="absolute inset-0 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/30 blur-md" />
                <div className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/50 animate-ping" />
                <div className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[4px] bg-cyan-200/70" />
                <div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.65)]" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              Sisa kebutuhan
            </div>
            <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
              {remainingFunding > 0 ? compactIDR(remainingFunding) : "Terpenuhi"}
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              Kecepatan progres
            </div>
            <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
              {formatPercent(fundingProgress)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BloombergHeroCard({
  project,
  backHref,
  topBarLabel = "Detail transaksi",
}: {
  project: ProjectDetailViewModel;
  backHref?: string;
  topBarLabel?: string;
}) {
  const totalFunded = toNumber(project.totalFunded);
  const fundingTarget = toNumber(project.fundingTarget);
  const estimatedNetProfit = toNumber(project.estimatedNetProfit);
  const estimatedSellPrice = toNumber(project.estimatedSellPrice);

  const fundingProgress = safeDivide(totalFunded, fundingTarget);
  const remainingFunding = Math.max(0, fundingTarget - totalFunded);
  const roi = safeDivide(estimatedNetProfit, fundingTarget);
  const multiple =
    fundingTarget > 0
      ? (fundingTarget + estimatedNetProfit) / fundingTarget
      : 0;

  const heroImage = normalizeImage(project.image);
  const locationFull = getLocation(project);
  const timeline = getTimelineMeta(
    project.startDate,
    project.purchaseDate,
    project.estimatedMonths
  );

  const managerName = project.createdByName?.trim() || "";
  const shouldShowManager = Boolean(
    managerName || project.createdByAvatar
  );

  const fundingTypeLabel =
    project.fundingType === "terbuka"
      ? "Pendanaan terbuka"
      : "Pendanaan tertutup";

  return (
    <section className="relative overflow-hidden rounded-[38px] border border-white/10 bg-[#06080d] shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_22%)]" />

      <div className="relative grid min-h-[760px] lg:min-h-[620px] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative min-h-[360px] lg:min-h-[620px]">
          {heroImage ? (
            <img
              src={heroImage}
              alt={project.name}
              className="absolute inset-0 h-full w-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#111827,#0b1220,#05070b)]" />
          )}

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,11,0.05)_0%,rgba(5,7,11,0.10)_26%,rgba(5,7,11,0.58)_72%,rgba(5,7,11,0.96)_100%)] lg:bg-[linear-gradient(180deg,rgba(5,7,11,0.01)_0%,rgba(5,7,11,0.03)_48%,rgba(5,7,11,0.18)_66%,rgba(5,7,11,0.96)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(56,189,248,0.18),transparent_22%),radial-gradient(circle_at_82%_10%,rgba(168,85,247,0.14),transparent_20%)]" />

          <HeroTopBar backHref={backHref} label={topBarLabel} />

          <div className="relative flex h-full flex-col justify-end px-6 pb-6 pt-28 md:px-8 md:pb-8 md:pt-32 lg:p-10">
            <div className="max-w-3xl">
              <h1 className="max-w-4xl text-4xl font-semibold leading-[0.92] tracking-[-0.06em] text-white md:text-6xl xl:text-7xl">
                {project.name}
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200/88 md:text-[15px]">
                {project.description?.trim()
                  ? project.description
                  : "Aset dengan struktur pendanaan yang dirancang untuk memberi visibilitas tajam terhadap progres, timeline, dan potensi nilai exit."}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-200/90">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {project.address || locationFull || "Lokasi belum diisi"}
                </span>

                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  Akuisisi {formatDate(project.purchaseDate)}
                </span>

                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-400" />
                  {fundingTypeLabel}
                </span>
              </div>

              {shouldShowManager ? (
                <div className="mt-7">
                  <ManagerChip
                    name={managerName || "Manager proyek"}
                    avatar={project.createdByAvatar}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10 bg-[linear-gradient(180deg,rgba(8,11,17,0.96),rgba(4,6,10,0.99))] lg:border-l lg:border-t-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.08),transparent_24%)]" />

          <div className="relative flex h-full flex-col p-5 md:p-7 lg:p-8">
            <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 md:p-6 backdrop-blur-2xl">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/70 via-white/20 to-transparent" />
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />

              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                      Live status
                    </div>
                    <div className="mt-4">
                      <StatusBadge status={project.status} />
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                      Timeline
                    </div>
                    <div className="mt-2 text-lg font-medium text-white">
                      {timeline.headline}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {timeline.deadlineLabel}
                    </div>
                  </div>
                </div>

                <LifecycleRail status={project.status} />
              </div>
            </div>

            <div className="mt-4">
              <FundingTerminal
                totalFunded={totalFunded}
                fundingTarget={fundingTarget}
                fundingProgress={fundingProgress}
                remainingFunding={remainingFunding}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <InfoPanel
                label="ROI proyeksi"
                value={formatPercent(roi)}
                helper={`${formatMultiple(multiple)} equity multiple`}
                tone="emerald"
              />

              <InfoPanel
                label="Pendapatan kotor"
                value={compactIDR(estimatedSellPrice)}
                helper="Estimasi nilai exit"
                tone="fuchsia"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
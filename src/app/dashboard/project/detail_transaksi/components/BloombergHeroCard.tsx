import type { ReactNode } from "react";
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
import { CalendarDays, Clock3, MapPin } from "lucide-react";

type Tone = "amber" | "emerald" | "cyan" | "fuchsia" | "rose" | "slate";

const TONE_STYLES: Record<
  Tone,
  {
    text: string;
    softBg: string;
    softBorder: string;
    glow: string;
    dot: string;
    progress: string;
    line: string;
  }
> = {
  amber: {
    text: "text-amber-200",
    softBg: "bg-amber-400/10",
    softBorder: "border-amber-300/20",
    glow: "bg-amber-300/18",
    dot: "bg-amber-300",
    progress: "from-amber-400 via-amber-300 to-lime-300",
    line: "from-amber-300/80 via-amber-200/40 to-transparent",
  },
  emerald: {
    text: "text-emerald-200",
    softBg: "bg-emerald-400/10",
    softBorder: "border-emerald-300/20",
    glow: "bg-emerald-300/18",
    dot: "bg-emerald-300",
    progress: "from-emerald-400 via-emerald-300 to-cyan-300",
    line: "from-emerald-300/80 via-emerald-200/40 to-transparent",
  },
  cyan: {
    text: "text-cyan-200",
    softBg: "bg-cyan-400/10",
    softBorder: "border-cyan-300/20",
    glow: "bg-cyan-300/18",
    dot: "bg-cyan-300",
    progress: "from-cyan-400 via-sky-300 to-indigo-300",
    line: "from-cyan-300/80 via-cyan-200/40 to-transparent",
  },
  fuchsia: {
    text: "text-fuchsia-200",
    softBg: "bg-fuchsia-400/10",
    softBorder: "border-fuchsia-300/20",
    glow: "bg-fuchsia-300/18",
    dot: "bg-fuchsia-300",
    progress: "from-fuchsia-400 via-violet-300 to-pink-300",
    line: "from-fuchsia-300/80 via-fuchsia-200/40 to-transparent",
  },
  rose: {
    text: "text-rose-200",
    softBg: "bg-rose-400/10",
    softBorder: "border-rose-300/20",
    glow: "bg-rose-300/18",
    dot: "bg-rose-300",
    progress: "from-rose-400 via-orange-300 to-amber-300",
    line: "from-rose-300/80 via-rose-200/40 to-transparent",
  },
  slate: {
    text: "text-slate-200",
    softBg: "bg-white/[0.06]",
    softBorder: "border-white/10",
    glow: "bg-white/10",
    dot: "bg-slate-300",
    progress: "from-slate-300 via-slate-200 to-white",
    line: "from-slate-300/80 via-slate-200/40 to-transparent",
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
          Managed by
        </p>
        <p className="mt-0.5 text-sm font-medium text-white">{name}</p>
      </div>
    </div>
  );
}

function StageRibbon({ status }: { status: ProjectStatus }) {
  const currentIndex = STATUS_ORDER.indexOf(status);
  const currentTone = STATUS_TONE[status];

  if (status === "dibatalkan") {
    return (
      <div className="mt-5 rounded-[22px] border border-rose-300/20 bg-rose-400/8 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.24em] text-rose-200/80">
            Lifecycle
          </span>
          <span className="text-sm font-medium text-rose-200">
            Proyek dibatalkan
          </span>
        </div>

        <div className="mt-4 h-1.5 rounded-full bg-white/10">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-rose-400 via-rose-300 to-orange-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 px-4 py-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
          Lifecycle
        </span>
        <span className={cn("text-sm font-medium", TONE_STYLES[currentTone].text)}>
          Tahap {currentIndex + 1} / {STATUS_ORDER.length}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {STATUS_ORDER.map((item, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;

          return (
            <div
              key={item}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                isDone &&
                  "bg-gradient-to-r from-emerald-400 to-cyan-300 opacity-90",
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

function SpotlightCard({
  status,
  timelineHeadline,
  deadlineLabel,
}: {
  status: ProjectStatus;
  timelineHeadline: string;
  deadlineLabel: string;
}) {
  const tone = STATUS_TONE[status];
  const styles = TONE_STYLES[tone];

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 backdrop-blur-2xl md:p-6">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-px bg-gradient-to-r",
          styles.line
        )}
      />
      <div
        className={cn(
          "absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl",
          styles.glow
        )}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Status saat ini
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className={cn("h-2.5 w-2.5 rounded-full", styles.dot)}
              />
              <h2
                className={cn(
                  "text-2xl font-semibold tracking-[-0.03em] md:text-3xl",
                  styles.text
                )}
              >
                {STATUS_LABEL[status]}
              </h2>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Deadline
            </p>
            <p className="mt-2 text-base font-medium text-white md:text-lg">
              {deadlineLabel}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-300">{timelineHeadline}</p>

        <StageRibbon status={status} />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  footnote,
  tone,
  progress,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  footnote?: string;
  tone: Tone;
  progress?: number;
  icon?: ReactNode;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <div className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,13,21,0.82),rgba(7,9,14,0.72))] p-5 backdrop-blur-xl">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-px bg-gradient-to-r",
          styles.line
        )}
      />
      <div
        className={cn(
          "absolute -right-10 -top-10 h-24 w-24 rounded-full blur-3xl",
          styles.glow
        )}
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
            {label}
          </p>
          {icon ? <div className="text-slate-500">{icon}</div> : null}
        </div>

        <div className="mt-4 text-[28px] font-semibold leading-none tracking-[-0.03em] text-white md:text-[32px]">
          {value}
        </div>

        <div className="mt-3 text-sm text-slate-300">{helper}</div>

        {footnote ? (
          <div className="mt-1.5 text-xs uppercase tracking-[0.18em] text-slate-500">
            {footnote}
          </div>
        ) : null}

        {typeof progress === "number" ? (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r",
                  styles.progress
                )}
                style={{
                  width: `${Math.max(6, Math.min(100, progress * 100))}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function BloombergHeroCard({
  project,
}: {
  project: ProjectDetailViewModel;
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

  const managerName = project.createdByName?.trim() || project.createdById || "";
  const fundingTypeLabel =
    project.fundingType === "terbuka"
      ? "Pendanaan terbuka"
      : "Pendanaan tertutup";

  return (
    <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#070b11] shadow-[0_40px_120px_rgba(0,0,0,0.48)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_22%)]" />

      <div className="relative grid min-h-[720px] lg:min-h-[640px] lg:grid-cols-[1.2fr_0.9fr]">
        <div className="relative min-h-[360px] lg:min-h-[640px]">
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

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,11,0.08)_0%,rgba(4,7,11,0.2)_22%,rgba(4,7,11,0.62)_70%,rgba(4,7,11,0.92)_100%)] lg:bg-[linear-gradient(90deg,rgba(4,7,11,0.12)_0%,rgba(4,7,11,0.18)_28%,rgba(4,7,11,0.48)_60%,rgba(4,7,11,0.82)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.16),transparent_24%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.14),transparent_20%)]" />

          <div className="relative flex h-full flex-col justify-end p-6 md:p-8 lg:p-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 backdrop-blur-xl">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    TONE_STYLES[STATUS_TONE[project.status]].dot
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    TONE_STYLES[STATUS_TONE[project.status]].text
                  )}
                >
                  {STATUS_LABEL[project.status]}
                </span>
              </div>

              <div className="mt-5 text-[11px] uppercase tracking-[0.34em] text-slate-400">
                {fundingTypeLabel}
              </div>

              <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-[0.94] tracking-[-0.05em] text-white md:text-6xl xl:text-7xl">
                {project.name}
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200/88 md:text-[15px]">
                {project.description?.trim()
                  ? project.description
                  : "Ringkasan utama proyek untuk menilai progres, timeline, dan potensi hasil investasi dalam satu tampilan yang tajam."}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-200/90">
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
                  {timeline.subline}
                </span>
              </div>

              {managerName ? (
                <div className="mt-6">
                  <ManagerChip
                    name={managerName}
                    avatar={project.createdByAvatar}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10 bg-[linear-gradient(180deg,rgba(7,10,16,0.92),rgba(4,6,10,0.98))] lg:border-l lg:border-t-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.08),transparent_26%)]" />

          <div className="relative flex h-full flex-col p-5 md:p-7 lg:p-8">
            <SpotlightCard
              status={project.status}
              timelineHeadline={timeline.headline}
              deadlineLabel={timeline.deadlineLabel}
            />

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricCard
                label="Dana terhimpun"
                value={compactIDR(totalFunded)}
                helper={`${formatPercent(fundingProgress)} dari ${compactIDR(
                  fundingTarget
                )}`}
                footnote={
                  remainingFunding > 0
                    ? `Sisa ${compactIDR(remainingFunding)}`
                    : "Target terpenuhi"
                }
                tone="amber"
                progress={fundingProgress}
              />

              <MetricCard
                label="Deadline target"
                value={timeline.headline}
                helper={timeline.subline}
                footnote={
                  project.estimatedMonths
                    ? `${project.estimatedMonths} bulan tenor`
                    : "Tenor belum diatur"
                }
                tone={timeline.tone}
                progress={timeline.progress}
              />

              <MetricCard
                label="ROI proyeksi"
                value={formatPercent(roi)}
                helper="Terhadap target pendanaan"
                footnote={`${formatMultiple(multiple)} equity multiple`}
                tone="emerald"
              />

              <MetricCard
                label="Pendapatan kotor"
                value={compactIDR(estimatedSellPrice)}
                helper="Estimasi nilai exit"
                footnote="Sebelum biaya akhir"
                tone="fuchsia"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
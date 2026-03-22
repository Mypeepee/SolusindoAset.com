import type { ReactNode } from "react";
import type {
  FundingType,
  PaymentStatus,
  ProjectStatus,
} from "./types";
import {
  cn,
  getFundingTypeTone,
  getInitials,
  getPaymentStatusTone,
  getProjectStatusTone,
  normalizeImage,
} from "./utils";
import {
  PAYMENT_STATUS_LABEL,
  STATUS_LABEL,
} from "./utils";

export function SectionCard({
  eyebrow,
  title,
  icon,
  right,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl md:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-300">
            {icon}
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
              {eyebrow}
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">
              {title}
            </h3>
          </div>
        </div>
        {right}
      </div>

      {children}
    </section>
  );
}

export function DataRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={cn("text-right font-mono text-white", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value * 100));

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(245,158,11,0.95),rgba(16,185,129,0.95))]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm leading-6 text-slate-400">
      {text}
    </div>
  );
}

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-medium",
        getProjectStatusTone(status)
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function FundingTypePill({ type }: { type: FundingType }) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-medium",
        getFundingTypeTone(type)
      )}
    >
      Pendanaan {type}
    </span>
  );
}

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
        getPaymentStatusTone(status)
      )}
    >
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  );
}

export function InvestorAvatar({
  name,
  avatar,
}: {
  name: string;
  avatar?: string | null;
}) {
  const src = normalizeImage(avatar);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-10 w-10 rounded-2xl border border-white/10 object-cover"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sm font-semibold text-slate-200">
      {getInitials(name)}
    </div>
  );
}
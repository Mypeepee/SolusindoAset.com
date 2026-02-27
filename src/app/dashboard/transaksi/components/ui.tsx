// src/app/dashboard/components/transaksi/ui.tsx
"use client";

import { Icon } from "@iconify/react";

/** =========================================
 *  Types
 *  ========================================= */
export type JenisTransaksi = "PRIMARY" | "SECONDARY" | "LELANG" | "SEWA";

/** =========================================
 *  Formatters
 *  ========================================= */
export function formatIDR(n: number) {
  const x = Number(n ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(x) ? x : 0);
}

export function formatM2(n: any) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return "-";
  const isInt = Math.abs(v - Math.round(v)) < 1e-6;
  return `${isInt ? Math.round(v) : v.toFixed(1)} m²`;
}

export function formatDateID(input?: string | Date | null) {
  if (!input) return "-";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** =========================================
 *  Price meta (handle LELANG vs others)
 *  ========================================= */
type PriceMeta = { label: string; value: number; strike?: number | null };

function clamp(n: any, fb = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fb;
}

function getPriceMeta(args: {
  jenis: JenisTransaksi;
  harga: number;
  harga_promo?: number | null;
  nilai_limit_lelang?: number | null;
}): PriceMeta {
  const { jenis } = args;
  const harga = clamp(args.harga, 0);
  const promo = clamp(args.harga_promo, 0);
  const limit = clamp(args.nilai_limit_lelang, 0);

  if (jenis === "LELANG") {
    return { label: "Nilai limit lelang", value: limit > 0 ? limit : harga };
  }

  if (promo > 0 && promo < harga) {
    return { label: "Harga promo", value: promo, strike: harga };
  }

  return { label: jenis === "SEWA" ? "Harga sewa" : "Harga listing", value: harga };
}

/** =========================================
 *  Badge
 *  ========================================= */
const JENIS_META: Record<
  JenisTransaksi,
  { label: string; icon: string; cls: string }
> = {
  PRIMARY: {
    label: "PRIMARY",
    icon: "solar:buildings-3-linear",
    cls: "border-sky-700/30 bg-sky-500/10 text-sky-200",
  },
  SECONDARY: {
    label: "SECONDARY",
    icon: "solar:home-2-linear",
    cls: "border-indigo-700/30 bg-indigo-500/10 text-indigo-200",
  },
  LELANG: {
    label: "LELANG",
    icon: "solar:hammer-linear",
    cls: "border-amber-700/30 bg-amber-500/10 text-amber-200",
  },
  SEWA: {
    label: "SEWA",
    icon: "solar:key-square-linear",
    cls: "border-emerald-700/30 bg-emerald-500/10 text-emerald-200",
  },
};

export function Badge({
  jenis,
  compact = false,
}: {
  jenis: JenisTransaksi;
  compact?: boolean;
}) {
  const m = JENIS_META[jenis];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        "backdrop-blur",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        m.cls,
      ].join(" ")}
      title={m.label}
    >
      <Icon icon={m.icon} className={compact ? "text-[12px]" : "text-sm"} />
      {m.label}
    </span>
  );
}

/** =========================================
 *  PriceCell
 *  ========================================= */
export function PriceCell({
  jenis,
  harga,
  harga_promo,
  nilai_limit_lelang,
  size = "md",
  showLabel = true,
  align = "left",
}: {
  jenis: JenisTransaksi;
  harga: number;
  harga_promo: number | null;
  nilai_limit_lelang: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  align?: "left" | "right";
}) {
  const meta = getPriceMeta({ jenis, harga, harga_promo, nilai_limit_lelang });
  const priceCls =
    size === "lg" ? "text-2xl" : size === "md" ? "text-xl" : "text-base";
  const wrapAlign =
    align === "right" ? "items-end text-right" : "items-start text-left";

  const isPromo = Boolean(meta.strike && meta.value > 0);
  const priceColor = isPromo ? "text-emerald-200" : "text-white";

  return (
    <div className={`flex flex-col ${wrapAlign}`}>
      {meta.strike ? (
        <span className="text-xs text-zinc-500 line-through">
          {formatIDR(meta.strike)}
        </span>
      ) : null}
      <span className={`${priceCls} font-semibold tracking-tight ${priceColor}`}>
        {formatIDR(meta.value)}
      </span>
      {showLabel ? (
        <span className="text-[11px] text-zinc-500">{meta.label}</span>
      ) : null}
    </div>
  );
}

/** =========================================
 *  Small building blocks (futuristic cards)
 *  ========================================= */
export function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl border border-zinc-800 bg-zinc-950/40",
        "shadow-[0_0_0_1px_rgba(0,0,0,0.25)]",
        "backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon ? (
          <div className="grid h-9 w-9 place-items-center rounded-2xl border border-emerald-700/40 bg-emerald-500/10 text-emerald-300">
            <Icon icon={icon} className="text-lg" />
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-xs text-zinc-400">{subtitle}</div>
          ) : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon icon={icon} className="mt-0.5 text-base text-emerald-300/90" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </div>
        <div className="mt-0.5 whitespace-normal break-words text-sm text-zinc-200">
          {value}
        </div>
      </div>
    </div>
  );
}

export function StatChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon icon={icon} className="text-base text-emerald-300" />
        <div className="text-[11px] font-semibold text-zinc-400">{label}</div>
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
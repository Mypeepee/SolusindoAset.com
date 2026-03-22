import type {
    FundingType,
    NullableDate,
    PaymentStatus,
    ProjectDetailViewModel,
    ProjectStatus,
  } from "./types";
  
  export const STATUS_ORDER: ProjectStatus[] = [
    "pendanaan_terbuka",
    "pendanaan_penuh",
    "pengurusan_dokumen",
    "eksekusi_pengosongan",
    "renovasi",
    "sedang_dijual",
    "terjual",
  ];
  
  export const STATUS_LABEL: Record<ProjectStatus, string> = {
    pendanaan_terbuka: "Pendanaan dibuka",
    pendanaan_penuh: "Pendanaan penuh",
    pengurusan_dokumen: "Pengurusan dokumen",
    eksekusi_pengosongan: "Eksekusi pengosongan",
    renovasi: "Renovasi",
    sedang_dijual: "Sedang dijual",
    terjual: "Terjual",
    dibatalkan: "Dibatalkan",
  };
  
  export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
    menunggu_pembayaran: "Menunggu",
    dibayar_sebagian: "Sebagian",
    lunas: "Lunas",
    dikembalikan: "Dikembalikan",
    dibatalkan: "Dibatalkan",
  };
  
  export function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
  }
  
  export function toNumber(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  
  export function safeDivide(a: number, b: number) {
    if (!b) return 0;
    return a / b;
  }
  
  export function formatIDR(value: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value || 0);
  }
  
  export function compactIDR(value: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value || 0);
  }
  
  export function formatPercent(value: number) {
    return `${(value * 100).toFixed(1)}%`;
  }
  
  export function formatMultiple(value: number) {
    return value > 0 ? `${value.toFixed(2)}x` : "—";
  }
  
  export function formatNumber(value: number) {
    return new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 0,
    }).format(value || 0);
  }
  
  export function formatDate(value: NullableDate) {
    if (!value) return "—";
  
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
  
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }
  
  export function capitalize(value: string) {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  
  export function normalizeImage(value?: string | null) {
    if (!value) return null;
  
    const trimmed = value.trim();
  
    if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
      return `https://drive.google.com/thumbnail?id=${trimmed}&sz=w1600`;
    }
  
    const match = trimmed.match(/(?:id=|\/d\/)([A-Za-z0-9_-]{20,})/);
    if (match?.[1]) {
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
    }
  
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("/") ||
      trimmed.startsWith("data:")
    ) {
      return trimmed;
    }
  
    return null;
  }
  
  export function getInitials(name: string) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }
  
  export function getLocation(project: ProjectDetailViewModel) {
    return [project.village, project.district, project.city, project.province]
      .filter(Boolean)
      .join(", ");
  }
  
  export function getFundingTypeTone(type: FundingType) {
    return type === "terbuka"
      ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-300"
      : "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300";
  }
  
  export function getProjectStatusTone(status: ProjectStatus) {
    if (status === "terjual") {
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
    }
  
    if (status === "dibatalkan") {
      return "border-rose-400/25 bg-rose-400/10 text-rose-300";
    }
  
    if (status === "sedang_dijual") {
      return "border-sky-400/25 bg-sky-400/10 text-sky-300";
    }
  
    return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  }
  
  export function getPaymentStatusTone(status: PaymentStatus) {
    const map: Record<PaymentStatus, string> = {
      menunggu_pembayaran: "border-amber-400/25 bg-amber-400/10 text-amber-200",
      dibayar_sebagian: "border-sky-400/25 bg-sky-400/10 text-sky-300",
      lunas: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
      dikembalikan: "border-slate-400/25 bg-slate-400/10 text-slate-300",
      dibatalkan: "border-rose-400/25 bg-rose-400/10 text-rose-300",
    };
  
    return map[status];
  }
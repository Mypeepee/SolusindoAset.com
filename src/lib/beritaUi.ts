// Shared UI helpers + pure constants for the blog/berita surfaces.
// IMPORTANT: keep this file free of Prisma/server imports — it is bundled
// into client components (admin editor, blog index, etc.).

// Canonical editorial categories shown on the public blog + admin editor.
export const BERITA_KATEGORI = [
  "Berita Properti",
  "Analisa Pasar",
  "Tips Lelang",
  "Panduan Pembeli",
  "Investasi",
  "Legal & Dokumen",
] as const;

export type BeritaKategori = (typeof BERITA_KATEGORI)[number];

export const BERITA_STATUS = ["DRAFT", "PUBLISHED", "ARCHIVED", "SCHEDULED"] as const;
export type BeritaStatus = (typeof BERITA_STATUS)[number];

/** URL-safe slug from arbitrary text. */
export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 280);
}

/** Estimated reading time in minutes (~200 wpm, min 1). */
export function readingMinutes(markdown: string | null | undefined): number {
  const words = String(markdown || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** "14 Jan 2026" in Indonesian. */
export function formatTanggal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** "2 jam lalu" / "3 hari lalu" relative label, falls back to date. */
export function relativeTanggal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} hari lalu`;
  return formatTanggal(iso);
}

// Section colour-coding — top news sites visually distinguish desks.
type Accent = {
  text: string;
  chip: string; // background + text for the category pill
  glow: string; // box-shadow on hover
  ring: string; // border accent
  dot: string;
};

const ACCENTS: Record<string, Accent> = {
  "Berita Properti": {
    text: "text-emerald-300",
    chip: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(52,211,153,0.45)]",
    ring: "group-hover:border-emerald-400/50",
    dot: "bg-emerald-400",
  },
  "Analisa Pasar": {
    text: "text-sky-300",
    chip: "bg-sky-400/15 text-sky-300 border-sky-400/30",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(56,189,248,0.45)]",
    ring: "group-hover:border-sky-400/50",
    dot: "bg-sky-400",
  },
  "Tips Lelang": {
    text: "text-amber-300",
    chip: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(251,191,36,0.45)]",
    ring: "group-hover:border-amber-400/50",
    dot: "bg-amber-400",
  },
  "Panduan Pembeli": {
    text: "text-violet-300",
    chip: "bg-violet-400/15 text-violet-300 border-violet-400/30",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(167,139,250,0.45)]",
    ring: "group-hover:border-violet-400/50",
    dot: "bg-violet-400",
  },
  Investasi: {
    text: "text-teal-300",
    chip: "bg-teal-400/15 text-teal-300 border-teal-400/30",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(45,212,191,0.45)]",
    ring: "group-hover:border-teal-400/50",
    dot: "bg-teal-400",
  },
  "Legal & Dokumen": {
    text: "text-rose-300",
    chip: "bg-rose-400/15 text-rose-300 border-rose-400/30",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(251,113,133,0.45)]",
    ring: "group-hover:border-rose-400/50",
    dot: "bg-rose-400",
  },
};

const DEFAULT_ACCENT: Accent = ACCENTS["Berita Properti"];

export function accentFor(kategori?: string | null): Accent {
  return (kategori && ACCENTS[kategori]) || DEFAULT_ACCENT;
}

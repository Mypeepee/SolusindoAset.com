// src/lib/berita.ts
// Service layer for Berita (blog/news). Centralizes Prisma queries,
// BigInt-safe serialization, slugging, reading-time, and access control.
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  BERITA_KATEGORI,
  BERITA_STATUS,
  readingMinutes,
  slugify,
  type BeritaKategori,
  type BeritaStatus,
} from "@/lib/beritaUi";

// Re-export client-safe constants so server callers can import from one place.
export {
  BERITA_KATEGORI,
  BERITA_STATUS,
  readingMinutes,
  slugify,
  type BeritaKategori,
  type BeritaStatus,
};

// Only these agent positions may create/edit/delete berita.
export const BERITA_EDITOR_JABATAN = ["OWNER", "ADMIN", "PRINCIPAL"];

export function canManageBerita(jabatan?: string | null): boolean {
  return BERITA_EDITOR_JABATAN.includes(String(jabatan || "").toUpperCase());
}

// ── DTOs (BigInt-safe, JSON-serializable) ───────────────────────────
export type BeritaListItem = {
  id: string;
  judul: string;
  slug: string;
  ringkasan: string | null;
  gambar_utama: string | null;
  kategori: string;
  penulis: string;
  status_publish: BeritaStatus;
  berita_unggulan: boolean;
  berita_utama: boolean;
  views: number;
  readMinutes: number;
  tanggal_publish: string | null;
  tanggal_dibuat: string;
  tanggal_diupdate: string;
};

export type BeritaDetail = BeritaListItem & {
  isi_berita: string;
  galeri_gambar: string[];
  tag: string[];
  sumber_berita: string | null;
  share: number;
  id_agent: string | null;
};

type BeritaRow = {
  id_berita: bigint;
  id_agent: string | null;
  judul: string;
  slug: string;
  ringkasan: string | null;
  isi_berita: string;
  gambar_utama: string | null;
  galeri_gambar: string | null;
  kategori: string;
  tag: string | null;
  penulis: string;
  sumber_berita: string | null;
  status_publish: BeritaStatus;
  berita_unggulan: boolean;
  berita_utama: boolean;
  views: number;
  share: number;
  tanggal_publish: Date | null;
  tanggal_dibuat: Date;
  tanggal_diupdate: Date;
};

// ── Helpers ─────────────────────────────────────────────────────────
/** Ensure a slug is unique in the berita table (appends -2, -3, ...). */
export async function uniqueSlug(base: string, ignoreId?: bigint): Promise<string> {
  const root = slugify(base) || `berita-${Date.now()}`;
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const found = await prisma.berita.findUnique({
      where: { slug: candidate },
      select: { id_berita: true },
    });
    if (!found || (ignoreId != null && found.id_berita === ignoreId)) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
  } catch {
    // not JSON — treat as comma separated
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

const LIST_SELECT = {
  id_berita: true,
  judul: true,
  slug: true,
  ringkasan: true,
  isi_berita: true,
  gambar_utama: true,
  kategori: true,
  penulis: true,
  status_publish: true,
  berita_unggulan: true,
  berita_utama: true,
  views: true,
  tanggal_publish: true,
  tanggal_dibuat: true,
  tanggal_diupdate: true,
} satisfies Prisma.BeritaSelect;

export function toListItem(row: any): BeritaListItem {
  return {
    id: String(row.id_berita),
    judul: row.judul,
    slug: row.slug,
    ringkasan: row.ringkasan ?? null,
    gambar_utama: row.gambar_utama ?? null,
    kategori: row.kategori,
    penulis: row.penulis,
    status_publish: row.status_publish,
    berita_unggulan: !!row.berita_unggulan,
    berita_utama: !!row.berita_utama,
    views: row.views ?? 0,
    readMinutes: readingMinutes(row.isi_berita),
    tanggal_publish: row.tanggal_publish ? row.tanggal_publish.toISOString() : null,
    tanggal_dibuat: row.tanggal_dibuat.toISOString(),
    tanggal_diupdate: row.tanggal_diupdate.toISOString(),
  };
}

export function toDetail(row: BeritaRow): BeritaDetail {
  return {
    ...toListItem(row),
    isi_berita: row.isi_berita,
    galeri_gambar: parseJsonArray(row.galeri_gambar),
    tag: parseJsonArray(row.tag),
    sumber_berita: row.sumber_berita ?? null,
    share: row.share ?? 0,
    id_agent: row.id_agent ?? null,
  };
}

// ── Public reads ────────────────────────────────────────────────────
const PUBLISHED_WHERE: Prisma.BeritaWhereInput = { status_publish: "PUBLISHED" };

export type PublicListParams = {
  q?: string;
  kategori?: string;
  page?: number;
  pageSize?: number;
  excludeSlug?: string;
};

export async function getPublishedList(params: PublicListParams = {}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(48, Math.max(1, params.pageSize || 9));

  const where: Prisma.BeritaWhereInput = { ...PUBLISHED_WHERE };
  if (params.kategori && params.kategori !== "All") where.kategori = params.kategori;
  if (params.excludeSlug) where.slug = { not: params.excludeSlug };
  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    where.OR = [
      { judul: { contains: q, mode: "insensitive" } },
      { ringkasan: { contains: q, mode: "insensitive" } },
      { tag: { contains: q, mode: "insensitive" } },
      { kategori: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.berita.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ tanggal_publish: "desc" }, { tanggal_dibuat: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.berita.count({ where }),
  ]);

  return {
    items: rows.map(toListItem),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Featured headline for the blog hero (berita_utama → unggulan → newest). */
export async function getFeatured(): Promise<BeritaListItem | null> {
  const row =
    (await prisma.berita.findFirst({
      where: { ...PUBLISHED_WHERE, berita_utama: true },
      select: LIST_SELECT,
      orderBy: [{ tanggal_publish: "desc" }],
    })) ||
    (await prisma.berita.findFirst({
      where: { ...PUBLISHED_WHERE, berita_unggulan: true },
      select: LIST_SELECT,
      orderBy: [{ tanggal_publish: "desc" }],
    })) ||
    (await prisma.berita.findFirst({
      where: PUBLISHED_WHERE,
      select: LIST_SELECT,
      orderBy: [{ tanggal_publish: "desc" }, { tanggal_dibuat: "desc" }],
    }));
  return row ? toListItem(row) : null;
}

export async function getLatest(take = 3): Promise<BeritaListItem[]> {
  const rows = await prisma.berita.findMany({
    where: PUBLISHED_WHERE,
    select: LIST_SELECT,
    orderBy: [{ tanggal_publish: "desc" }, { tanggal_dibuat: "desc" }],
    take,
  });
  return rows.map(toListItem);
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const grouped = await prisma.berita.groupBy({
    by: ["kategori"],
    where: PUBLISHED_WHERE,
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const g of grouped) out[g.kategori] = g._count._all;
  return out;
}

export async function getBySlug(slug: string): Promise<BeritaDetail | null> {
  const row = await prisma.berita.findUnique({ where: { slug } });
  if (!row) return null;
  return toDetail(row as unknown as BeritaRow);
}

export async function getRelated(
  slug: string,
  kategori: string,
  take = 3
): Promise<BeritaListItem[]> {
  const same = await prisma.berita.findMany({
    where: { ...PUBLISHED_WHERE, kategori, slug: { not: slug } },
    select: LIST_SELECT,
    orderBy: [{ tanggal_publish: "desc" }],
    take,
  });
  if (same.length >= take) return same.map(toListItem);

  const fillers = await prisma.berita.findMany({
    where: {
      ...PUBLISHED_WHERE,
      slug: { notIn: [slug, ...same.map((s) => s.slug)] },
    },
    select: LIST_SELECT,
    orderBy: [{ tanggal_publish: "desc" }],
    take: take - same.length,
  });
  return [...same, ...fillers].map(toListItem);
}

/** Fire-and-forget view increment (never throws). */
export async function incrementViews(slug: string): Promise<void> {
  try {
    await prisma.berita.update({ where: { slug }, data: { views: { increment: 1 } } });
  } catch {
    /* ignore */
  }
}

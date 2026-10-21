// Admin berita endpoints: list all (any status) + create.
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toListItem, uniqueSlug, type BeritaStatus } from "@/lib/berita";
import { requireBeritaEditor } from "./_guard";
import { normalizeBerita, validateBerita } from "./_payload";
import type { Prisma } from "@prisma/client";
import { editorialWriteError, scheduleError } from "./_workflow";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireBeritaEditor();
  if (guard instanceof NextResponse) return guard;

  const sp = req.nextUrl.searchParams;
  const status = (sp.get("status") || "").toUpperCase();
  const q = (sp.get("q") || "").trim();
  const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));
  const pageSize = Math.min(
    50,
    Math.max(1, Math.floor(Number(sp.get("pageSize")) || 12)),
  );

  const where: Prisma.BeritaWhereInput = {};
  if (["DRAFT", "PUBLISHED", "ARCHIVED", "SCHEDULED"].includes(status)) {
    where.status_publish = status as BeritaStatus;
  }
  if (q) {
    where.OR = [
      { judul: { contains: q, mode: "insensitive" } },
      { kategori: { contains: q, mode: "insensitive" } },
      { penulis: { contains: q, mode: "insensitive" } },
    ];
  }
  if (sp.get("kategori")) where.kategori = sp.get("kategori")!;
  if (sp.get("penulis")) where.penulis = sp.get("penulis")!;
  if (sp.get("review") === "true") where.review_requested_at = { not: null };
  const from = sp.get("from");
  const to = sp.get("to");
  if ([from, to].some((date) => date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return NextResponse.json(
      { error: "Rentang tanggal tidak valid" },
      { status: 400 },
    );
  }
  if (from || to) {
    const gte = from ? new Date(`${from}T00:00:00+07:00`) : undefined;
    const lt = to
      ? new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000)
      : undefined;
    if (
      [gte, lt].some((date) => date && !Number.isFinite(date.getTime())) ||
      (gte && lt && gte >= lt)
    ) {
      return NextResponse.json(
        { error: "Rentang tanggal tidak valid" },
        { status: 400 },
      );
    }
    where.tanggal_dibuat = { gte, lt };
  }
  const sort = sp.get("sort");
  const orderBy: Prisma.BeritaOrderByWithRelationInput[] =
    sort === "views"
      ? [{ views: "desc" }, { id_berita: "desc" }]
      : sort === "oldest"
        ? [{ tanggal_dibuat: "asc" }, { id_berita: "asc" }]
        : [{ tanggal_diupdate: "desc" }, { id_berita: "desc" }];

  try {
    const [rows, total, counts, authors, activity, reviewCount] =
      await Promise.all([
        prisma.berita.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.berita.count({ where }),
        prisma.berita.groupBy({
          by: ["status_publish"],
          _count: { _all: true },
        }),
        prisma.berita.findMany({
          distinct: ["penulis"],
          select: { penulis: true },
          orderBy: { penulis: "asc" },
        }),
        prisma.berita.findMany({
          where: {
            tanggal_dibuat: { gte: new Date(Date.now() - 14 * 86400000) },
          },
          select: { tanggal_dibuat: true, status_publish: true },
        }),
        prisma.berita.count({
          where: {
            status_publish: "DRAFT",
            review_requested_at: { not: null },
          },
        }),
      ]);

    const statusCounts: Record<string, number> = {};
    for (const c of counts) statusCounts[c.status_publish] = c._count._all;

    return NextResponse.json({
      items: rows.map(toListItem),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      statusCounts,
      authors: authors.map((author) => author.penulis),
      reviewCount,
      activity: activity.map((row) => ({
        date: row.tanggal_dibuat.toISOString(),
        status: row.status_publish,
      })),
    });
  } catch (err) {
    console.error("GET /api/berita/admin error:", err);
    return NextResponse.json({ error: "Gagal memuat berita" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireBeritaEditor();
  if (guard instanceof NextResponse) return guard;
  const editor = guard;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });

  const valid = validateBerita(body);
  if (!valid.ok)
    return NextResponse.json({ error: valid.error }, { status: 400 });
  const denied = editorialWriteError(editor.jabatan, body);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const invalidSchedule = scheduleError(body);
  if (invalidSchedule)
    return NextResponse.json({ error: invalidSchedule }, { status: 400 });

  const data = normalizeBerita(body);
  const slug = await uniqueSlug(body?.slug || data.judul);
  const penulis =
    (typeof body?.penulis === "string" && body.penulis.trim()) ||
    editor.penulis;

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Only one headline at a time.
      if (data.berita_utama) {
        await tx.berita.updateMany({
          where: { berita_utama: true },
          data: { berita_utama: false },
        });
      }
      return tx.berita.create({
        data: {
          ...data,
          slug,
          penulis,
          id_agent: editor.id_agent,
          tanggal_diupdate: new Date(),
        },
      });
    });

    revalidatePath("/blog", "layout");
    return NextResponse.json(
      { item: toListItem(created), slug: created.slug },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("POST /api/berita/admin error:", err);
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Slug sudah digunakan." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Gagal menyimpan berita" },
      { status: 500 },
    );
  }
}

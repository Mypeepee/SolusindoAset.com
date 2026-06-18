// Admin berita endpoints: list all (any status) + create.
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toListItem, uniqueSlug, type BeritaStatus } from "@/lib/berita";
import { requireBeritaEditor } from "./_guard";
import { normalizeBerita, validateBerita } from "./_payload";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireBeritaEditor();
  if (guard instanceof NextResponse) return guard;

  const sp = req.nextUrl.searchParams;
  const status = (sp.get("status") || "").toUpperCase();
  const q = (sp.get("q") || "").trim();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize")) || 20));

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

  try {
    const [rows, total, counts] = await Promise.all([
      prisma.berita.findMany({
        where,
        orderBy: { tanggal_diupdate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.berita.count({ where }),
      prisma.berita.groupBy({ by: ["status_publish"], _count: { _all: true } }),
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

  const valid = validateBerita(body);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });

  const data = normalizeBerita(body);
  const slug = await uniqueSlug(body?.slug || data.judul);
  const penulis = (typeof body?.penulis === "string" && body.penulis.trim()) || editor.penulis;

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

    return NextResponse.json({ item: toListItem(created), slug: created.slug }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/berita/admin error:", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Slug sudah digunakan." }, { status: 409 });
    }
    return NextResponse.json({ error: "Gagal menyimpan berita" }, { status: 500 });
  }
}

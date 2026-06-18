// Admin berita endpoints for a single record: read, update, delete.
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toDetail, toListItem, uniqueSlug } from "@/lib/berita";
import { requireBeritaEditor } from "../_guard";
import { normalizeBerita, validateBerita } from "../_payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireBeritaEditor();
  if (guard instanceof NextResponse) return guard;

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  const row = await prisma.berita.findUnique({ where: { id_berita: id } });
  if (!row) return NextResponse.json({ error: "Berita tidak ditemukan" }, { status: 404 });

  return NextResponse.json({ item: toDetail(row as any) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireBeritaEditor();
  if (guard instanceof NextResponse) return guard;

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  const existing = await prisma.berita.findUnique({ where: { id_berita: id } });
  if (!existing) return NextResponse.json({ error: "Berita tidak ditemukan" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const valid = validateBerita(body);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });

  const data = normalizeBerita(body);

  // Keep the original publish date once set, unless the editor supplied one.
  if (existing.tanggal_publish && !body?.tanggal_publish) {
    data.tanggal_publish = existing.tanggal_publish;
  }

  // Re-slug only if explicitly provided or the title changed.
  let slug = existing.slug;
  const wantSlug =
    (typeof body?.slug === "string" && body.slug.trim()) || data.judul;
  if (wantSlug && wantSlug !== existing.slug && data.judul !== existing.judul) {
    slug = await uniqueSlug(wantSlug, id);
  } else if (typeof body?.slug === "string" && body.slug.trim() && body.slug.trim() !== existing.slug) {
    slug = await uniqueSlug(body.slug, id);
  }

  const penulis =
    (typeof body?.penulis === "string" && body.penulis.trim()) || existing.penulis;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (data.berita_utama && !existing.berita_utama) {
        await tx.berita.updateMany({
          where: { berita_utama: true, id_berita: { not: id } },
          data: { berita_utama: false },
        });
      }
      return tx.berita.update({
        where: { id_berita: id },
        data: { ...data, slug, penulis, tanggal_diupdate: new Date() },
      });
    });

    return NextResponse.json({ item: toListItem(updated), slug: updated.slug });
  } catch (err: any) {
    console.error("PATCH /api/berita/admin/[id] error:", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Slug sudah digunakan." }, { status: 409 });
    }
    return NextResponse.json({ error: "Gagal memperbarui berita" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireBeritaEditor();
  if (guard instanceof NextResponse) return guard;

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    await prisma.berita.delete({ where: { id_berita: id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Berita tidak ditemukan" }, { status: 404 });
    }
    console.error("DELETE /api/berita/admin/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus berita" }, { status: 500 });
  }
}

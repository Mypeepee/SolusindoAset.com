import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { beritaPermissions } from "@/lib/beritaPermissions";
import { requireBeritaEditor } from "../_guard";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const editor = await requireBeritaEditor();
  if (editor instanceof NextResponse) return editor;
  if (!beritaPermissions(editor.jabatan).canPublish) {
    return NextResponse.json(
      { error: "Aksi massal publikasi hanya tersedia untuk Owner." },
      { status: 403 },
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }
  if (
    !body ||
    !Array.isArray(body.ids) ||
    !body.ids.length ||
    body.ids.length > 50 ||
    body.ids.some(
      (id: unknown) => typeof id !== "string" || !/^[1-9]\d*$/.test(id),
    )
  ) {
    return NextResponse.json(
      { error: "Pilih 1–50 artikel dengan ID yang valid." },
      { status: 400 },
    );
  }
  if (!["PUBLISHED", "DRAFT", "ARCHIVED", "DELETE"].includes(body.action)) {
    return NextResponse.json({ error: "Aksi tidak valid." }, { status: 400 });
  }
  const ids = Array.from(new Set<string>(body.ids)).map((id) => BigInt(id));
  try {
    const count = await prisma.$transaction(async (tx) => {
      const rows = await tx.berita.findMany({
        where: { id_berita: { in: ids } },
        select: { id_berita: true },
      });
      if (rows.length !== ids.length) throw new Error("MISSING");
      if (body.action === "DELETE")
        return (
          await tx.berita.deleteMany({ where: { id_berita: { in: ids } } })
        ).count;
      // Preserve existing publication dates; assign now only to first-time publications.
      if (body.action === "PUBLISHED") {
        await tx.berita.updateMany({
          where: { id_berita: { in: ids }, tanggal_publish: null },
          data: { tanggal_publish: new Date() },
        });
        await tx.berita.updateMany({
          where: {
            id_berita: { in: ids },
            tanggal_publish: { gt: new Date() },
          },
          data: { tanggal_publish: new Date() },
        });
      }
      return (
        await tx.berita.updateMany({
          where: { id_berita: { in: ids } },
          data: {
            status_publish: body.action,
            review_requested_at: null,
            requested_publish_at: null,
            tanggal_diupdate: new Date(),
          },
        })
      ).count;
    });
    revalidatePath("/blog", "layout");
    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof Error && error.message === "MISSING")
      return NextResponse.json(
        { error: "Sebagian artikel sudah tidak tersedia. Muat ulang daftar." },
        { status: 409 },
      );
    console.error("Bulk berita:", error);
    return NextResponse.json(
      { error: "Aksi massal gagal. Tidak ada perubahan yang disimpan." },
      { status: 500 },
    );
  }
}

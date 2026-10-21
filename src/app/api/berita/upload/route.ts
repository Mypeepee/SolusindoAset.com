// Image upload for berita cover/gallery. Saves to public/uploads/berita.
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireBeritaEditor } from "../admin/_guard";
import sharp from "sharp";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: NextRequest) {
  const guard = await requireBeritaEditor();
  if (guard instanceof NextResponse) return guard;

  try {
    const formData = await req.formData();
    const file = formData.get("image") || formData.get("file");
    if (!(file instanceof File) || !file.size)
      return NextResponse.json(
        { error: "Tidak ada file gambar yang valid" },
        { status: 400 },
      );

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: "Format gambar tidak didukung" },
        { status: 415 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Ukuran gambar maksimal 8MB" },
        { status: 413 },
      );
    }

    const dir = path.join(process.cwd(), "public", "uploads", "berita");
    await mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}.webp`;
    let buffer: Buffer;
    try {
      buffer = await sharp(Buffer.from(await file.arrayBuffer()), {
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize({ width: 2400, withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        {
          error: "Gambar tidak dapat diproses. Gunakan file gambar yang valid.",
        },
        { status: 422 },
      );
    }
    await writeFile(path.join(dir, filename), buffer);

    return NextResponse.json({ url: `/uploads/berita/${filename}` });
  } catch (err) {
    console.error("POST /api/berita/upload error:", err);
    return NextResponse.json(
      { error: "Gagal mengunggah gambar" },
      { status: 500 },
    );
  }
}

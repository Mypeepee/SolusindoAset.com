// Image upload for berita cover/gallery. Saves to public/uploads/berita.
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireBeritaEditor } from "../admin/_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function safeExt(name: string, type: string): string {
  const fromName = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, "");
  if (fromName) return fromName;
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
  };
  return map[type] || ".jpg";
}

export async function POST(req: NextRequest) {
  const guard = await requireBeritaEditor();
  if (guard instanceof NextResponse) return guard;

  try {
    const formData = await req.formData();
    const file = (formData.get("image") || formData.get("file")) as File | null;
    if (!file) return NextResponse.json({ error: "Tidak ada file" }, { status: 400 });

    if (file.type && !ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "Format gambar tidak didukung" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Ukuran gambar maksimal 8MB" }, { status: 413 });
    }

    const dir = path.join(process.cwd(), "public", "uploads", "berita");
    await mkdir(dir, { recursive: true });

    const ext = safeExt(file.name, file.type);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);

    return NextResponse.json({ url: `/uploads/berita/${filename}` });
  } catch (err) {
    console.error("POST /api/berita/upload error:", err);
    return NextResponse.json({ error: "Gagal mengunggah gambar" }, { status: 500 });
  }
}

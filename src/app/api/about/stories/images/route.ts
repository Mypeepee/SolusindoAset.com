import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import {
  MAX_STORY_IMAGE_BYTES,
  STORY_IMAGE_TYPES,
} from "@/lib/success-stories";
import { requireStoryOwner } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const owner = await requireStoryOwner();
    if (owner instanceof NextResponse) return owner;
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || !file.size)
      return NextResponse.json(
        { error: "Pilih foto proyek." },
        { status: 400 },
      );
    if (!STORY_IMAGE_TYPES.includes(file.type))
      return NextResponse.json(
        { error: "Gunakan foto JPG, PNG, WebP, atau AVIF." },
        { status: 415 },
      );
    if (file.size > MAX_STORY_IMAGE_BYTES)
      return NextResponse.json(
        { error: "Ukuran maksimal setiap foto adalah 8 MB." },
        { status: 413 },
      );
    let buffer: Buffer;
    try {
      buffer = await sharp(Buffer.from(await file.arrayBuffer()), {
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize({
          width: 1920,
          height: 1920,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 84 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { error: "Foto tidak dapat dibaca. Pilih file gambar lain." },
        { status: 422 },
      );
    }
    const filename = `${randomUUID()}.webp`;
    const dir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "success-stories",
      owner.id_agent,
    );
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
    return NextResponse.json(
      { url: `/uploads/success-stories/${owner.id_agent}/${filename}` },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[POST /api/about/stories/images]", error);
    return NextResponse.json(
      { error: "Foto belum terunggah. Silakan coba lagi." },
      { status: 503 },
    );
  }
}

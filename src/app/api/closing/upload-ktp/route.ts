import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

export const runtime = "nodejs";
export const maxDuration = 60;

import { googleDrive } from "@/lib/server/googleDrive";

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const namaKlien = (formData.get("nama_klien") as string | null) ?? "klien";

    if (!file) return NextResponse.json({ error: "File wajib disertakan" }, { status: 400 });

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type))
      return NextResponse.json({ error: "Format file tidak didukung. Gunakan JPG, PNG, atau WEBP." }, { status: 400 });

    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: "Ukuran file maksimal 10 MB." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const safeName = namaKlien.replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_") || "klien";
    const filename = `KTP_${safeName}_${Date.now()}.${ext}`;

    const { fileId } = await googleDrive.upload({ buffer, name: filename, mimeType: file.type,
      purpose: "properties", folders: ["KTP Klien"], publicRead: true });

    return NextResponse.json({ ok: true, fileId, filename });
  } catch (err: any) {
    console.error("[upload-ktp]", err);
    return NextResponse.json({ error: err?.message ?? "Gagal upload KTP" }, { status: 500 });
  }
}

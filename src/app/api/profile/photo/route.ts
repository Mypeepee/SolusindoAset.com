// src/app/api/profile/photo/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { googleDrive } from "@/lib/server/googleDrive";

async function uploadProfileToDrive(params: { base64Image: string; filename: string; folderName: string }): Promise<string> {
  const match = params.base64Image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) throw new Error("Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error("Ukuran gambar harus 1 byte sampai 10 MB.");
  const result = await googleDrive.upload({ buffer, name: params.filename, mimeType: match[1],
    purpose: "agents", folders: [params.folderName], publicRead: true });
  return result.fileId;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { cropped_profile_image } = body as {
      cropped_profile_image?: string;
    };

    if (!cropped_profile_image) {
      return NextResponse.json(
        { error: "cropped_profile_image tidak ditemukan" },
        { status: 400 }
      );
    }

    // pastikan user agent
    const agent = await prisma.agent.findUnique({
      where: { id_pengguna: session.user.id },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Akun agent tidak ditemukan" },
        { status: 404 }
      );
    }


    // nama folder: slug dari nama agent atau fallback id_pengguna
    const nama =
      (session.user.name || session.user.id) || session.user.id;

    const folderName = nama
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    const filename = `agent_profile_${Date.now()}.jpg`;

    // Upload foto baru DULU sebelum hapus yang lama
    const fileId = await uploadProfileToDrive({
      base64Image: cropped_profile_image,
      filename,
      folderName,
    });

    const updated = await prisma.agent.update({
      where: { id_agent: agent.id_agent },
      data: {
        foto_profil_url: fileId,
      },
    });

    // Setelah DB berhasil disimpan, baru hapus foto lama dari Drive
    const oldUrl = agent.foto_profil_url;
    if (oldUrl) {
      let oldFileId: string | null = null;
      if (oldUrl.length < 100) {
        // sudah berupa raw Drive fileId
        oldFileId = oldUrl;
      } else {
        // coba ekstrak fileId dari URL (https://drive.google.com/...?id=XXX)
        try {
          const parsed = new URL(oldUrl);
          oldFileId = parsed.searchParams.get("id");
          if (!oldFileId) {
            const m = parsed.pathname.match(/\/d\/([^/]+)/);
            oldFileId = m?.[1] ?? null;
          }
        } catch {
          // bukan URL valid, lewati
        }
      }

      if (oldFileId) {
        await googleDrive.deleteFile(oldFileId).catch(() =>
          console.warn("Gagal membersihkan foto profil lama di Google Drive.")
        );
      }
    }

    return NextResponse.json({
      success: true,
      fileId,
      agent: updated,
    });
  } catch (err) {
    console.error("Error update foto profil:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui foto profil" },
      { status: 500 }
    );
  }
}

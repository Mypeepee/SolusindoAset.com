// src/app/api/profile/npwp/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { googleDrive } from "@/lib/server/googleDrive";

async function uploadNpwpToDrive(params: { base64Image: string; filename: string; folderName: string }): Promise<string> {
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
    const { nomor_npwp, cropped_image_npwp } = body as {
      nomor_npwp?: string;
      cropped_image_npwp?: string;
    };

    if (!nomor_npwp && !cropped_image_npwp) {
      return NextResponse.json(
        { error: "nomor_npwp atau foto NPWP wajib diisi" },
        { status: 400 }
      );
    }

    // ambil nama user untuk nama folder
    const user = await prisma.pengguna.findUnique({
      where: { id_pengguna: session.user.id },
      select: { nama_lengkap: true },
    });

    const nama = user?.nama_lengkap || session.user.id;
    const folderName = nama
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    let fileId: string | null = null;

    if (cropped_image_npwp) {
      const filename = `npwp_${Date.now()}.jpg`;
      fileId = await uploadNpwpToDrive({
        base64Image: cropped_image_npwp,
        filename,
        folderName,
      });
    }

    const updatedAgent = await prisma.agent.update({
      where: {
        id_pengguna: session.user.id,
      },
      data: {
        ...(nomor_npwp ? { nomor_npwp } : {}),
        ...(fileId ? { foto_npwp_url: fileId } : {}),
        diperbarui_pada: new Date(),
      },
    });

    return NextResponse.json({
      fileId,
      agent: updatedAgent,
    });
  } catch (err) {
    console.error("Error upload/simpan NPWP:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan data NPWP" },
      { status: 500 }
    );
  }
}

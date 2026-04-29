// app/api/property/[id]/video/route.ts
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { renderMedia } from "@remotion/renderer";
import path from "path";

const prisma = new PrismaClient();

function parseGambar(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    const property = await prisma.property.findUnique({
      where: { id_property: id },
      include: {
        agent: {
          include: {
            pengguna: true,
          },
        },
      },
    });

    if (!property) {
      return new Response("Property not found", { status: 404 });
    }

    const imageUrls = parseGambar(property.gambar);

    const address =
      property.alamat_lengkap ??
      [
        property.kelurahan,
        property.kecamatan,
        property.kota,
        property.provinsi,
      ]
        .filter(Boolean)
        .join(", ");

    const limitPrice = Number(
      property.nilai_limit_lelang ?? property.harga ?? 0
    );
    const marketPrice = Number(property.harga ?? 0);

    const agentName =
      property.agent?.pengguna?.nama_lengkap ??
      property.agent?.nama_kantor ??
      "Agent Kami";

    // Sama seperti CLI: pakai entryPoint (bukan serveUrl bundle)
    const entry = path.join(process.cwd(), "remotion", "index.tsx");

    console.log("Remotion render starting for property:", id);

    const { readableStream } = await renderMedia({
      entryPoint: entry,
      composition: "property-video",
      codec: "h264",
      inputProps: {
        imageUrls,
        address,
        limitPrice,
        marketPrice,
        agentName,
        theme: "default",
      },
      logLevel: "info",
    });

    console.log("Remotion render finished for property:", id);

    const stream = readableStream as unknown as ReadableStream;

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="property-${id}.mp4"`,
      },
    });
  } catch (err: any) {
    console.error("ERROR render video:", err);
    return new Response(
      `Failed to render video: ${err?.message ?? "Unknown error"}`,
      { status: 500 }
    );
  }
}

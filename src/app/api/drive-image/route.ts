import { NextRequest, NextResponse } from "next/server";

// Proxy Google Drive images melalui server.
// Mendukung parameter `sz` (mis. w400, w800) untuk thumbnail berukuran kecil.
// Cache-Control: immutable → browser/CDN cache selamanya, tidak pernah hit Drive lagi.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const sz = req.nextUrl.searchParams.get("sz"); // opsional, mis. "w400"

  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return new NextResponse("Invalid file ID", { status: 400 });
  }

  // Pakai thumbnail endpoint kalau sz diberikan (jauh lebih kecil dari full image)
  const driveUrl = sz
    ? `https://drive.google.com/thumbnail?id=${id}&sz=${sz}`
    : `https://drive.google.com/thumbnail?id=${id}&sz=w800`;

  try {
    const res = await fetch(driveUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return new NextResponse("Gagal mengambil gambar dari Drive", {
        status: res.status,
      });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";

    if (!contentType.startsWith("image/")) {
      return new NextResponse("Bukan file gambar", { status: 415 });
    }

    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new NextResponse("Gagal fetch gambar", { status: 502 });
  }
}

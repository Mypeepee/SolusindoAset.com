import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // penting: biar fetch streaming aman
export const dynamic = "force-dynamic";

function getDriveId(url: string) {
  // thumbnail?id=...
  const m1 = url.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/i);
  if (m1?.[1]) return m1[1];

  // uc?export=view&id=...
  const m2 = url.match(/drive\.google\.com\/uc\?(?:[^#]*&)?id=([^&]+)/i);
  if (m2?.[1]) return m2[1];

  // open?id=...
  const m3 = url.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  if (m3?.[1]) return m3[1];

  // file/d/<id>/
  const m4 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m4?.[1]) return m4[1];

  return null;
}

function rewriteDrive(url: string) {
  const id = getDriveId(url);
  if (!id) return url;

  // paling stabil untuk img:
  // return `https://drive.google.com/uc?export=view&id=${id}`;

  // atau kalau kamu mau thumbnail yang konsisten size:
  return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
}

function isHttpUrl(u: string) {
  return u.startsWith("http://") || u.startsWith("https://");
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !isHttpUrl(url)) {
    return NextResponse.json({ error: "Missing/invalid url" }, { status: 400 });
  }

  // sanitize: remove spaces only (jangan hapus underscore)
  const targetRaw = url.replace(/\s/g, "");
  const target = targetRaw.includes("drive.google.com") ? rewriteDrive(targetRaw) : targetRaw;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const upstream = await fetch(target, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
      },
      next: { revalidate: 86400 },
    }).finally(() => clearTimeout(timeout));

    if (!upstream.ok) {
      // debug friendly
      return NextResponse.json(
        { error: "Upstream not ok", status: upstream.status, target },
        { status: 404 }
      );
    }

    const ct = upstream.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) {
      // Drive kadang balikin HTML/redirect page -> treat as not image
      return NextResponse.json(
        { error: "Upstream not image", contentType: ct, target },
        { status: 404 }
      );
    }

    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Proxy failed", message: e?.message || "unknown", target },
      { status: 502 }
    );
  }
}
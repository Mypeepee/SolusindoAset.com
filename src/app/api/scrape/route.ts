import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export interface ScrapedProperty {
  judul: string;
  harga: string;
  lokasi: string;
  luas_tanah?: string;
  luas_bangunan?: string;
  kamar_tidur?: string;
  kamar_mandi?: string;
  url: string;
  gambar?: string;
}

// Regex helpers
function extractText(html: string, regex: RegExp): string {
  const m = html.match(regex);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

function parseOlx(html: string, baseUrl: string): ScrapedProperty[] {
  const results: ScrapedProperty[] = [];
  const itemRegex =
    /<li[^>]*data-aut-id="itemBox[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(html)) !== null) {
    const block = m[1];
    const judul = extractText(block, /data-aut-id="itemTitle"[^>]*>([^<]+)</i);
    const harga = extractText(block, /data-aut-id="itemPrice"[^>]*>([^<]+)</i);
    const lokasi = extractText(
      block,
      /data-aut-id="item-location"[^>]*>([^<]+)</i
    );
    const urlMatch = block.match(/href="([^"]+)"/i);
    const gambarMatch = block.match(/src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
    if (judul) {
      results.push({
        judul,
        harga: harga || "-",
        lokasi: lokasi || "-",
        url: urlMatch
          ? urlMatch[1].startsWith("http")
            ? urlMatch[1]
            : baseUrl + urlMatch[1]
          : "-",
        gambar: gambarMatch ? gambarMatch[1] : undefined,
      });
    }
  }
  return results;
}

function parseRumah123(html: string, baseUrl: string): ScrapedProperty[] {
  const results: ScrapedProperty[] = [];
  // article cards
  const cardRegex = /<article[^>]*class="[^"]*card[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = cardRegex.exec(html)) !== null) {
    const block = m[1];
    const judul = extractText(block, /class="[^"]*card-title[^"]*"[^>]*>([^<]+)</i);
    const harga = extractText(block, /class="[^"]*price[^"]*"[^>]*>([^<]+)</i);
    const lokasi = extractText(block, /class="[^"]*card-location[^"]*"[^>]*>([^<]+)</i);
    const urlMatch = block.match(/href="([^"]+)"/i);
    const gambarMatch = block.match(/src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
    if (judul) {
      results.push({
        judul,
        harga: harga || "-",
        lokasi: lokasi || "-",
        url: urlMatch
          ? urlMatch[1].startsWith("http")
            ? urlMatch[1]
            : baseUrl + urlMatch[1]
          : "-",
        gambar: gambarMatch ? gambarMatch[1] : undefined,
      });
    }
  }
  return results;
}

function parseGeneric(html: string, baseUrl: string): ScrapedProperty[] {
  // Coba ambil semua <a> yang mengandung harga Rp
  const results: ScrapedProperty[] = [];
  const seen = new Set<string>();

  // Cari blok dengan pola harga
  const priceBlockRegex = /Rp[\s\d.,]+(?:Juta|Miliar|M|Jt)?/gi;
  const titleRegex = /<(?:h[1-6]|strong|b)[^>]*>([^<]{10,120})<\/(?:h[1-6]|strong|b)>/gi;
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]{5,100})<\/a>/gi;

  // Collect links with reasonable text
  let lm: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    lm = m as RegExpExecArray;
    const href = lm[1];
    const text = lm[2].trim();
    if (!seen.has(href) && text.length > 10 && !href.includes("javascript")) {
      seen.add(href);
    }
  }

  // Collect titles as property listings
  let tm: RegExpExecArray | null;
  while ((tm = titleRegex.exec(html)) !== null) {
    const judul = tm[1].trim();
    if (judul.length > 10) {
      const idx = html.indexOf(tm[0]);
      const nearby = html.slice(Math.max(0, idx - 200), idx + 500);
      const hargaMatch = nearby.match(priceBlockRegex);
      const linkMatch = nearby.match(/href="([^"]+)"/i);
      if (!seen.has(judul)) {
        seen.add(judul);
        results.push({
          judul,
          harga: hargaMatch ? hargaMatch[0] : "-",
          lokasi: "-",
          url: linkMatch
            ? linkMatch[1].startsWith("http")
              ? linkMatch[1]
              : baseUrl + linkMatch[1]
            : "-",
        });
      }
    }
  }
  return results.slice(0, 30);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, kategori } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL wajib diisi" }, { status: 400 });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "URL tidak valid" }, { status: 400 });
    }

    const res = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Gagal fetch URL: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const baseUrl = `${targetUrl.protocol}//${targetUrl.host}`;
    const hostname = targetUrl.hostname;

    let properties: ScrapedProperty[] = [];

    if (hostname.includes("olx.co.id")) {
      properties = parseOlx(html, baseUrl);
    } else if (
      hostname.includes("rumah123.com") ||
      hostname.includes("lamudi.co.id") ||
      hostname.includes("99.co")
    ) {
      properties = parseRumah123(html, baseUrl);
    } else {
      properties = parseGeneric(html, baseUrl);
    }

    return NextResponse.json({
      total: properties.length,
      kategori: kategori || "semua",
      url: targetUrl.toString(),
      data: properties,
    });
  } catch (err: any) {
    console.error("Scrape error:", err);
    if (err.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timeout (15 detik)" }, { status: 504 });
    }
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan" },
      { status: 500 }
    );
  }
}

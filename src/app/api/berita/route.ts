// Public berita (blog) listing — published only, with search/category/pagination.
import { NextRequest, NextResponse } from "next/server";
import { getPublishedList } from "@/lib/berita";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const data = await getPublishedList({
      q: sp.get("q") || undefined,
      kategori: sp.get("kategori") || undefined,
      page: Number(sp.get("page")) || 1,
      pageSize: Number(sp.get("pageSize")) || 9,
      excludeSlug: sp.get("excludeSlug") || undefined,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/berita error:", err);
    return NextResponse.json({ error: "Gagal memuat berita" }, { status: 500 });
  }
}

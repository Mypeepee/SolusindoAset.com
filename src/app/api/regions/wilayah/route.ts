import { NextResponse } from "next/server";
import {
  getIndonesiaRegions,
  type RegionLevel,
} from "@/lib/indonesia-regions.server";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams,
      level = params.get("level") || "",
      parent = params.get("parentId") || "";
    if (
      !["provinsi", "kota", "kecamatan", "kelurahan"].includes(level) ||
      (level !== "provinsi" && !/^\d{2,12}$/.test(parent))
    )
      return NextResponse.json(
        { ok: false, message: "Permintaan wilayah tidak valid." },
        { status: 400 },
      );
    return NextResponse.json({
      ok: true,
      items: await getIndonesiaRegions(level as RegionLevel, parent),
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Referensi wilayah belum dapat dimuat." },
      { status: 503 },
    );
  }
}

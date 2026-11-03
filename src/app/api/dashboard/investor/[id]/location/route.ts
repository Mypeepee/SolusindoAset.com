import { NextRequest, NextResponse } from "next/server";
import {
  requireInvestorOwner,
  investorPrivateHeaders as headers,
} from "@/lib/investor-owner.server";
import {
  getInvestorLocationOptions,
  correctInvestorLocation,
} from "@/lib/investor-location.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const failure = (error: unknown) => {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const status =
    code === "LOCATION_CONFLICT"
      ? 409
      : code === "LISTING_NOT_FOUND"
        ? 404
        : code.startsWith("INVALID_")
          ? 400
          : 503;
  const message =
    status === 409
      ? "Lokasi listing sudah berubah. Muat ulang pilihan sebelum menyimpan."
      : status === 404
        ? "Listing tidak ditemukan."
        : status === 400
          ? "Pilih kecamatan dan kelurahan yang sesuai dengan kota listing."
          : "Referensi wilayah belum dapat dimuat. Coba lagi.";
  return NextResponse.json({ error: message }, { status, headers });
};
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const denied = await requireInvestorOwner();
    if (denied) return denied;
    return NextResponse.json(
      await getInvestorLocationOptions(
        params.id,
        request.nextUrl.searchParams.get("districtId") || undefined,
      ),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const denied = await requireInvestorOwner();
    if (denied) return denied;
    const origin = request.headers.get("origin");
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && origin !== request.nextUrl.origin)
    )
      return NextResponse.json(
        { error: "Asal permintaan tidak diizinkan." },
        { status: 403, headers },
      );
    const body = await request.json().catch(() => {
      throw new Error("INVALID_LOCATION");
    });
    if (
      !body ||
      typeof body.districtId !== "string" ||
      typeof body.kelurahanId !== "string" ||
      typeof body.revision !== "string"
    )
      throw new Error("INVALID_LOCATION");
    return NextResponse.json(await correctInvestorLocation(params.id, body), {
      headers,
    });
  } catch (error) {
    return failure(error);
  }
}

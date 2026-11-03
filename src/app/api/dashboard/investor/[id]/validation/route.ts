import { NextRequest, NextResponse } from "next/server";
import { getCmaValidationProof } from "@/lib/investor-deals.server";
import {
  requireInvestorOwner,
  investorPrivateHeaders as headers,
} from "@/lib/investor-owner.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const denied = await requireInvestorOwner();
    if (denied) return denied;
    if (!/^\d{1,20}$/.test(params.id))
      return NextResponse.json(
        { error: "ID listing tidak valid." },
        { status: 400, headers },
      );
    const proof = await getCmaValidationProof(params.id);
    if (!proof)
      return NextResponse.json(
        {
          error:
            "Listing ini sudah tidak aktif. Perbarui dashboard untuk melihat data terbaru.",
        },
        { status: 404, headers },
      );
    return NextResponse.json(proof, { headers });
  } catch (error) {
    console.error(
      "[Investor CMA validation]",
      error instanceof Error ? error.name : "Database error",
    );
    return NextResponse.json(
      {
        error:
          "Bukti CMA belum dapat dimuat. Coba lagi untuk memvalidasi benchmark.",
      },
      { status: 503, headers },
    );
  }
}

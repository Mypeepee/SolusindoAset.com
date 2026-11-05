import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_DEAL_THRESHOLD,
  isolateTransactionFilters,
  type DealFilters,
} from "@/lib/investor-deals";
import { getInvestorFeed } from "@/lib/investor-deals.server";
import { readInvestorSearch } from "@/lib/investor-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import {
  requireInvestorOwner,
  investorPrivateHeaders as headers,
} from "@/lib/investor-owner.server";
export async function GET(request: NextRequest) {
  try {
    const started = performance.now();
    const denied = await requireInvestorOwner();
    if (denied) return denied;
    const authorizedAt = performance.now();
    const params = request.nextUrl.searchParams;
    const percentage = (name: string) => {
      const raw = params.get(name);
      const value =
        raw === null || raw === "" ? DEFAULT_DEAL_THRESHOLD : Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 100)
        throw new Error("INVALID_FILTER");
      return value;
    };
    const sort = params.get("sort") || "score",
      view = params.get("view") || "grid";
    const page = Number(params.get("page") || 1);
    if (
      !["score", "spread", "drop", "price", "auctionDate"].includes(sort) ||
      !["grid", "table", "map"].includes(view) ||
      !Number.isSafeInteger(page) ||
      page < 1
    )
      throw new Error("INVALID_FILTER");
    const city = params.get("city") === "all" ? "" : params.get("city") || "";
    const query = params.get("q") || "";
    const savedIds = (params.get("ids") || "").split(",").filter(Boolean);
    if (
      city.length > 300 ||
      query.length > 150 ||
      savedIds.length > 500 ||
      savedIds.some((id) => !/^\d{1,20}$/.test(id))
    )
      throw new Error("INVALID_FILTER");
    const transactionType = params.get("transaction") || "BELI";
    const listingCategory = params.get("category") || "ALL";
    const dataState = params.get("data") || "all";
    if (
      !["BELI", "SEWA"].includes(transactionType) ||
      !["ALL", "PRIMARY", "LELANG", "SECONDARY"].includes(listingCategory) ||
      !["deals", "all", "unverified"].includes(dataState)
    )
      throw new Error("INVALID_FILTER");
    const filters: DealFilters = isolateTransactionFilters({
      ...readInvestorSearch(params, true),
      transactionType: transactionType as DealFilters["transactionType"],
      listingCategory: listingCategory as DealFilters["listingCategory"],
      dataState: dataState as DealFilters["dataState"],
      city,
      query,
      minSpread: percentage("spread"),
      minDrop: percentage("drop"),
      sort: sort as DealFilters["sort"],
      savedOnly: params.get("saved") === "1",
      upcomingOnly: params.get("upcoming") === "1",
    });
    const data = await getInvestorFeed(
      filters,
      page,
      view,
      savedIds,
      params.get("refresh") === "1",
    );
    return NextResponse.json(data, {
      headers: {
        ...headers,
        "Server-Timing": `auth;dur=${(authorizedAt - started).toFixed(1)}, investor;dur=${(performance.now() - authorizedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_FILTER")
      return NextResponse.json(
        {
          error:
            "Periksa filter. Rentang minimum tidak boleh melebihi maksimum dan persentase harus 0–100.",
        },
        { status: 400, headers },
      );
    if (error instanceof Error && error.message === "INVESTOR_CITY_NOT_FOUND")
      return NextResponse.json(
        {
          error: "Wilayah ini tidak tersedia dalam database. Pilih kota lain.",
        },
        { status: 400, headers },
      );
    console.error(
      "[Investor feed]",
      error instanceof Error ? error.name : "Database error",
    );
    return NextResponse.json(
      {
        error:
          "Data Investor belum dapat dimuat. Coba perbarui beberapa saat lagi.",
      },
      { status: 503, headers },
    );
  }
}

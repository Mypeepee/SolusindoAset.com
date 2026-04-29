import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (!month || !year) {
    return NextResponse.json({ error: "month and year required" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://dayoffapi.vercel.app/api?month=${month}&year=${year}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 86400 }, // cache 24 jam di server
      }
    );

    if (!response.ok) {
      return NextResponse.json([], { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json(Array.isArray(data) ? data : [], {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return NextResponse.json([]);
  }
}

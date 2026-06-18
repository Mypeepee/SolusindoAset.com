import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { scrapeJobManager } from "@/lib/scrape-job";

// POST /api/scrape/lelang/stop
// Mengeset cancellation flag → loop scraping akan break di check point berikutnya
// (page loop, detail loop, atau sebelum prisma.listing.create).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cancelled = scrapeJobManager.cancel();
  return NextResponse.json({
    ok: true,
    cancelled,
    status: scrapeJobManager.current?.status ?? "idle",
  });
}

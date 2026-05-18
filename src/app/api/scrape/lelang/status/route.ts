import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { scrapeJobManager } from "@/lib/scrape-job";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/scrape/lelang/status
// Snapshot ringan job saat ini. Dipakai client pada mount untuk
// menentukan apakah perlu auto-reconnect ke stream yang sedang jalan.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = scrapeJobManager.current;
  console.log(
    "[scrape:/status] job =",
    job
      ? {
          id: job.id,
          status: job.status,
          cancelled: job.cancelled,
          totalSaved: job.totalSaved,
          currentPage: job.currentPage,
        }
      : null,
  );

  if (!job) {
    return NextResponse.json({ running: false, job: null });
  }

  return NextResponse.json({
    running: job.status === "running",
    job: {
      id: job.id,
      kategori: job.kategori,
      startPage: job.startPage,
      status: job.status,
      totalSaved: job.totalSaved,
      totalSkipped: job.totalSkipped,
      currentPage: job.currentPage,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt ?? null,
    },
  });
}

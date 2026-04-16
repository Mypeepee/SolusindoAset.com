import { NextRequest, NextResponse } from "next/server";
import Holidays from "date-holidays";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Parameter year/month tidak valid" }, { status: 400 });
  }

  const hd = new Holidays("ID");
  const all = hd.getHolidays(year) as Array<{
    date: string;
    name: string;
    type: string;
  }>;

  // Filter to requested month and only public/observance holidays
  const result = all
    .filter((h) => {
      const d = new Date(h.date);
      return (
        d.getMonth() + 1 === month &&
        (h.type === "public" || h.type === "observance")
      );
    })
    .map((h) => {
      const d    = new Date(h.date);
      const yyyy = d.getFullYear();
      const mm   = String(d.getMonth() + 1).padStart(2, "0");
      const dd   = String(d.getDate()).padStart(2, "0");
      return {
        tanggal:         `${yyyy}-${mm}-${dd}`,
        tanggal_display: `${dd}/${mm}/${yyyy}`,
        keterangan:      h.name,
        is_cuti:         false,
      };
    });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

/* ────────────────────────────────────────────────────────────────────
   /api/dashboard/agent/listing-performance
   Returns two ranked slices for the agent's own active listings:
     • topPerformers — highest composite engagement score
     • needsAttention — listings stagnating (no recent leads + aging)
   Used by the ListingPerformanceCard on the premium dashboard.
   ──────────────────────────────────────────────────────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000;
const STAGNANT_AGE_DAYS = 30;
const STAGNANT_NO_LEAD_DAYS = 21;

function serializeBigInt(data: unknown): unknown {
  return JSON.parse(
    JSON.stringify(data, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  );
}

/**
 * Mirror semantik [Jual]/page.tsx & [Lelang]/page.tsx: kolom `gambar` di DB
 * berbentuk comma-separated dan tiap item bisa full URL (drive.google.com,
 * file.lelang.go.id, /local, dst) atau bare Google Drive fileId.
 * Untuk dashboard kita hanya butuh URL pertama yang resolvable.
 */
function resolveFirstImage(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const first = raw
    .split(",")
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  if (!first) return null;
  const lower = first.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    first.startsWith("/")
  ) {
    return first;
  }
  // Bare Drive ID — wrap dengan thumbnail endpoint
  return `https://drive.google.com/thumbnail?id=${first}&sz=w400`;
}

const KATEGORI_LABEL: Record<string, string> = {
  RUMAH: "Rumah",
  APARTEMEN: "Apartemen",
  RUKO: "Ruko",
  TANAH: "Tanah",
  GUDANG: "Gudang",
  HOTEL_DAN_VILLA: "Hotel & Villa",
  TOKO: "Toko",
  PABRIK: "Pabrik",
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agentId = (session.user as { agentId?: string }).agentId;
    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID tidak ditemukan di sesi" },
        { status: 400 },
      );
    }

    // Only listings yang masih tayang (TERSEDIA). Listings yang sudah
    // TERJUAL atau TARIK_LISTING tidak relevan untuk "perlu di-boost".
    const listings = await prisma.listing.findMany({
      where: {
        id_agent: agentId,
        status_tayang: "TERSEDIA",
      },
      select: {
        id_property: true,
        slug: true,
        judul: true,
        kota: true,
        kecamatan: true,
        alamat_lengkap: true,
        gambar: true,
        harga: true,
        harga_promo: true,
        nilai_limit_lelang: true,
        jenis_transaksi: true,
        kategori: true,
        status_tayang: true,
        luas_tanah: true,
        luas_bangunan: true,
        dilihat: true,
        wa_click_count: true,
        is_hot_deal: true,
        tanggal_dibuat: true,
        _count: { select: { leads: true } },
        leads: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: { created_at: true },
        },
      },
      // We sort in JS by composite score; cap to a reasonable upper bound.
      orderBy: { tanggal_diupdate: "desc" },
      take: 200,
    });

    const now = Date.now();

    type Enriched = {
      id_property: string;
      slug: string;
      judul: string;
      kota: string;
      kecamatan: string | null;
      alamat_lengkap: string | null;
      gambar: string | null;
      harga: number;
      jenis_transaksi: string;
      kategori: string;
      kategori_label: string;
      status_tayang: string;
      luas_tanah: number;
      luas_bangunan: number;
      views: number;
      wa_clicks: number;
      lead_count: number;
      is_hot_deal: boolean;
      days_active: number;
      last_lead_days_ago: number | null;
      /** Higher = better engagement. */
      score: number;
      /** A simple velocity proxy = score / days_active, used as "trend". */
      velocity: number;
    };

    const enriched: Enriched[] = listings.map((l) => {
      const created = l.tanggal_dibuat
        ? new Date(l.tanggal_dibuat).getTime()
        : now;
      const days_active = Math.max(1, Math.floor((now - created) / DAY_MS));

      const lastLead = l.leads[0]?.created_at
        ? new Date(l.leads[0].created_at).getTime()
        : null;
      const last_lead_days_ago =
        lastLead !== null
          ? Math.max(0, Math.floor((now - lastLead) / DAY_MS))
          : null;

      // Composite score — weighted by what's most "intent-y":
      //  WhatsApp click > inquiry/lead > raw view.
      //  Hot Deal flag adds a small boost.
      const score =
        l.dilihat * 0.3 +
        l._count.leads * 6 +
        l.wa_click_count * 2.5 +
        (l.is_hot_deal ? 15 : 0);

      const velocity = score / days_active;

      const kategoriRaw = String(l.kategori);

      return {
        id_property: l.id_property.toString(),
        slug: l.slug,
        judul: l.judul,
        kota: l.kota,
        kecamatan: l.kecamatan,
        alamat_lengkap: l.alamat_lengkap ?? null,
        gambar: resolveFirstImage(l.gambar),
        harga: l.jenis_transaksi === "LELANG"
          ? Number(l.nilai_limit_lelang ?? 0)
          : Number(l.harga_promo ?? l.harga ?? 0),
        jenis_transaksi: String(l.jenis_transaksi),
        kategori: kategoriRaw,
        kategori_label: KATEGORI_LABEL[kategoriRaw] ?? kategoriRaw,
        status_tayang: String(l.status_tayang),
        luas_tanah: Number(l.luas_tanah ?? 0),
        luas_bangunan: Number(l.luas_bangunan ?? 0),
        views: l.dilihat,
        wa_clicks: l.wa_click_count,
        lead_count: l._count.leads,
        is_hot_deal: l.is_hot_deal,
        days_active,
        last_lead_days_ago,
        score,
        velocity,
      };
    });

    const topPerformers = [...enriched]
      .filter((l) => l.score > 0) // listings yang punya engagement
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Stagnan: cukup tua untuk dinilai (>30 hari aktif) DAN
    // tidak ada lead baru >21 hari (atau tidak pernah ada lead sama sekali).
    const needsAttention = [...enriched]
      .filter((l) => {
        if (l.days_active < STAGNANT_AGE_DAYS) return false;
        if (l.lead_count === 0) return true;
        return (l.last_lead_days_ago ?? 0) >= STAGNANT_NO_LEAD_DAYS;
      })
      .sort((a, b) => {
        // Prioritize listings yang DULU pernah ramai (views tinggi)
        // tapi sekarang stagnan — kandidat repricing terbaik.
        const aScore = a.views + (a.last_lead_days_ago ?? a.days_active);
        const bScore = b.views + (b.last_lead_days_ago ?? b.days_active);
        return bScore - aScore;
      })
      .slice(0, 5);

    const totalActive = enriched.length;
    const totalHot = enriched.filter(
      (l) => l.is_hot_deal || l.score >= 30,
    ).length;

    return NextResponse.json(
      serializeBigInt({
        ok: true,
        totalActive,
        totalHot,
        topPerformers,
        needsAttention,
      }),
    );
  } catch (err) {
    console.error("listing-performance error:", err);
    return NextResponse.json(
      { error: "Gagal memuat performa listing" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

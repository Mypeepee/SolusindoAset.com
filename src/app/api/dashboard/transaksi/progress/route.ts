import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// ── Image helpers (same logic as listings route) ──────────────────────────────

function normalizeUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  const driveMatch =
    raw.match(/drive\.google\.com\/file\/d\/([^/]+)/) ??
    raw.match(/drive\.google\.com\/open\?id=([^&]+)/) ??
    raw.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
  if (driveMatch?.[1]) return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  return raw;
}

function extractFirstImageUrl(raw: unknown): string {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";
  const candidates = str
    .split(",")
    .map((x) => normalizeUrl(x))
    .filter((u) => u.startsWith("http://") || u.startsWith("https://") || u.startsWith("/"));
  return candidates[0] ?? "";
}

function toProxyImg(url: string): string {
  if (!url) return "";
  if (url.startsWith("/")) return url;
  if (url.startsWith("http://") || url.startsWith("https://"))
    return `/api/img?url=${encodeURIComponent(url)}`;
  return "";
}

function resolveAgentFoto(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim();
  if (!s) return "";
  // Extract Drive file ID from any Drive URL format
  const driveMatch =
    s.match(/drive\.google\.com\/file\/d\/([^/?]+)/) ??
    s.match(/drive\.google\.com\/open\?id=([^&]+)/) ??
    s.match(/drive\.google\.com\/uc\?.*id=([^&]+)/) ??
    s.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/);
  if (driveMatch?.[1]) {
    const thumb = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w200`;
    return `/api/img?url=${encodeURIComponent(thumb)}`;
  }
  // Bare Drive file ID (no protocol, no dots, 20+ alfanumerik)
  if (!s.includes("://") && !s.includes(".") && /^[a-zA-Z0-9_-]{20,}$/.test(s)) {
    const thumb = `https://drive.google.com/thumbnail?id=${s}&sz=w200`;
    return `/api/img?url=${encodeURIComponent(thumb)}`;
  }
  return toProxyImg(s);
}

// ── Numeric helpers ───────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && typeof (v as { toString(): string }).toString === "function")
    return Number((v as { toString(): string }).toString());
  return Number(v);
}

function resolveNilai(jenis: string, tipeKomisi: string, hargaDeal: unknown, hargaBidding: unknown): number {
  if (jenis === "LELANG" && tipeKomisi.toUpperCase() === "PERSENTASE") {
    return toNum(hargaBidding);
  }
  return toNum(hargaDeal);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { agentId?: string | null };
  const agentId = user.agentId;
  if (!agentId) return NextResponse.json({ error: "Bukan agent" }, { status: 403 });

  // Query jabatan langsung dari DB — jangan andalkan session yang bisa stale
  const agentRow = await prisma.agent.findUnique({
    where: { id_agent: agentId },
    select: { jabatan: true },
  });
  const isOwner = agentRow?.jabatan === "OWNER";

  const { searchParams } = new URL(req.url);
  const take = Math.min(Math.max(Number(searchParams.get("take") ?? 50), 1), 100);
  const skip = Math.max(Number(searchParams.get("skip") ?? 0), 0);
  const statusFilter = searchParams.get("status") ?? "";
  const jenisFilter  = searchParams.get("jenis") ?? "";
  const q = searchParams.get("q") ?? "";

  // Owner melihat semua transaksi, agent biasa hanya miliknya sendiri
  const baseWhere: Record<string, unknown> = isOwner ? {} : { id_agent: agentId };

  if (statusFilter && statusFilter !== "ALL") {
    baseWhere.status_transaksi = statusFilter;
  }
  if (jenisFilter && jenisFilter !== "ALL") {
    baseWhere.jenis_transaksi = jenisFilter;
  }
  if (q) {
    baseWhere.OR = [
      { id_transaksi: { contains: q, mode: "insensitive" } },
      { listing: { judul: { contains: q, mode: "insensitive" } } },
      { listing: { kota: { contains: q, mode: "insensitive" } } },
    ];
  }

  const agentBaseWhere = isOwner ? {} : { id_agent: agentId };

  const [rows, total, selesaiCount, allForStats] = await Promise.all([
    prisma.transaksi.findMany({
      where: baseWhere,
      orderBy: { diperbarui_pada: "desc" },
      take,
      skip,
      select: {
        id: true,
        id_transaksi: true,
        status_transaksi: true,
        jenis_transaksi: true,
        tipe_komisi: true,
        harga_deal: true,
        harga_promo_deal: true,
        harga_bidding: true,
        tanggal_transaksi: true,
        dibuat_pada: true,
        persentase_komisi: true,
        pendapatan_bersih_kantor: true,
        thc_agent: true,
        catatan: true,
        rating: true,
        comment: true,
        biaya_baliknama: true,
        biaya_pengosongan: true,
        royalty_fee: true,
        cobroke_fee: true,
        agent_luar_nama: true,
        agent_luar_kantor: true,
        agent_luar_telepon: true,
        agent: {
          select: {
            id_agent: true,
            nama_kantor: true,
            foto_profil_url: true,
            pengguna: { select: { nama_lengkap: true } },
          },
        },
        klien: { select: { nama_lengkap: true } },
        listing: {
          select: {
            id_property: true,
            judul: true,
            gambar: true,
            kota: true,
            kecamatan: true,
            kelurahan: true,
            alamat_lengkap: true,
          },
        },
        detail: {
          select: {
            role: true,
            pendapatan: true,
            agent: { select: { pengguna: { select: { nama_lengkap: true } } } },
          },
        },
      },
    }),
    prisma.transaksi.count({ where: agentBaseWhere }),
    prisma.transaksi.count({ where: { ...agentBaseWhere, status_transaksi: "SELESAI" } }),
    // Lightweight fetch for totalNilai — conditional sum based on jenis+tipeKomisi
    prisma.transaksi.findMany({
      where: agentBaseWhere,
      select: {
        jenis_transaksi: true,
        tipe_komisi: true,
        harga_deal: true,
        harga_bidding: true,
      },
    }),
  ]);

  const totalNilai = allForStats.reduce(
    (sum, t) => sum + resolveNilai(t.jenis_transaksi, t.tipe_komisi, t.harga_deal, t.harga_bidding),
    0,
  );

  const data = rows.map((t) => ({
    id: t.id.toString(),
    kode: t.id_transaksi ?? `TR-${t.id}`,
    status: t.status_transaksi,
    jenis: t.jenis_transaksi,
    tipeKomisi: t.tipe_komisi,
    hargaDeal: toNum(t.harga_deal),
    hargaPromoDeal: toNum(t.harga_promo_deal),
    hargaBidding: toNum(t.harga_bidding),
    nilaiTransaksi: resolveNilai(t.jenis_transaksi, t.tipe_komisi, t.harga_deal, t.harga_bidding),
    tanggal: t.tanggal_transaksi.toISOString().slice(0, 10),
    dibuat: t.dibuat_pada?.toISOString() ?? new Date().toISOString(),
    agentNama: (t as any).agent_luar_nama || t.agent?.pengguna?.nama_lengkap || "—",
    agentKantor: (t as any).agent_luar_kantor || t.agent?.nama_kantor || "—",
    agentFoto: (t as any).agent_luar_nama ? "" : resolveAgentFoto(t.agent?.foto_profil_url),
    klienNama: t.klien?.nama_lengkap ?? null,
    listingId: t.listing.id_property.toString(),
    listingJudul: t.listing.judul,
    listingGambar: toProxyImg(extractFirstImageUrl(t.listing.gambar)) || "/images/listing/sample-1.jpg",
    listingAlamat: [
      t.listing.alamat_lengkap,
      t.listing.kelurahan,
      t.listing.kecamatan,
      t.listing.kota,
    ]
      .filter(Boolean)
      .join(", "),
    listingKota: t.listing.kota,
    pendapatanKantor: toNum(t.pendapatan_bersih_kantor),
    thcAgent: toNum(t.thc_agent),
    komisiPersentase: toNum(t.persentase_komisi),
    biayaBaliknama: toNum(t.biaya_baliknama),
    biayaPengosongan: toNum(t.biaya_pengosongan),
    royaltyFee: toNum(t.royalty_fee),
    cobrokeFee: toNum(t.cobroke_fee),
    catatan: t.catatan ?? null,
    rating: t.rating ?? null,
    comment: t.comment ?? null,
    detail: t.detail.map((d) => ({
      role: d.role,
      agentNama: d.agent?.pengguna?.nama_lengkap ?? "—",
      pendapatan: toNum(d.pendapatan),
    })),
  }));

  return NextResponse.json({
    data,
    stats: {
      total,
      totalNilai,
      inProgress: total - selesaiCount,
      selesai: selesaiCount,
    },
  });
}

const VALID_STATUSES = [
  "CLOSING",
  // Primary / Secondary / Sewa stages
  "VERIFIKASI_DOKUMEN",
  "AJB",
  // Lelang stages
  "PENGURUSAN_DOKUMEN",
  "EKSEKUSI_PENGOSONGAN",
  // Terminal
  "SELESAI",
  "BATAL",
];

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = (session.user as { agentId?: string }).agentId;
  if (!agentId) return NextResponse.json({ error: "Bukan agent" }, { status: 403 });

  try {
    const body = await req.json();
    const { id, status } = body as { id?: string; status?: string };

    if (!id || !status) {
      return NextResponse.json({ error: "id dan status diperlukan" }, { status: 400 });
    }
    if (!VALID_STATUSES.includes(status.toUpperCase())) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
    }

    // Only allow update if the transaksi belongs to this agent
    const existing = await prisma.transaksi.findFirst({
      where: { id: BigInt(id), id_agent: agentId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

    await prisma.transaksi.update({
      where: { id: BigInt(id) },
      data: { status_transaksi: status.toUpperCase(), diperbarui_pada: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Gagal update status" }, { status: 500 });
  }
}

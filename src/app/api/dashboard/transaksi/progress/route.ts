import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const { sql } = Prisma;

// ── Image helpers ─────────────────────────────────────────────────────────────

function sanitizeDriveId(id: string): string {
  return (id || "").trim().replace(/_+$/g, "");
}

function normalizeUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  const driveMatch =
    raw.match(/drive\.google\.com\/file\/d\/([^/]+)/) ??
    raw.match(/drive\.google\.com\/open\?id=([^&]+)/) ??
    raw.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
  if (driveMatch?.[1]) return `/api/drive-image?id=${sanitizeDriveId(driveMatch[1])}&sz=w400`;
  return raw;
}

function extractFirstImageUrl(raw: unknown): string {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";

  // Try comma-separated list first
  for (const part of str.split(",")) {
    const normalized = normalizeUrl(part.trim());
    if (normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("/")) {
      return normalized;
    }
    // Bare Drive ID (no http, no slash) — resolve to proxy
    const bare = part.trim();
    if (bare && !bare.includes("/") && !bare.includes(".") && /^[a-zA-Z0-9_-]{10,}$/.test(bare)) {
      return `/api/drive-image?id=${sanitizeDriveId(bare)}&sz=w400`;
    }
  }
  return "";
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

  // Full Drive URL — extract ID
  const driveMatch =
    s.match(/drive\.google\.com\/file\/d\/([^/?]+)/) ??
    s.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/) ??
    s.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
  if (driveMatch?.[1]) {
    return `/api/drive-image?id=${sanitizeDriveId(driveMatch[1])}&sz=w96`;
  }

  // Bare Drive ID (long alphanumeric, no dots or slashes)
  if (!s.includes("://") && !s.includes(".") && /^[a-zA-Z0-9_-]{20,}$/.test(s)) {
    return `/api/drive-image?id=${sanitizeDriveId(s)}&sz=w96`;
  }

  if (s.startsWith("http")) return `/api/img?url=${encodeURIComponent(s)}`;
  return "";
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && typeof (v as any).toString === "function")
    return Number((v as any).toString());
  return Number(v) || 0;
}

// ── GET ───────────────────────────────────────────────────────────────────────

const CLOSING_STATUS_SET = new Set([
  "closing", "pengurusan_balik_nama", "balik_nama_selesai",
  "pengurusan_risalah_lelang", "risalah_lelang_selesai",
  "mediasi", "mediasi_gagal", "permohonan_eksekusi",
  "aanmaning", "penetapan", "rakor",
  "pelaksanaan_eksekusi", "serah_terima_kunci", "selesai",
]);

const CLOSING_STATUS_LIST = Array.from(CLOSING_STATUS_SET);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { agentId?: string | null };
  const agentId = user.agentId;
  if (!agentId) return NextResponse.json({ error: "Bukan agent" }, { status: 403 });

  const agentRow = await prisma.agent.findUnique({
    where: { id_agent: agentId },
    select: { jabatan: true },
  });
  const isPrivileged = agentRow?.jabatan === "OWNER" || agentRow?.jabatan === "PRINCIPAL";

  const { searchParams } = new URL(req.url);
  const take = Math.min(Math.max(Number(searchParams.get("take") ?? 50), 1), 100);
  const skip = Math.max(Number(searchParams.get("skip") ?? 0), 0);
  const q = (searchParams.get("q") ?? "").trim();
  const statusFilter = (searchParams.get("status") ?? "").trim().toLowerCase();
  const jenisFilter  = (searchParams.get("jenis")  ?? "").trim().toUpperCase();

  // Build dynamic WHERE fragments
  const agentFragment = isPrivileged ? sql`` : sql`AND m.id_agent = ${agentId}`;
  const searchFragment = q
    ? sql`AND (m.id_transaksi ILIKE ${`%${q}%`} OR l.kota ILIKE ${`%${q}%`})`
    : sql``;
  const jenisFragment = jenisFilter && jenisFilter !== "ALL"
    ? sql`AND m.jenis_transaksi::text = ${jenisFilter}`
    : sql``;
  const statusFragment = statusFilter && statusFilter !== "all"
    ? CLOSING_STATUS_SET.has(statusFilter)
      ? sql`AND t.status_transaksi::text = ${statusFilter}`
      : sql`AND m.status::text = ${statusFilter}`
    : sql``;

  const agentBaseWhere = isPrivileged ? sql`` : sql`AND m.id_agent = ${agentId}`;

  // Run main listing query + stats queries in parallel
  const [rows, statsResult] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT
        m.id::text                            AS id,
        m.id_transaksi,
        m.status,
        m.jenis_transaksi::text               AS jenis_transaksi,
        m.tipe_komisi,
        m.harga_deal::text                    AS harga_deal,
        m.maksimum_bidding::text              AS maksimum_bidding,
        m.harga_limit::text                   AS harga_limit,
        m.persentase_komisi::text             AS persentase_komisi,
        m.biaya_baliknama::text               AS biaya_baliknama,
        m.biaya_pengosongan::text             AS biaya_pengosongan,
        m.mou_generated,
        m.invoice_utm_generated,
        m.dibuat_pada,
        m.diperbarui_pada,
        a.id_agent                            AS agent_id,
        a.nama_kantor                         AS agent_kantor,
        a.foto_profil_url                     AS agent_foto,
        pa.nama_lengkap                       AS agent_nama,
        pk.nama_lengkap                       AS klien_nama,
        l.id_property::text                   AS listing_id,
        l.judul                               AS listing_judul,
        l.gambar                              AS listing_gambar,
        l.kota                                AS listing_kota,
        l.kecamatan                           AS listing_kecamatan,
        l.kelurahan                           AS listing_kelurahan,
        l.alamat_lengkap                      AS listing_alamat,
        t.status_transaksi::text              AS trx_status,
        t.harga_bidding::text                 AS trx_bidding,
        t.cobroke_fee::text                   AS trx_cobroke,
        t.pendapatan_bersih_kantor::text      AS trx_pendapatan,
        t.thc_agent::text                     AS trx_thc,
        t.tanggal_transaksi                   AS trx_tanggal,
        t.rating                              AS trx_rating,
        t.comment                             AS trx_comment,
        t.catatan                             AS trx_catatan,
        t.biaya_baliknama::text               AS trx_biaya_bn,
        t.biaya_pengosongan::text             AS trx_biaya_eks,
        m.agent_luar_nama                     AS luar_nama,
        m.agent_luar_kantor                   AS luar_kantor,
        m.agent_luar_telepon                  AS luar_telepon
      FROM mou m
      JOIN listing l ON l.id_property = m.id_listing
      JOIN agent a ON a.id_agent = m.id_agent
      JOIN pengguna pa ON pa.id_pengguna = a.id_pengguna
      LEFT JOIN pengguna pk ON pk.id_pengguna = m.id_klien
      LEFT JOIN transaksi t ON t.id_transaksi = m.id_transaksi
      WHERE 1=1
      ${agentFragment}
      ${searchFragment}
      ${jenisFragment}
      ${statusFragment}
      ORDER BY m.diperbarui_pada DESC
      LIMIT ${take} OFFSET ${skip}
    `,
    // SQL aggregate for total nilai — replaces unbounded findMany + JS reduce
    prisma.$queryRaw<{ total_count: bigint; selesai_count: bigint; total_nilai: string }[]>`
      SELECT
        COUNT(*)::bigint AS total_count,
        COUNT(*) FILTER (WHERE t.status_transaksi = 'selesai')::bigint AS selesai_count,
        COALESCE(SUM(
          CASE
            WHEN m.tipe_komisi = 'PERSENTASE' AND t.status_transaksi::text = ANY(${CLOSING_STATUS_LIST}) THEN
              COALESCE(t.harga_bidding, m.maksimum_bidding, 0)
            WHEN m.tipe_komisi = 'PERSENTASE' THEN
              COALESCE(m.maksimum_bidding, 0)
            ELSE
              COALESCE(m.harga_deal, 0)
          END
        ), 0)::text AS total_nilai
      FROM mou m
      LEFT JOIN transaksi t ON t.id_transaksi = m.id_transaksi
      WHERE 1=1 ${agentBaseWhere}
    `,
  ]);

  const statsRow = statsResult[0];
  const total       = Number(statsRow?.total_count  ?? 0);
  const selesaiCount = Number(statsRow?.selesai_count ?? 0);
  const totalNilai  = Number(statsRow?.total_nilai  ?? 0);

  // Fetch detail per transaksi
  const trxIds = rows
    .filter((r: any) => r.trx_status && r.id_transaksi)
    .map((r: any) => r.id_transaksi as string);

  const detailMap: Record<string, { role: string; agentNama: string; pendapatan: number }[]> = {};
  if (trxIds.length > 0) {
    const details = await prisma.detailTransaksi.findMany({
      where: { id_transaksi: { in: trxIds } },
      select: {
        id_transaksi: true,
        role: true,
        pendapatan: true,
        agent: { select: { pengguna: { select: { nama_lengkap: true } } } },
      },
    });
    for (const d of details) {
      if (!detailMap[d.id_transaksi]) detailMap[d.id_transaksi] = [];
      detailMap[d.id_transaksi].push({
        role: d.role,
        agentNama: d.agent?.pengguna?.nama_lengkap ?? "—",
        pendapatan: toNum(d.pendapatan),
      });
    }
  }

  const data = rows.map((m: any) => {
    const isPersen = (m.tipe_komisi ?? "").toUpperCase() === "PERSENTASE";
    const status = m.trx_status ?? m.status;
    const isClosing = CLOSING_STATUS_SET.has(status);
    const persenValue = isClosing
      ? toNum(m.trx_bidding) || toNum(m.maksimum_bidding)
      : toNum(m.maksimum_bidding);
    const displayPrice = isPersen ? persenValue : toNum(m.harga_deal);
    const agentNama = m.luar_nama || m.agent_nama || "—";
    const agentKantor = m.luar_kantor || m.agent_kantor || "—";

    return {
      id: m.id,
      kode: m.id_transaksi ?? `MOU-${m.id}`,
      status,
      mouStatus: m.status,
      jenis: m.jenis_transaksi,
      tipeKomisi: m.tipe_komisi,
      hargaDeal: toNum(m.harga_deal),
      hargaPromoDeal: 0,
      hargaBidding: toNum(m.trx_bidding),
      maksimumBidding: toNum(m.maksimum_bidding),
      nilaiTransaksi: displayPrice,
      tanggal: m.trx_tanggal
        ? new Date(m.trx_tanggal).toISOString().slice(0, 10)
        : new Date(m.dibuat_pada).toISOString().slice(0, 10),
      dibuat: new Date(m.dibuat_pada).toISOString(),
      agentNama,
      agentKantor,
      agentFoto: resolveAgentFoto(m.agent_foto),
      klienNama: m.klien_nama ?? null,
      listingId: m.listing_id,
      listingJudul: m.listing_judul ?? "-",
      listingGambar: toProxyImg(extractFirstImageUrl(m.listing_gambar)) || "/images/listing/sample-1.jpg",
      listingAlamat: [m.listing_alamat, m.listing_kelurahan, m.listing_kecamatan, m.listing_kota].filter(Boolean).join(", "),
      listingKota: m.listing_kota ?? "-",
      pendapatanKantor: toNum(m.trx_pendapatan),
      thcAgent: toNum(m.trx_thc),
      komisiPersentase: toNum(m.persentase_komisi),
      biayaBaliknama: toNum(m.trx_biaya_bn ?? m.biaya_baliknama),
      biayaPengosongan: toNum(m.trx_biaya_eks ?? m.biaya_pengosongan),
      royaltyFee: 0,
      cobrokeFee: toNum(m.trx_cobroke),
      catatan: m.trx_catatan ?? null,
      rating: m.trx_rating ?? null,
      comment: m.trx_comment ?? null,
      mouGenerated: m.mou_generated,
      invoiceUtmGenerated: m.invoice_utm_generated,
      detail: detailMap[m.id_transaksi] ?? [],
    };
  });

  return NextResponse.json({
    data,
    stats: { total, totalNilai, inProgress: total - selesaiCount, selesai: selesaiCount },
  });
}

// ── PATCH: update status ──────────────────────────────────────────────────────

const VALID_MOU_STATUSES = ["proses", "closing", "kalah", "batal"];
const VALID_TRX_STATUSES = [
  "closing", "pengurusan_kuitansi", "kuitansi_selesai",
  "pengurusan_risalah_lelang", "risalah_lelang_selesai",
  "pengurusan_balik_nama", "balik_nama_selesai",
  "mediasi", "mediasi_gagal", "permohonan_eksekusi",
  "aanmaning", "penetapan", "rakor",
  "pelaksanaan_eksekusi", "serah_terima_kunci", "selesai",
];

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = (session.user as { agentId?: string }).agentId;
  if (!agentId) return NextResponse.json({ error: "Bukan agent" }, { status: 403 });

  const agentRow = await prisma.agent.findUnique({
    where: { id_agent: agentId },
    select: { jabatan: true },
  });
  const isPrivileged = agentRow?.jabatan === "OWNER" || agentRow?.jabatan === "PRINCIPAL";

  try {
    const body = await req.json();
    const { id, status } = body as { id?: string; status?: string };

    if (!id || !status) {
      return NextResponse.json({ error: "id dan status diperlukan" }, { status: 400 });
    }

    const isMouStatus = VALID_MOU_STATUSES.includes(status.toLowerCase());
    const isTrxStatus = VALID_TRX_STATUSES.includes(status.toLowerCase());

    if (!isMouStatus && !isTrxStatus) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
    }

    const mouWhere = isPrivileged
      ? { id: BigInt(id) }
      : { id: BigInt(id), id_agent: agentId };

    const mou = await prisma.mou.findFirst({
      where: mouWhere,
      select: { id: true, id_transaksi: true },
    });
    if (!mou) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

    if (isMouStatus) {
      await prisma.$executeRaw`
        UPDATE mou
        SET status = ${status.toLowerCase()}::status_mou_enum,
            diperbarui_pada = NOW()
        WHERE id = ${mou.id}
      `;

      if (status.toLowerCase() === "closing" && mou.id_transaksi) {
        await prisma.$executeRaw`
          INSERT INTO transaksi (id_transaksi, tanggal_transaksi, status_transaksi)
          VALUES (
            ${mou.id_transaksi},
            NOW()::date,
            'closing'::status_transaksi_enum
          )
          ON CONFLICT (id_transaksi) DO UPDATE
            SET status_transaksi = 'closing'::status_transaksi_enum,
                diperbarui_pada  = NOW()
        `;
      }
    } else if (isTrxStatus && mou.id_transaksi) {
      await prisma.$executeRaw`
        UPDATE transaksi
        SET status_transaksi = ${status.toLowerCase()}::status_transaksi_enum,
            diperbarui_pada  = NOW()
        WHERE id_transaksi = ${mou.id_transaksi}
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("[progress PATCH]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Gagal update status", detail: msg }, { status: 500 });
  }
}

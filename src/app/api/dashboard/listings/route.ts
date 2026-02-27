// src/app/api/dashboard/listings/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * ✅ Goals
 * - GET return: alamat_lengkap, harga/harga_promo/nilai_limit_lelang, vendor, id_property
 * - GET return: agent handler (nama + kantor) dari relasi Agent -> Pengguna
 * - GET return: luas_tanah, luas_bangunan (luas_bangunan = null untuk LELANG)
 * - GET return: tanggal_lelang (ONLY LELANG) sebagai ISO string
 * - gambar: parse CSV, sanitize gdrive id (underscore nyasar), dan semuanya diproxy lewat /api/img
 * - STOP spam 404 placeholder: imageUrl boleh kosong "" -> UI yang fallback
 */

// ---------- Helpers ----------
const okJson = (data: any, status = 200) => NextResponse.json(data, { status });

const toNumber = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "object" && typeof v.toString === "function") return Number(v.toString());
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toNullableNumber = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "object" && typeof v.toString === "function") {
    const n = Number(v.toString());
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toIsoOrNull = (d: any): string | null => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString(); // client friendly
};

function normalizeUrl(u: string) {
  const s = (u || "").trim();
  if (!s) return "";
  return s.replace(/\s+/g, "");
}

function sanitizeDriveId(id: string) {
  return (id || "").trim().replace(/_+$/g, ""); // buang underscore nyasar
}

function toDriveThumb(url: string) {
  // already thumbnail
  if (/drive\.google\.com\/thumbnail\?id=/i.test(url)) {
    const m = url.match(/thumbnail\?id=([^&]+)/i);
    if (m?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m[1])}`;
    return url;
  }

  // file/d/<id>/
  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m1?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m1[1])}`;

  // open?id=<id>
  const m2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  if (m2?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m2[1])}`;

  // uc?export=view&id=<id>
  const m3 = url.match(/drive\.google\.com\/uc\?[^#]*id=([^&]+)/i);
  if (m3?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m3[1])}`;

  return url;
}

function isProbablyUrl(url: string) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/");
}

function extractFirstImageUrl(raw: any): string {
  // IMPORTANT: balikin "" kalau tidak ada, biar UI fallback (dan ga spam 404 placeholder)
  if (!raw) return "";

  const str = String(raw).trim();
  if (!str) return "";

  const candidates = str
    .split(",")
    .map((x) => normalizeUrl(x))
    .filter(Boolean)
    .map((x) => toDriveThumb(x));

  for (const c of candidates) {
    if (isProbablyUrl(c)) return c;
  }

  const single = toDriveThumb(normalizeUrl(str));
  if (isProbablyUrl(single)) return single;

  return "";
}

function toProxyImg(url: string) {
  if (!url) return "";
  if (url.startsWith("/")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `/api/img?url=${encodeURIComponent(url)}`;
  }
  return "";
}

// ---------- POST (create listing) ----------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return okJson({ error: "Unauthorized" }, 401);

    const body = await request.json();

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId) return okJson({ error: "User is not an agent or agentId missing in session" }, 400);

    const agent = await prisma.agent.findUnique({
      where: { id_agent: agentId },
      select: {
        id_agent: true,
        poin: true,
        nama_kantor: true,
        pengguna: { select: { nama_lengkap: true, email: true } },
      },
    });
    if (!agent) return okJson({ error: "Agent not found" }, 404);

    if (!body.judul || !body.slug || !body.kota || !body.jenis_transaksi || !body.kategori) {
      return okJson(
        { error: "Missing required fields (judul, slug, kota, jenis_transaksi, kategori)" },
        400
      );
    }

    const jenis_transaksi = String(body.jenis_transaksi).toUpperCase() as
      | "PRIMARY"
      | "SECONDARY"
      | "LELANG"
      | "SEWA";

    const kategori = String(body.kategori).toUpperCase() as
      | "RUMAH"
      | "APARTEMEN"
      | "RUKO"
      | "TANAH"
      | "GUDANG"
      | "HOTEL_DAN_VILLA"
      | "TOKO"
      | "PABRIK";

    if (jenis_transaksi === "LELANG") {
      if (!body.nilai_limit_lelang || Number(body.nilai_limit_lelang) <= 0) {
        return okJson({ error: "Nilai limit lelang wajib diisi untuk tipe LELANG" }, 400);
      }
      if (!body.uang_jaminan || Number(body.uang_jaminan) <= 0) {
        return okJson({ error: "Uang jaminan wajib diisi untuk tipe LELANG" }, 400);
      }
      if (!body.tanggal_lelang) {
        return okJson({ error: "Tanggal lelang wajib diisi untuk tipe LELANG" }, 400);
      }
    } else {
      if (body.harga == null || Number(body.harga) <= 0) {
        return okJson({ error: "Harga wajib diisi untuk tipe non-LELANG" }, 400);
      }
    }

    const harga = jenis_transaksi === "LELANG" ? Number(body.nilai_limit_lelang) : Number(body.harga);

    const vendor =
      jenis_transaksi === "LELANG"
        ? `Balai Lelang Solusindo - ${agent.pengguna.nama_lengkap}`
        : `${agent.nama_kantor || "Premier"} - ${agent.pengguna.nama_lengkap}`;

    let tanggalLelang: Date | null = null;
    let uangJaminan: number | null = null;
    let nilaiLimitLelang: number | null = null;

    if (jenis_transaksi === "LELANG") {
      nilaiLimitLelang = Number(body.nilai_limit_lelang);
      uangJaminan = Number(body.uang_jaminan);
      tanggalLelang = body.tanggal_lelang ? new Date(body.tanggal_lelang) : null;
    }

    const listing = await prisma.listing.create({
      data: {
        id_agent: agent.id_agent,
        judul: body.judul,
        slug: body.slug,
        deskripsi: body.deskripsi || null,
        jenis_transaksi,
        kategori,
        vendor,
        status_tayang: body.status_tayang || "TERSEDIA",
        harga,
        harga_promo:
          jenis_transaksi !== "LELANG" && body.harga_promo != null ? Number(body.harga_promo) : null,
        tanggal_lelang: tanggalLelang,
        uang_jaminan: uangJaminan,
        nilai_limit_lelang: nilaiLimitLelang,
        link: body.link || null,
        alamat_lengkap: body.alamat_lengkap || null,
        provinsi: body.provinsi || null,
        kota: body.kota,
        kecamatan: body.kecamatan || null,
        kelurahan: body.kelurahan || null,
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
        luas_tanah: body.luas_tanah != null ? Number(body.luas_tanah) : null,
        luas_bangunan: body.luas_bangunan != null ? Number(body.luas_bangunan) : null,
        jumlah_lantai: body.jumlah_lantai || 1,
        kamar_tidur: body.kamar_tidur ?? null,
        kamar_mandi: body.kamar_mandi ?? null,
        daya_listrik: body.daya_listrik ?? null,
        sumber_air: body.sumber_air || null,
        hadap_bangunan: body.hadap_bangunan || null,
        kondisi_interior: body.kondisi_interior || null,
        legalitas: body.legalitas || null,
        nomor_legalitas: body.nomor_legalitas || null,
        gambar: body.gambar || null,
        lampiran: body.lampiran || null,
        is_hot_deal: body.is_hot_deal || false,
      },
    });

    const newPoin = agent.poin + 10;
    await prisma.agent.update({
      where: { id_agent: agent.id_agent },
      data: { poin: newPoin },
    });

    await prisma.riwayatPoin.create({
      data: {
        id_agent: agent.id_agent,
        jenis_aktivitas: "Tambah Listing",
        deskripsi: `Menambahkan listing: ${body.judul}`,
        poin: 10,
        tipe_transaksi: "DAPAT",
        id_referensi: listing.id_property.toString(),
        tabel_referensi: "listing",
        saldo_sebelum: agent.poin,
        saldo_sesudah: newPoin,
      },
    });

    return okJson({
      success: true,
      data: { ...listing, id_property: listing.id_property.toString() },
      message: "Listing berhasil dibuat dan poin ditambahkan (+10)",
    });
  } catch (error: any) {
    console.error("❌ Error creating listing:", error);
    if (error?.code === "P2002") {
      return okJson(
        {
          error: "Data duplikat terdeteksi",
          details: error.meta?.target
            ? `Field ${error.meta.target.join(", ")} sudah ada`
            : "Constraint violation",
        },
        400
      );
    }
    return okJson({ error: "Failed to create listing", details: error?.message || "Unknown error" }, 500);
  }
}

// ---------- GET (dashboard transaksi: listing search) ----------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return okJson({ error: "Unauthorized" }, 401);

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId) return okJson({ error: "User is not an agent or agentId missing in session" }, 400);

    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || searchParams.get("take") || "30", 10);
    const skip = (page - 1) * limit;

    const q = (searchParams.get("q") || "").trim();
    const jenisParam = (searchParams.get("jenis") || searchParams.get("jenis_transaksi") || "ALL").trim();
    const vendor = (searchParams.get("vendor") || "").trim();
    const provinsi = (searchParams.get("provinsi") || "").trim();
    const kota = (searchParams.get("kota") || "").trim();
    const kecamatan = (searchParams.get("kecamatan") || "").trim();
    const kelurahan = (searchParams.get("kelurahan") || "").trim();

    const minHargaRaw = searchParams.get("minHarga") || searchParams.get("min_harga");
    const maxHargaRaw = searchParams.get("maxHarga") || searchParams.get("max_harga");
    const minHarga = minHargaRaw ? Number(minHargaRaw) : null;
    const maxHarga = maxHargaRaw ? Number(maxHargaRaw) : null;

    const where: any = { id_agent: agentId };

    if (jenisParam && jenisParam.toUpperCase() !== "ALL") where.jenis_transaksi = jenisParam.toUpperCase();
    if (vendor) where.vendor = { contains: vendor, mode: "insensitive" };
    if (provinsi) where.provinsi = { equals: provinsi, mode: "insensitive" };
    if (kota) where.kota = { equals: kota, mode: "insensitive" };
    if (kecamatan) where.kecamatan = { equals: kecamatan, mode: "insensitive" };
    if (kelurahan) where.kelurahan = { equals: kelurahan, mode: "insensitive" };

    if (q) {
      where.OR = [
        { judul: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { vendor: { contains: q, mode: "insensitive" } },
        { alamat_lengkap: { contains: q, mode: "insensitive" } },
        { provinsi: { contains: q, mode: "insensitive" } },
        { kota: { contains: q, mode: "insensitive" } },
        { kecamatan: { contains: q, mode: "insensitive" } },
        { kelurahan: { contains: q, mode: "insensitive" } },
      ];
    }

    if (minHarga !== null || maxHarga !== null) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          {
            jenis_transaksi: { in: ["PRIMARY", "SECONDARY", "SEWA"] },
            OR: [
              { harga: { gte: minHarga ?? undefined, lte: maxHarga ?? undefined } },
              { harga_promo: { gte: minHarga ?? undefined, lte: maxHarga ?? undefined } },
            ],
          },
          {
            jenis_transaksi: "LELANG",
            nilai_limit_lelang: { gte: minHarga ?? undefined, lte: maxHarga ?? undefined },
          },
        ],
      });
    }

    const [rows, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { tanggal_diupdate: "desc" },
        select: {
          id_property: true,
          judul: true,
          vendor: true,
          jenis_transaksi: true,
          kategori: true,
          status_tayang: true,

          harga: true,
          harga_promo: true,
          nilai_limit_lelang: true,

          tanggal_lelang: true, // ✅ FIX: ambil dari DB

          alamat_lengkap: true,
          provinsi: true,
          kota: true,
          kecamatan: true,
          kelurahan: true,

          luas_tanah: true,
          luas_bangunan: true,

          gambar: true,

          agent: {
            select: {
              nama_kantor: true,
              pengguna: { select: { nama_lengkap: true } },
            },
          },
        },
      }),
      prisma.listing.count({ where }),
    ]);

    const data = rows.map((r: any) => {
      const jenis = String(r.jenis_transaksi);

      const luasBangunan = jenis === "LELANG" ? null : toNullableNumber(r.luas_bangunan);
      const luasTanah = toNullableNumber(r.luas_tanah);
      const luas = toNumber(luasBangunan ?? luasTanah ?? 0);

      const rawImg = extractFirstImageUrl(r.gambar);
      const imageUrl = toProxyImg(rawImg);

      // ✅ tanggal lelang: ONLY kalau LELANG
      const tanggal_lelang = jenis === "LELANG" ? toIsoOrNull(r.tanggal_lelang) : null;

      return {
        id: r.id_property.toString(),
        judul: r.judul,
        vendor: r.vendor ?? null,

        agent_nama: r.agent?.pengguna?.nama_lengkap ?? null,
        agent_kantor: r.agent?.nama_kantor ?? null,

        jenis_transaksi: r.jenis_transaksi,
        kategori: String(r.kategori),

        harga: toNumber(r.harga),
        harga_promo: toNullableNumber(r.harga_promo),
        nilai_limit_lelang: toNullableNumber(r.nilai_limit_lelang),

        tanggal_lelang, // ✅ NEW (ISO string / null)

        alamat_lengkap: r.alamat_lengkap ?? null,

        provinsi: r.provinsi ?? null,
        kota: r.kota,
        kecamatan: r.kecamatan ?? null,
        kelurahan: r.kelurahan ?? null,

        luas_tanah: luasTanah,
        luas_bangunan: luasBangunan,

        luas, // legacy

        imageUrl,
        status_tayang: r.status_tayang,
      };
    });

    return okJson({
      success: true,
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error("❌ Error fetching listings:", error);
    return okJson({ error: "Failed to fetch listings", details: error?.message }, 500);
  }
}
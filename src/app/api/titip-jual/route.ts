// src/app/api/titip-jual/route.ts
// Submission form titip-jual dari halaman /titip-jual.
// Flow:
//   1. Validasi & normalisasi input.
//   2. Anti-spam: dedup by (phone + kota) dalam 1 jam.
//   3. Insert property_titip.
//   4. Cari agent AKTIF di kota yang sama (match case-insensitive +
//      strip prefix "Kota "/"Kabupaten "/"Kab.").
//   5. Bulk insert property_titip_distribution untuk tiap agent.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { pusherServer } from "@/lib/pusher-server";

type JenisProperti =
  | "RUMAH"
  | "APARTEMEN"
  | "RUKO"
  | "TANAH"
  | "GUDANG"
  | "PABRIK"
  | "HOTEL_DAN_VILLA"
  | "TOKO";

type StatusKepemilikan = "PRIBADI" | "ORANG_LAIN";

interface SubmitBody {
  jenis_properti: JenisProperti;
  alamat_lengkap: string;
  provinsi: string;
  kota: string;
  kecamatan?: string;
  kelurahan?: string;
  latitude?: number | null;
  longitude?: number | null;
  estimasi_harga?: string | number | null;
  pengirim_nama: string;
  pengirim_phone: string;
  status_kepemilikan: StatusKepemilikan;
  session_id?: string;
  referrer?: string;
}

const JENIS_PROPERTI_SET = new Set<JenisProperti>([
  "RUMAH",
  "APARTEMEN",
  "RUKO",
  "TANAH",
  "GUDANG",
  "PABRIK",
  "HOTEL_DAN_VILLA",
  "TOKO",
]);

function normalizeKota(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .replace(/^(kota|kabupaten|kab\.?)\s+/i, "")
    .trim();
}

// POSIX regex untuk PostgreSQL — hindari backslash escape karena
// JS template literal akan "memakan" \s dan \. (unknown escape).
// [[:space:]] = whitespace, [.] = literal titik.
const KOTA_STRIP_PREFIX_PG = "^(kota|kabupaten|kab[.]?)[[:space:]]+";

function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("62")) d = d.slice(2);
  d = d.replace(/^0+/, "");
  return d;
}

function parseRupiahToDecimal(v: unknown): Prisma.Decimal | null {
  if (v === null || v === undefined || v === "") return null;
  const digits = String(v).replace(/\D/g, "");
  if (!digits) return null;
  try {
    return new Prisma.Decimal(digits);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SubmitBody;

    // ---------- Validasi ----------
    if (!body.jenis_properti || !JENIS_PROPERTI_SET.has(body.jenis_properti)) {
      return NextResponse.json(
        { ok: false, error: "jenis_properti tidak valid" },
        { status: 400 },
      );
    }
    if (!body.alamat_lengkap || body.alamat_lengkap.trim().length < 5) {
      return NextResponse.json(
        { ok: false, error: "alamat_lengkap wajib diisi" },
        { status: 400 },
      );
    }
    if (!body.provinsi || !body.kota) {
      return NextResponse.json(
        { ok: false, error: "provinsi & kota wajib diisi" },
        { status: 400 },
      );
    }
    if (!body.pengirim_nama || body.pengirim_nama.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: "Nama pengirim wajib diisi" },
        { status: 400 },
      );
    }
    const phone = normalizePhone(body.pengirim_phone);
    if (phone.length < 9) {
      return NextResponse.json(
        { ok: false, error: "No. WhatsApp tidak valid" },
        { status: 400 },
      );
    }
    if (
      body.status_kepemilikan !== "PRIBADI" &&
      body.status_kepemilikan !== "ORANG_LAIN"
    ) {
      return NextResponse.json(
        { ok: false, error: "status_kepemilikan tidak valid" },
        { status: 400 },
      );
    }

    // ---------- Anti-spam: dedup ----------
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await prisma.propertyTitip.findFirst({
      where: {
        pengirim_phone: phone,
        kota: { equals: body.kota, mode: "insensitive" },
        dibuat_pada: { gte: oneHourAgo },
      },
      select: { id_titip: true },
    });
    if (recent) {
      return NextResponse.json({
        ok: true,
        id_titip: recent.id_titip.toString(),
        deduped: true,
        message:
          "Pendaftaran serupa baru saja diterima — konsultan akan menghubungi Anda segera.",
      });
    }

    // ---------- Tracking metadata ----------
    const userAgent = req.headers.get("user-agent") || null;
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const realIp = req.headers.get("x-real-ip") || "";
    const ip = forwardedFor.split(",")[0]?.trim() || realIp || null;
    const referrer = body.referrer || req.headers.get("referer") || null;

    // ---------- Insert + distribusi (transaction) ----------
    const result = await prisma.$transaction(async (tx) => {
      const titip = await tx.propertyTitip.create({
        data: {
          jenis_properti: body.jenis_properti,
          alamat_lengkap: body.alamat_lengkap.trim(),
          provinsi: body.provinsi.trim(),
          kota: body.kota.trim(),
          kecamatan: body.kecamatan?.trim() || null,
          kelurahan: body.kelurahan?.trim() || null,
          latitude:
            typeof body.latitude === "number"
              ? new Prisma.Decimal(body.latitude)
              : null,
          longitude:
            typeof body.longitude === "number"
              ? new Prisma.Decimal(body.longitude)
              : null,
          estimasi_harga: parseRupiahToDecimal(body.estimasi_harga),
          pengirim_nama: body.pengirim_nama.trim(),
          pengirim_phone: phone,
          status_kepemilikan: body.status_kepemilikan,
          ip_address: ip,
          user_agent: userAgent,
          session_id: body.session_id || null,
          referrer,
        },
        select: { id_titip: true, kota: true },
      });

      // Cari agent AKTIF di kota yang sama (normalisasi case + prefix).
      // Pakai raw query supaya bisa LOWER + REGEXP-strip prefix di DB side.
      const kotaNorm = normalizeKota(body.kota);
      const agents = await tx.$queryRaw<{ id_agent: string }[]>`
        SELECT id_agent FROM agent
        WHERE status_keanggotaan = 'AKTIF'
          AND regexp_replace(LOWER(kota_area), ${KOTA_STRIP_PREFIX_PG}, '') = ${kotaNorm}
      `;

      if (agents.length > 0) {
        await tx.propertyTitipDistribution.createMany({
          data: agents.map((a) => ({
            id_titip: titip.id_titip,
            id_agent: a.id_agent,
          })),
          skipDuplicates: true,
        });
      }

      return {
        id_titip: titip.id_titip,
        broadcasted_to: agents.length,
      };
    });

    // Pusher fire-and-forget — semua agent inbox auto-refresh.
    // FE re-fetch dari API yang sudah filter per-agent, jadi aman.
    pusherServer
      .trigger("titip-broadcast", "titip:new", {
        id_titip: result.id_titip.toString(),
      })
      .catch((e) => console.warn("pusher trigger titip:new failed:", e));

    return NextResponse.json({
      ok: true,
      id_titip: result.id_titip.toString(),
      broadcasted_to: result.broadcasted_to,
    });
  } catch (error) {
    console.error("❌ /api/titip-jual error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

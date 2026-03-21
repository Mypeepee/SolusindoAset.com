import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AgentInvestorRow = {
  id_agent: string;
  id_pengguna: string;
  nama_lengkap: string | null;
  nama_kantor: string | null;
  kota_area: string | null;
  jabatan: string | null;
  nomor_whatsapp: string | null;
  foto_profil_url: string | null;
  status_keanggotaan: string | null;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBooleanParam(
  value: string | null,
  defaultValue = false
): boolean {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

function pickFirstImage(raw?: string | null): string {
  if (!raw) return "";

  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      const first = parsed.find(
        (item) => typeof item === "string" && item.trim().length > 0
      );
      return typeof first === "string" ? first : "";
    }
  } catch {
    // fallback string biasa
  }

  if (trimmed.includes(",")) {
    return (
      trimmed
        .split(",")
        .map((item) => item.trim())
        .find(Boolean) ?? ""
    );
  }

  if (trimmed.includes("\n")) {
    return (
      trimmed
        .split("\n")
        .map((item) => item.trim())
        .find(Boolean) ?? ""
    );
  }

  return trimmed;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = (searchParams.get("q") ?? "").trim();
    const investorQ = (searchParams.get("investor_q") ?? "").trim();

    const includeListings = toBooleanParam(
      searchParams.get("include_listings"),
      true
    );
    const includeInvestors = toBooleanParam(
      searchParams.get("include_investors"),
      true
    );

    const limitParam = Number(searchParams.get("limit") ?? "8");
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 24)
        : 8;

    const investorLimitParam = Number(
      searchParams.get("investor_limit") ?? "12"
    );
    const investorLimit =
      Number.isFinite(investorLimitParam) && investorLimitParam > 0
        ? Math.min(investorLimitParam, 50)
        : 12;

    const isNumericQuery = /^\d+$/.test(q);
    const numericId = isNumericQuery ? BigInt(q) : null;

    const listingPromise = includeListings
      ? prisma.listing.findMany({
          where: {
            jenis_transaksi: {
              in: ["PRIMARY", "SECONDARY", "LELANG"],
            },
            ...(q
              ? {
                  OR: [
                    ...(numericId !== null ? [{ id_property: numericId }] : []),
                    {
                      alamat_lengkap: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                    {
                      judul: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                    {
                      slug: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                    {
                      kota: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                    {
                      kecamatan: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                    {
                      kelurahan: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                    {
                      provinsi: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                  ],
                }
              : {}),
          },
          select: {
            id_property: true,
            judul: true,
            slug: true,
            jenis_transaksi: true,
            kategori: true,
            harga: true,
            harga_promo: true,
            nilai_limit_lelang: true,
            uang_jaminan: true,
            alamat_lengkap: true,
            provinsi: true,
            kota: true,
            kecamatan: true,
            kelurahan: true,
            luas_tanah: true,
            luas_bangunan: true,
            legalitas: true,
            gambar: true,
            vendor: true,
            tanggal_lelang: true,
            tanggal_dibuat: true,
          },
          orderBy: [{ tanggal_dibuat: "desc" }, { id_property: "desc" }],
          take: limit,
        })
      : Promise.resolve([]);

    const investorPromise = includeInvestors
      ? prisma.$queryRaw<AgentInvestorRow[]>`
          SELECT
            a.id_agent,
            a.id_pengguna,
            p.nama_lengkap,
            a.nama_kantor,
            a.kota_area,
            a.jabatan::text AS jabatan,
            a.nomor_whatsapp,
            a.foto_profil_url,
            a.status_keanggotaan::text AS status_keanggotaan
          FROM public.agent a
          LEFT JOIN public.pengguna p
            ON p.id_pengguna = a.id_pengguna
          WHERE
            ${investorQ === ""} = true
            OR a.id_agent ILIKE ${`%${investorQ}%`}
            OR COALESCE(p.nama_lengkap, '') ILIKE ${`%${investorQ}%`}
            OR COALESCE(a.nama_kantor, '') ILIKE ${`%${investorQ}%`}
            OR COALESCE(a.kota_area, '') ILIKE ${`%${investorQ}%`}
            OR COALESCE(a.nomor_whatsapp, '') ILIKE ${`%${investorQ}%`}
          ORDER BY a.dibuat_pada DESC, a.id_agent DESC
          LIMIT ${investorLimit}
        `
      : Promise.resolve([]);

    const [listings, investorRows] = await Promise.all([
      listingPromise,
      investorPromise,
    ]);

    const data = listings.map((item) => ({
      id_listing: item.id_property.toString(),
      id_property: item.id_property.toString(),
      slug: item.slug,
      judul: item.judul,
      jenis_transaksi: item.jenis_transaksi,
      kategori: item.kategori,
      harga: toNumber(item.harga),
      harga_promo: toNumber(item.harga_promo),
      nilai_limit_lelang: toNumber(item.nilai_limit_lelang),
      uang_jaminan: toNumber(item.uang_jaminan),
      alamat_property: item.alamat_lengkap ?? "",
      alamat_lengkap: item.alamat_lengkap ?? "",
      provinsi: item.provinsi ?? "",
      kota: item.kota ?? "",
      kecamatan: item.kecamatan ?? "",
      kelurahan: item.kelurahan ?? "",
      luas_tanah: toNumber(item.luas_tanah),
      luas_bangunan: toNumber(item.luas_bangunan),
      legalitas: item.legalitas ?? null,
      vendor: item.vendor ?? "",
      tanggal_lelang: item.tanggal_lelang,
      gambar_thumbnail: pickFirstImage(item.gambar),
      gambar: pickFirstImage(item.gambar),
    }));

    const investors = investorRows.map((item) => ({
      id: item.id_agent,
      id_agent: item.id_agent,
      id_pengguna: item.id_pengguna,
      nama: item.nama_lengkap ?? item.id_agent,
      label: item.nama_lengkap
        ? `${item.nama_lengkap} • ${item.id_agent}`
        : item.id_agent,
      nama_kantor: item.nama_kantor ?? "",
      kota_area: item.kota_area ?? "",
      jabatan: item.jabatan ?? "",
      nomor_whatsapp: item.nomor_whatsapp ?? "",
      foto_profil_url: pickFirstImage(item.foto_profil_url),
      status_keanggotaan: item.status_keanggotaan ?? "",
    }));

    return NextResponse.json(
      {
        success: true,
        query: q,
        investor_query: investorQ,
        total: data.length,
        investor_total: investors.length,
        data,
        investors,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API_PROJECT_MODAL_GET]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data listing / investor untuk modal project.",
      },
      { status: 500 }
    );
  }
}
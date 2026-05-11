import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import KategoriPageClient from "./KategoriPageClient";

// --- SLUG → KATEGORI MAP ---
const SLUG_TO_KATEGORI: Record<string, Prisma.kategori_properti_enum> = {
  "rumah":          "RUMAH",
  "apartemen":      "APARTEMEN",
  "ruko":           "RUKO",
  "tanah":          "TANAH",
  "gudang":         "GUDANG",
  "hotel-dan-villa":"HOTEL_DAN_VILLA",
  "toko":           "TOKO",
  "pabrik":         "PABRIK",
};

const KATEGORI_LABEL: Record<string, string> = {
  "rumah":          "Rumah",
  "apartemen":      "Apartemen",
  "ruko":           "Ruko",
  "tanah":          "Tanah",
  "gudang":         "Gudang",
  "hotel-dan-villa":"Hotel & Villa",
  "toko":           "Kios / Toko",
  "pabrik":         "Pabrik",
};

const KATEGORI_DESC: Record<string, string> = {
  "rumah":          "hunian nyaman untuk keluarga",
  "apartemen":      "hunian vertikal modern",
  "ruko":           "rumah toko dan properti bisnis",
  "tanah":          "investasi tanah strategis",
  "gudang":         "properti logistik dan penyimpanan",
  "hotel-dan-villa":"properti akomodasi dan wisata",
  "toko":           "ruang usaha dan kios ritel",
  "pabrik":         "properti industri dan produksi",
};

type Props = {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const slug = params.slug;
  const label = KATEGORI_LABEL[slug];
  if (!label) return { title: "Kategori Properti | Kosku" };

  const tipe = typeof searchParams.tipe === "string" ? searchParams.tipe : undefined;
  const kota = typeof searchParams.kota === "string" ? searchParams.kota : undefined;

  const tipeLabel: Record<string, string> = {
    jual: "Dijual",
    lelang: "Lelang",
    sewa: "Disewa",
  };

  const tipeSuffix = tipe && tipeLabel[tipe] ? ` ${tipeLabel[tipe]}` : "";
  const kotaSuffix = kota ? ` di ${kota.charAt(0).toUpperCase() + kota.slice(1)}` : "";

  const title = `${label}${tipeSuffix}${kotaSuffix} - Jual, Sewa & Lelang | Kosku`;
  const description = `Temukan ${label.toLowerCase()} ${KATEGORI_DESC[slug] || ""} terbaik${kotaSuffix}. Tersedia pilihan dijual, disewa, maupun lelang dengan legalitas terjamin.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/kategori/${slug}${tipe ? `?tipe=${tipe}` : ""}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

// --- IMAGE HELPERS ---
function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;
  const t = url.trim().toLowerCase();
  return t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/");
}

function normalizeListingImages(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => (isValidImageUrl(s) ? s : `https://drive.google.com/thumbnail?id=${s}`));
}

function normalizeAgentPhoto(fileId: string | null | undefined): string {
  if (!fileId || fileId.trim() === "") return "/images/default-profile.png";
  const t = fileId.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/")) return t;
  return `https://drive.google.com/thumbnail?id=${t}&sz=w64`;
}

// --- SERVER COMPONENT ---
export default async function KategoriPage({ params, searchParams }: Props) {
  const slug = params.slug;
  const kategori = SLUG_TO_KATEGORI[slug];
  if (!kategori) notFound();

  const label = KATEGORI_LABEL[slug];

  // Parse searchParams
  const page   = typeof searchParams.page === "string"  ? Number(searchParams.page)  : 1;
  const tipe   = typeof searchParams.tipe === "string"  ? searchParams.tipe          : "semua";
  const kota   = typeof searchParams.kota === "string"  ? searchParams.kota          : undefined;
  const sort   = typeof searchParams.sort === "string"  ? searchParams.sort          : "terbaru";
  const limit  = 15;
  const skip   = (page - 1) * limit;

  // jenis_transaksi filter berdasarkan tab
  const transaksiFilter = (): Prisma.ListingWhereInput["jenis_transaksi"] => {
    if (tipe === "jual")   return { in: ["PRIMARY", "SECONDARY"] };
    if (tipe === "lelang") return "LELANG";
    if (tipe === "sewa")   return "SEWA";
    return { in: ["PRIMARY", "SECONDARY", "LELANG", "SEWA"] };
  };

  const whereClause: Prisma.ListingWhereInput = {
    kategori,
    status_tayang: "TERSEDIA",
    jenis_transaksi: transaksiFilter(),
    ...(kota && { kota: { contains: kota, mode: "insensitive" } }),
  };

  // Sorting
  let orderBy: Prisma.ListingOrderByWithRelationInput[] = [{ tanggal_dibuat: "desc" }];
  if (sort === "termurah") orderBy = [{ harga: "asc" }];
  if (sort === "termahal") orderBy = [{ harga: "desc" }];
  if (sort === "terpopuler") orderBy = [{ dilihat: "desc" }];

  const [totalItems, propertiesRaw] = await prisma.$transaction([
    prisma.listing.count({ where: whereClause }),
    prisma.listing.findMany({
      where: whereClause,
      take: limit,
      skip,
      orderBy,
      include: {
        agent: {
          select: {
            nama_kantor: true,
            foto_profil_url: true,
            pengguna: { select: { nama_lengkap: true } },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  const properties = propertiesRaw.map((item) => {
    const foto_list = normalizeListingImages(item.gambar);
    return {
      id_property:     String(item.id_property),
      slug:            item.slug,
      judul:           item.judul,
      kota:            item.kota,
      harga:           item.nilai_limit_lelang
                         ? Number(item.nilai_limit_lelang)
                         : Number(item.harga),
      harga_promo:     item.harga_promo != null ? Number(item.harga_promo) : null,
      jenis_transaksi: item.jenis_transaksi,
      kategori:        item.kategori,
      gambar:          foto_list[0] || "/images/hero/banner.jpg",
      foto_list,
      luas_tanah:      Number(item.luas_tanah ?? 0),
      luas_bangunan:   Number(item.luas_bangunan ?? 0),
      kamar_tidur:     item.kamar_tidur ?? 0,
      kamar_mandi:     item.kamar_mandi ?? 0,
      tanggal_lelang:  item.tanggal_lelang ? item.tanggal_lelang.toISOString() : null,
      agent_name:      item.agent?.pengguna?.nama_lengkap || "Agent Kosku",
      agent_photo:     normalizeAgentPhoto(item.agent?.foto_profil_url),
      agent_office:    item.agent?.nama_kantor || "Kosku",
    };
  });

  // Hitung tab counts (semua transaksi untuk kategori ini)
  const tabCounts = await prisma.listing.groupBy({
    by: ["jenis_transaksi"],
    where: { kategori, status_tayang: "TERSEDIA" },
    _count: { jenis_transaksi: true },
  });

  const countMap: Record<string, number> = {};
  tabCounts.forEach((t) => { countMap[t.jenis_transaksi] = t._count.jenis_transaksi; });
  const totalCount =
    (countMap["PRIMARY"] ?? 0) +
    (countMap["SECONDARY"] ?? 0) +
    (countMap["LELANG"] ?? 0) +
    (countMap["SEWA"] ?? 0);
  const jualCount  = (countMap["PRIMARY"] ?? 0) + (countMap["SECONDARY"] ?? 0);

  return (
    <KategoriPageClient
      slug={slug}
      label={label}
      initialData={properties}
      pagination={{ currentPage: page, totalPages, totalItems }}
      activeTipe={tipe}
      activeSort={sort}
      tabCounts={{
        semua:  totalCount,
        jual:   jualCount,
        lelang: countMap["LELANG"] ?? 0,
        sewa:   countMap["SEWA"] ?? 0,
      }}
    />
  );
}

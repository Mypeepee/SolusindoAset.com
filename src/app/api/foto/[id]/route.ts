// GET /api/foto/[id]?w=236
// ---------------------------------------------------------------------------
// FOTO LISTING DARI DOMAIN SENDIRI — untuk email.
//
// KENAPA ADA. Klien email tidak memuat gambar langsung dari perangkat
// penerima; Gmail dan Outlook mem-proxy-nya lewat server mereka, dan proxy itu
// tidak mengirim `Referer`. Sementara 120.007 dari 120.393 foto listing berada
// di file.lelang.go.id yang MEMBLOKIR HOTLINK. Jadi <img> yang menunjuk
// langsung ke sana akan kosong di hampir setiap email yang kita kirim — dan
// email properti tanpa foto adalah email yang tidak dibaca. Foto pula yang
// diberi bobot terbesar di mesin peringkat (30 dari 100), justru karena aset
// tanpa foto praktis tidak bisa ditawarkan.
//
// Route ini mengambilnya server-side (server kita bisa menjangkau host itu),
// mengecilkannya ke ukuran yang benar-benar dipakai kartu email, lalu
// menyajikannya dari domain sendiri dengan cache panjang.
//
// Sepupu dari /api/og/lelang/[id] — bedanya itu untuk crawler WhatsApp
// (1200×630 tetap), ini untuk email (kecil, ukuran bisa diminta).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import prisma from "@/lib/prisma";
import { resolveFetchableImage, fetchImageBytes } from "@/lib/fotoListing";

export const runtime = "nodejs";

/** Lebar yang diizinkan. Daftar tertutup, bukan angka bebas: `?w=` yang bebas
 *  membuat siapa pun bisa menyuruh server ini mengubah ukuran gambar ribuan
 *  kali dengan lebar berbeda-beda — CPU habis, dan tidak ada satu pun hasil
 *  yang bisa dipakai ulang dari cache. */
const LEBAR_SAH = new Set([118, 236, 320, 640]);
const LEBAR_BAWAAN = 236; // 2× kartu email 118px — tajam di layar retina
const RASIO = 148 / 118; // sama dengan kartu email (potret 4:5-an)

let cadanganCache: Buffer | null = null;
async function muatCadangan(): Promise<Buffer> {
  if (!cadanganCache) {
    cadanganCache = await readFile(
      path.join(process.cwd(), "public", "images", "hero", "banner.jpg"),
    );
  }
  return cadanganCache;
}

function keBigInt(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = keBigInt(params.id);
  const cardView = req.nextUrl.searchParams.get("view") === "card";
  const rawIndex = req.nextUrl.searchParams.get("index") || "0";
  const photoIndex = Number(rawIndex);
  if (
    cardView &&
    (!id ||
      !/^\d+$/.test(rawIndex) ||
      !Number.isSafeInteger(photoIndex) ||
      photoIndex > 49)
  )
    return new NextResponse("Foto tidak valid", { status: 400 });
  const diminta = Number(new URL(req.url).searchParams.get("w"));
  const lebar = LEBAR_SAH.has(diminta) ? diminta : LEBAR_BAWAAN;
  const tinggi = Math.round(lebar * RASIO);

  let sumber: Buffer | null = null;
  if (id != null) {
    const listing = await prisma.listing.findUnique({
      where: { id_property: id },
      select: { gambar: true },
    });
    const reference = cardView
      ? listing?.gambar
          ?.split(",")
          .map((part) => part.trim())
          .filter(Boolean)[photoIndex]
      : listing?.gambar;
    const src = resolveFetchableImage(reference, lebar * 2);
    if (src) sumber = await fetchImageBytes(src);
  }
  // Investor galleries never replace a missing source photo with another asset.
  if (cardView && !sumber)
    return new NextResponse("Foto belum tersedia", { status: 404 });

  /* Selalu membalas gambar yang VALID, bahkan saat sumbernya gagal. Balasan
     404 akan menghasilkan ikon rusak di tengah email — jauh lebih merusak
     daripada satu foto cadangan yang netral. */
  const kirim = async (buf: Buffer) =>
    (cardView
      ? sharp(buf).resize({ width: lebar, withoutEnlargement: true })
      : sharp(buf).resize(lebar, tinggi, {
          fit: "cover",
          position: "attention",
        })
    )
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();

  let keluar: Buffer;
  try {
    keluar = await kirim(sumber ?? (await muatCadangan()));
  } catch {
    if (cardView)
      return new NextResponse("Foto belum tersedia", { status: 404 });
    keluar = await kirim(await muatCadangan());
  }

  return new NextResponse(keluar as any, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(keluar.length),
      /* Cache panjang. Satu email digest dibuka berkali-kali oleh orang yang
         sama, dan proxy Gmail juga menyimpannya — tanpa cache, tiap pembukaan
         memaksa server kita mengambil ulang dari file.lelang.go.id. */
      "Cache-Control":
        "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    },
  });
}

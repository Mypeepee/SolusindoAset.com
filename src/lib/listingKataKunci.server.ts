import "server-only";

/**
 * Penghitung kata kunci — bagian `listingKataKunci` yang butuh database.
 *
 * Dipisah dari berkas induknya karena aturan `buildKataKunciWhere` ikut dipakai
 * client component (lewat listingFilters.ts → FilterCommandBar), sementara
 * yang ini tidak boleh ikut ke browser. Polanya sama dengan
 * nearbyPlaces.ts / nearbyPlaces.server.ts.
 */

import prisma from "@/lib/prisma";
import { applyPropertySearchQuery, parsePropertySearchQuery } from "./propertySearchQuery";
import { whereHargaListing } from "./listingSortRuntime";
import { buildTempatWhere, siapkanTempat } from "./listingTempatFilter";
import {
  TRANSAKSI,
  buildKataKunciWhere,
  type KonteksTransaksi,
} from "@/lib/listingKataKunci";

/**
 * Ambang untuk MENGHITUNG, bukan untuk menyaring — dan bedanya penting.
 *
 * Penghitung jalan pada setiap ketukan, jadi ia berhak menolak kueri yang
 * terlalu pendek untuk berarti apa pun (dua huruf cocok ke puluhan ribu baris
 * dengan biaya penuh). Tapi PENYARING dijalankan sekali, atas permintaan
 * pemakainya sendiri — memakai ambang yang sama di sana berarti kata kunci dua
 * huruf yang dulu berfungsi mendadak diabaikan diam-diam, dan halaman
 * menampilkan seluruh isi database seolah itu hasil pencariannya.
 */
const MIN_KATA_HITUNG = 3;

/**
 * Berapa properti yang cocok dengan kata kunci ini.
 *
 * Dipanggil dari kotak pencarian sambil user mengetik, jadi ia harus murah
 * DAN jujur: `status_tayang` & `bukan_properti` disaring sama persis seperti
 * halaman hasil, kalau tidak angkanya menjanjikan lebih dari yang akan
 * ditampilkan.
 */
export async function hitungKataKunci(
  q: string | null | undefined,
  konteks: KonteksTransaksi = "semua",
): Promise<number | null> {
  const teks = String(q ?? "").trim();
  if (teks.length < MIN_KATA_HITUNG) return null;

  const parsed = parsePropertySearchQuery(teks);

  try {
    const params = new URLSearchParams({ q: teks });
    applyPropertySearchQuery(params);
    const siap = parsed.nearby
      ? await siapkanTempat(Object.fromEntries(params), { q: params.get("q") ?? undefined })
      : { q: parsed.keyword, tempat: null };
    const where = buildKataKunciWhere(siap.q);
    const near = buildTempatWhere(siap.tempat);
    if (!where && !near && parsed.minHarga === undefined && parsed.maxHarga === undefined) return null;
    const price = await whereHargaListing(
      konteks === "beli" ? "JUAL" : konteks === "sewa" ? "SEWA" : konteks === "lelang" ? "LELANG" : "SEMUA",
      parsed.minHarga,
      parsed.maxHarga,
    );
    return await prisma.listing.count({
      where: {
        status_tayang: "TERSEDIA",
        bukan_properti: false,
        ...TRANSAKSI[konteks],
        AND: [where, price, near].filter((part): part is NonNullable<typeof part> => Boolean(part)),
      },
    });
  } catch {
    // Kotak pencarian tetap menawarkan pencarian alamat, hanya tanpa angka.
    return null;
  }
}

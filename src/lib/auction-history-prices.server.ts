import { Prisma } from "@prisma/client";
import {
  assembleAuctionHistory,
  AUCTION_HISTORY_CANDIDATE_LIMIT,
  auctionEffectivePrice,
  certNumbers,
  CERT_KEYS_EXPR,
  filterKotaSql,
  parseKota,
  type AuctionHistorySourceRow,
} from "@/lib/auctionHistory";

type Reader = Pick<Prisma.TransactionClient, "$queryRaw">;
type PriceNumber = Prisma.Decimal | number | string | null;
export type AuctionPriceSource = Omit<
  Pick<
    AuctionHistorySourceRow,
    | "id_property"
    | "slug"
    | "harga"
    | "nilai_limit_lelang"
    | "tanggal_lelang"
    | "tanggal_dibuat"
    | "kelurahan"
    | "kecamatan"
    | "kota"
    | "legalitas"
    | "nomor_legalitas"
    | "alamat_lengkap"
    | "luas_tanah"
    | "latitude"
    | "longitude"
  >,
  "harga" | "nilai_limit_lelang" | "luas_tanah" | "latitude" | "longitude"
> & {
  harga: PriceNumber;
  nilai_limit_lelang: PriceNumber;
  luas_tanah: PriceNumber;
  latitude: PriceNumber;
  longitude: PriceNumber;
};
export interface AuctionPricePoint {
  id: string;
  slug: string;
  date: string | null;
  price: number;
  round: number;
}
export interface AuctionPriceHistory {
  initialPrice: number | null;
  currentPrice: number | null;
  dropPct: number | null;
  points: AuctionPricePoint[];
  eventCount: number;
}
// Only provenance and matching evidence; no photo payload or building valuation.
const columns = Prisma.sql`id_property,slug,harga,nilai_limit_lelang,
 tanggal_lelang,tanggal_dibuat,kelurahan,kecamatan,kota,legalitas,nomor_legalitas,
 alamat_lengkap,luas_tanah,latitude,longitude`;

/** Same event collector as Riwayat Lelang Aset. Compare first recorded price
 * with this listing's actual event, never a historical maximum or a future event. */
export function summarizeAuctionPrices(
  target: AuctionPriceSource,
  candidates: AuctionPriceSource[],
): AuctionPriceHistory {
  const events = assembleAuctionHistory(target, candidates).filter(
    (e) => e.verdict.cakupan === "SAMA",
  );
  const currentIndex = events.findIndex(
    (e) => String(e.row.id_property) === String(target.id_property),
  );
  const history = events.slice(0, currentIndex + 1);
  const points = history.flatMap((event, index) => {
    const price = auctionEffectivePrice(event.row);
    return price === null
      ? []
      : [
          {
            id: String(event.row.id_property),
            slug: event.row.slug,
            date: event.row.tanggal_lelang
              ? new Date(event.row.tanggal_lelang).toISOString()
              : null,
            price,
            round: index + 1,
          },
        ];
  });
  const initial = points[0]?.price ?? null;
  const current = auctionEffectivePrice(target);
  const comparable = points.length >= 2 && initial !== null && current !== null;
  return {
    initialPrice: comparable ? initial : null,
    currentPrice: current,
    dropPct: comparable ? ((initial - current) / initial) * 100 : null,
    points,
    eventCount: history.length,
  };
}

/** One set-based candidate read; target evidence comes from the existing CMA read.
 * Keep the detail endpoint's per-reference candidate order/cap (1,000) exactly. */
export async function getAuctionPriceHistories(
  reader: Reader,
  targets: AuctionPriceSource[],
) {
  const result = new Map<string, AuctionPriceHistory>();
  if (!targets.length) return result;
  const numbers = [
    ...new Set(targets.flatMap((t) => certNumbers(t.nomor_legalitas))),
  ];
  const cityCores = targets.map((t) => parseKota(t.kota).core);
  // A nationwide scope already covers virtually all source cities. Avoid a
  // large LIKE ANY scan; the same per-reference city predicate is applied below.
  const cityFilter =
    new Set(cityCores).size > 20 ? Prisma.sql`TRUE` : filterKotaSql(cityCores);
  const candidates = numbers.length
    ? await reader.$queryRaw<
        AuctionPriceSource[]
      >`SELECT ${columns} FROM listing
      WHERE jenis_transaksi='LELANG' AND status_tayang<>'TARIK_LISTING'
      AND ${numbers.length > 1000 ? Prisma.sql`TRUE` : Prisma.sql`${CERT_KEYS_EXPR} && ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(numbers)}::jsonb))`}
      AND ${cityFilter} ORDER BY id_property`
    : [];
  const buckets = new Map<
    string,
    { row: AuctionPriceSource; city: string }[]
  >();
  for (const row of candidates) {
    const entry = {
      row,
      city: (row.kota || "").replace(/[^0-9A-Za-z]+/g, " ").toUpperCase(),
    };
    for (const number of certNumbers(row.nomor_legalitas)) {
      const bucket = buckets.get(number);
      if (bucket) bucket.push(entry);
      else buckets.set(number, [entry]);
    }
  }
  // Normalize source cities once, and reuse the same per-reference predicate for
  // repeated city/certificate pairs. Candidate order/cap and matching stay exact.
  const cityBuckets = new Map<string, AuctionPriceSource[]>();
  for (const target of targets) {
    const byId = new Map<string, AuctionPriceSource>();
    const core = parseKota(target.kota).core;
    for (const number of certNumbers(target.nomor_legalitas)) {
      const key = JSON.stringify([core, number]);
      let matches = cityBuckets.get(key);
      if (!matches) {
        matches = (buckets.get(number) || [])
          .filter(
            ({ city }) =>
              !core ||
              city.replace(/[^0-9A-Z]/g, "") === "" ||
              city.includes(core),
          )
          .map(({ row }) => row);
        cityBuckets.set(key, matches);
      }
      for (const row of matches) {
        if (String(row.id_property) !== String(target.id_property))
          byId.set(String(row.id_property), row);
      }
    }
    const ordered = [...byId.values()]
      .sort((a, b) =>
        a.id_property < b.id_property
          ? -1
          : a.id_property > b.id_property
            ? 1
            : 0,
      )
      .slice(0, AUCTION_HISTORY_CANDIDATE_LIMIT);
    result.set(
      String(target.id_property),
      summarizeAuctionPrices(target, ordered),
    );
  }
  return result;
}

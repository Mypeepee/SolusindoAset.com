import { Prisma } from "@prisma/client";
import { BUY_PROPERTY_TYPES } from "@/lib/propertyType";
import { getAuctionPriceHistories } from "@/lib/auction-history-prices.server";
import { buildCityRegistry } from "@/lib/investor-regions";
import { normWilayah, parseKota } from "@/lib/auctionHistory";
import type { LokasiDiskon } from "@/lib/preferensiDiskon";
import { matchesInvestorSearch } from "@/lib/investor-search";
import { selectCmaEvidence } from "@/lib/investor-roi";
import {
  serializeInvestorListing,
  type ListingRow,
} from "@/lib/investor-deals-row.server";
import {
  jakartaDayStart,
  combinedDealScore,
  INVESTOR_PAGE_SIZE,
  selectDeals,
  type CmaValidationProof,
  type DealFilters,
  type InvestorFeed,
  type InvestorListing,
  type TransactionType,
} from "@/lib/investor-deals";

type Reader = Pick<Prisma.TransactionClient, "$queryRaw">;
type Region = { provinsi: string | null; kota: string };
type Registry = ReturnType<typeof buildCityRegistry>;
type LegacyRow = ListingRow & { updated_at: Date };
const TTL = 60_000;
const READ_MODEL_PROPERTY_TYPES = ["RUMAH", "TANAH", "RUKO", "APARTEMEN"];
let cacheGeneration = 0;

/** Deployment compatibility is SELECT-only. Never install tables on a request. */
export async function hasInvestorReadModel(tx: Reader) {
  const rows = await tx.$queryRaw<{ ready: boolean }[]>`SELECT
    to_regclass('investor_pipeline_v2_state') IS NOT NULL AND
    to_regclass('investor_listing_valuations') IS NOT NULL AND
    to_regclass('investor_source_scopes') IS NOT NULL AS ready`;
  if (rows[0]?.ready !== true) return false;
  const state = await tx.$queryRaw<
    { version: number }[]
  >`SELECT version FROM investor_pipeline_v2_state WHERE id=true AND NOT needs_alias_refresh`;
  // Version 3 removes the former district fallback. Never serve an older stored benchmark.
  return state[0]?.version === 3;
}

const regionKey = (
  column: string,
) => Prisma.sql`regexp_replace(regexp_replace(trim(regexp_replace(upper(coalesce(${Prisma.raw(column)},'')),
 '[^0-9A-Z]+',' ','g')), '^(DESA KELURAHAN|KELURAHAN|KEL|DESA|DS|KECAMATAN|KEC) +','','g'), ' +','','g')`;

/** Canonical predicates and arithmetic embedded in migration_investor_intent_v2.sql, evaluated in
 * PostgreSQL while a deployment still has only the canonical `listing` table.
 * Initial/current ratios remain distinct; no old asking-price CMA is restored.
 */
export function legacyCmaQuery(
  registry: Registry,
  cityId: string,
  transactionType: TransactionType = "BELI",
  districtKey: string | null = null,
  includeMedia = true,
  extendedTypes = false,
) {
  const aliases = new Map<string, Record<string, string>>();
  for (const city of registry.records.values())
    for (const region of city.regions)
      aliases.set(JSON.stringify([region.provinsi || "", region.kota]), {
        raw_province: region.provinsi || "",
        raw_city: region.kota,
        city_id: city.id,
        city_name: city.name,
        province_name: city.provinceName,
      });
  const propertyTypes = extendedTypes ? [...BUY_PROPERTY_TYPES] : READ_MODEL_PROPERTY_TYPES;
  return Prisma.sql`WITH aliases AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify([...aliases.values()])}::jsonb)
    AS a(raw_province text,raw_city text,city_id text,city_name text,province_name text)
  ), normalized AS MATERIALIZED (
    -- Keep window-sort tuples narrow; descriptions/photos join only after valuation.
    SELECT s.id_property,s.kategori,s.status_tayang,s.bukan_properti,
      s.tanggal_lelang,s.luas_tanah,s.legalitas,a.city_id,a.city_name,a.province_name,
      ${regionKey("s.kecamatan")} district,${regionKey("s.kelurahan")} kel,
      CASE WHEN s.jenis_transaksi='SEWA' OR upper(s.judul)~'^[[:space:]]*(SEWA|DISEWAKAN|PENYEWAAN)([[:space:]:-]|$)' THEN 'SEWA' ELSE 'BELI' END transaction_type,
      CASE WHEN s.jenis_transaksi::text IN('PRIMARY','LELANG','SECONDARY') THEN s.jenis_transaksi::text END listing_category,
      CASE WHEN (s.jenis_transaksi='SEWA' OR upper(s.judul)~'^[[:space:]]*(SEWA|DISEWAKAN|PENYEWAAN)([[:space:]:-]|$)') AND d.durasi_sewa::text IN('HARIAN','MINGGUAN','BULANAN','TAHUNAN') THEN d.durasi_sewa::text END rental_period,
      CASE WHEN s.jenis_transaksi='SEWA' OR upper(s.judul)~'^[[:space:]]*(SEWA|DISEWAKAN|PENYEWAAN)([[:space:]:-]|$)' THEN
        coalesce(CASE d.durasi_sewa::text WHEN 'HARIAN' THEN nullif(d.harga_sewa_harian,0) WHEN 'MINGGUAN' THEN nullif(d.harga_sewa_mingguan,0) WHEN 'BULANAN' THEN nullif(d.harga_sewa_bulanan,0) WHEN 'TAHUNAN' THEN nullif(d.harga_sewa_tahunan,0) END,s.harga)
       WHEN s.jenis_transaksi='LELANG' THEN coalesce(nullif(s.nilai_limit_lelang,0),s.harga)
       ELSE CASE WHEN s.harga_promo>0 AND s.harga_promo<s.harga THEN s.harga_promo ELSE s.harga END END price,
      coalesce(s.tanggal_dibuat,CURRENT_TIMESTAMP) source_created_at,
      coalesce((SELECT array_agg(DISTINCT k ORDER BY k) FROM (
       SELECT regexp_replace(regexp_replace(part,'[^0-9A-Z]','','g'),'^0+','') k
       FROM regexp_split_to_table(upper(coalesce(s.nomor_legalitas,'')), '[,;/|+&]|\\mDAN\\M') part
      ) ck WHERE k ~ '[0-9]'),'{}'::text[]) certs
    FROM listing s LEFT JOIN listing_sewa_detail d ON d.id_property=s.id_property JOIN aliases a ON a.raw_city=s.kota AND a.raw_province=coalesce(s.provinsi,'')
    WHERE s.jenis_transaksi IN('PRIMARY','LELANG','SECONDARY','SEWA') AND (${cityId || null}::text IS NULL OR a.city_id=${cityId || null}) AND (${districtKey}::text IS NULL OR ${regionKey("s.kecamatan")}=${districtKey})
  ), keyed AS MATERIALIZED (
    SELECT n.*,
     (cardinality(certs)>0 AND kel<>'' AND district<>'' AND legalitas IS NOT NULL) identity_verified,
     city_id||'/'||coalesce(nullif(district,''),'UNKNOWN') district_id,
     CASE WHEN kel<>'' AND district<>'' THEN city_id||'/'||district||'/'||kel END kelurahan_id
    FROM normalized n WHERE transaction_type=${transactionType}
  ), sources AS MATERIALIZED (
    SELECT k.*,CASE WHEN identity_verified THEN
     'AST-'||md5(jsonb_build_array(city_id,district,kel,legalitas,certs)::text)
     ELSE 'UNVERIFIED-'||id_property::text END asset_code
    FROM keyed k
  ), ranked AS (
    SELECT s.*,row_number() OVER(PARTITION BY asset_code,transaction_type ORDER BY coalesce(tanggal_lelang,source_created_at) DESC,id_property DESC) latest,
     first_value(CASE WHEN listing_category='LELANG' AND price>0 THEN price END) OVER initial_event initial_price,
     first_value(CASE WHEN listing_category='LELANG' AND price>0 THEN id_property END) OVER initial_event initial_id,
     first_value(CASE WHEN listing_category='LELANG' AND price>0 THEN tanggal_lelang END) OVER initial_event initial_date,
     dense_rank() OVER(PARTITION BY asset_code,transaction_type ORDER BY coalesce(tanggal_lelang,source_created_at)) auction_round
    FROM sources s WINDOW initial_event AS (PARTITION BY asset_code,transaction_type
     ORDER BY CASE WHEN listing_category='LELANG' AND price>0 THEN 0 ELSE 1 END,coalesce(tanggal_lelang,source_created_at),id_property DESC
     ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
  ), current_assets AS MATERIALIZED (
    SELECT r.*,
      initial_price/nullif(CASE WHEN luas_tanah>0 THEN luas_tanah END,0) harga_per_meter,
      (CASE WHEN r.transaction_type='BELI' AND r.listing_category='LELANG' THEN initial_price ELSE price END)/nullif(CASE WHEN luas_tanah>0 THEN luas_tanah END,0) market_basis_per_meter,
      coalesce(kelurahan_id IS NOT NULL AND kel<>'' AND luas_tanah>0 AND (r.transaction_type='BELI' OR rental_period IS NOT NULL),false) market_eligible,
      price/nullif(CASE WHEN luas_tanah>0 THEN luas_tanah END,0) current_price_per_meter,
      CASE WHEN r.transaction_type='BELI' AND r.listing_category='LELANG' THEN (initial_price-price)/initial_price*100 END metric_auction_drop_pct
    FROM ranked r
    WHERE latest=1 AND price>0 AND NOT bukan_properti AND kategori::text = ANY(${propertyTypes}::text[])
  ), windowed AS (
    SELECT c.*,
     count(*) FILTER(WHERE status_tayang='TERSEDIA' AND identity_verified AND market_eligible AND market_basis_per_meter>0)
      OVER(PARTITION BY transaction_type,rental_period,kelurahan_id,kategori) nk_total,
     sum(market_basis_per_meter) FILTER(WHERE status_tayang='TERSEDIA' AND identity_verified AND market_eligible AND market_basis_per_meter>0)
      OVER(PARTITION BY transaction_type,rental_period,kelurahan_id,kategori) sk_total
    FROM current_assets c
  ), counts AS (
    SELECT c.*,
     (nk_total-CASE WHEN identity_verified AND market_eligible AND market_basis_per_meter>0 THEN 1 ELSE 0 END)::int nk,
     coalesce(sk_total,0)-CASE WHEN identity_verified AND market_eligible AND market_basis_per_meter>0 THEN market_basis_per_meter ELSE 0 END sk
    FROM windowed c WHERE status_tayang='TERSEDIA'
  ), baseline AS (
    SELECT *,CASE WHEN market_eligible AND nk>0 THEN sk/nk END benchmark_avg,
     CASE WHEN market_eligible THEN nk ELSE 0 END benchmark_count,
     CASE WHEN market_eligible AND nk>0 THEN 'KELURAHAN' ELSE 'NONE' END benchmark_scope
    FROM counts
  ), metrics AS (
    SELECT *, (benchmark_avg-current_price_per_meter)/nullif(benchmark_avg,0)*100 metric_market_spread_pct FROM baseline
  )
  SELECT m.id_property::text id,m.asset_code,m.id_property source_listing_id,m.identity_verified,
   m.city_id,m.city_name,m.province_name,m.district_id,coalesce(media.kecamatan,'') district_name,
   m.kelurahan_id,CASE WHEN m.kel<>'' THEN nullif(trim(media.kelurahan),'') END kelurahan_name,m.kategori::text property_type,
   m.transaction_type,m.listing_category,m.rental_period,m.market_basis_per_meter,m.market_eligible,true is_latest,
   m.source_created_at created_at,
   m.initial_price harga_lelang_pertama,m.price harga_lelang_terakhir,
   CASE WHEN m.luas_tanah>0 THEN m.luas_tanah END luas_tanah_m2,
   CASE WHEN m.luas_tanah>0 THEN m.harga_per_meter END harga_per_meter,
   CASE WHEN m.luas_tanah>0 THEN m.current_price_per_meter END current_price_per_meter,
   m.initial_id initial_source_id,m.initial_date initial_auction_date,m.auction_round::int,
   m.metric_auction_drop_pct,m.metric_market_spread_pct,
   CASE WHEN m.metric_auction_drop_pct IS NULL AND m.metric_market_spread_pct IS NULL THEN NULL ELSE coalesce(m.metric_auction_drop_pct,0)+coalesce(m.metric_market_spread_pct,0) END primary_deal_score,
   CASE WHEN m.metric_market_spread_pct IS NULL AND m.metric_auction_drop_pct IS NULL THEN NULL WHEN m.metric_market_spread_pct IS NULL OR m.metric_auction_drop_pct>=m.metric_market_spread_pct THEN 'AUCTION_DROP' ELSE 'MARKET_SPREAD' END primary_deal_type,
   m.benchmark_avg,m.benchmark_count,m.nk kelurahan_sample_count,m.benchmark_scope,
   CURRENT_TIMESTAMP benchmark_version,coalesce(media.tanggal_diupdate,m.source_created_at) updated_at,
   media.judul,media.slug,media.alamat_lengkap,${includeMedia ? Prisma.sql`media.gambar` : Prisma.sql`NULL::text AS gambar`},media.latitude,media.longitude,m.tanggal_lelang,
   media.harga history_raw_price,media.nilai_limit_lelang history_raw_limit,m.legalitas::text certificate_type,m.legalitas history_legalitas,media.nomor_legalitas history_nomor_legalitas,media.kota history_city_name,media.tanggal_dibuat history_created_at,
   '[]'::jsonb history,
   md5(jsonb_build_array(m.id_property,media.kota,media.provinsi,media.kecamatan,media.kelurahan,media.tanggal_diupdate)::text) source_revision
  FROM metrics m JOIN listing media ON media.id_property=m.id_property`;
}

let regionCache: { registry: Registry; expires: number } | null = null;
async function regions(tx: Reader, refresh: boolean) {
  if (!refresh && regionCache && regionCache.expires > Date.now())
    return regionCache.registry;
  const generation = cacheGeneration;
  const rows = await tx.$queryRaw<
    Region[]
  >`SELECT DISTINCT provinsi,kota FROM listing WHERE jenis_transaksi IN('PRIMARY','LELANG','SECONDARY','SEWA')`;
  const registry = buildCityRegistry(rows);
  if (generation === cacheGeneration)
    regionCache = { registry, expires: Date.now() + TTL };
  return registry;
}
type Snapshot = {
  rows: LegacyRow[];
  items: InvestorListing[];
  byId: Map<string, LegacyRow>;
  itemById: Map<string, InvestorListing>;
  hydrated: Set<string>;
  mediaFlights: Map<string, Promise<void>>;
  responses: Map<string, InvestorFeed>;
  generatedAt: string;
  expires: number;
};
const cache = new Map<string, Snapshot>();
const flights = new Map<string, Promise<Snapshot>>();
async function snapshot(
  tx: Reader,
  registry: Registry,
  cityId: string,
  refresh: boolean,
  transactionType: TransactionType = "BELI",
  extendedTypes = false,
) {
  // Cache checks precede ALL readiness/database work, including cold-request coalescing.
  const cacheKey = `${extendedTypes ? "marketing:" : ""}${transactionType}:${cityId}`;
  const cached = cache.get(cacheKey);
  if (!refresh && cached && cached.expires > Date.now()) return cached;
  const pending = flights.get(cacheKey);
  if (pending) return pending;
  const generation = cacheGeneration;
  const task = (async () => {
    // The existing read model stores four categories. Marketing's wider Home
    // catalogue uses the same valuation rules from source, in a separate cache.
    const stored = !extendedTypes && (await hasInvestorReadModel(tx));
    // Bound the database work as well as the browser request/Prisma transaction.
    await tx.$queryRaw`SELECT set_config('statement_timeout','20000',true)`;
    const rows = stored
      ? await tx.$queryRaw<
          LegacyRow[]
        >`SELECT v.*,s.judul,s.slug,s.alamat_lengkap,NULL::text AS gambar,s.latitude,s.longitude,s.tanggal_lelang,
          s.harga history_raw_price,s.nilai_limit_lelang history_raw_limit,s.legalitas::text certificate_type,s.legalitas history_legalitas,s.nomor_legalitas history_nomor_legalitas,s.kota history_city_name,s.tanggal_dibuat history_created_at
          FROM investor_listing_valuations v JOIN listing s ON s.id_property=v.source_listing_id
          WHERE v.is_latest AND v.transaction_type=${transactionType} AND (${cityId || null}::text IS NULL OR v.city_id=${cityId || null})`
      : await tx.$queryRaw<LegacyRow[]>(
          legacyCmaQuery(registry, cityId, transactionType, null, false, extendedTypes),
        );
    const auctions = rows.filter(
      (row) =>
        row.transaction_type === "BELI" && row.listing_category === "LELANG",
    );
    const histories = await getAuctionPriceHistories(
      tx,
      auctions.map((row) => ({
        id_property: BigInt(row.id),
        slug: row.slug,
        harga:
          row.history_raw_price === null
            ? null
            : Number(row.history_raw_price ?? row.harga_lelang_terakhir),
        nilai_limit_lelang:
          row.history_raw_limit === null
            ? null
            : Number(
                row.history_raw_limit === undefined
                  ? row.harga_lelang_terakhir
                  : row.history_raw_limit,
              ),
        tanggal_lelang: row.tanggal_lelang
          ? new Date(row.tanggal_lelang)
          : null,
        tanggal_dibuat: row.history_created_at
          ? new Date(row.history_created_at)
          : null,
        legalitas: row.history_legalitas ?? null,
        nomor_legalitas: row.history_nomor_legalitas ?? null,
        kelurahan: row.kelurahan_name,
        kecamatan: row.district_name,
        kota: row.history_city_name ?? row.city_name,
        alamat_lengkap: row.alamat_lengkap,
        luas_tanah:
          row.luas_tanah_m2 === null ? null : Number(row.luas_tanah_m2),
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
      })),
    );
    for (const row of auctions) {
      const history = histories.get(row.id);
      const auction = history?.dropPct ?? null;
      const market =
        row.metric_market_spread_pct === null
          ? null
          : Number(row.metric_market_spread_pct);
      row.auction_initial_price = history?.initialPrice ?? null;
      row.metric_auction_drop_pct = auction;
      row.primary_deal_score = combinedDealScore(auction, market);
      row.primary_deal_type =
        row.primary_deal_score === null
          ? null
          : auction !== null && (market === null || auction >= market)
            ? "AUCTION_DROP"
            : "MARKET_SPREAD";
      row.auction_round = history?.eventCount || 1;
      row.history = (history?.points || [])
        .filter((point) => point.id !== row.id)
        .map((point) => ({
          date: point.date,
          price: point.price,
          id: point.id,
          slug: point.slug,
          round: point.round,
        }));
    }
    const items = rows.map((row) => serializeInvestorListing(row, false));
    const result: Snapshot = {
      rows,
      items,
      itemById: new Map(items.map((item) => [item.id, item])),
      hydrated: new Set<string>(),
      mediaFlights: new Map<string, Promise<void>>(),
      byId: new Map(rows.map((row) => [row.id, row])),
      responses: new Map<string, InvestorFeed>(),
      generatedAt: new Date().toISOString(),
      expires: Date.now() + TTL,
    };
    if (generation !== cacheGeneration) return result;
    cache.delete(cacheKey);
    cache.set(cacheKey, result);
    while (
      cache.size > 4 ||
      (cache.size > 1 &&
        [...cache.values()].reduce((sum, e) => sum + e.rows.length, 0) >
          100_000)
    )
      cache.delete(cache.keys().next().value!);
    return result;
  })();
  flights.set(cacheKey, task);
  try {
    return await task;
  } finally {
    if (flights.get(cacheKey) === task) flights.delete(cacheKey);
  }
}

function resolveCity(
  registry: Registry,
  filters: DealFilters,
  cities = cityOptions(registry),
) {
  let cityId = filters.locations?.length ? "" : filters.city;
  // A single selected city uses the existing optimized city snapshot.
  if (
    filters.locations?.length === 1 &&
    filters.locations[0].level === "kota"
  ) {
    const selected = filters.locations[0];
    const city = cities.find(
      (candidate) =>
        candidate.name.toLocaleLowerCase("id-ID") ===
        selected.name.toLocaleLowerCase("id-ID"),
    );
    cityId = city?.id || "";
  }
  if (cityId && !registry.records.has(cityId)) {
    const found = cities.filter(
      (c) =>
        c.name.toLocaleLowerCase("id-ID") === cityId.toLocaleLowerCase("id-ID"),
    );
    if (found.length !== 1) throw new Error("INVESTOR_CITY_NOT_FOUND");
    cityId = found[0].id;
  }
  return cityId;
}
const cityOptionsCache = new WeakMap<Registry, InvestorFeed["cities"]>();
function cityOptions(registry: Registry) {
  let options = cityOptionsCache.get(registry);
  if (!options) {
    options = [...registry.records.values()]
      .map(({ id, name, provinceName }) => ({ id, name, provinceName }))
      .sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
    cityOptionsCache.set(registry, options);
  }
  return options;
}

/** Authorized callers can serve a fresh snapshot without opening a transaction. */
export function getCachedInvestorFeed(
  filters: DealFilters,
  page: number,
  view: string,
  savedIds: string[],
) {
  if (!regionCache || regionCache.expires <= Date.now()) return null;
  const registry = regionCache.registry;
  const cityId = resolveCity(registry, filters);
  const data = cache.get(`${filters.transactionType || "BELI"}:${cityId}`);
  if (!data || data.expires <= Date.now()) return null;
  const feed = feedFromSnapshot(
    data,
    registry,
    cityId,
    filters,
    page,
    view,
    savedIds,
  );
  return feedIds(feed).every((id) => data.hydrated.has(id)) ? feed : null;
}

export async function getLegacyInvestorFeed(
  tx: Reader,
  filters: DealFilters,
  page: number,
  view: string,
  savedIds: string[],
  refresh = false,
): Promise<InvestorFeed> {
  const registry = await regions(tx, refresh);
  const cities = cityOptions(registry);
  const cityId = resolveCity(registry, filters, cities);
  const data = await snapshot(
    tx,
    registry,
    cityId,
    refresh,
    filters.transactionType || "BELI",
  );
  const feed = feedFromSnapshot(
    data,
    registry,
    cityId,
    filters,
    page,
    view,
    savedIds,
  );
  await hydrateDetails(tx, data, feedIds(feed));
  return feed;
}

async function marketingInvestorScope(
  tx: Reader,
  filters: DealFilters,
  refresh: boolean,
) {
  const registry = await regions(tx, refresh);
  const cityId = resolveCity(registry, filters, cityOptions(registry));
  const extendedTypes =
    !filters.propertyTypes?.length ||
    filters.propertyTypes.some(
      (type) => !READ_MODEL_PROPERTY_TYPES.includes(type),
    );
  const data = await snapshot(
    tx,
    registry,
    cityId,
    refresh,
    "BELI",
    extendedTypes,
  );
  const ranked = selectDeals(
    data.items.filter(
      (item) =>
        (!filters.listingCategory ||
          filters.listingCategory === "ALL" ||
          item.listingCategory === filters.listingCategory) &&
        matchesInvestorSearch(item, filters),
    ),
    { ...filters, city: cityId },
    [],
  );
  return { data, ranked };
}

/** Shared valuation evidence for CRM criteria, before UI filters or pagination. */
export async function getClientDiscountScope(tx: Reader, transactionType: TransactionType, location: LokasiDiskon) {
  const registry = await regions(tx, false);
  const key = (value: string) => (normWilayah(value) || "").replace(/[^0-9A-Z]/gi, "").toUpperCase();
  // Locate municipalities first. Valuation still sees every peer in each city,
  // independent of the client's budget/type/land range, without a nationwide sort.
  let filter = Prisma.sql`TRUE`;
  if (location.loc_kota) filter = Prisma.sql`s.kota ILIKE ${`%${parseKota(location.loc_kota).core || location.loc_kota}%`}`;
  else if (location.loc_kelurahan) filter = Prisma.sql`${regionKey("s.kelurahan")}=${key(location.loc_kelurahan)}`;
  else if (location.loc_kecamatan) filter = Prisma.sql`${regionKey("s.kecamatan")}=${key(location.loc_kecamatan)}`;
  else if (location.loc_provinsi) filter = Prisma.sql`s.provinsi ILIKE ${`%${location.loc_provinsi}%`}`;
  const raw = await tx.$queryRaw<Region[]>(Prisma.sql`SELECT DISTINCT s.provinsi,s.kota FROM listing s WHERE ${filter}`);
  const cityIds = new Set(raw.map(row => registry.resolve(row)).filter((id): id is string => !!id));
  const result: { id: string; kelurahan: number | null; turunLelang: number | null }[] = [];
  for (const cityId of cityIds) {
    const data = await snapshot(tx, registry, cityId, false, transactionType, true);
    result.push(...data.items.map(item => ({ id: item.id, kelurahan: item.metricMarketSpreadPct, turunLelang: item.metricAuctionDropPct })));
  }
  return result;
}

/** Complete selection facts for inventory diagnostics; no photos/history hydration. */
export async function getMarketingInvestorScope(
  tx: Reader,
  filters: DealFilters,
  refresh = false,
): Promise<readonly InvestorListing[]> {
  return (await marketingInvestorScope(tx, filters, refresh)).ranked;
}

/** Server-only publishing selection: rank the complete scope before hydration/slicing. */
export async function getMarketingInvestorCandidates(
  tx: Reader,
  filters: DealFilters,
  excludedKeys: Set<string>,
  offset = 0,
  limit = 30,
  qualifies: (listing: InvestorListing) => boolean = () => true,
  refresh = true,
  prioritize?: (listing: InvestorListing) => boolean,
) {
  const { data, ranked } = await marketingInvestorScope(
    tx,
    filters,
    offset === 0 && refresh,
  );
  const matching = ranked.filter(
    (item) =>
      qualifies(item) &&
      !excludedKeys.has(
        item.assetCode ? "asset:" + item.assetCode : "listing:" + item.id,
      ),
  );
  // The manual picker keeps unavailable matches visible with an explanation.
  // Partition before pagination while preserving Investor rank within each group.
  // Automatic publishing omits this callback and retains its existing ranking.
  const available = prioritize
    ? [
        ...matching.filter(prioritize),
        ...matching.filter((item) => !prioritize(item)),
      ]
    : matching;
  const items = available.slice(offset, offset + limit);
  await hydrateDetails(
    tx,
    data,
    items.map((item) => item.id),
  );
  // Investor's browser photos are proxy URLs. Publishing needs the original
  // stored references; clone so the shared snapshot/browser feed stays intact.
  return {
    items: items.map((item) => {
      const photos = [
        ...new Set(
          (data.byId.get(item.id)?.gambar || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ];
      const sourceCreated = data.byId.get(item.id)?.history_created_at;
      return {
        ...item,
        sourceListedAt: sourceCreated
          ? new Date(sourceCreated).toISOString()
          : null,
        imageUrl: photos[0] || "",
        imageUrls: photos,
      };
    }),
    total: available.length,
  };
}

function feedFromSnapshot(
  data: Snapshot,
  registry: Registry,
  cityId: string,
  filters: DealFilters,
  page: number,
  view: string,
  savedIds: string[],
): InvestorFeed {
  const responseKey = JSON.stringify([
    filters,
    filters.savedOnly ? [...savedIds].sort() : [],
    jakartaDayStart(),
  ]);
  const cached = data.responses.get(responseKey);
  if (cached) return paginateFeed(cached, page, view);
  const cities = cityOptions(registry);
  const items = data.items
      .filter(
        (p) =>
          filters.transactionType === "SEWA" ||
          !filters.listingCategory ||
          filters.listingCategory === "ALL" ||
          p.listingCategory === filters.listingCategory,
      )
      .filter((p) => matchesInvestorSearch(p, filters)),
    applied = { ...filters, city: cityId };
  const ranked = selectDeals(items, applied, savedIds);
  const matchingListingsCount =
    applied.dataState === "all"
      ? ranked.length
      : selectDeals(items, { ...applied, dataState: "all" }, savedIds).length;
  const cityDeals = selectDeals(items, {
    ...applied,
    query: "",
    savedOnly: false,
    sort: "score",
    dataState: "deals",
    listingCategory: filters.listingCategory || "ALL",
  });
  const spreads = items.flatMap((p) =>
    p.metricMarketSpreadPct === null ? [] : [p.metricMarketSpreadPct],
  );
  const response: InvestorFeed = {
    // Full ranking is cached internally, and only a bounded page leaves the server.
    items: ranked,
    cities,
    locations: [
      ...new Set(
        items
          .flatMap((p) => [p.kelurahanName, p.districtName])
          .filter((value): value is string => Boolean(value)),
      ),
    ]
      .filter((v) =>
        v
          .toLocaleLowerCase("id-ID")
          .includes(filters.query.trim().toLocaleLowerCase("id-ID")),
      )
      .sort((a, b) => a.localeCompare(b, "id-ID"))
      .slice(0, 100),
    total: ranked.length,
    page: 1,
    pageSize: INVESTOR_PAGE_SIZE,
    pageCount: 1,
    cityId,
    generatedAt: data.generatedAt,
    summary: {
      missingKelurahanCount: items.filter((p) => !p.kelurahanVerified).length,
      rentalPeriodMissingCount: items.filter(
        (p) => p.transactionType === "SEWA" && !p.rentalPeriod,
      ).length,
      activeListings: items.length,
      matchingListingsCount,
      worthItCount: cityDeals.length,
      avgMarketSpread: spreads.length
        ? spreads.reduce((a, b) => a + b, 0) / spreads.length
        : null,
      benchmarkCoverage: spreads.length,
      historyCoverage: items.filter((p) => p.auctionRound > 1).length,
      unscoredCount: items.filter((p) => p.primaryDealScore === null).length,
      pastScheduleCount: items.filter(
        (p) => p.auctionDate && Date.parse(p.auctionDate) < jakartaDayStart(),
      ).length,
      topDeal: cityDeals[0] || null,
      suggestedDeals: cityDeals.slice(0, 5),
    },
  };
  data.responses.set(responseKey, response);
  while (data.responses.size > 24)
    data.responses.delete(data.responses.keys().next().value!);
  return paginateFeed(response, page, view);
}
function paginateFeed(
  feed: InvestorFeed,
  requestedPage: number,
  view: string,
): InvestorFeed {
  const pageSize = view === "map" ? 200 : INVESTOR_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(feed.total / pageSize));
  const page = Math.max(1, Math.min(requestedPage, pageCount));
  return {
    ...feed,
    items: feed.items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    pageCount,
  };
}

const feedIds = (feed: InvestorFeed) => [
  ...new Set([
    ...feed.items.map((item) => item.id),
    ...(feed.summary.suggestedDeals || []).map((item) => item.id),
    ...(feed.summary.topDeal ? [feed.summary.topDeal.id] : []),
  ]),
];
async function hydrateDetails(tx: Reader, data: Snapshot, ids: string[]) {
  const missing = [...new Set(ids)].filter((id) => !data.hydrated.has(id));
  if (!missing.length) return;
  const key = missing.slice().sort().join(",");
  const pending = data.mediaFlights.get(key);
  if (pending) return pending;
  const task = (async () => {
    const photos = await tx.$queryRaw<
      { id: string; gambar: string | null }[]
    >`SELECT id_property::text id,gambar FROM listing WHERE id_property IN (${Prisma.join(missing.map((id) => BigInt(id)))})`;
    const byId = new Map(photos.map((photo) => [photo.id, photo.gambar]));
    for (const id of missing) {
      const row = data.byId.get(id),
        item = data.itemById.get(id);
      if (row && item) {
        row.gambar = byId.get(id) ?? null;
        Object.assign(item, serializeInvestorListing(row));
        data.hydrated.add(id);
      }
    }
  })();
  data.mediaFlights.set(key, task);
  try {
    await task;
  } finally {
    if (data.mediaFlights.get(key) === task) data.mediaFlights.delete(key);
  }
}
function cachedSnapshotFor(id: string) {
  return [...cache.values()]
    .filter((entry) => entry.expires > Date.now() && entry.byId.has(id))
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
}
const proofIds = (proof: CmaValidationProof) => [
  ...new Set([
    proof.listing.id,
    ...proof.samples.map((peer) => peer.id),
    ...(proof.cheapestPeer ? [proof.cheapestPeer.id] : []),
  ]),
];
async function hydratedProof(tx: Reader, data: Snapshot, row: LegacyRow) {
  const proof = proofFromSnapshot(data, row);
  await hydrateDetails(tx, data, proofIds(proof));
  return proofFromSnapshot(data, row);
}

export async function getLegacyCmaProof(
  tx: Reader,
  id: string,
): Promise<CmaValidationProof | null> {
  if (!/^\d{1,20}$/.test(id) || BigInt(id) > BigInt("9223372036854775807"))
    return null;
  const cached = cachedSnapshotFor(id);
  if (cached) return hydratedProof(tx, cached, cached.byId.get(id)!);
  const target = await tx.$queryRaw<
    (Region & { transaction_type: TransactionType })[]
  >`SELECT provinsi,kota,CASE WHEN jenis_transaksi='SEWA' OR upper(judul)~'^[[:space:]]*(SEWA|DISEWAKAN|PENYEWAAN)([[:space:]:-]|$)' THEN 'SEWA' ELSE 'BELI' END transaction_type FROM listing WHERE id_property=${BigInt(id)} AND jenis_transaksi IN('PRIMARY','LELANG','SECONDARY','SEWA')`;
  if (!target[0]) return null;
  const registry = await regions(tx, false),
    cityId = registry.resolve(target[0]);
  if (!cityId) return null;
  const data = await snapshot(
      tx,
      registry,
      cityId,
      false,
      target[0].transaction_type,
    ),
    row = data.rows.find((r) => r.id === id);
  if (!row) return null;
  return hydratedProof(tx, data, row);
}

export function getCachedCmaProof(id: string): CmaValidationProof | null {
  const data = cachedSnapshotFor(id);
  if (!data) return null;
  const proof = proofFromSnapshot(data, data.byId.get(id)!);
  return proofIds(proof).every((peerId) => data.hydrated.has(peerId))
    ? proof
    : null;
}

function proofFromSnapshot(data: Snapshot, row: LegacyRow): CmaValidationProof {
  const peers = row.market_eligible
    ? data.rows.filter(
        (p) =>
          p.identity_verified &&
          p.market_eligible &&
          Number(p.market_basis_per_meter) > 0 &&
          p.transaction_type === row.transaction_type &&
          p.rental_period === row.rental_period &&
          p.asset_code !== row.asset_code &&
          p.property_type === row.property_type &&
          p.kelurahan_id === row.kelurahan_id,
      )
    : [];
  if (peers.length !== row.benchmark_count)
    throw new Error("INVESTOR_CMA_INCONSISTENT");
  const listing = serializeInvestorListing(row);
  const selected = selectCmaEvidence(
    peers.map((peer) => ({
      assetCode: peer.asset_code,
      baselinePricePerSqm: Number(peer.market_basis_per_meter),
      updatedAt: new Date(peer.updated_at).toISOString(),
      row: peer,
    })),
    row.asset_code,
  );
  // Serialize source photos/links only for the bounded visible selection and
  // the cheapest reference, never the entire pool. No extra database queries.
  const toSample = ({ row: p }: (typeof selected.samples)[number]) => {
    const source = serializeInvestorListing(p);
    return {
      id: p.id,
      assetCode: p.asset_code,
      propertyType: p.property_type,
      locationSummary: [p.alamat_lengkap, p.kelurahan_name, p.district_name]
        .filter(Boolean)
        .join(", "),
      initialAuctionPrice: Number(
        p.harga_lelang_pertama ?? p.harga_lelang_terakhir,
      ),
      listingCategory: p.listing_category,
      transactionType: p.transaction_type,
      rentalPeriod: p.rental_period,
      landAreaSqm: Number(p.luas_tanah_m2),
      baselinePricePerSqm: Number(p.market_basis_per_meter),
      listingUrl: source.listingUrl,
      imageUrl: source.imageUrl,
      updatedAt: new Date(p.updated_at).toISOString(),
    };
  };
  const samples = selected.samples.map(toSample);
  const cheapestPeer = selected.cheapestPeer
    ? (samples.find(
        (peer) => peer.assetCode === selected.cheapestPeer!.assetCode,
      ) ?? toSample(selected.cheapestPeer))
    : null;
  return {
    listing,
    benchmark: listing.benchmark,
    kelurahanSampleCount: row.kelurahan_sample_count,
    expandedToDistrict: false,
    generatedAt: data.generatedAt,
    version: new Date(row.benchmark_version).toISOString(),
    samples,
    minBaselinePricePerSqm: selected.minBaselinePricePerSqm,
    cheapestPeer,
  };
}

export function invalidateInvestorCache() {
  cacheGeneration++;
  cache.clear();
  flights.clear();
  regionCache = null;
}

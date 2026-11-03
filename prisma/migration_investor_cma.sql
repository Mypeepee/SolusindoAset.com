-- Additive investor read model. Legacy `listing` remains the ingestion source.
-- Install atomically using scripts/install-investor-cma.cjs (seeds city aliases,
-- backfills, validates and commits). Do not use prisma db push for this migration.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
  WHERE t.typname='investor_property_type_enum' AND n.nspname=current_schema()) THEN
  CREATE TYPE investor_property_type_enum AS ENUM('RUMAH','TANAH','RUKO','APARTEMEN');
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS investor_city_aliases (
  raw_province text NOT NULL, raw_city text NOT NULL,
  city_id text NOT NULL, city_name text NOT NULL, province_name text NOT NULL,
  PRIMARY KEY(raw_province, raw_city)
);

CREATE OR REPLACE FUNCTION investor_region_key(v text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT regexp_replace(regexp_replace(trim(regexp_replace(upper(coalesce(v,'')),
 '[^0-9A-Z]+',' ','g')), '^(DESA KELURAHAN|KELURAHAN|KEL|DESA|DS|KECAMATAN|KEC) +','','g'), ' +','','g')
$$;
CREATE OR REPLACE FUNCTION investor_cert_keys(v text) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT coalesce(array_agg(DISTINCT k ORDER BY k), '{}'::text[]) FROM (
 SELECT regexp_replace(regexp_replace(part,'[^0-9A-Z]','','g'),'^0+','') k
 FROM regexp_split_to_table(upper(coalesce(v,'')), '[,;/|+&]|\mDAN\M') part
 ) s WHERE k ~ '[0-9]'
$$;

-- One mapping per source event. History lives in legacy listing, not duplicate
-- rows in the latest-asset table. Unresolved identities are never CMA samples.
CREATE TABLE IF NOT EXISTS investor_listing_sources (
 -- Intentionally no FK: mappings must survive the source DELETE until its
 -- AFTER STATEMENT trigger can discover and rebuild the affected asset.
 source_id bigint PRIMARY KEY,
 asset_code text NOT NULL, identity_verified boolean NOT NULL,
 city_id text NOT NULL, city_name text NOT NULL, province_name text NOT NULL,
 district_id text NOT NULL, district_name text NOT NULL,
 kelurahan_id text NOT NULL, kelurahan_name text NOT NULL,
 property_type text NOT NULL, event_price numeric(20,2) NOT NULL,
 is_property boolean NOT NULL,
 event_date timestamptz, source_created_at timestamptz NOT NULL,
 status text NOT NULL, land_area numeric(12,2), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS investor_sources_asset ON investor_listing_sources(asset_code, event_date, source_id);

CREATE TABLE IF NOT EXISTS listings (
 id text PRIMARY KEY,
 asset_code text NOT NULL UNIQUE,
 source_listing_id bigint NOT NULL UNIQUE,
 city_id text NOT NULL, city_name text NOT NULL, province_name text NOT NULL,
 district_id text NOT NULL, district_name text NOT NULL,
 kelurahan_id text NOT NULL, kelurahan_name text NOT NULL,
 property_type investor_property_type_enum NOT NULL,
 harga_lelang_pertama numeric(20,2) NOT NULL CHECK(harga_lelang_pertama > 0),
 harga_lelang_terakhir numeric(20,2) NOT NULL CHECK(harga_lelang_terakhir > 0),
 luas_tanah_m2 numeric(12,2),
 harga_per_meter numeric, -- FIRST recorded auction / land area, never current price
 current_price_per_meter numeric,
 is_latest boolean NOT NULL DEFAULT false,
 identity_verified boolean NOT NULL DEFAULT false,
 initial_source_id bigint NOT NULL,
 initial_auction_date timestamptz,
 auction_round integer NOT NULL,
 metric_auction_drop_pct numeric,
 metric_market_spread_pct numeric,
 primary_deal_score numeric,
 primary_deal_type text,
 benchmark_avg numeric,
 benchmark_count integer NOT NULL DEFAULT 0,
 kelurahan_sample_count integer NOT NULL DEFAULT 0,
 benchmark_scope text NOT NULL DEFAULT 'NONE' CHECK(benchmark_scope IN ('KELURAHAN','KECAMATAN','NONE')),
 benchmark_version timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS investor_city_idx ON listings(city_id, city_name);
CREATE INDEX IF NOT EXISTS investor_kelurahan_idx ON listings(kelurahan_id, kelurahan_name);
CREATE INDEX IF NOT EXISTS investor_kel_peers ON listings(kelurahan_id, property_type, updated_at DESC, asset_code)
 INCLUDE(harga_per_meter) WHERE is_latest AND identity_verified AND harga_per_meter > 0;
CREATE INDEX IF NOT EXISTS investor_district_peers ON listings(district_id, property_type, updated_at DESC, asset_code)
 INCLUDE(harga_per_meter) WHERE is_latest AND identity_verified AND harga_per_meter > 0;
CREATE INDEX IF NOT EXISTS investor_rank ON listings(primary_deal_score DESC NULLS LAST, id) WHERE is_latest;
CREATE INDEX IF NOT EXISTS investor_city_rank ON listings(city_id, primary_deal_score DESC NULLS LAST, id) WHERE is_latest;

CREATE TABLE IF NOT EXISTS investor_cma_groups (
 scope text NOT NULL, region_id text NOT NULL, property_type investor_property_type_enum NOT NULL,
 price_sum numeric NOT NULL, sample_count integer NOT NULL,
 PRIMARY KEY(scope,region_id,property_type)
);
CREATE TABLE IF NOT EXISTS investor_pipeline_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), version integer NOT NULL,
 updated_at timestamptz NOT NULL
);

-- Price ratios are protected from accidental application writes too.
CREATE OR REPLACE FUNCTION investor_listing_ratios() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.harga_per_meter := NEW.harga_lelang_pertama / nullif(NEW.luas_tanah_m2,0);
 NEW.current_price_per_meter := NEW.harga_lelang_terakhir / nullif(NEW.luas_tanah_m2,0);
 NEW.metric_auction_drop_pct := (NEW.harga_lelang_pertama-NEW.harga_lelang_terakhir)/NEW.harga_lelang_pertama*100;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS investor_ratios ON listings;
CREATE TRIGGER investor_ratios BEFORE INSERT OR UPDATE OF harga_lelang_pertama,harga_lelang_terakhir,luas_tanah_m2,harga_per_meter,current_price_per_meter,metric_auction_drop_pct
 ON listings FOR EACH ROW EXECUTE FUNCTION investor_listing_ratios();

-- Rebuild only affected districts; NULL means full backfill. Stored sum/count
-- lets every target use a leave-one-asset-out arithmetic mean in constant time.
CREATE OR REPLACE FUNCTION investor_refresh_cma(districts text[] DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM investor_cma_groups g WHERE districts IS NULL OR
 (g.scope='KECAMATAN' AND g.region_id=ANY(districts)) OR
 (g.scope='KELURAHAN' AND EXISTS(SELECT 1 FROM unnest(districts) d WHERE g.region_id LIKE d || '/%'));
 INSERT INTO investor_cma_groups(scope,region_id,property_type,price_sum,sample_count)
 SELECT scope,region_id,property_type,sum(harga_per_meter),count(*)::int
 FROM listings l CROSS JOIN LATERAL (VALUES ('KELURAHAN',l.kelurahan_id),('KECAMATAN',l.district_id)) r(scope,region_id)
 WHERE l.is_latest AND l.identity_verified AND l.harga_per_meter>0
 AND (districts IS NULL OR l.district_id=ANY(districts))
 GROUP BY scope,region_id,property_type;

 WITH counts AS (
  SELECT l.asset_code,
   greatest(0,coalesce(k.sample_count,0)-CASE WHEN l.is_latest AND l.identity_verified AND l.harga_per_meter>0 THEN 1 ELSE 0 END) nk,
   greatest(0,coalesce(d.sample_count,0)-CASE WHEN l.is_latest AND l.identity_verified AND l.harga_per_meter>0 THEN 1 ELSE 0 END) nd,
   coalesce(k.price_sum,0)-CASE WHEN l.is_latest AND l.identity_verified AND l.harga_per_meter>0 THEN l.harga_per_meter ELSE 0 END sk,
   coalesce(d.price_sum,0)-CASE WHEN l.is_latest AND l.identity_verified AND l.harga_per_meter>0 THEN l.harga_per_meter ELSE 0 END sd
  FROM listings l
  LEFT JOIN investor_cma_groups k ON k.scope='KELURAHAN' AND k.region_id=l.kelurahan_id AND k.property_type=l.property_type
  LEFT JOIN investor_cma_groups d ON d.scope='KECAMATAN' AND d.region_id=l.district_id AND d.property_type=l.property_type
  WHERE districts IS NULL OR l.district_id=ANY(districts)
 ), baseline AS (
  SELECT *, CASE WHEN nk>=3 THEN sk/nk WHEN nd>0 THEN sd/nd END avg,
   CASE WHEN nk>=3 THEN nk ELSE nd END n,
   CASE WHEN nk>=3 THEN 'KELURAHAN' WHEN nd>0 THEN 'KECAMATAN' ELSE 'NONE' END scope FROM counts
 ), metrics AS (
 SELECT b.*, (b.avg-l.current_price_per_meter)/nullif(b.avg,0)*100 spread
 FROM baseline b JOIN listings l USING(asset_code)
 )
 UPDATE listings l SET benchmark_avg=m.avg,benchmark_count=m.n,kelurahan_sample_count=m.nk,
 benchmark_scope=m.scope,metric_market_spread_pct=m.spread,
 primary_deal_score=CASE WHEN l.metric_auction_drop_pct IS NULL AND m.spread IS NULL THEN NULL ELSE coalesce(l.metric_auction_drop_pct,0)+coalesce(m.spread,0) END,
 primary_deal_type=CASE WHEN m.spread IS NULL OR l.metric_auction_drop_pct>=m.spread THEN 'AUCTION_DROP' ELSE 'MARKET_SPREAD' END,
 benchmark_version=transaction_timestamp()
 FROM metrics m WHERE l.asset_code=m.asset_code;
END $$;

CREATE OR REPLACE FUNCTION investor_sync(source_ids bigint[] DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE assets text[]; affected text[]; lock_key text;
BEGIN
 -- Full rebuilds require the source write barrier; normal ingestion uses
 -- ordered per-asset then per-district locks, leaving other cities independent.
 IF source_ids IS NULL THEN LOCK TABLE listing IN SHARE ROW EXCLUSIVE MODE; END IF;
 SELECT array_agg(DISTINCT asset_code),array_agg(DISTINCT district_id) INTO assets,affected
 FROM investor_listing_sources WHERE source_ids IS NULL OR source_id=ANY(source_ids);
 DELETE FROM investor_listing_sources WHERE source_ids IS NULL OR source_id=ANY(source_ids);

 INSERT INTO investor_listing_sources
 (source_id,asset_code,identity_verified,city_id,city_name,province_name,district_id,district_name,
 kelurahan_id,kelurahan_name,property_type,event_price,is_property,event_date,source_created_at,status,land_area)
 WITH normalized AS (
 SELECT l.*, a.city_id canonical_city_id,a.city_name canonical_city_name,a.province_name canonical_province,
 investor_cert_keys(l.nomor_legalitas) certs,
 investor_region_key(l.kecamatan) district,investor_region_key(l.kelurahan) kel,
 coalesce(nullif(l.nilai_limit_lelang,0),l.harga) price
 FROM listing l LEFT JOIN investor_city_aliases a ON a.raw_city=l.kota AND a.raw_province=coalesce(l.provinsi,'')
 WHERE (source_ids IS NULL OR l.id_property=ANY(source_ids)) AND l.jenis_transaksi='LELANG'

 ), keys AS (
 SELECT *, coalesce(canonical_city_id,'UNRESOLVED/'||investor_region_key(provinsi)||'/'||investor_region_key(kota)) city,
 (canonical_city_id IS NOT NULL AND cardinality(certs)>0 AND kel<>'' AND district<>'' AND legalitas IS NOT NULL) verified
 FROM normalized
 )
 SELECT id_property,
 CASE WHEN verified THEN 'AST-'||md5(jsonb_build_array(city,district,kel,legalitas,certs)::text) ELSE 'UNVERIFIED-'||id_property::text END,
 verified,city,coalesce(canonical_city_name,kota),coalesce(canonical_province,provinsi,''),
 city||'/'||coalesce(nullif(district,''),'UNKNOWN'),coalesce(kecamatan,''),
 city||'/'||coalesce(nullif(district,''),'UNKNOWN')||'/'||coalesce(nullif(kel,''),'UNKNOWN'),coalesce(kelurahan,''),
 kategori::text,price,NOT bukan_properti,tanggal_lelang,coalesce(tanggal_dibuat,now()),status_tayang::text,CASE WHEN luas_tanah>0 THEN luas_tanah END
 FROM keys;
 SELECT array_agg(DISTINCT v) INTO assets FROM (
 SELECT unnest(coalesce(assets,'{}')) v UNION SELECT asset_code FROM investor_listing_sources WHERE source_ids IS NULL OR source_id=ANY(source_ids)
 ) s;
 IF source_ids IS NOT NULL THEN
  FOR lock_key IN SELECT DISTINCT v FROM unnest(assets) v ORDER BY v LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended('investor/asset/'||lock_key,0));
  END LOOP;
 END IF;
 SELECT array_agg(DISTINCT v) INTO affected FROM (
 SELECT unnest(coalesce(affected,'{}')) v UNION SELECT district_id FROM investor_listing_sources WHERE asset_code=ANY(assets)
 UNION SELECT district_id FROM listings WHERE asset_code=ANY(assets)
 ) s;

 IF source_ids IS NOT NULL THEN
  FOR lock_key IN SELECT DISTINCT v FROM unnest(affected) v ORDER BY v LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended('investor/district/'||lock_key,0));
  END LOOP;
 END IF;

 -- Remove stale assets and select latest event, including sold/withdrawn events
 -- so they suppress obsolete available auctions. NULL auction dates use
 -- source creation time; ties use newest source id. Invalid/unsupported latest
 -- events suppress the asset rather than resurrecting an older valid auction.
 DELETE FROM listings l WHERE source_ids IS NULL OR l.asset_code=ANY(assets);
 INSERT INTO listings(id,asset_code,source_listing_id,city_id,city_name,province_name,district_id,district_name,
 kelurahan_id,kelurahan_name,property_type,harga_lelang_pertama,harga_lelang_terakhir,luas_tanah_m2,
 is_latest,identity_verified,initial_source_id,initial_auction_date,auction_round,created_at,updated_at)
 WITH initial AS (
 SELECT DISTINCT ON(asset_code) asset_code,event_price initial_price,source_id initial_id,event_date initial_date
 FROM investor_listing_sources WHERE event_price>0 AND (source_ids IS NULL OR asset_code=ANY(assets))
 ORDER BY asset_code,coalesce(event_date,source_created_at),source_id DESC
 ), ranked AS (
 SELECT s.*,row_number() OVER(PARTITION BY asset_code ORDER BY coalesce(event_date,source_created_at) DESC,source_id DESC) latest,
 dense_rank() OVER(PARTITION BY asset_code ORDER BY coalesce(event_date,source_created_at)) round
 FROM investor_listing_sources s WHERE source_ids IS NULL OR asset_code=ANY(assets)
 )
 SELECT source_id::text,asset_code,source_id,city_id,city_name,province_name,district_id,district_name,
 kelurahan_id,kelurahan_name,property_type::investor_property_type_enum,initial_price,event_price,land_area,status='TERSEDIA',
 identity_verified,initial_id,initial_date,round::int,source_created_at,transaction_timestamp()
 FROM ranked JOIN initial USING(asset_code) WHERE latest=1 AND event_price>0 AND is_property
 AND property_type IN ('RUMAH','TANAH','RUKO','APARTEMEN')
 ON CONFLICT(asset_code) DO UPDATE SET id=excluded.id,source_listing_id=excluded.source_listing_id,
 city_id=excluded.city_id,city_name=excluded.city_name,province_name=excluded.province_name,
 district_id=excluded.district_id,district_name=excluded.district_name,kelurahan_id=excluded.kelurahan_id,
 kelurahan_name=excluded.kelurahan_name,property_type=excluded.property_type,
 harga_lelang_pertama=excluded.harga_lelang_pertama,harga_lelang_terakhir=excluded.harga_lelang_terakhir,
 luas_tanah_m2=excluded.luas_tanah_m2,is_latest=excluded.is_latest,identity_verified=excluded.identity_verified,
 initial_source_id=excluded.initial_source_id,initial_auction_date=excluded.initial_auction_date,
 auction_round=excluded.auction_round,updated_at=excluded.updated_at;
 PERFORM investor_refresh_cma(CASE WHEN source_ids IS NULL THEN NULL ELSE affected END);
 -- Readiness is installation metadata, not a global hot row on every write.
 IF source_ids IS NULL THEN
  INSERT INTO investor_pipeline_state VALUES(true,1,transaction_timestamp())
  ON CONFLICT(id) DO UPDATE SET version=1,updated_at=excluded.updated_at;
 END IF;
END $$;

-- Statement triggers batch all rows of a bulk import. The projection and source
-- commit together; a pipeline failure rolls back ingestion instead of lying.
CREATE OR REPLACE FUNCTION investor_source_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids bigint[];
BEGIN
 IF TG_OP='DELETE' THEN SELECT array_agg(id_property) INTO ids FROM old_rows WHERE jenis_transaksi='LELANG';
 ELSIF TG_OP='UPDATE' THEN
 SELECT array_agg(n.id_property) INTO ids FROM new_rows n JOIN old_rows o USING(id_property)
 WHERE (n.jenis_transaksi='LELANG' OR o.jenis_transaksi='LELANG') AND
 (n.jenis_transaksi,n.kategori,n.status_tayang,n.harga,n.nilai_limit_lelang,n.tanggal_lelang,
 n.provinsi,n.kota,n.kecamatan,n.kelurahan,n.legalitas,n.nomor_legalitas,n.luas_tanah,n.bukan_properti,n.tanggal_dibuat)
 IS DISTINCT FROM
 (o.jenis_transaksi,o.kategori,o.status_tayang,o.harga,o.nilai_limit_lelang,o.tanggal_lelang,
 o.provinsi,o.kota,o.kecamatan,o.kelurahan,o.legalitas,o.nomor_legalitas,o.luas_tanah,o.bukan_properti,o.tanggal_dibuat);
 ELSE SELECT array_agg(id_property) INTO ids FROM new_rows WHERE jenis_transaksi='LELANG'; END IF;
 IF cardinality(ids)>0 THEN PERFORM investor_sync(ids); END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS investor_source_insert ON listing;
DROP TRIGGER IF EXISTS investor_source_update ON listing;
DROP TRIGGER IF EXISTS investor_source_delete ON listing;
CREATE TRIGGER investor_source_insert AFTER INSERT ON listing REFERENCING NEW TABLE AS new_rows
 FOR EACH STATEMENT EXECUTE FUNCTION investor_source_changed();
CREATE TRIGGER investor_source_update AFTER UPDATE ON listing REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
 FOR EACH STATEMENT EXECUTE FUNCTION investor_source_changed();
CREATE TRIGGER investor_source_delete AFTER DELETE ON listing REFERENCING OLD TABLE AS old_rows
 FOR EACH STATEMENT EXECUTE FUNCTION investor_source_changed();


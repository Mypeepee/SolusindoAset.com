-- Additive v2 storage. Generated together with the canonical valuation query.
-- No existing listing price, building area or public listing table is modified.
CREATE TABLE IF NOT EXISTS investor_city_aliases (
 raw_province text NOT NULL,raw_city text NOT NULL,city_id text NOT NULL,
 city_name text NOT NULL,province_name text NOT NULL,PRIMARY KEY(raw_province,raw_city)
);
CREATE TABLE IF NOT EXISTS investor_assets(asset_code text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS investor_listing_valuations (
 id text PRIMARY KEY,asset_code text NOT NULL,source_listing_id bigint NOT NULL UNIQUE,
 identity_verified boolean NOT NULL,transaction_type text NOT NULL CHECK(transaction_type IN('BELI','SEWA')),
 listing_category text CHECK(listing_category IN('PRIMARY','LELANG','SECONDARY')),
 rental_period text CHECK(rental_period IN('HARIAN','MINGGUAN','BULANAN','TAHUNAN')),
 city_id text NOT NULL,city_name text NOT NULL,province_name text NOT NULL,
 district_id text NOT NULL,district_name text NOT NULL,
 kelurahan_id text,kelurahan_name text,
 property_type text NOT NULL CHECK(property_type IN('RUMAH','TANAH','RUKO','APARTEMEN')),
 harga_lelang_pertama numeric(20,2),harga_lelang_terakhir numeric(20,2) NOT NULL CHECK(harga_lelang_terakhir>0),
 luas_tanah_m2 numeric(12,2),harga_per_meter numeric,current_price_per_meter numeric,
 market_basis_per_meter numeric,market_eligible boolean NOT NULL,
 initial_source_id bigint,initial_auction_date timestamptz,auction_round integer NOT NULL,
 metric_auction_drop_pct numeric,metric_market_spread_pct numeric,primary_deal_score numeric,
 primary_deal_type text CHECK(primary_deal_type IN('AUCTION_DROP','MARKET_SPREAD')),
 benchmark_avg numeric,benchmark_count integer NOT NULL,kelurahan_sample_count integer NOT NULL,
 benchmark_scope text NOT NULL CHECK(benchmark_scope IN('KELURAHAN','NONE')),
 benchmark_version timestamptz NOT NULL,history jsonb NOT NULL DEFAULT '[]',
 source_revision text NOT NULL,is_latest boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(asset_code,transaction_type),
 CHECK(listing_category IS DISTINCT FROM 'LELANG' OR (harga_lelang_pertama IS NOT NULL AND harga_lelang_pertama>0)),
 CHECK(transaction_type<>'SEWA' OR metric_auction_drop_pct IS NULL),
 CHECK((kelurahan_id IS NOT NULL AND NULLIF(btrim(kelurahan_name),'') IS NOT NULL) OR (benchmark_avg IS NULL AND metric_market_spread_pct IS NULL)),
 CHECK(primary_deal_score IS NOT DISTINCT FROM (CASE WHEN metric_auction_drop_pct IS NULL AND metric_market_spread_pct IS NULL THEN NULL ELSE coalesce(metric_auction_drop_pct,0)+coalesce(metric_market_spread_pct,0) END))
);
CREATE INDEX IF NOT EXISTS investor_v2_city_district ON investor_listing_valuations(city_id,district_id);
CREATE INDEX IF NOT EXISTS investor_v2_city_rank ON investor_listing_valuations(transaction_type,city_id,primary_deal_score DESC NULLS LAST,id) WHERE is_latest;
CREATE INDEX IF NOT EXISTS investor_v2_rank ON investor_listing_valuations(transaction_type,primary_deal_score DESC NULLS LAST,id) WHERE is_latest;
CREATE INDEX IF NOT EXISTS investor_v2_kel_peers ON investor_listing_valuations(transaction_type,rental_period,kelurahan_id,property_type,updated_at DESC,asset_code)
 INCLUDE(market_basis_per_meter) WHERE is_latest AND identity_verified AND market_eligible AND market_basis_per_meter>0;
CREATE INDEX IF NOT EXISTS investor_v2_district_peers ON investor_listing_valuations(transaction_type,rental_period,district_id,property_type,updated_at DESC,asset_code)
 INCLUDE(market_basis_per_meter) WHERE is_latest AND identity_verified AND market_eligible AND market_basis_per_meter>0;
CREATE INDEX IF NOT EXISTS investor_v2_missing_kel ON investor_listing_valuations(transaction_type,city_id,id) WHERE kelurahan_id IS NULL OR kelurahan_name IS NULL;
CREATE TABLE IF NOT EXISTS investor_source_scopes(source_id bigint PRIMARY KEY,city_id text NOT NULL,district_key text NOT NULL);
CREATE INDEX IF NOT EXISTS investor_source_scope_idx ON investor_source_scopes(city_id,district_key);
CREATE TABLE IF NOT EXISTS investor_pipeline_v2_state(id boolean PRIMARY KEY DEFAULT true CHECK(id),version integer NOT NULL,needs_alias_refresh boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL);

CREATE OR REPLACE FUNCTION investor_v2_region_key(v text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT regexp_replace(regexp_replace(trim(regexp_replace(upper(coalesce(v,'')),'[^0-9A-Z]+',' ','g')),
 '^(DESA KELURAHAN|KELURAHAN|KEL|DESA|DS|KECAMATAN|KEC) +','','g'),' +','','g')
$$;
CREATE INDEX IF NOT EXISTS investor_v2_source_region ON listing(kota,investor_v2_region_key(kecamatan)) WHERE jenis_transaksi IN('PRIMARY','LELANG','SECONDARY','SEWA');

CREATE OR REPLACE FUNCTION investor_v2_guard_metrics() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.harga_per_meter:=NEW.harga_lelang_pertama/nullif(NEW.luas_tanah_m2,0);
 NEW.current_price_per_meter:=NEW.harga_lelang_terakhir/nullif(NEW.luas_tanah_m2,0);
 NEW.market_eligible:=coalesce(NEW.kelurahan_id IS NOT NULL AND NULLIF(btrim(NEW.kelurahan_name),'') IS NOT NULL AND NEW.luas_tanah_m2>0 AND (NEW.transaction_type='BELI' OR NEW.rental_period IS NOT NULL),false);
 NEW.market_basis_per_meter:=CASE WHEN NEW.transaction_type='BELI' AND NEW.listing_category='LELANG' THEN NEW.harga_per_meter ELSE NEW.current_price_per_meter END;
 NEW.metric_auction_drop_pct:=CASE WHEN NEW.transaction_type='BELI' AND NEW.listing_category='LELANG' THEN (NEW.harga_lelang_pertama-NEW.harga_lelang_terakhir)/NEW.harga_lelang_pertama*100 END;
 IF NOT NEW.market_eligible THEN NEW.benchmark_avg:=NULL;NEW.benchmark_count:=0;NEW.benchmark_scope:='NONE'; END IF;
 NEW.metric_market_spread_pct:=CASE WHEN NEW.market_eligible THEN (NEW.benchmark_avg-NEW.current_price_per_meter)/nullif(NEW.benchmark_avg,0)*100 END;
 NEW.primary_deal_score:=CASE WHEN NEW.metric_auction_drop_pct IS NULL AND NEW.metric_market_spread_pct IS NULL THEN NULL ELSE coalesce(NEW.metric_auction_drop_pct,0)+coalesce(NEW.metric_market_spread_pct,0) END;
 NEW.primary_deal_type:=CASE WHEN NEW.primary_deal_score IS NULL THEN NULL WHEN NEW.metric_market_spread_pct IS NULL OR NEW.metric_auction_drop_pct>=NEW.metric_market_spread_pct THEN 'AUCTION_DROP' ELSE 'MARKET_SPREAD' END;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS investor_v2_metrics ON investor_listing_valuations;
CREATE TRIGGER investor_v2_metrics BEFORE INSERT OR UPDATE ON investor_listing_valuations FOR EACH ROW EXECUTE FUNCTION investor_v2_guard_metrics();

-- __CANONICAL_FUNCTION__

CREATE OR REPLACE FUNCTION investor_v2_sync(source_ids bigint[] DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE scopes jsonb;aliases jsonb;scope_row record;intent text;payload jsonb;key text;
BEGIN
 IF source_ids IS NULL THEN LOCK TABLE listing IN SHARE ROW EXCLUSIVE MODE; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') INTO aliases FROM investor_city_aliases a;
 SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') INTO scopes FROM (
  SELECT DISTINCT city_id,district_key FROM investor_source_scopes WHERE source_ids IS NULL OR source_id=ANY(source_ids)
  UNION SELECT DISTINCT a.city_id,investor_v2_region_key(l.kecamatan) FROM listing l JOIN investor_city_aliases a
   ON a.raw_city=l.kota AND a.raw_province=coalesce(l.provinsi,'')
   WHERE (source_ids IS NULL OR l.id_property=ANY(source_ids)) AND l.jenis_transaksi IN('PRIMARY','LELANG','SECONDARY','SEWA')
 ) s;
 IF source_ids IS NOT NULL THEN
  FOR key IN SELECT DISTINCT (e->>'city_id')||'/'||(e->>'district_key') FROM jsonb_array_elements(scopes) e ORDER BY 1 LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended('investor/v2/'||key,0));
  END LOOP;
 END IF;
 DELETE FROM investor_source_scopes WHERE source_ids IS NULL OR source_id=ANY(source_ids);
 INSERT INTO investor_source_scopes SELECT l.id_property,a.city_id,investor_v2_region_key(l.kecamatan)
  FROM listing l JOIN investor_city_aliases a ON a.raw_city=l.kota AND a.raw_province=coalesce(l.provinsi,'')
  WHERE (source_ids IS NULL OR l.id_property=ANY(source_ids)) AND l.jenis_transaksi IN('PRIMARY','LELANG','SECONDARY','SEWA');
 IF source_ids IS NULL THEN
  DELETE FROM investor_listing_valuations;
  FOREACH intent IN ARRAY ARRAY['BELI','SEWA'] LOOP
   INSERT INTO investor_listing_valuations SELECT (jsonb_populate_record(NULL::investor_listing_valuations,p)).* FROM investor_v2_compute(aliases,NULL,NULL,intent) p;
  END LOOP;
 ELSE
  -- Remove every old/new scope before inserting. A location correction can move
  -- a source ID into a scope sorted before its previous scope.
  DELETE FROM investor_listing_valuations v USING jsonb_to_recordset(scopes) AS r(city_id text,district_key text)
   WHERE v.city_id=r.city_id AND v.district_id=r.city_id||'/'||coalesce(nullif(r.district_key,''),'UNKNOWN');
  FOR scope_row IN SELECT * FROM jsonb_to_recordset(scopes) AS r(city_id text,district_key text) LOOP
   FOREACH intent IN ARRAY ARRAY['BELI','SEWA'] LOOP
    INSERT INTO investor_listing_valuations SELECT (jsonb_populate_record(NULL::investor_listing_valuations,p)).* FROM investor_v2_compute(aliases,scope_row.city_id,scope_row.district_key,intent) p;
   END LOOP;
  END LOOP;
 END IF;
 IF source_ids IS NULL THEN
  INSERT INTO investor_assets(asset_code) SELECT DISTINCT asset_code FROM investor_listing_valuations ON CONFLICT DO NOTHING;
 ELSE
  INSERT INTO investor_assets(asset_code) SELECT DISTINCT v.asset_code FROM investor_listing_valuations v
   JOIN jsonb_to_recordset(scopes) AS r(city_id text,district_key text)
   ON v.city_id=r.city_id AND v.district_id=r.city_id||'/'||coalesce(nullif(r.district_key,''),'UNKNOWN') ON CONFLICT DO NOTHING;
 END IF;
 IF source_ids IS NULL THEN
  INSERT INTO investor_pipeline_v2_state VALUES(true,3,false,clock_timestamp()) ON CONFLICT(id) DO UPDATE SET version=3,needs_alias_refresh=false,updated_at=excluded.updated_at;
 END IF;
 IF EXISTS(SELECT 1 FROM listing l LEFT JOIN investor_city_aliases a ON a.raw_city=l.kota AND a.raw_province=coalesce(l.provinsi,'')
  WHERE (source_ids IS NULL OR l.id_property=ANY(source_ids)) AND l.jenis_transaksi IN('PRIMARY','LELANG','SECONDARY','SEWA') AND a.city_id IS NULL) THEN
  UPDATE investor_pipeline_v2_state SET needs_alias_refresh=true WHERE id=true;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION investor_v2_source_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids bigint[];
BEGIN
 IF TG_OP='DELETE' THEN SELECT array_agg(id_property) INTO ids FROM old_rows;
 ELSIF TG_OP='INSERT' THEN SELECT array_agg(id_property) INTO ids FROM new_rows;
 ELSE SELECT array_agg(n.id_property) INTO ids FROM new_rows n JOIN old_rows o USING(id_property)
  WHERE (n.jenis_transaksi,n.kategori,n.status_tayang,n.harga,n.harga_promo,n.nilai_limit_lelang,n.tanggal_lelang,n.provinsi,n.kota,n.kecamatan,n.kelurahan,n.legalitas,n.nomor_legalitas,n.luas_tanah,n.bukan_properti,n.judul,n.tanggal_dibuat)
  IS DISTINCT FROM (o.jenis_transaksi,o.kategori,o.status_tayang,o.harga,o.harga_promo,o.nilai_limit_lelang,o.tanggal_lelang,o.provinsi,o.kota,o.kecamatan,o.kelurahan,o.legalitas,o.nomor_legalitas,o.luas_tanah,o.bukan_properti,o.judul,o.tanggal_dibuat);
 END IF;
 IF cardinality(ids)>0 THEN PERFORM investor_v2_sync(ids); END IF;RETURN NULL;
END $$;
-- Retire earlier investor triggers; retain all legacy tables and source rows.
DROP TRIGGER IF EXISTS investor_source_insert ON listing;
DROP TRIGGER IF EXISTS investor_source_update ON listing;
DROP TRIGGER IF EXISTS investor_source_delete ON listing;
DROP TRIGGER IF EXISTS investor_v2_insert ON listing;
DROP TRIGGER IF EXISTS investor_v2_update ON listing;
DROP TRIGGER IF EXISTS investor_v2_delete ON listing;
CREATE TRIGGER investor_v2_insert AFTER INSERT ON listing REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION investor_v2_source_changed();
CREATE TRIGGER investor_v2_update AFTER UPDATE ON listing REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION investor_v2_source_changed();
CREATE TRIGGER investor_v2_delete AFTER DELETE ON listing REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION investor_v2_source_changed();
CREATE OR REPLACE FUNCTION investor_v2_rent_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.durasi_sewa,NEW.harga_sewa_harian,NEW.harga_sewa_mingguan,NEW.harga_sewa_bulanan,NEW.harga_sewa_tahunan) IS NOT DISTINCT FROM (OLD.durasi_sewa,OLD.harga_sewa_harian,OLD.harga_sewa_mingguan,OLD.harga_sewa_bulanan,OLD.harga_sewa_tahunan) THEN RETURN NULL;END IF;
 IF TG_OP='DELETE' THEN PERFORM investor_v2_sync(ARRAY[OLD.id_property]);ELSE PERFORM investor_v2_sync(ARRAY[NEW.id_property]);END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS investor_v2_rental ON listing_sewa_detail;
CREATE TRIGGER investor_v2_rental AFTER INSERT OR UPDATE OR DELETE ON listing_sewa_detail FOR EACH ROW EXECUTE FUNCTION investor_v2_rent_changed();

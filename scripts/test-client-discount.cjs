const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(__dirname, "..", file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    new Function("require", "module", "exports", code)(name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.resolve(__dirname, "../src", name.slice(2)) : path.resolve(path.dirname(filename), name);
        const target = [base, base + ".ts", base + ".tsx", base + ".js"].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
        return target.endsWith(".js") ? require(target) : load(target);
      }
      return require(name);
    }, mod, mod.exports);
    return mod.exports;
  }
  return load;
}

const load = loader();
const discount = load("src/lib/preferensiDiskon.ts");
const input = load("src/lib/preferensiInput.ts");
const preference = { maksud: "BELI", tipe_properti: "RUMAH", jenis_transaksi: null, loc_provinsi: null, loc_kota: "Surabaya", loc_kecamatan: null, loc_kelurahan: null, budget_min: null, budget_max: null, luas_min: null, luas_max: null };
const criterion = { diskon_jenis: "KEDUANYA", diskon_persen: 50 };

test("each option applies its own strict threshold; both means AND", () => {
  for (const [kelurahan, turunLelang, expected] of [[51, 51, true], [50, 90, false], [90, 50, false], [49, 90, false], [90, null, false], [null, 90, false], [null, null, false], [NaN, 90, false]]) {
    assert.equal(discount.lolosDiskon(criterion, { kelurahan, turunLelang }), expected);
  }
  assert.equal(discount.lolosDiskon({ ...criterion, diskon_jenis: "KELURAHAN" }, { kelurahan: 51, turunLelang: null }), true);
  assert.equal(discount.lolosDiskon({ ...criterion, diskon_jenis: "TURUN_LELANG" }, { kelurahan: null, turunLelang: 51 }), true);
  assert.equal(discount.lolosDiskon({}, { kelurahan: null, turunLelang: null }), true);
});

test("typing and paste cannot retain leading zeros, junk, decimals or overflow", () => {
  for (const [raw, before, expected] of [["0", "", ""], ["00", "", ""], ["050", "", "50"], ["00099", "", "99"], ["05", "5", "5"], ["100", "10", "10"], ["-5", "5", "5"], ["5.5", "5", "5"], ["50%", "50", "50"], ["abc", "", ""], ["", "50", ""]]) {
    assert.equal(discount.inputPersenDiskon(raw, before), expected);
  }
});

test("the server validates optional paired fields and rejects malformed raw payloads", () => {
  for (const fields of [{}, { diskon_jenis: null, diskon_persen: null }, criterion, { ...criterion, diskon_persen: "99" }]) {
    assert.equal(input.bacaPreferensi({ ...preference, ...fields }).ok, true);
  }
  for (const fields of [{ diskon_jenis: "KEDUANYA" }, { diskon_persen: 50 }, { ...criterion, diskon_jenis: "OR" }, ...[0, 100, -1, 1.5, "050", "0", "5e1", " 50", "50%", true, [], [50], {}].map(diskon_persen => ({ ...criterion, diskon_persen }))]) {
    assert.equal(input.bacaPreferensi({ ...preference, ...fields }).ok, false, JSON.stringify(fields));
  }
  const parsed = input.bacaPreferensi({ ...preference, ...criterion });
  assert.equal(parsed.data.diskon_persen, 50);
  assert.equal(input.bacaBanyakPreferensi([{ ...preference, ...criterion }, { ...preference, ...criterion, diskon_persen: "050" }]).ok, false);
  assert.equal(input.serialisasiPreferensi({ id_preferensi: 1n, ...criterion }).diskon_persen, 50);
});

test("canonical valuation resolution handles each distinct threshold once without pagination", async () => {
  let reads = 0;
  const resolve = loader({
    "@/lib/investor-read.server": { withInvestorRead: async callback => { reads++; return callback({}); } },
    "@/lib/investor-cma-legacy.server": { getClientDiscountScope: async () => [
      { id: "1", kelurahan: 60, turunLelang: 70 }, { id: "2", kelurahan: 90, turunLelang: 50 },
      { id: "3", kelurahan: null, turunLelang: 80 },
    ] },
  })("src/lib/klienDiskon.server.ts");
  const both = { ...criterion, maksud: "BELI" };
  const auction = { ...both, diskon_jenis: "TURUN_LELANG" };
  const result = await resolve.siapkanDiskon([both, both, auction]);
  assert.equal(reads, 1);
  assert.deepEqual([...result.get(discount.kunciDiskon(both))], ["1"]);
  assert.deepEqual([...result.get(discount.kunciDiskon(auction))], ["1", "3"]);
  await resolve.siapkanDiskon([preference]);
  assert.equal(reads, 1);
});

test("discount evidence retains exact qualifying values and only the requested comparison types", async () => {
  let reads = 0;
  const resolve = loader({
    "@/lib/investor-read.server": { withInvestorRead: async callback => { reads++; return callback({}); } },
    "@/lib/investor-cma-legacy.server": { getClientDiscountScope: async () => [
      { id: "1", kelurahan: 60.12345, turunLelang: 64.28571428571429 },
      { id: "2", kelurahan: 90, turunLelang: 50 },
      { id: "3", kelurahan: null, turunLelang: 80 },
    ] },
  })("src/lib/klienDiskon.server.ts");
  const both = { ...criterion, maksud: "BELI" };
  const auction = { ...both, diskon_jenis: "TURUN_LELANG" };
  const market = { ...both, diskon_jenis: "KELURAHAN" };
  const evidence = await resolve.siapkanBuktiDiskon([both, auction, market, both]);
  assert.equal(reads, 1);
  assert.deepEqual(evidence.get(discount.kunciDiskon(both)).get("1"), { kelurahan: 60.12345, turunLelang: 64.28571428571429 });
  assert.deepEqual(evidence.get(discount.kunciDiskon(auction)).get("1"), { kelurahan: null, turunLelang: 64.28571428571429 });
  assert.deepEqual(evidence.get(discount.kunciDiskon(market)).get("1"), { kelurahan: 60.12345, turunLelang: null });
  assert.equal(evidence.get(discount.kunciDiskon(both)).has("2"), false);
  assert.equal(evidence.get(discount.kunciDiskon(both)).has("3"), false);
  assert.equal(evidence.get(discount.kunciDiskon(auction)).has("3"), true);
});

test("SQL filters qualifying IDs before take and memory matching never bypasses missing evidence", async () => {
  const { cariCocok, lolosSemuaGerbang } = load("src/lib/klienMatch.ts");
  const k = { ...preference, ...criterion, diskon_ids: new Set(["2"]) };
  const row = id => ({ id_property: BigInt(id), judul: "Rumah", slug: "rumah", jenis_transaksi: "SECONDARY", kota: "Surabaya", harga: 100000000, luas_tanah: 100, luas_bangunan: 80, alamat_lengkap: "Jalan Contoh" });
  let query;
  const db = { listing: { findMany: async q => { query = q; const ids = q.where.AND.find(w => w.id_property).id_property.in; return [row(1), row(2)].filter(l => ids.includes(l.id_property)).slice(0, q.take); } } };
  assert.deepEqual((await cariCocok(db, k, { maks: 1 })).map(l => String(l.id_property)), ["2"]);
  assert.equal(query.take, 1);
  assert.equal(lolosSemuaGerbang(row(1), k), false);
  assert.equal(lolosSemuaGerbang(row(2), k), true);
  assert.equal(lolosSemuaGerbang(row(2), { ...k, diskon_ids: undefined }), false);
  assert.equal(lolosSemuaGerbang(row(1), preference), true);
});

function matchesWhere(row, where) {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return (Array.isArray(condition) ? condition : [condition]).every(part => matchesWhere(row, part));
    if (key === "OR") return condition.some(part => matchesWhere(row, part));
    const value = row[key];
    if (condition === null || typeof condition !== "object") return value === condition;
    if (value == null) return false;
    if (condition.in && !condition.in.includes(value)) return false;
    if (condition.notIn && condition.notIn.includes(value)) return false;
    if (condition.not !== undefined && value === condition.not) return false;
    if (condition.gt !== undefined && !(value > condition.gt)) return false;
    if (condition.gte !== undefined && !(value >= condition.gte)) return false;
    if (condition.lt !== undefined && !(value < condition.lt)) return false;
    if (condition.lte !== undefined && !(value <= condition.lte)) return false;
    return !condition.contains || String(value).toLowerCase().includes(condition.contains.toLowerCase());
  });
}

const AUCTION_NOW = Date.parse("2026-11-01T09:00:00+07:00");
function auctionEvent(id, price, date, extra = {}) {
  return {
    id_property: BigInt(id), slug: `rumah-${id}`, judul: `Rumah ${id}`,
    jenis_transaksi: "LELANG", kategori: "RUMAH", status_tayang: "TERSEDIA", bukan_properti: false, ada_bangunan: true,
    kota: "Surabaya", provinsi: "Jawa Timur", kecamatan: "Wonokromo", kelurahan: "Ngagelrejo",
    legalitas: "SHM", nomor_legalitas: "188", alamat_lengkap: "Jalan Anggrek 10",
    luas_tanah: 120, luas_bangunan: 80, latitude: null, longitude: null,
    harga: price, nilai_limit_lelang: price, harga_efektif: price, harga_promo: null,
    tanggal_lelang: new Date(date), tanggal_dibuat: new Date(AUCTION_NOW),
    gambar: null, kamar_tidur: 2, is_hot_deal: false, ...extra,
  };
}

test("CRM cards receive actual discounts from every matched criterion, while unrelated cards stay unlabelled", async t => {
  t.mock.method(Date, "now", () => AUCTION_NOW);
  let reads = 0;
  let prefs = [];
  const metrics = [
    { id: "1", kelurahan: 61.25, turunLelang: 64.28571428571429 },
    { id: "2", kelurahan: null, turunLelang: null },
  ];
  const stock = [auctionEvent(1, 250e6, "2026-11-10"), auctionEvent(2, 250e6, "2026-11-10", { luas_tanah: 150 })];
  const db = {
    klien: { findFirst: async () => ({ id_klien: "KL_QA", nama: "Klien QA", preferensi: prefs, id_properti_asal: null }) },
    listing: { findMany: async query => stock.filter(row => matchesWhere(row, query.where)).slice(0, query.take) },
    rekomendasiDisingkirkan: { count: async () => 0 },
  };
  const route = loader({
    "@/lib/prisma": { prisma: db },
    "next-auth": { getServerSession: async () => ({ user: { agentId: "AG_QA" } }) },
    "@/app/api/auth/[...nextauth]/authOptions": { authOptions: {} },
    "@/lib/klienPengecualian": { muatPengecualian: async () => new Map(), gabung: () => [] },
    "@/lib/klienDekat": { siapkanDekat: async () => new Map(), dekatUntuk: () => null },
    "@/lib/investor-read.server": { withInvestorRead: async callback => { reads++; return callback({}); } },
    "@/lib/investor-cma-legacy.server": { getClientDiscountScope: async () => metrics },
  })("src/app/api/dashboard/klien/[id]/rekomendasi/siap/route.ts");
  for (const kind of ["TURUN_LELANG", "KELURAHAN", "KEDUANYA", null]) {
    prefs = [{ ...preference, id_preferensi: 1n, diskon_jenis: kind, diskon_persen: kind ? 40 : null }];
    const response = await route.GET({ url: "http://localhost/api/dashboard/klien/KL_QA/rekomendasi/siap" }, { params: { id: "KL_QA" } });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.items[0].diskon, kind === null ? null : {
      kelurahan: kind === "TURUN_LELANG" ? null : 61.25,
      turunLelang: kind === "KELURAHAN" ? null : 64.28571428571429,
    });
  }
  reads = 0;
  prefs = [null, "KELURAHAN", "TURUN_LELANG"].map((kind, index) => ({ ...preference,
    id_preferensi: BigInt(index + 1), diskon_jenis: kind, diskon_persen: kind ? 40 : null }));
  const response = await route.GET({ url: "http://localhost/api/dashboard/klien/KL_QA/rekomendasi/siap" }, { params: { id: "KL_QA" } });
  const data = await response.json();
  assert.equal(reads, 1);
  assert.equal(data.items.length, 2);
  assert.deepEqual(data.items.find(row => row.id_property === "1").diskon, { kelurahan: 61.25, turunLelang: 64.28571428571429 });
  assert.equal(data.items.find(row => row.id_property === "2").diskon, null);
  const limitedResponse = await route.GET({ url: "http://localhost/api/dashboard/klien/KL_QA/rekomendasi/siap?limit=1" }, { params: { id: "KL_QA" } });
  const limited = await limitedResponse.json();
  assert.equal(limited.items.length, 1);
  assert.equal(limited.items[0].id_property, "1");
  assert.deepEqual(limited.items[0].diskon, { kelurahan: 61.25, turunLelang: 64.28571428571429 });
  assert.equal(limited.items[0].cocok_grup.length, 3);
  assert.ok(limited.preferensi.every(group => group.ditampilkan === 1));
  stock[1] = auctionEvent(2, 600e6, "2026-11-10", { luas_tanah: 150 });
  metrics[1].turunLelang = 60;
  prefs = [
    { ...preference, id_preferensi: 1n, budget_max: 300e6 },
    { ...preference, id_preferensi: 2n, budget_max: 1e9, diskon_jenis: "TURUN_LELANG", diskon_persen: 40 },
  ];
  const splitResponse = await route.GET({ url: "http://localhost/api/dashboard/klien/KL_QA/rekomendasi/siap?limit=2" }, { params: { id: "KL_QA" } });
  const split = await splitResponse.json();
  assert.equal(split.items.length, 2);
  assert.deepEqual(split.items.find(row => row.id_property === "1").diskon, { kelurahan: null, turunLelang: 64.28571428571429 });
  assert.equal(split.items.find(row => row.id_property === "1").cocok_grup.length, 2);
});

test("preference slot allocation respects limits smaller than the number of matching groups", () => {
  const { bagiSlot } = load("src/lib/klienRingkas.ts");
  for (const [available, limit] of [[[2, 1, 1], 1], [[4, 5, 6], 2], [[0, 4, 0, 8], 1], [[1, 1], 0]]) {
    const allocated = bagiSlot(available, limit);
    assert.ok(allocated.reduce((sum, value) => sum + value, 0) <= limit);
    assert.ok(allocated.every((value, index) => value >= 0 && value <= available[index]));
  }
});

test("Rp700m -> Rp500m -> Rp250m qualifies for a Rp300m budget and >50% cumulative discount", async () => {
  const { getAuctionPriceHistories } = loader({ "@/lib/prisma": {} })("src/lib/auction-history-prices.server.ts");
  const cases = [
    { prices: [700e6, 500e6, 250e6], effective: 700e6, eligible: true },
    { prices: [1e9, 500e6, 350e6], effective: 150e6, eligible: false }, // discount passes; budget fails
    { prices: [400e6, 300e6, 250e6], eligible: false }, // budget passes; discount fails
    { prices: [500e6, 400e6, 250e6], eligible: false }, // exactly 50% is not >50%
    { prices: [700e6, 500e6, 300e6], eligible: true }, // budget includes its ceiling
    { prices: [400e6, 700e6, 250e6], eligible: false }, // first price, not historical maximum
    { prices: [700e6, 500e6, 300e6 + 1], eligible: false }, // no budget rounding
    { prices: [500e6 + 1, 400e6, 250e6], eligible: true }, // no discount rounding before filtering
  ];
  const stock = [];
  const current = [];
  cases.forEach((scenario, index) => {
    const events = scenario.prices.map((price, round) => auctionEvent(
      index * 10 + round + 1, price, ["2026-09-10", "2026-10-15", "2026-11-10"][round],
      { nomor_legalitas: String(188 + index), luas_tanah: 120 + index },
    ));
    events[2].harga_efektif = scenario.effective ?? events[2].nilai_limit_lelang;
    stock.push(...events);
    current.push(events[2]);
  });
  const histories = await getAuctionPriceHistories({ $queryRaw: async () => stock }, current);
  assert.deepEqual(histories.get("3").points.map(point => point.price), [700e6, 500e6, 250e6]);
  assert.ok(Math.abs(histories.get("3").dropPct - 64.28571428571429) < 1e-10);
  const resolve = loader({
    "@/lib/investor-read.server": { withInvestorRead: async callback => callback({}) },
    "@/lib/investor-cma-legacy.server": { getClientDiscountScope: async () => current.map(row => ({
      id: String(row.id_property), kelurahan: null, turunLelang: histories.get(String(row.id_property)).dropPct,
    })) },
  })("src/lib/klienDiskon.server.ts");
  const k = { ...preference, jenis_transaksi: "LELANG", budget_max: 300e6, diskon_jenis: "TURUN_LELANG", diskon_persen: 50 };
  k.diskon_ids = (await resolve.siapkanDiskon([k])).get(discount.kunciDiskon(k));
  const { cariCocok, lolosSemuaGerbang, hargaEfektif, alasanCocok } = load("src/lib/klienMatch.ts");
  const db = { listing: { findMany: async query => stock.filter(row => matchesWhere(row, query.where)).slice(0, query.take) } };
  const result = await cariCocok(db, k, { now: AUCTION_NOW });
  const expected = current.filter((row, index) => cases[index].eligible).map(row => String(row.id_property));
  assert.deepEqual(result.map(row => String(row.id_property)), expected);
  assert.deepEqual(stock.filter(row => lolosSemuaGerbang(row, k, { now: AUCTION_NOW })).map(row => String(row.id_property)), expected);
  assert.equal(hargaEfektif(result[0]), 250e6);
  assert.ok(alasanCocok(result[0], k).includes("Rp 50 jt di bawah plafon"));
  // An over-budget row with a stale low effective price cannot consume the only slot.
  const firstSlot = await cariCocok({ listing: { findMany: async query => [current[1], current[0]]
    .filter(row => matchesWhere(row, query.where)).slice(0, query.take) } }, k, { now: AUCTION_NOW, maks: 1 });
  assert.deepEqual(firstSlot.map(row => String(row.id_property)), ["3"]);
});

test("auction budget SQL and memory use the same limit/fallback price, including lower budgets", async () => {
  const { whereKasar, lolosSemuaGerbang, hargaEfektif, cariCocok, skorListing } = load("src/lib/klienMatch.ts");
  const k = { ...preference, jenis_transaksi: "LELANG", budget_min: 200e6, budget_max: 300e6 };
  const scenarios = [
    [{ nilai_limit_lelang: 250e6, harga_efektif: 700e6, harga_promo: 100e6 }, 250e6, true],
    [{ nilai_limit_lelang: 350e6, harga_efektif: 250e6 }, 350e6, false],
    [{ nilai_limit_lelang: 199e6, harga_efektif: 250e6 }, 199e6, false],
    [{ nilai_limit_lelang: null, harga: 250e6, harga_efektif: 700e6 }, 250e6, true],
    [{ nilai_limit_lelang: 0, harga: 250e6, harga_efektif: 700e6 }, 250e6, true],
    [{ nilai_limit_lelang: 0, harga: 350e6, harga_efektif: 250e6 }, 350e6, false],
    [{ nilai_limit_lelang: null, harga: 0, harga_efektif: 250e6 }, 0, false],
  ];
  const where = whereKasar(k, { now: AUCTION_NOW });
  for (const [fields, price, eligible] of scenarios) {
    const row = auctionEvent(1, 250e6, "2026-11-10", fields);
    assert.equal(hargaEfektif(row), price);
    assert.equal(matchesWhere(row, where), eligible, JSON.stringify(fields));
    assert.equal(lolosSemuaGerbang(row, k, { now: AUCTION_NOW }), eligible, JSON.stringify(fields));
  }
  const original = auctionEvent(1, 250e6, "2026-11-10");
  assert.equal(skorListing({ ...original, harga_efektif: 700e6 }, k), skorListing(original, k));
  let selection;
  await cariCocok({ listing: { findMany: async query => { selection = query.select; return []; } } }, k, { now: AUCTION_NOW, select: { id_property: true } });
  for (const field of ["harga", "harga_efektif", "harga_promo", "nilai_limit_lelang"]) assert.equal(selection[field], true);
  const other = { ...original, jenis_transaksi: "SECONDARY", nilai_limit_lelang: 700e6, harga_efektif: 250e6 };
  assert.equal(hargaEfektif(other), 250e6);
  assert.equal(lolosSemuaGerbang(other, { ...k, jenis_transaksi: null }, { now: AUCTION_NOW }), true);
});

test("empty results explain date-ineligible matches without relaxing budget, area, discount or exclusions", async () => {
  const { cariCocok, diagnosaKosong } = load("src/lib/klienMatch.ts");
  const k = { ...preference, jenis_transaksi: "LELANG", budget_max: 300e6, luas_min: 80,
    diskon_jenis: "TURUN_LELANG", diskon_persen: 40, diskon_ids: new Set(["1", "2", "3", "4", "5", "7", "8"]) };
  const stock = [
    auctionEvent(1, 250e6, "2026-05-18"),
    auctionEvent(2, 200e6, "2026-05-18", { tanggal_lelang: null, luas_tanah: 130 }),
    auctionEvent(3, 300e6 + 1, "2026-05-18"),
    auctionEvent(4, 200e6, "2026-05-18", { luas_tanah: 79 }),
    auctionEvent(5, 200e6, "2026-05-18", { kota: "Sidoarjo" }),
    auctionEvent(6, 200e6, "2026-05-18"), // no qualifying discount evidence
    auctionEvent(7, 200e6, "2026-05-18"), // already sent or dismissed
    auctionEvent(8, 200e6, "2026-05-18", { status_tayang: "TERJUAL" }),
    auctionEvent(9, 200e6, "2026-11-10"), // current, but discount does not qualify
  ];
  const db = { listing: {
    findMany: async query => stock.filter(row => matchesWhere(row, query.where)).slice(0, query.take),
    count: async query => stock.filter(row => matchesWhere(row, query.where)).length,
  } };
  const options = { now: AUCTION_NOW, kecuali: [7n] };
  assert.deepEqual(await cariCocok(db, k, options), []);
  const diagnostic = await diagnosaKosong(db, k, options);
  assert.equal(diagnostic.lelangTersaringTanggal, 2);
  assert.equal(diagnostic.lelangTanpaJadwal, 1);
  assert.equal(diagnostic.jadwalLelangTerakhir, "2026-05-18T00:00:00.000Z");
  assert.equal(diagnostic.batasTanggalLelang, "2026-09-30T17:00:00.000Z");
  assert.equal(diagnostic.jikaDiskonDiabaikan, 1);
  assert.equal(diagnostic.adaDiskon, true);
  assert.deepEqual(await cariCocok(db, k, options), []);
  const excluded = await diagnosaKosong(db, k, { ...options, kecuali: [1n, 2n, 7n] });
  assert.equal(excluded.lelangTersaringTanggal, 0);
  assert.equal(excluded.jadwalLelangTerakhir, null);
});

test("a diagnostic query failure remains an error, never an empty inventory", async () => {
  const { diagnosaKosong } = load("src/lib/klienMatch.ts");
  const db = { listing: { count: async () => 0, findMany: async () => { throw new Error("database unavailable"); } } };
  await assert.rejects(diagnosaKosong(db, { ...preference, jenis_transaksi: "LELANG" }, { now: AUCTION_NOW }), /database unavailable/);
});

test("create/edit round trips retain the discount across expanded locations and types", () => {
  const noop = () => null;
  const form = loader({
    "@/components/search/TypePicker": noop, "@/components/search/LocationPicker": noop,
    "@/components/search/KeywordField": noop, "@/components/search/SearchSelect": noop,
    "./CrmFormControls": {},
  })("src/app/dashboard/crm/components/FormPreferensi.tsx");
  const empty = load("src/app/dashboard/crm/components/types.ts").EMPTY_PREFERENSI;
  const draft = { ...empty, ...criterion, diskon_persen: "50", tipe_properti: ["RUMAH", "TANAH"], locations: [
    { id: "1", name: "Surabaya", level: "kota" }, { id: "2", name: "Gresik", level: "kota" },
  ] };
  const payloads = form.buildPrefPayloads(draft);
  assert.equal(payloads.length, 4);
  assert.ok(payloads.every(row => row.diskon_jenis === "KEDUANYA" && row.diskon_persen === 50));
  const [restored] = form.groupPreferensi(payloads);
  assert.equal(restored.diskon_persen, "50");
  assert.equal(restored.diskon_jenis, "KEDUANYA");
  assert.equal(restored.locations.length, 2);
  const different = [...payloads, ...payloads.map(row => ({ ...row, diskon_persen: 60 }))];
  assert.equal(form.groupPreferensi(different).length, 2);
  const { kunciGrup } = load("src/lib/klienRingkas.ts");
  assert.notEqual(kunciGrup(payloads[0]), kunciGrup(different[4]));
  assert.equal(form.masalahPreferensi({ ...draft, diskon_persen: "" }), "Isi persentase diskon 1–99%");
  const [cleared] = form.buildPrefPayloads({ ...draft, diskon_jenis: "", diskon_persen: "" });
  assert.equal(cleared.diskon_jenis, null);
  assert.equal(cleared.diskon_persen, null);
});

test("manual discounts protect chatbot rows while legacy fingerprints stay stable", () => {
  const { preferenceFingerprint } = load("src/lib/chatbot/client-preferences.ts");
  assert.equal(preferenceFingerprint(preference), preferenceFingerprint({ ...preference, diskon_jenis: null, diskon_persen: null }));
  assert.notEqual(preferenceFingerprint(preference), preferenceFingerprint({ ...preference, ...criterion }));
});

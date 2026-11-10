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

const noop = () => null;
const load = loader({
  "@/components/search/TypePicker": noop, "@/components/search/LocationPicker": noop,
  "@/components/search/KeywordField": noop, "@/components/search/SearchSelect": noop,
  "./CrmFormControls": {},
});
const form = load("src/app/dashboard/crm/components/FormPreferensi.tsx");
const { EMPTY_PREFERENSI } = load("src/app/dashboard/crm/components/types.ts");
const { regionKey, regionLabel, isSameRegion } = load("src/lib/regionSearch.ts");
const { bacaPreferensi, serialisasiPreferensi } = load("src/lib/preferensiInput.ts");
const { whereKasar, lolosKetat, lolosSemuaGerbang, cariCocok } = load("src/lib/klienMatch.ts");
const { lokasiRingkas, ringkasGrup } = load("src/lib/klienRingkas.ts");
const scope = { loc_provinsi: "Jawa Timur", loc_kota: "Kabupaten Sidoarjo", loc_kecamatan: "Sukodono", loc_kelurahan: null };
const pref = { maksud: "BELI", tipe_properti: "RUMAH", jenis_transaksi: null, ...scope, budget_min: null, budget_max: null, luas_min: null, luas_max: null };
const house = { id_property: 1n, status_tayang: "TERSEDIA", bukan_properti: false, kategori: "RUMAH", jenis_transaksi: "SECONDARY", ada_bangunan: true, harga: 300000000, harga_efektif: 300000000, luas_tanah: 120, luas_bangunan: 80, provinsi: "Jawa Timur", kota: "Kab. Sidoarjo", kecamatan: "Sukodono", kelurahan: "Sukodono" };

test("district save/read/edit retains its city and province across repeated saves", () => {
  const picked = { id: "3515-test", level: "kecamatan", name: "Sukodono", parent: "Kabupaten Sidoarjo", ancestors: ["Kabupaten Sidoarjo", "Jawa Timur"] };
  let draft = { ...EMPTY_PREFERENSI, locations: [picked], tipe_properti: ["RUMAH", "TANAH"] };
  for (let round = 0; round < 3; round++) {
    const payloads = form.buildPrefPayloads(draft);
    assert.equal(payloads.length, 2);
    const rows = payloads.map((payload, i) => {
      const parsed = bacaPreferensi(payload);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.data.loc_kota, "Kabupaten Sidoarjo");
      assert.equal(parsed.data.loc_provinsi, "Jawa Timur");
      return serialisasiPreferensi({ ...parsed.data, id_preferensi: BigInt(i + 1) });
    });
    [draft] = form.groupPreferensi(rows);
    assert.equal(draft.locations.length, 1);
    assert.deepEqual(draft.locations[0].ancestors, picked.ancestors);
    assert.equal(regionKey(draft.locations[0]), regionKey(picked));
    assert.equal(regionLabel(draft.locations[0]), "Sukodono, Kabupaten Sidoarjo");
  }
});

test("village round trips preserve district, city, province and a qualified pill", () => {
  const region = { id: "village", name: "Sukodono", level: "kelurahan", parent: "Sukodono", ancestors: ["Sukodono", "Kabupaten Sidoarjo", "Jawa Timur"] };
  const fields = form.regionToLocFields(region);
  assert.deepEqual(fields, { ...scope, loc_kelurahan: "Sukodono" });
  const restored = form.locFieldsToRegion(fields);
  assert.deepEqual(restored.ancestors, region.ancestors);
  assert.equal(regionKey(restored), regionKey(region));
  assert.equal(regionLabel(restored), "Sukodono, Sukodono, Kabupaten Sidoarjo");
  assert.equal(form.buildPrefPayloads({ ...EMPTY_PREFERENSI, locations: [restored] })[0].lokasi_dicari, regionLabel(restored));
});

test("same-named districts and villages in different cities never collapse into one selection", () => {
  for (const level of ["kecamatan", "kelurahan"]) {
    const rows = ["Kabupaten Sidoarjo", "Kabupaten Lumajang"].flatMap(city => ["RUMAH", "TANAH"].map(tipe_properti => ({
      ...pref, loc_kota: city, loc_kelurahan: level === "kelurahan" ? "Sukodono" : null, tipe_properti,
    })));
    const [card] = form.groupPreferensi(rows);
    assert.equal(card.locations.length, 2);
    assert.notEqual(card.locations[0].id, card.locations[1].id);
    assert.notEqual(regionKey(card.locations[0]), regionKey(card.locations[1]));
    assert.notEqual(regionLabel(card.locations[0]), regionLabel(card.locations[1]));
    assert.equal(form.buildPrefPayloads(card).length, 4);
  }
});

test("same village name inside different districts of one city remains distinct", () => {
  const [card] = form.groupPreferensi(["Sukodono", "Waru"].map(loc_kecamatan => ({ ...pref, loc_kecamatan, loc_kelurahan: "Sukodono" })));
  assert.equal(card.locations.length, 2);
  assert.notEqual(card.locations[0].id, card.locations[1].id);
});

test("partial legacy ancestry stays in its original column without inventing missing parents", () => {
  for (const fields of [
    { ...scope, loc_provinsi: null },
    { ...scope, loc_kelurahan: "Sukodono", loc_kecamatan: null },
    { ...scope, loc_kelurahan: "Sukodono", loc_kota: null },
    { ...scope, loc_kota: null, loc_provinsi: null },
  ]) assert.deepEqual(form.regionToLocFields(form.locFieldsToRegion(fields)), fields);
  assert.notEqual(regionKey({ name: "X", level: "kelurahan", ancestors: ["", "A"] }), regionKey({ name: "X", level: "kelurahan", ancestors: ["A"] }));
  assert.equal(form.locFieldsToRegion({ loc_provinsi: null, loc_kota: null, loc_kecamatan: null, loc_kelurahan: null }), null);
});

test("legacy picker parent remains supported when the ancestry array is absent", () => {
  assert.deepEqual(form.regionToLocFields({ id: "old", level: "kecamatan", name: "Sukodono", parent: "Kabupaten Sidoarjo" }), { ...scope, loc_provinsi: null });
  for (const region of [
    { id: "p", level: "provinsi", name: "Jawa Timur" },
    { id: "c", level: "kota", name: "Kabupaten Sidoarjo", parent: "Jawa Timur" },
  ]) {
    const fields = form.regionToLocFields(region);
    assert.deepEqual(form.regionToLocFields(form.locFieldsToRegion(fields)), fields);
  }
});

test("legacy selection without a province can still be unchecked in the same city", () => {
  const old = form.locFieldsToRegion({ ...scope, loc_provinsi: null });
  const fresh = form.locFieldsToRegion(scope);
  assert.equal(isSameRegion(old, fresh), true);
  assert.equal(isSameRegion(old, { ...fresh, ancestors: ["Kabupaten Lumajang", "Jawa Timur"] }), false);
  assert.equal(isSameRegion({ ...old, ancestors: [] }, fresh), false);
  assert.equal(isSameRegion(fresh, { ...fresh, ancestors: ["Kabupaten Sidoarjo", "Jawa Tengah"] }), false);
  const village = form.locFieldsToRegion({ ...scope, loc_kelurahan: "Sukodono" });
  assert.equal(isSameRegion({ ...village, ancestors: village.ancestors.slice(0, 2) }, village), true);
  assert.equal(isSameRegion({ ...village, ancestors: ["Sukodono"] }, village), false);
});

test("incomplete district/village parents cannot be saved or match arbitrary namesakes", () => {
  for (const fields of [
    { ...scope, loc_kota: null },
    { ...scope, loc_kelurahan: "Sukodono", loc_kota: null },
    { ...scope, loc_kelurahan: "Sukodono", loc_kecamatan: null },
  ]) {
    const incomplete = { ...pref, ...fields };
    const parsed = bacaPreferensi(incomplete);
    assert.equal(parsed.ok, false);
    assert.match(parsed.message, /Pilih ulang/);
    assert.match(form.masalahPreferensi({ ...EMPTY_PREFERENSI, locations: [form.locFieldsToRegion(fields)] }), /Pilih ulang/);
    assert.equal(lolosKetat(house, incomplete), false);
    assert.equal(lolosSemuaGerbang(house, incomplete), false);
    assert.ok(whereKasar(incomplete).AND.some(condition => condition.id_property?.in?.length === 0));
  }
  assert.equal(bacaPreferensi({ ...pref, loc_provinsi: null }).ok, true);
});

test("Sukodono in Sidoarjo excludes Sukodono in Lumajang in SQL and strict matching", () => {
  const where = whereKasar(pref);
  assert.equal(where.kota.mode, "insensitive");
  assert.ok(where.kota.in.includes("Kab. Sidoarjo"));
  assert.equal(where.kota.in.includes("Kota Sidoarjo"), false);
  assert.deepEqual(where.kecamatan, { contains: "sukodono", mode: "insensitive" });
  assert.deepEqual(where.provinsi, { contains: "jawa timur", mode: "insensitive" });
  assert.equal(lolosKetat(house, pref), true);
  assert.equal(lolosKetat({ ...house, kota: "Kab. Lumajang" }, pref), false);
  assert.equal(lolosKetat({ ...house, kota: null }, pref), false);
  assert.equal(lolosKetat({ ...house, provinsi: "Jawa Tengah" }, pref), false);
});

test("village matching requires its selected district and city", () => {
  const village = { ...pref, loc_kelurahan: "Sukodono" };
  assert.ok(whereKasar(village).kelurahan);
  assert.equal(lolosKetat(house, village), true);
  for (const other of [
    { kota: "Kabupaten Lumajang" }, { kecamatan: "Waru" },
    { kelurahan: "Sukodono Utara" }, { kecamatan: null },
  ]) assert.equal(lolosKetat({ ...house, ...other }, village), false);
});

test("Kota and Kabupaten sharing a name cannot match each other's districts", () => {
  const selected = { ...pref, loc_kota: "Kabupaten Malang" };
  assert.equal(whereKasar(selected).kota.in.includes("Kota Malang"), false);
  assert.equal(lolosKetat({ ...house, kota: "Kab. Malang" }, selected), true);
  assert.equal(lolosKetat({ ...house, kota: "Kota Malang" }, selected), false);
  const [card] = form.groupPreferensi(["Kota Malang", "Kabupaten Malang"].map(loc_kota => ({ ...pref, loc_kota })));
  assert.equal(card.locations.length, 2);
});

test("administrative spelling variants remain accepted within the selected hierarchy", () => {
  assert.equal(lolosKetat({ ...house, kota: "  Kab. Sidoarjo ", kecamatan: " Kec. Sukodono ", kelurahan: "Desa Sukodono" }, { ...pref, loc_kelurahan: "Sukodono" }), true);
  // Legacy listings with no city prefix retain their existing spelling support.
  assert.equal(lolosKetat({ ...house, kota: "Sidoarjo" }, pref), true);
});

test("cron/chatbot direct matching uses the same full geographic scope", () => {
  assert.equal(lolosSemuaGerbang(house, pref), true);
  assert.equal(lolosSemuaGerbang({ ...house, kota: "Kabupaten Lumajang" }, pref), false);
});

test("only the explicit location diagnostic may relax the selected parents", () => {
  const elsewhere = { ...house, kota: "Kabupaten Lumajang" };
  assert.equal(lolosKetat(elsewhere, pref, { longgar: "budget" }), false);
  assert.equal(lolosKetat(elsewhere, pref, { longgar: "lokasi" }), true);
  const where = whereKasar(pref, { longgar: "lokasi" });
  for (const field of ["kota", "kecamatan", "provinsi", "kelurahan"]) assert.equal(where[field], undefined);
});

test("SQL applies the parent before take so hundreds of namesakes cannot crowd out a match", async () => {
  const stock = [...Array.from({ length: 1400 }, (_, i) => ({ ...house, id_property: BigInt(i + 2), kota: "Kabupaten Lumajang" })), house];
  const db = { listing: { findMany: async query => {
    const cities = query.where.kota.in.map(city => city.toLowerCase());
    assert.equal(cities.includes("kabupaten lumajang"), false);
    return stock.filter(row => cities.includes(row.kota.toLowerCase())).slice(0, query.take);
  } } };
  const result = await cariCocok(db, pref);
  assert.deepEqual(result.map(row => row.id_property), [1n]);
});

test("saved criteria labels expose parents and keep same-named locations distinct", () => {
  assert.equal(lokasiRingkas(pref), "Sukodono, Kabupaten Sidoarjo");
  assert.equal(lokasiRingkas({ ...pref, loc_kelurahan: "Sukodono" }), "Sukodono, Sukodono, Kabupaten Sidoarjo");
  const label = ringkasGrup([pref, { ...pref, loc_kota: "Kabupaten Lumajang" }], { lengkap: true });
  assert.match(label, /Sukodono, Kabupaten Sidoarjo \/ Sukodono, Kabupaten Lumajang/);
});

test("authenticated POST/PUT retain geographic columns and reject incomplete batches before writes", async () => {
  let stored = [], writes = 0;
  const tx = {
    preferensiKlien: {
      create: async ({ data }) => { writes++; const row = { ...data, id_preferensi: BigInt(writes) }; stored.push(row); return row; },
      deleteMany: async () => { writes++; stored = []; return { count: 0 }; },
      findMany: async () => stored,
    },
  };
  const db = { ...tx, klien: { findFirst: async () => ({ id_klien: "KL_SCOPE" }) }, $transaction: async callback => callback(tx) };
  const route = loader({
    "@/lib/prisma": { prisma: db },
    "next-auth": { getServerSession: async () => ({ user: { agentId: "AG_SCOPE" } }) },
    "@/app/api/auth/[...nextauth]/authOptions": { authOptions: {} },
  })("src/app/api/dashboard/klien/[id]/preferensi/route.ts");
  const ctx = { params: { id: "KL_SCOPE" } };
  const first = await route.POST({ json: async () => pref }, ctx);
  assert.equal(first.status, 201);
  const saved = (await first.json()).data;
  for (const key of Object.keys(scope)) assert.equal(saved[key], pref[key]);
  const replacement = [pref, { ...pref, loc_kota: "Kabupaten Lumajang" }];
  const response = await route.PUT({ json: async () => ({ preferensi: replacement }) }, ctx);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.map(row => row.loc_kota), ["Kabupaten Sidoarjo", "Kabupaten Lumajang"]);
  const before = writes;
  const invalid = await route.PUT({ json: async () => ({ preferensi: [pref, { ...pref, loc_kota: null }] }) }, ctx);
  assert.equal(invalid.status, 400);
  assert.equal(writes, before);
  assert.equal(stored.length, 2);
});

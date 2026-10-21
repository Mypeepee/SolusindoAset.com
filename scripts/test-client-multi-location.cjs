const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const ts = require('typescript');

function loader(overrides) {
  const cache = new Map();
  function load(file) {
    file = resolve(__dirname, '..', file);
    if (!/\.[jt]s$/.test(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', code)(name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) {
        const path = resolve(dirname(file), name);
        return path.includes('/backend/') ? require(path) : load(path);
      }
      return require(name);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}

function matches(row, where) {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') return (Array.isArray(condition) ? condition : [condition]).every(w => matches(row, w));
    if (key === 'OR') return condition.some(w => matches(row, w));
    const value = row[key];
    if (condition === null || typeof condition !== 'object') return value === condition;
    if (value == null) return false;
    if (condition.in && !condition.in.includes(value)) return false;
    if (condition.notIn && condition.notIn.includes(value)) return false;
    if (condition.not !== undefined && value === condition.not) return false;
    if (condition.gte !== undefined && value < condition.gte) return false;
    if (condition.lte !== undefined && value > condition.lte) return false;
    if (condition.contains && !String(value).toLowerCase().includes(condition.contains.toLowerCase())) return false;
    return true;
  });
}

const locations = [
  { loc_kecamatan: 'Waru', loc_kota: 'Kabupaten Sidoarjo' },
  { loc_kecamatan: 'Menganti', loc_kota: 'Kabupaten Gresik' },
  { loc_kecamatan: 'Taman', loc_kota: 'Kabupaten Sidoarjo' },
  { loc_kecamatan: null, loc_kota: 'Kota Surabaya' },
];
const preferences = locations.map((location, index) => ({
  id_preferensi: BigInt(index + 1), maksud: 'BELI', tipe_properti: 'RUMAH', jenis_transaksi: null,
  loc_provinsi: 'Jawa Timur', loc_kelurahan: null, ...location,
  budget_min: null, budget_max: 310000000, luas_min: 120, luas_max: null,
}));
const stock = locations.map((location, index) => ({
  id_property: BigInt(index + 1), slug: `rumah-${index + 1}`, judul: `Rumah ${index + 1}`,
  kecamatan: location.loc_kecamatan ?? 'Sukolilo', kota: location.loc_kota, provinsi: 'Jawa Timur',
  alamat_lengkap: `Jalan ${['Anggrek', 'Teratai', 'Melati', 'Kenanga'][index]}`,
  jenis_transaksi: 'SECONDARY', kategori: 'RUMAH', status_tayang: 'TERSEDIA',
  bukan_properti: false, ada_bangunan: true, legalitas: 'SHM',
  harga: 300000000, harga_efektif: 300000000, harga_promo: null,
  luas_tanah: 120 + index, luas_bangunan: 80, gambar: null, is_hot_deal: false,
  tanggal_dibuat: new Date('2026-10-21T00:00:00Z'), tanggal_lelang: null,
}));

async function search({ prefs = preferences, listings = stock, query = '', excluded = [] } = {}) {
  const db = {
    klien: { findFirst: async () => ({
      id_klien: 'KL-MULTI', nama: 'Klien Contoh', nomor_whatsapp: null,
      id_properti_asal: null, preferensi: prefs,
    }) },
    listing: {
      findMany: async q => listings.filter(row => matches(row, q.where)).slice(0, q.take),
      count: async q => listings.filter(row => matches(row, q.where)).length,
    },
    rekomendasiDisingkirkan: { count: async () => excluded.length },
  };
  const route = loader({
    '@/lib/prisma': { prisma: db },
    'next-auth': { getServerSession: async () => ({ user: { agentId: 'AG-MULTI' } }) },
    '@/app/api/auth/[...nextauth]/authOptions': { authOptions: {} },
    '@/lib/klienPengecualian': { muatPengecualian: async () => new Map(), gabung: () => excluded },
    '@/lib/klienDekat': { siapkanDekat: async () => new Map(), dekatUntuk: () => null },
  })('src/app/api/dashboard/klien/[id]/rekomendasi/siap/route.ts');
  const response = await route.GET({
    url: `http://localhost/api/dashboard/klien/KL-MULTI/rekomendasi/siap${query}`,
  }, { params: { id: 'KL-MULTI' } });
  assert.equal(response.status, 200);
  return response.json();
}

test('one preference card searches all four locations and exposes their full names', async () => {
  const unrelated = { ...stock[0], id_property: 5n, kecamatan: 'Klojen', kota: 'Kota Malang' };
  const data = await search({ query: '?pref=1,2,3,4', listings: [...stock, unrelated] });
  assert.deepEqual(data.items.map(item => item.id_property).sort(), ['1', '2', '3', '4']);
  assert.equal(data.total, 4);
  assert.equal(data.preferensi.length, 1);
  assert.equal(data.preferensi[0].label, 'Rumah · Waru +3 · ≤ 310 jt · LT ≥ 120 m²');
  assert.equal(data.preferensi[0].label_lengkap,
    'Rumah · Waru / Menganti / Taman / Kota Surabaya · ≤ 310 jt · LT ≥ 120 m²');
});

test('a match only in the fourth location still appears', async () => {
  const data = await search({ listings: [stock[3]] });
  assert.deepEqual(data.items.map(item => item.id_property), ['4']);
  assert.equal(data.diagnosa, null);
});

test('explicit preference IDs narrow the search without falling back to the first location', async () => {
  const data = await search({ query: '?pref=2,3,9999' });
  assert.deepEqual(data.items.map(item => item.id_property).sort(), ['2', '3']);
  assert.equal(data.preferensi[0].label_lengkap, 'Rumah · Menganti / Taman · ≤ 310 jt · LT ≥ 120 m²');
});

test('an empty result retains the full search scope and treats 310 as rupiah', async () => {
  const data = await search({ prefs: preferences.map(p => ({ ...p, budget_max: 310 })) });
  assert.equal(data.total, 0);
  assert.deepEqual(data.items, []);
  assert.equal(data.preferensi[0].label_lengkap,
    'Rumah · Waru / Menganti / Taman / Kota Surabaya · ≤ 310 · LT ≥ 120 m²');
  assert.equal(data.diagnosa.jikaBudgetNaik10, 0);
});

test('previously dismissed matches stay excluded across all locations', async () => {
  const data = await search({ excluded: [1n, 2n, 3n, 4n] });
  assert.equal(data.total, 0);
  assert.deepEqual(data.items, []);
  assert.equal(data.jumlahDisingkirkan, 4);
  assert.match(data.preferensi[0].label_lengkap, /Waru \/ Menganti \/ Taman \/ Kota Surabaya/);
});

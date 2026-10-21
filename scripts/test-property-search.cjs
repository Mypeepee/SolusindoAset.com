// Jalankan: node --test scripts/test-property-search.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Muat modul TS asli tanpa koneksi DB atau dependensi test tambahan.
const cache = new Map();
function loadTs(file) {
  file = resolve(__dirname, '..', file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
    fileName: file,
  }).outputText;
  const localRequire = (name) => {
    if (name === 'server-only') return {};
    if (name === '@prisma/client') return require(name);
    if (name === 'react') return { ...require('react'), default: require('react') };
    if (name === '@iconify/react') return { Icon: () => null };
    if (name === '@/lib/prisma') return { __esModule: true, default: { tempat: { count: async () => 0 } } };
    if (name.startsWith('@/')) return loadTs(`src/${name.slice(2)}.ts`);
    if (name.startsWith('.')) return loadTs(resolve(dirname(file), /\.(?:js|ts)$/.test(name) ? name : `${name}.ts`));
    throw new Error(`Dependency tidak diisolasi: ${name}`);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}

const { parsePropertySearchQuery: parse, applyPropertySearchQuery, propertySearchRedirect, SURABAYA_REGIONS } = loadTs('src/lib/propertySearchQuery.ts');
const { buildSearchParams, EMPTY_SEARCH_STATE, selectSearchPlace } = loadTs('src/lib/searchTabs.ts');
const { buildTempatWhere, bacaTempatDariParams } = loadTs('src/lib/listingTempatFilter.ts');
const { nearbyScopeWhere } = loadTs('src/lib/nearbySearchScope.ts');
const { tebakKelasDariNama, normalNama, tanpaKataJenis } = loadTs('src/lib/tempat/normalisasi.ts');
const { klasifikasiLandmark, petakanLandmark, bangunQueryLandmark, bangunQueryPintuTol } = loadTs('src/lib/tempat/landmark.ts');
const { petakanElemen } = loadTs('src/lib/nearbyPlaces.ts');
const { gabungPintuTol } = loadTs('src/lib/tempat/pintu-tol.ts');
const { buildKataKunciWhere } = loadTs('src/lib/listingKataKunci.ts');
const { parseFilters, buildListingWhere, hapusSemuaFilter } = loadTs('src/lib/listingFilters.ts');

// Evaluasi klausa Prisma yang dihasilkan terhadap fixture properti, sehingga
// tes memeriksa hasil pencarian (termasuk batas inklusif), bukan bentuk objek.
function matches(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') return (Array.isArray(condition) ? condition : [condition]).every((part) => matches(row, part));
    if (key === 'OR') return condition.some((part) => matches(row, part));
    if (typeof condition !== 'object') return row[key] === condition;
    const value = row[key];
    if (value == null) return false;
    if (condition.some) return value.some((item) => matches(item, condition.some));
    if (!Object.keys(condition).some((key) => ['in', 'contains', 'gte', 'lte', 'mode'].includes(key))) return matches(value, condition);
    const normalize = (v) => condition.mode === 'insensitive' ? String(v).toLowerCase() : v;
    if (condition.in && !condition.in.map(normalize).includes(normalize(value))) return false;
    if (condition.contains && !normalize(value).includes(normalize(condition.contains))) return false;
    if (condition.gte !== undefined && value < condition.gte) return false;
    if (condition.lte !== undefined && value > condition.lte) return false;
    return true;
  });
}

const listing = (id, kecamatan, harga_efektif, kota = 'Surabaya', extra = {}) => ({
  id, kecamatan, harga_efektif, kota, judul: 'Rumah siap huni', ...extra,
});
const fixtures = [
  listing('benowo-murah', 'Benowo', 450_000_000),
  listing('pakal-mentok', 'Pakal', 500_000_000),
  listing('kelebihan-serupiah', 'Tandes', 500_000_001),
  listing('timur', 'Rungkut', 300_000_000),
  listing('selatan', 'Wiyung', 400_000_000),
  listing('kota-lain', 'Benowo', 350_000_000, 'Gresik'),
  listing('ejaan-geocoder', ' Asemrowo', 499_000_000, 'Kota Surabaya'),
  listing('judul-menyesatkan', 'Gubeng', 450_000_000, 'Surabaya', { judul: 'Rumah dekat Surabaya Barat' }),
];

test('contoh user: Surabaya barat budget 500 juta mentok', () => {
  const params = buildSearchParams({ ...EMPTY_SEARCH_STATE, keyword: 'Surabaya barat budget 500 juta mentok' }, 'semua');
  assert.equal(params.get('q'), 'Surabaya barat');
  assert.equal(params.get('maxHarga'), '500000000');
  const where = buildListingWhere(parseFilters(Object.fromEntries(params)), 'SEMUA');
  assert.deepEqual(fixtures.filter((row) => matches(row, where)).map((row) => row.id), [
    'benowo-murah', 'pakal-mentok', 'ejaan-geocoder',
  ]);
});

for (const [region, districts] of Object.entries({
  barat: ['Asem Rowo', 'Benowo', 'Lakarsantri', 'Pakal', 'Sambikerep', 'Sukomanunggal', 'Tandes'],
  selatan: ['Dukuh Pakis', 'Gayungan', 'Jambangan', 'Karang Pilang', 'Sawahan', 'Wiyung', 'Wonocolo', 'Wonokromo'],
  timur: ['Gubeng', 'Gunung Anyar', 'Mulyorejo', 'Rungkut', 'Sukolilo', 'Tambaksari', 'Tenggilis Mejoyo'],
  pusat: ['Bubutan', 'Genteng', 'Simokerto', 'Tegalsari'],
  utara: ['Bulak', 'Kenjeran', 'Krembangan', 'Pabean Cantian', 'Semampir'],
})) {
  test(`Surabaya ${region} mencakup seluruh kecamatan dari referensi dan menolak wilayah lain`, () => {
    const where = buildKataKunciWhere(`DI KOTA SURABAYA ${region.toUpperCase()}`);
    for (const district of districts) {
      assert.ok(matches(listing('', district, 100), where), district);
      assert.ok(matches(listing('', district.replaceAll(' ', ''), 100, 'Kota Surabaya'), where), district);
      assert.ok(!matches(listing('', district, 100, 'Malang'), where), district);
    }
    const otherDistricts = Object.values(SURABAYA_REGIONS).flat().filter((name) => !districts.includes(name));
    for (const district of otherDistricts) assert.ok(!matches(listing('', district, 100), where), district);
  });
}

for (const [query, max] of [
  ['Surabaya Barat budget 500 juta mentok', 500_000_000],
  ['(surabaya barat) budget 500 juta mentok', 500_000_000],
  ['surabaya BARAT maksimal 500jt', 500_000_000],
  ['surabaya barat 500 juta mentok', 500_000_000],
  ['surabaya barat budget Rp500.000.000', 500_000_000],
  ['surabaya barat harga di bawah 500 juta', 500_000_000],
  ['surabaya barat budget 1,5 miliar', 1_500_000_000],
  ['surabaya barat max 1.5M', 1_500_000_000],
]) {
  test(`budget: ${query}`, () => {
    const result = parse(query);
    assert.deepEqual(result.regions, ['barat']);
    assert.equal(result.text, '');
    assert.equal(result.maxHarga, max);
  });
}

test('rentang harga dan batas minimum tidak berubah menjadi batas maksimum', () => {
  for (const query of ['Surabaya Timur budget 300-500 juta', 'Surabaya Timur 300 juta sampai 500 juta']) {
    const result = parse(query);
    assert.equal(result.minHarga, 300_000_000);
    assert.equal(result.maxHarga, 500_000_000);
    assert.equal(result.text, '');
  }
  const result = parse('Surabaya Timur minimal 300 juta maksimal 500 juta');
  assert.equal(result.minHarga, 300_000_000);
  assert.equal(result.maxHarga, 500_000_000);
});

test('harga dropdown tetap berlaku pada kata kunci wilayah saja di semua tab', () => {
  for (const tab of ['semua', 'beli', 'lelang', 'sewa']) {
    const params = buildSearchParams({ ...EMPTY_SEARCH_STATE, keyword: 'Surabaya Barat', maxPrice: '500.000.000', maxRent: '20.000.000' }, tab);
    assert.equal(params.get('maxHarga'), tab === 'sewa' ? '20000000' : '500000000');
    assert.equal(params.get('q'), 'Surabaya Barat');
  }
});

test('kata kunci biasa, nama jalan dan ID tetap dapat dicari', () => {
  for (const query of ['Dukuh Kupang', 'Jl. Mawar 500', 'Jl. Barat 50', 'Rumah 500 juta', 'Surabaya Barat Daya']) {
    assert.equal(parse(query).keyword, query);
    assert.equal(parse(query).maxHarga, undefined);
  }
  assert.equal(buildSearchParams({ ...EMPTY_SEARCH_STATE, keyword: '123456' }, 'semua').get('idProperty'), '123456');
  assert.ok(matches({ kelurahan: 'Dukuh Kupang' }, buildKataKunciWhere('Dukuh Kupang')));
});

test('sisa kata kunci tetap menyaring judul dan alamat', () => {
  const where = buildKataKunciWhere('rumah mewah di Surabaya barat');
  assert.ok(matches(listing('', 'Benowo', 100, 'Surabaya', { judul: 'Rumah mewah siap huni' }), where));
  assert.ok(!matches(listing('', 'Benowo', 100), where));
});

test('pilihan lokasi manual diiriskan dengan wilayah, bukan memperluas ke seluruh kota', () => {
  const params = buildSearchParams({ ...EMPTY_SEARCH_STATE, keyword: 'Surabaya Barat', locations: [{ id: 'sby', level: 'kota', name: 'Kota Surabaya' }], maxPrice: '500.000.000' }, 'semua');
  const where = buildListingWhere(parseFilters(Object.fromEntries(params)), 'SEMUA');
  assert.ok(matches(fixtures[0], where));
  assert.ok(!matches(fixtures[3], where));
});

test('budget ketikan dan dropdown memakai batas paling ketat', () => {
  for (const price of ['400000000', '400.000.000']) {
    const params = new URLSearchParams({ q: 'Surabaya Barat budget 500 juta mentok', maxHarga: price });
    applyPropertySearchQuery(params);
    assert.equal(params.get('maxHarga'), '400000000');
    assert.equal(params.get('q'), 'Surabaya Barat');
  }
});

test('minimum di atas budget tidak menukar batas lalu meloloskan properti mahal', () => {
  const where = buildListingWhere(parseFilters({ q: 'Surabaya Barat', minHarga: '600000000', maxHarga: '500000000' }), 'SEMUA');
  assert.ok(!matches(listing('', 'Benowo', 550_000_000), where));
});

test('parser filter server juga mengenali budget pada kata kunci mentah', () => {
  const filters = parseFilters({ q: 'Surabaya Barat budget 500 juta mentok' });
  const where = buildListingWhere(filters, 'SEMUA');
  assert.equal(filters.maxHarga, 500_000_000);
  assert.ok(matches(fixtures[1], where));
  assert.ok(!matches(fixtures[2], where));
});

test('dua wilayah digabung tanpa menyertakan wilayah ketiga', () => {
  const where = buildKataKunciWhere('Surabaya Barat dan Surabaya Timur');
  assert.ok(matches(fixtures[0], where));
  assert.ok(matches(fixtures[3], where));
  assert.ok(!matches(fixtures[4], where));
});

test('tautan langsung dinormalisasi sekali, mempertahankan filter dan pagination', () => {
  for (const path of ['/Jual', '/Lelang', '/Sewa', '/properti/semua', '/properti/rumah']) {
    const target = propertySearchRedirect(path, { q: 'Surabaya barat budget 500 juta mentok', page: '2', kategori: 'RUMAH', kecamatan: ['Benowo*Surabaya', 'Pakal*Surabaya'] });
    const url = new URL(target, 'https://example.test');
    assert.equal(url.pathname, path);
    assert.equal(url.searchParams.get('maxHarga'), '500000000');
    assert.equal(url.searchParams.get('page'), '2');
    assert.deepEqual(url.searchParams.getAll('kecamatan'), ['Benowo*Surabaya', 'Pakal*Surabaya']);
    assert.equal(propertySearchRedirect(path, Object.fromEntries(url.searchParams)), undefined);
  }
});

for (const [query, kelas, area, radius] of [
  ['dekat rumah sakit di Surabaya radius 500 meter', 'RUMAH_SAKIT', 'surabaya', 500],
  ['dekat sekolah di Wiyung maksimal 1000 meter', 'SEKOLAH', 'wiyung', 1000],
  ['dekat dengan tempat makan 100 meter di Surabaya Barat', 'KULINER', 'surabaya barat', 100],
  ['deket stasiun di Sidoarjo radius 1,5 km', 'STASIUN', 'sidoarjo', 1500],
  ['dekat mall di Kabupaten Malang 300 m', 'MALL', 'kabupaten malang', 300],
  ['dekat sekolah di Kecamatan Wiyung 500m', 'SEKOLAH', 'kecamatan wiyung', 500],
  ['dekat sekolah di Surabaya radius 1.000 meter', 'SEKOLAH', 'surabaya', 1000],
]) {
  test(`pencarian dekat: ${query}`, () => {
    const parsed = parse(query);
    assert.equal(parsed.nearby.kelas, kelas);
    assert.equal(parsed.nearby.wilayah, area);
    assert.equal(parsed.nearby.radius, radius);
    assert.equal(parsed.maxHarga, undefined);
    const params = buildSearchParams({ ...EMPTY_SEARCH_STATE, keyword: query }, 'semua');
    assert.ok(params.get('dekat').startsWith(`kelas:${kelas}@`));
    assert.equal(params.get('radius'), String(radius));
    assert.equal(params.get('q'), null);
  });
}

test('jenis tempat + kecamatan + jarak + budget diterapkan bersamaan', async () => {
  const params = buildSearchParams({ ...EMPTY_SEARCH_STATE, keyword: 'cari rumah dekat rumah sakit di Surabaya Barat radius 500 meter budget 500 juta mentok' }, 'semua');
  assert.equal(params.get('q'), 'rumah');
  assert.equal(params.get('maxHarga'), '500000000');
  assert.equal(params.get('radius'), '500');
  const selected = await bacaTempatDariParams(Object.fromEntries(params));
  const where = { AND: [buildListingWhere(parseFilters(Object.fromEntries(params)), 'SEMUA'), buildTempatWhere(selected)] };
  const valid = listing('', 'Benowo', 500_000_000, 'Surabaya', {
    tempatDekat: [{ jarak_meter: 500, tempat: { kelas: 'RUMAH_SAKIT', kota: 'Gresik' } }],
  });
  assert.ok(matches(valid, where), 'tempat di perbatasan tetap sah bila aset berada dalam daerah');
  assert.ok(!matches({ ...valid, harga_efektif: 500_000_001 }, where));
  assert.ok(!matches({ ...valid, kota: 'Gresik' }, where));
  assert.ok(!matches({ ...valid, kecamatan: 'Rungkut' }, where));
  assert.ok(!matches({ ...valid, tempatDekat: [{ jarak_meter: 501, tempat: { kelas: 'RUMAH_SAKIT' } }] }, where));
  assert.ok(!matches({ ...valid, tempatDekat: [{ jarak_meter: 100, tempat: { kelas: 'KLINIK' } }] }, where));
});

test('pilihan kelas tanpa data tetap membatasi hasil, termasuk stasiun', async () => {
  const selected = await bacaTempatDariParams({ dekat: 'kelas:STASIUN@surabaya', radius: '100' });
  assert.ok(selected);
  assert.equal(selected.cabang, 0);
  assert.equal(selected.radius, 100);
  assert.ok(!matches({ kota: 'Surabaya', tempatDekat: [] }, buildTempatWhere(selected)));
});

test('preferensi landmark gabungan mempertahankan DAN/ATAU dan radius di searchbar CRM', async () => {
  const selected = await bacaTempatDariParams({ dekat: 'kueri:sekolah dan pintu tol atau stasiun', radius: '100' });
  assert.ok(selected); assert.equal(selected.gabungan.length, 2);
  const where = buildTempatWhere(selected);
  const rel = (kelas, jarak_meter = 100) => ({ jarak_meter, tempat: { kelas } });
  assert.ok(matches({ tempatDekat: [rel('SEKOLAH'), rel('PINTU_TOL')] }, where));
  assert.ok(matches({ tempatDekat: [rel('STASIUN')] }, where));
  assert.ok(!matches({ tempatDekat: [rel('SEKOLAH')] }, where));
  assert.ok(!matches({ tempatDekat: [rel('SEKOLAH'), rel('PINTU_TOL', 101)] }, where));
  assert.ok(!matches({ tempatDekat: [] }, where));
});

test('cakupan kecamatan, kelurahan, dan kota tidak memakai contains', () => {
  assert.ok(matches({ kota: 'Kota Surabaya', kecamatan: 'Wiyung' }, nearbyScopeWhere('Wiyung, Surabaya')));
  assert.ok(!matches({ kota: 'Sidoarjo', kecamatan: 'Wiyung' }, nearbyScopeWhere('Wiyung, Surabaya')));
  assert.ok(matches({ kelurahan: 'Manukan Kulon' }, nearbyScopeWhere('kelurahan Manukan Kulon')));
  assert.ok(!matches({ kota: 'Bandung Barat' }, nearbyScopeWhere('Bandung')));
});

test('memilih nama tempat mempertahankan budget, radius, dan daerah', () => {
  const place = { nilai: 'rs-muji-rahayu-surabaya', nama: 'Rumah Sakit Muji Rahayu', radius: 5000 };
  const state = selectSearchPlace({ ...EMPTY_SEARCH_STATE, keyword: 'dekat RS Muji Rahayu di Surabaya radius 100 meter budget 500 juta' }, place, 'beli');
  assert.equal(state.maxPrice, '500.000.000');
  assert.equal(state.radius, '100');
  assert.equal(state.dekat.wilayah, 'surabaya');
  assert.equal(state.keyword, '');
  const params = buildSearchParams(state, 'beli');
  assert.equal(params.get('dekat'), place.nilai);
  assert.equal(params.get('areaDekat'), 'surabaya');
  assert.equal(params.get('maxHarga'), '500000000');
});

test('klasifikasi memisahkan rumah sakit, klinik, minimarket, dan mall', () => {
  assert.equal(tebakKelasDariNama('Rumah Sakit Muji Rahayu').kelas, 'RUMAH_SAKIT');
  assert.equal(tebakKelasDariNama('Posyandu Melati').kelas, 'KLINIK');
  assert.equal(tebakKelasDariNama('Indomaret Wiyung').kelas, 'MINIMARKET');
  assert.equal(tebakKelasDariNama('Pakuwon Mall').kelas, 'MALL');
});

test('batas radius ketikan tetap berlaku saat pilihan manual lebih longgar', () => {
  const params = new URLSearchParams({ q: 'dekat sekolah di Surabaya radius 100 meter', radius: '1000' });
  applyPropertySearchQuery(params);
  assert.equal(params.get('radius'), '100');
});

test('hapus semua juga melepas tempat, radius, dan daerah tempat', () => {
  const params = new URLSearchParams({ dekat: 'kelas:SEKOLAH@surabaya', areaDekat: 'surabaya', radius: '500', maxHarga: '500000000', sort: 'terdekat' });
  hapusSemuaFilter(params);
  assert.equal(params.get('dekat'), null);
  assert.equal(params.get('radius'), null);
  assert.equal(params.get('areaDekat'), null);
  assert.equal(params.get('maxHarga'), null);
});

test('tanda baca sebelum budget tidak menjadi bagian wilayah', () => {
  const params = buildSearchParams({ ...EMPTY_SEARCH_STATE, keyword: 'dekat rumah sakit di Surabaya, budget 500 juta.' }, 'semua');
  assert.equal(params.get('dekat'), 'kelas:RUMAH_SAKIT@surabaya');
  assert.equal(params.get('areaDekat'), 'surabaya');
  assert.equal(params.get('maxHarga'), '500000000');
});

for (const keyword of ['pintu tol', 'gerbang tol', 'akses tol', 'exit tol', 'toll gate', 'tol']) {
  test(`kategori gerbang: dekat ${keyword} di Surabaya Barat radius 2 km budget 500 juta`, () => {
    const params = buildSearchParams({ ...EMPTY_SEARCH_STATE, keyword: `dekat ${keyword} di Surabaya Barat radius 2 km budget 500 juta` }, 'semua');
    assert.equal(params.get('dekat'), 'kelas:PINTU_TOL@surabaya-barat');
    assert.equal(params.get('radius'), '2000');
    assert.equal(params.get('maxHarga'), '500000000');
    assert.equal(params.get('q'), null);
  });
}

test('GT, gerbang tol, dan pintu tol mencocokkan nama yang sama', () => {
  assert.equal(normalNama('GT Satelit'), normalNama('Gerbang Tol Satelit'));
  assert.equal(normalNama('Toll Gate Satelit'), normalNama('Pintu Tol Satelit'));
  assert.equal(tanpaKataJenis('Gerbang Tol Satelit'), 'satelit');
  assert.equal(tebakKelasDariNama('Gerbang Tol Satelit').kelas, 'PINTU_TOL');
  assert.equal(tebakKelasDariNama('Jalan Tol Surabaya Gempol'), null);
});

const tollFixture = (id, nama, lat) => ({ type: 'node', id, lat, lon: 112.7, tags: { name: nama, barrier: 'toll_booth' } });

test('peta hanya menggolongkan gerbang, bukan ruas atau simpang tol', () => {
  assert.equal(klasifikasiLandmark({ barrier: 'toll_booth' }), 'PINTU_TOL');
  assert.equal(klasifikasiLandmark({ highway: 'motorway', toll: 'yes', name: 'Jalan Tol Surabaya Gempol' }), null);
  assert.equal(klasifikasiLandmark({ highway: 'motorway_junction', name: 'Simpang susun' }), null);
  const elements = [tollFixture(1, 'Gerbang Tol Uji', -7.301), { type: 'node', id: 2, lat: -7.3, lon: 112.7, tags: { highway: 'motorway', toll: 'yes', name: 'Jalan Tol Uji' } }];
  const places = petakanLandmark(elements, -7.3, 112.7);
  assert.equal(places.length, 1);
  assert.equal(places[0].kelas, 'PINTU_TOL');
  assert.equal(petakanElemen(elements, -7.3, 112.7)[0].kategori, 'toll');
  assert.ok(bangunQueryLandmark(-7.3, 112.7).includes('["barrier"="toll_booth"]'));
});

test('pemindaian batch gerbang menggabungkan koordinat yang sama', () => {
  const query = bangunQueryPintuTol([{ lat: -7.3, lng: 112.7 }, { lat: -7.3, lng: 112.7 }]);
  assert.equal((query.match(/toll_booth/g) ?? []).length, 1);
  assert.ok(!query.includes('motorway_junction'));
  assert.throws(() => bangunQueryPintuTol([{ lat: NaN, lng: 112.7 }]));
});

test('beberapa lajur gerbang bernama sama memakai titik yang paling dekat', () => {
  const elements = [tollFixture(1, 'Gerbang Tol Uji', -7.31), tollFixture(2, 'Gerbang Tol Uji', -7.301)];
  const landmark = petakanLandmark(elements, -7.3, 112.7);
  const poi = petakanElemen(elements, -7.3, 112.7);
  assert.equal(landmark.length, 1);
  assert.equal(poi.length, 1);
  assert.equal(landmark[0].id, 'node-2');
  assert.equal(poi[0].id, 'node-2');
});

test('pengisian gerbang mempertahankan fasilitas lama dan radius harian', () => {
  const old = [{ id: 'school', nama: 'Sekolah Uji', kategori: 'education', jarak: 300 }];
  const landmark = [{ id: 'campus', nama: 'Kampus Uji', kelas: 'KAMPUS', jarak: 2000 }];
  const toll = [{ id: 'toll-near', nama: 'Gerbang Dekat', kelas: 'PINTU_TOL', jarak: 800 }, { id: 'toll-far', nama: 'Gerbang Jauh', kelas: 'PINTU_TOL', jarak: 1200 }];
  const merged = gabungPintuTol(old, landmark, toll, 800);
  assert.deepEqual(merged.tempat.map((place) => place.id), ['school', 'toll-near']);
  assert.deepEqual(merged.landmark.map((place) => place.id), ['toll-near', 'toll-far', 'campus']);
  assert.equal(old.length, 1);
  assert.equal(landmark.length, 1);
});

test('detail aset menyebut gerbang di luar radius fasilitas dengan jarak garis lurus', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Component = loadTs('src/components/property/detail/FasilitasSekitar.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Component, { sekitar: {
    tempat: [], radius: 800, memuat: false, gagal: false,
    landmark: [{ id: 'toll', nama: 'Gerbang Tol Uji', kelas: 'PINTU_TOL', jarak: 1200 }],
  } }));
  assert.ok(html.includes('Gerbang Tol Uji'));
  assert.ok(html.includes('1,2 km'));
  assert.ok(html.includes('Jarak garis lurus'));
  assert.ok(html.includes('Radius 5,0 km'));
});

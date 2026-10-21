import test from 'node:test';
import assert from 'node:assert/strict';
import { buyerContext } from '../services/buyer_profile.js';
import { resolvePropertyContext } from '../services/property_reply.js';
import { createAiController } from '../services/ai_controller.js';
import { searchReply } from '../services/search_reply.js';
import { getPropertyKnowledge } from '../../../src/lib/chatbot/property-knowledge.ts';

const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const purposeQuestion = 'Untuk dihuni sendiri atau investasi?';
const opening = [user('Saya cari lelang rumah daerah Manukan, Surabaya harga 700 juta mentok, kelurahan bebas, luas tanah bebas'), assistant(purposeQuestion)];

test('Manukan budget and mixed purpose persist through explicit and conversational answers', () => {
  for (const answer of ['untuk dihuni sekaligus investasi', 'untuk ditempati sambil investasi', 'hunian dan investasi', 'keduanya', 'dua duanya', 'dua-duanya', 'dua2nya']) {
    const context = buyerContext([...opening, user(answer)], answer, null);
    assert.equal(context.stage, 'recommendations', answer);
    assert.equal(context.profile.location, 'Manukan');
    assert.equal(context.profile.max_price, 700000000);
    assert.equal(context.profile.purpose, 'both');
    assert.equal(context.profile.city, 'Surabaya');
    assert.deepEqual(context.missing, []);
    assert.equal(context.profile.funds, undefined);
  }
  const history = [user('Cari lelang rumah Manukan, Surabaya, kelurahan bebas, luas tanah bebas'), assistant(purposeQuestion), user('dua duanya'), assistant('Berapa budget?'), user('700 juta mentok')];
  assert.equal(buyerContext(history, '700 juta mentok', null).stage, 'recommendations');
  const corrected = [...history, assistant('Ada opsi hingga 700 juta.'), user('Kalau bisa mentok 600 juta saja')];
  assert.equal(buyerContext(corrected, corrected.at(-1).content, null).profile.max_price, 600000000);
});

test('unrecognized qualifying answers retain context instead of searching raw conversational words', async () => {
  for (const question of ['Jenis properti apa yang dicari?', 'Manukan ada di kota Surabaya. Jenis properti apa yang dicari?']) {
    const context = await resolvePropertyContext({ resolve() { throw new Error('do not search belum tahu as an address'); } },
      'belum tahu', null, [user(opening[0].content.replace('cari lelang rumah', 'cari lelang aset')), assistant(question), user('belum tahu')]);
    assert.equal(context.status, 'qualifying');
    assert.deepEqual(context.buyer.missing, ['category']);
    assert.equal(context.buyer.profile.city, 'Surabaya');
    assert.equal(context.buyer.profile.location, 'Manukan');
  }
  const unrelated = buyerContext([opening[0], assistant('Manukan atau Wiyung?'), user('keduanya')], 'keduanya', null);
  assert.equal(unrelated.profile.purpose, null);
  const repeated = [opening[0], assistant(purposeQuestion), user('keduanya'), assistant('Boleh saya jelaskan dua opsi?'), user('keduanya')];
  assert.equal(buyerContext(repeated, 'keduanya', null).profile.purpose, 'both', 'each repeated answer uses its own preceding question');
});

// A small in-memory Prisma predicate evaluator lets fixtures exercise the whole
// context -> DB-filter -> result path, without a live DB dependency in CI.
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((condition) => matches(row, condition));
    if (key === 'OR') return value.some((condition) => matches(row, condition));
    const field = row[key];
    if (value == null || typeof value !== 'object') return field === value;
    return Object.entries(value).every(([operator, operand]) => {
      const text = value.mode === 'insensitive' ? String(field ?? '').toLowerCase() : String(field ?? '');
      const search = value.mode === 'insensitive' ? String(operand).toLowerCase() : String(operand);
      switch (operator) {
        case 'mode': return true;
        case 'contains': return field != null && text.includes(search);
        case 'equals': return field != null && text === search;
        case 'startsWith': return field != null && text.startsWith(search);
        case 'in': return field != null && operand.some((item) => text === (value.mode === 'insensitive' ? String(item).toLowerCase() : String(item)));
        case 'not': return field !== operand;
        case 'gte': return field != null && field >= operand;
        case 'lte': return field != null && field <= operand;
        case 'gt': return field != null && field > operand;
        case 'some': return (field || []).some((item) => matches(item, operand));
        default: throw new Error(`Unsupported test operator ${operator}`);
      }
    });
  });
}
function property(id, changes = {}) {
  return { id_property: BigInt(id), judul: 'Rumah', jenis_transaksi: 'LELANG', kategori: 'RUMAH',
    status_tayang: 'TERSEDIA', bukan_properti: false, kota: 'Kota Surabaya', kecamatan: 'Tandes',
    alamat_lengkap: 'Jl. Manukan Kulon No. 10', harga: 600000000, harga_efektif: 600000000,
    nilai_limit_lelang: 600000000, tanggal_lelang: new Date('2026-10-01T17:00:00Z'), ...changes };
}
function database(rows, sort = false) {
  return { listing: { async findMany({ where, take, orderBy }) {
    const results = rows.filter((row) => matches(row, where));
    if (sort) results.sort((a, b) => {
      for (const order of orderBy) {
        const [field, direction] = Object.entries(order)[0], left = a[field], right = b[field];
        if (left == null && right == null) continue;
        if (typeof direction === 'object' && direction.nulls === 'last') { if (left == null) return 1; if (right == null) return -1; }
        const result = left < right ? -1 : left > right ? 1 : 0;
        if (result) return (direction.sort || direction) === 'desc' ? -result : result;
      }
      return 0;
    });
    return results.slice(0, take);
  } },
    listingSekitar: { async findUnique() { return null; } }, listingTempat: { async findMany() { return []; } },
    listingSewaDetail: { async findUnique() { return null; } } };
}
function catalogFrom(db) {
  return { async resolve(text, previousId, criteria) {
    const result = await getPropertyKnowledge(db, { text, previousId, criteria });
    return { ...result, catalog: result.candidates };
  } };
}

function waruDatabase() {
  const base = { kota: 'Kab. Sidoarjo', kecamatan: 'Waru', kelurahan: 'Kepuhkiriman',
    alamat_lengkap: 'Desa Kepuhkiriman, Kecamatan Waru, Kabupaten Sidoarjo', luas_tanah: 137,
    nilai_limit_lelang: 250000000, tanggal_lelang: new Date('2026-11-01T00:00:00Z') };
  return database([
    property(1, { ...base, kategori: 'RUMAH' }), property(2, { ...base, kategori: 'GUDANG' }),
    property(3, { ...base, kategori: 'RUKO' }),
    property(4, { ...base, kategori: 'RUKO', kecamatan: 'Waru Barat' }),
    property(5, { ...base, kategori: 'RUKO', kota: 'Surabaya' }),
    property(6, { ...base, kategori: 'RUKO', luas_tanah: 119 }),
    property(7, { ...base, kategori: 'RUKO', nilai_limit_lelang: 600000001 }),
    property(8, { ...base, kategori: 'RUKO', status_tayang: 'TERJUAL' }),
    property(9, { ...base, kategori: 'RUKO', bukan_properti: true }),
  ]);
}

test('multi-category criteria use OR for types and retain all location, budget, land and availability filters', async () => {
  const criteria = { location: 'Waru', city: 'Sidoarjo', district: 'Waru', max_price: 600000000,
    min_land_area_m2: 120, transaction_type: 'LELANG', categories: ['RUMAH', 'RUKO'] };
  const result = await getPropertyKnowledge(waruDatabase(), { text: 'rumah dan ruko', criteria }, Date.parse('2026-10-12T00:00:00Z'));
  assert.deepEqual(result.candidates.map((item) => item.id), ['1', '3']);
  assert.ok(result.candidates.every((item) => criteria.categories.includes(item.category)));
  const history = [], catalog = catalogFrom(waruDatabase());
  let context;
  for (const text of ['Cari lelang aset di Kecamatan Waru, Sidoarjo', 'seluruh Waru, budget 600 juta', 'rumah dan ruko, luas minimal 120 m2']) {
    history.push(user(text)); context = await resolvePropertyContext(catalog, text, null, history, Date.parse('2026-10-12T00:00:00Z'));
    history.push(assistant(searchReply(context)));
  }
  assert.equal(context.status, 'recommendations');
  assert.deepEqual(context.catalog.map((item) => item.id), ['1', '3']);
});

test('Menganti warehouse, factory, land and shophouse dialogue filters the catalogue before and after list edits', async () => {
  const base = { kota: 'Kabupaten Gresik', kecamatan: 'Menganti', kelurahan: 'Hulaan',
    alamat_lengkap: 'Desa Hulaan, Kecamatan Menganti, Kabupaten Gresik', luas_tanah: 150,
    nilai_limit_lelang: 400000000, tanggal_lelang: new Date('2026-11-01T00:00:00Z') };
  const categories = ['GUDANG', 'PABRIK', 'TANAH', 'RUKO'];
  const rows = categories.map((kategori, i) => property(i + 1, { ...base, kategori, judul: kategori }));
  rows.push(...[
    { kategori: 'RUMAH' }, { kategori: 'TOKO' }, { kecamatan: 'Driyorejo' }, { kota: 'Surabaya' },
    { luas_tanah: 99 }, { luas_tanah: 201 }, { luas_tanah: null }, { nilai_limit_lelang: 400000001 },
    { status_tayang: 'TERJUAL' }, { bukan_properti: true }, { jenis_transaksi: 'SEWA' },
  ].map((change, i) => property(i + 10, { ...base, kategori: 'GUDANG', ...change })));
  const catalog = catalogFrom(database(rows)), history = [];
  async function send(text) {
    history.push(user(text));
    const context = await resolvePropertyContext(catalog, text, null, history);
    history.push(assistant(searchReply(context)));
    return context;
  }
  await send('Cari lelang aset di Kecamatan Menganti, Kabupaten Gresik, kelurahan bebas, budget 400 juta');
  const initial = await send('gudang, pabrik, tanah, atau ruko. luas tanah minimal 100 maksimal 200 m2');
  assert.equal(initial.status, 'recommendations');
  assert.deepEqual(initial.catalog.map((item) => item.category), categories);
  assert.deepEqual(initial.catalog.map((item) => item.id), ['1', '2', '3', '4']);
  const removed = await send('hapus gudang, pabrik, tanah');
  assert.deepEqual(removed.catalog.map((item) => item.id), ['4']);
  const added = await send('tambahkan gudang, pabrik, tanah');
  assert.deepEqual(added.catalog.map((item) => item.id), ['1', '2', '3', '4']);
  const replaced = await send('ganti dari gudang, pabrik, tanah, ruko ke pabrik dan tanah');
  assert.deepEqual(replaced.catalog.map((item) => item.id), ['2', '3']);
  assert.equal(replaced.buyer.profile.max_price, 400000000);
  assert.equal(replaced.buyer.profile.min_land_area_m2, 100);
  assert.equal(replaced.buyer.profile.max_land_area_m2, 200);
});

test('a multi-type search still returns available matches when some requested categories have no stock', async () => {
  const criteria = { location: 'Waru', city: 'Sidoarjo', district: 'Waru', max_price: 600000000,
    min_land_area_m2: 120, transaction_type: 'LELANG', categories: ['GUDANG', 'PABRIK', 'TANAH', 'RUKO'] };
  const result = await getPropertyKnowledge(waruDatabase(), { text: 'gudang, pabrik, tanah, atau ruko', criteria });
  assert.equal(result.status, 'recommendations');
  assert.deepEqual(result.candidates.map((item) => item.category), ['GUDANG', 'RUKO']);
  assert.deepEqual(result.candidates.map((item) => item.id), ['2', '3']);
});

test('reported RUKO Waru dialogue queries all villages in the district and returns the matching shop without a purpose gate', async () => {
  const catalog = catalogFrom(waruDatabase()), history = [];
  let last;
  for (const text of ['selamat siang, saya sedang cari lelang ruko di daerah sidoarjo pak, apakah ada?', 'di daerah waru pak...',
    'intinya di waru , dengan budget 600 juta pak', 'untuk luas tanah sih minimal 120 m']) {
    history.push(user(text)); last = await resolvePropertyContext(catalog, text, null, history);
    const reply = searchReply(last, Date.parse('2026-10-11T00:00:00Z'));
    assert.doesNotMatch(reply, /untuk dihuni|untuk investasi|atau keduanya|kelurahan \*Waru\*/i);
    history.push(assistant(reply));
  }
  assert.equal(last.status, 'recommendations'); assert.equal(last.buyer.profile.purpose, null);
  assert.deepEqual(last.catalog.map((item) => item.id), ['3']);
  assert.equal(last.catalog[0].category, 'RUKO'); assert.equal(last.catalog[0].address.village, 'Kepuhkiriman');
  assert.equal(last.catalog[0].specifications.land_area_m2, 137);
});

test('authoritative category criteria select only the requested type and allow free choice independently of raw user words', async () => {
  const criteria = { location: 'Waru', city: 'Sidoarjo', district: 'Waru', max_price: 600000000, min_land_area_m2: 120, transaction_type: 'LELANG' };
  for (const [category, ids] of [['RUKO', ['3']], ['GUDANG', ['2']], [null, ['1', '2', '3']]]) {
    const result = await getPropertyKnowledge(waruDatabase(), { text: 'ganti dari ruko ke jenis bebas', criteria: { ...criteria, category } }, Date.parse('2026-10-11T00:00:00Z'));
    assert.equal(result.status, 'recommendations'); assert.equal(result.selection.schedule_priority, 'upcoming');
    assert.deepEqual(result.candidates.map((item) => item.id), ids, String(category));
    if (category) assert.ok(result.candidates.every((item) => item.category === category));
  }
  const narrow = await getPropertyKnowledge(waruDatabase(), { text: 'cari lelang ruko', criteria: { ...criteria, category: 'RUKO', village: 'Waru' } });
  assert.equal(narrow.status, 'not_found', 'only an explicit village request should exclude Kepuhkiriman');
});

test('mixed-purpose Manukan search excludes Pamanukan, rental, sold, non-property and over-budget fixtures', async () => {
  const rows = [
    property(1, { kota: 'Subang', kecamatan: 'Pamanukan', alamat_lengkap: 'Jl. Pamanukan' }),
    property(2, { jenis_transaksi: 'SEWA', harga: 2000000, harga_efektif: 2000000 }),
    property(3, { status_tayang: 'TERJUAL' }), property(4, { bukan_properti: true }),
    property(5, { nilai_limit_lelang: 700000001 }),
    property(10, { kota: 'Madiun', alamat_lengkap: 'Jl. Manukan' }),
    property(6, { alamat_lengkap: 'Jl.Manukan Karya' }), property(7, { nilai_limit_lelang: 700000000 }),
    property(8, { alamat_lengkap: 'MANUKAN TAMA' }), property(9),
  ];
  const text = 'untuk dihuni sekaligus investasi';
  const result = await resolvePropertyContext(catalogFrom(database(rows)), text, null, [...opening, user(text)]);
  assert.equal(result.status, 'recommendations');
  assert.deepEqual(result.catalog.map((p) => p.id), ['6', '7', '8', '9']);
  assert.ok(result.catalog.every((p) => p.limit_price <= 700000000));
  assert.ok(result.catalog.every((p) => p.publication.status === 'TERSEDIA'));
  assert.ok(result.catalog.every((p) => p.auction_at === '2026-10-01T17:00:00.000Z'), 'recent past dates remain available for transparent cross-checking');
});

test('explicit rental search and real city ambiguity remain supported', async () => {
  const db = database([property(1), property(2, { jenis_transaksi: 'SEWA', harga: 2000000, harga_efektif: 2000000 })]);
  const result = await getPropertyKnowledge(db, { text: 'Cari sewa Manukan', criteria: { location: 'Manukan', purpose: 'live', max_price: 3000000, transaction_type: 'SEWA' } });
  assert.deepEqual(result.candidates.map((p) => p.id), ['2']);
  const ambiguous = database([property(1, { alamat_lengkap: 'Citraland', kota: 'Surabaya' }), property(2, { alamat_lengkap: 'Citraland', kota: 'Manado' })]);
  const clarification = await getPropertyKnowledge(ambiguous, { text: 'hunian', criteria: { location: 'Citraland', purpose: 'live', max_price: 700000000 } });
  assert.equal(clarification.status, 'clarify_location');
  const history = [user('Cari lelang rumah Citraland budget 700 juta untuk dihuni, kelurahan bebas, luas tanah bebas'), assistant('Citraland di kota apa?'), user('Surabaya')];
  const resolved = await resolvePropertyContext(catalogFrom(ambiguous), 'Surabaya', null, history);
  assert.equal(resolved.status, 'recommendations');
  assert.deepEqual(resolved.catalog.map((p) => p.address.city), ['Surabaya']);
});

test('confirmed city filters match administrative variants without leaking into similarly named cities', async () => {
  const db = database([property(1, { kota: 'Kota Malang' }), property(2, { kota: 'Kab. Malang' }),
    property(3, { kota: 'Kab. Pemalang' }), property(4, { kota: 'Bandung Barat' }), property(5, { kota: 'Kota Bandung' })]);
  for (const [city, ids] of [['Malang', ['1', '2']], ['Kota Malang', ['1']], ['Bandung', ['5']]]) {
    const result = await getPropertyKnowledge(db, { text: 'untuk investasi', criteria: {
      location: 'Manukan', city, purpose: 'investment', max_price: 700000000, transaction_type: 'LELANG',
    } });
    assert.deepEqual(result.candidates.map((p) => p.id), ids, city);
  }
});

test('village and land bounds retain exact boundary matches and exclude unknown size, wrong city/village and other categories', async () => {
  const base = { kelurahan: 'Manukan Kulon', luas_tanah: 150 };
  const db = database([
    property(1, { ...base, luas_tanah: 99 }), property(2, { ...base, luas_tanah: 201 }),
    property(3, { ...base, luas_tanah: null }), property(4, { ...base, luas_tanah: 0 }),
    property(5, { ...base, kelurahan: 'Manukan Wetan' }), property(6, { ...base, kota: 'Sidoarjo' }),
    property(7, { ...base, kategori: 'TANAH' }), property(8, { ...base, status_tayang: 'TERJUAL' }),
    property(12, { ...base, kecamatan: 'Tandes Barat' }),
    property(9, { ...base, luas_tanah: 100 }), property(10, { ...base, luas_tanah: 200 }), property(11, base),
  ]);
  const text = '100–200 m²';
  const history = [user('Cari lelang rumah di Tandes, Surabaya budget 700 juta untuk investasi'),
    assistant('Di kelurahan mana Bapak/Ibu tertarik?'), user('Manukan Kulon'),
    assistant('Apakah ada luas tanah minimal atau maksimal?'), user(text)];
  const result = await resolvePropertyContext(catalogFrom(db), text, null, history);
  assert.equal(result.status, 'recommendations'); assert.deepEqual(result.catalog.map((p) => p.id), ['9', '10', '11']);
  assert.ok(result.catalog.every((p) => p.address.village === 'Manukan Kulon' && p.address.city === 'Kota Surabaya'));
  assert.ok(result.catalog.every((p) => p.specifications.land_area_m2 >= 100 && p.specifications.land_area_m2 <= 200));
});

test('Jakarta hierarchy filters the exact city, district and village rather than matching address words in other areas', async () => {
  const base = { kota: 'Kota Adm. Jakarta Selatan', kecamatan: 'Tebet', kelurahan: 'Tebet Barat',
    alamat_lengkap: 'Jl. Tebet Barat', luas_tanah: 120 };
  const db = database([
    property(1, { ...base, kota: 'Kota Jakarta Timur' }),
    property(2, { ...base, kecamatan: 'Tebet Timur' }),
    property(3, { ...base, kelurahan: 'Tebet Timur' }),
    property(4, { ...base, luas_tanah: 201 }), property(5, { ...base, nilai_limit_lelang: 700000001 }),
    property(6, { ...base, status_tayang: 'TARIK_LISTING' }), property(7, base),
  ]);
  const history = [user('Cari lelang rumah di Jakarta Selatan budget 700 juta untuk investasi'),
    assistant('Di kawasan atau kecamatan mana Bapak/Ibu tertarik?'), user('Tebet'),
    assistant('Di kelurahan mana Bapak/Ibu tertarik?'), user('Tebet Barat'),
    assistant('Apakah ada luas tanah minimal atau maksimal?'), user('100-200 m2')];
  const result = await resolvePropertyContext(catalogFrom(db), '100-200 m2', null, history);
  assert.equal(result.status, 'recommendations'); assert.deepEqual(result.catalog.map((p) => p.id), ['7']);
  assert.equal(result.buyer.profile.city, 'Jakarta Selatan'); assert.equal(result.buyer.profile.district, 'Tebet');
  assert.equal(result.buyer.profile.village, 'Tebet Barat');
});

test('expired recommendation flags and mixed purpose reach the model without pretending stock is empty', async () => {
  let instructions;
  const qualification = Object.fromEntries(['purpose', 'funds', 'settlement'].map((key) => [key, { value: 'unknown', evidence: '' }]));
  const ai = createAiController({ provider: 'gemini', model: 'test', apiKey: 'test', timeoutMs: 1000 }, { fetchImpl: async (url, options) => {
    instructions = JSON.parse(options.body).systemInstruction.parts[0].text;
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ qualification,
      reply: 'Ada pilihan sesuai kriteria Bapak/Ibu.\n\n[[PROPERTY:6]]\n\nApakah Bapak/Ibu ingin mendalami unit ini?' }) }] } }] });
  } });
  const text = 'keduanya', history = [...opening, user(text)];
  const context = await resolvePropertyContext(catalogFrom(database([property(6)])), text, null, history);
  await ai.generate({ history, userText: text, facts: null, catalog: context.catalog, qualification: {}, knowledge: { status: context.status, buyer: context.buyer } });
  const injected = JSON.parse(instructions.split('KONTEKS_BACKEND:\n').at(-1));
  assert.equal(injected.knowledge.buyer.profile.purpose, 'both');
  assert.equal(injected.available_assets[0].auction_check_required, true);
  assert.equal(injected.available_assets[0].id, '6');
});

test('future auctions outrank cheaper expired ones and a short fresh result is never padded with old lots', async () => {
  const now = Date.parse('2026-10-08T08:00:00Z');
  const db = database([
    property(1, { harga_efektif: 100000000, nilai_limit_lelang: 100000000 }),
    property(2, { tanggal_lelang: new Date(now + 5 * 86400000), nilai_limit_lelang: 450000000 }),
    property(3, { tanggal_lelang: new Date(now + 2 * 86400000), nilai_limit_lelang: 700000001 }),
    property(4, { tanggal_lelang: new Date(now + 86400000), status_tayang: 'TERJUAL' }),
    property(5, { tanggal_lelang: new Date(now), nilai_limit_lelang: 300000000 }),
  ], true);
  const result = await getPropertyKnowledge(db, { text: 'hunian', criteria: { location: 'Manukan', max_price: 700000000, purpose: 'both', transaction_type: 'LELANG' } }, now);
  assert.equal(result.selection.schedule_priority, 'upcoming');
  assert.deepEqual(result.candidates.map((p) => p.id), ['2']);
  assert.equal(result.candidates[0].limit_price, 450000000);
});

test('fallback keeps budget/location and ranks the latest recorded auction before the cheapest old lot', async () => {
  const now = Date.parse('2026-10-08T08:00:00Z');
  const db = database([
    property(1, { tanggal_lelang: new Date('2025-01-01'), nilai_limit_lelang: 100000000, harga_efektif: 100000000 }),
    property(2, { tanggal_lelang: new Date('2026-09-29'), nilai_limit_lelang: 450000000 }),
    property(3, { tanggal_lelang: null, nilai_limit_lelang: 200000000 }),
    property(4, { tanggal_lelang: new Date('2026-10-01'), nilai_limit_lelang: 800000000 }),
    property(5, { tanggal_lelang: new Date('2026-10-01'), alamat_lengkap: 'Jl. Wiyung' }),
  ], true);
  const criteria = { location: 'Manukan', max_price: 700000000, purpose: 'both', transaction_type: 'LELANG' };
  const result = await getPropertyKnowledge(db, { text: 'hunian', criteria }, now);
  assert.equal(result.selection.schedule_priority, 'needs_confirmation');
  assert.deepEqual(result.candidates.map((p) => p.id), ['2'], 'old and undated auctions cannot reappear through the fallback');
  const strict = await getPropertyKnowledge(db, { text: 'hunian', criteria: { ...criteria, upcoming_auction_only: true } }, now);
  assert.equal(strict.status, 'not_found');
  assert.equal(strict.candidates.length, 0);
});

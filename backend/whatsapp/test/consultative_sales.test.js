import test from 'node:test';
import assert from 'node:assert/strict';
import { buyerContext, extractBudget } from '../services/buyer_profile.js';
import { generatePropertyReply, resolvePropertyContext } from '../services/property_reply.js';
import { createAiController, detectHandover, formatSalesReply } from '../services/ai_controller.js';
import { getPropertyKnowledge, isBuyerCriteria } from '../../../src/lib/chatbot/property-knowledge.ts';
import { Catalog } from '../services/catalog.js';
import { SEARCH_INTRODUCTION_QUESTION } from '../services/client_identity.js';

const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const qualification = Object.fromEntries(['purpose', 'funds', 'settlement'].map((key) => [key, { value: 'unknown', evidence: '' }]));
function modelReturning(reply, capture = () => {}) {
  return createAiController({ provider: 'gemini', model: 'test', apiKey: 'test', timeoutMs: 1000 }, {
    fetchImpl: async (url, options) => {
      capture(JSON.parse(options.body).systemInstruction.parts[0].text);
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ reply, qualification }) }] } }] });
    },
  });
}

test('broad area inquiry qualifies without fetching or prematurely listing properties', async () => {
  let reads = 0;
  const catalog = { async resolve() { reads++; throw new Error('no premature DB search'); } };
  const text = 'Cari lelang rumah di Citraland';
  const result = await generatePropertyReply({ catalog, ai: { generate() { assert.fail('Search qualification must not require a model'); } }, text, history: [user(text)] });
  assert.equal(reads, 0); assert.equal(result.knowledge.status, 'qualifying');
  // One location clarification followed by the optional first introduction.
  assert.equal((result.reply.match(/\?/g) || []).length, 2);
  assert.ok(result.reply.endsWith(SEARCH_INTRODUCTION_QUESTION));
  assert.match(result.reply, /Citraland/); assert.match(result.reply, /kota atau kabupaten mana/);
  const context = await resolvePropertyContext(catalog, text, null, [user(text)]);
  assert.deepEqual(context.catalog, []);
  assert.equal(context.buyer.profile.location, 'Citraland');
  assert.deepEqual(context.buyer.missing, ['city', 'max_price', 'land_area']);
});

test('client preferences accumulate across turns; assistant claims and listing template prices are ignored', () => {
  const history = [user('Cari lelang rumah di Northwest, Surabaya, kelurahan bebas, luas tanah bebas'), assistant('Budget Bapak/Ibu 10 miliar untuk investasi, benar?'), user('Sekitar 1,5 miliar'), assistant('Untuk hunian atau investasi?'), user('Untuk dihuni sendiri')];
  const context = buyerContext(history, 'Untuk dihuni sendiri', null);
  assert.equal(context.stage, 'recommendations');
  assert.equal(context.profile.location, 'Northwest'); assert.equal(context.profile.max_price, 1500000000);
  assert.equal(context.profile.purpose, 'live');
  const template = buyerContext([user('Kode 477, harga Rp110.000.000, alamat di Medan')], 'Kode 477, harga Rp110.000.000, alamat di Medan', null);
  assert.equal(template.stage, 'consultation'); assert.equal(template.profile.max_price, null);
  assert.equal(template.profile.location, null);
  assert.equal(extractBudget('luas 500 m2'), null);
  const partial = buyerContext([user('Cari lelang rumah di kota Surabaya'), user('Budget 900jt')], 'Budget 900jt', null);
  assert.deepEqual(partial.missing, ['location', 'land_area']);
});

test('budget formats and changes remain exact without implying ready funds', () => {
  for (const [text, expected] of [['Budget 1,5M', 1500000000], ['budget Rp1.500.000.000', 1500000000], ['budget 750jt', 750000000]]) assert.equal(extractBudget(text).max_price, expected);
  assert.deepEqual(extractBudget('Budget 500-700 juta'), { min_price: 500000000, max_price: 700000000 });
  const history = [user('Cari lelang rumah di Citraland'), user('Budget 1M untuk investasi'), user('Naikkan budget maksimal 1,5M')];
  const profile = buyerContext(history, history.at(-1).content, null).profile;
  assert.equal(profile.max_price, 1500000000); assert.equal(profile.purpose, 'investment');
  assert.equal(profile.funds, undefined); assert.equal(profile.settlement, undefined);
});

test('clear preferences are passed to DB; explicit asset and its followups bypass generic qualifying', async () => {
  const calls = [], catalog = { async resolve(...args) { calls.push(args); return { asset: null, catalog: [], status: 'not_found', source: 'database_listing_publik' }; } };
  const history = [user('Cari rumah lelang di Citraland, Surabaya, kelurahan bebas, luas tanah bebas'), user('Budget 1,5M untuk dihuni sendiri')];
  await resolvePropertyContext(catalog, history.at(-1).content, null, history);
  assert.equal(calls[0][2].location, 'Citraland'); assert.equal(calls[0][2].max_price, 1500000000);
  assert.equal(calls[0][2].transaction_type, 'LELANG');
  const specific = await resolvePropertyContext(catalog, 'Kode 477, alamatnya di mana?', null, [user('Kode 477, alamatnya di mana?')]);
  assert.equal(specific.buyer.stage, 'consultation'); assert.equal(calls[1][2], undefined);
  const followup = await resolvePropertyContext(catalog, 'Dekat apa saja?', '477', [user('Kode 477'), user('Dekat apa saja?')]);
  assert.equal(followup.buyer.stage, 'consultation'); assert.deepEqual(calls[2], ['Kode 477', null]);
});

test('ambiguous cities are clarified without presenting units in a different city', async () => {
  const rows = [{ id_property: 1n, judul: 'Citraland A', jenis_transaksi: 'LELANG', kategori: 'RUMAH', kota: 'Jambi', harga: 300000000, tanggal_lelang: new Date(Date.now() + 7 * 86400000) },
    { id_property: 2n, judul: 'Citraland B', jenis_transaksi: 'LELANG', kategori: 'RUMAH', kota: 'Manado', harga: 400000000, tanggal_lelang: new Date(Date.now() + 7 * 86400000) }];
  const db = { listing: { async findMany() { return rows; } } };
  const criteria = { location: 'Citraland', max_price: 1500000000, purpose: 'live' };
  const result = await getPropertyKnowledge(db, { text: 'Budget 1,5M untuk dihuni', criteria });
  assert.equal(result.status, 'clarify_location'); assert.deepEqual(result.candidates, []);
  const history = [user('Cari lelang rumah di Citraland, kelurahan bebas, luas tanah bebas'), user('Budget 1,5M untuk dihuni sendiri'), assistant('Citraland yang Bapak/Ibu maksud di kota apa?'), user('Surabaya')];
  const profile = buyerContext(history, 'Surabaya', null);
  assert.equal(profile.stage, 'recommendations'); assert.equal(profile.profile.city, 'Surabaya');
  assert.equal(profile.profile.location, 'Citraland'); assert.equal(profile.profile.max_price, 1500000000);
});

test('choosing a numbered option re-fetches its public facts instead of trusting assistant history', async () => {
  const calls = [], catalog = { async resolve(...args) { calls.push(args); return { asset: null, catalog: [], status: 'not_found', source: 'database_listing_publik' }; } };
  const history = [assistant('• *Kode 123* — harga lama.\n• *Kode 456* — harga lama.\n\nUnit mana yang ingin didalami?'), user('Yang kedua, alamatnya di mana?')];
  const result = await resolvePropertyContext(catalog, history.at(-1).content, null, history);
  assert.deepEqual(calls[0], ['Kode 456', null]);
  assert.equal(result.asset, null, 'if the selected unit is no longer available no old details are used');
  assert.equal(result.status, 'not_found'); assert.equal(result.buyer.stage, 'consultation');
  const invalid = await resolvePropertyContext(catalog, 'opsi ketiga', null, history);
  assert.equal(invalid.status, 'invalid_selection'); assert.equal(calls.length, 1);
});

test('recommendation query enforces available-only, max three, physical properties and bounded purchase price', async () => {
  let query;
  const db = { listing: { async findMany(input) { query = input; return []; } } };
  const criteria = { location: 'Citraland', category: 'RUMAH', max_price: 1500000000, purpose: 'live' };
  await getPropertyKnowledge(db, { text: 'Budget 1,5M untuk dihuni sendiri', criteria });
  assert.equal(query.where.status_tayang, 'TERSEDIA'); assert.equal(query.where.bukan_properti, false); assert.equal(query.take, 5);
  const filters = query.where.AND.find(group => group.OR?.some(filter => filter.nilai_limit_lelang || filter.harga_efektif || filter.harga)).OR;
  assert.ok(filters.every((filter) => (filter.nilai_limit_lelang || filter.harga_efektif || filter.harga).lte === 1500000000));
  assert.ok(JSON.stringify(query).includes('alamat_lengkap'));
  assert.equal(isBuyerCriteria({ ...criteria, max_price: "1500000000 OR 1=1" }), false);
  assert.equal(isBuyerCriteria({ ...criteria, min_price: 2000000000 }), false);
  assert.equal(isBuyerCriteria({ ...criteria, select: ['kata_sandi'] }), false);
});

test('RAG block excludes sold records; unsupported recommendation codes and invented scarcity are rejected', async () => {
  const available = { id: '123', name: 'Rumah tersedia', publication: { status: 'TERSEDIA' } };
  const sold = { id: '999', name: 'PRIVATE_SOLD_DETAIL', publication: { status: 'TERJUAL' } };
  const input = { history: [user('Cari lelang rumah')], userText: 'Cari lelang rumah', facts: sold, catalog: [available, sold], qualification: {}, knowledge: { status: 'recommendations', buyer: { stage: 'recommendations' } } };
  let instructions;
  const valid = modelReturning('• *Kode 123* — Rumah tersedia.\n\nUnit ini ingin Bapak/Ibu dalami untuk jadwal viewing?', (text) => { instructions = text; });
  await valid.generate(input);
  assert.ok(instructions.includes('[HASIL_PENCARIAN_DATABASE MULAI]')); assert.ok(!instructions.includes('PRIVATE_SOLD_DETAIL'));
  assert.equal(JSON.parse(instructions.split('KONTEKS_BACKEND:\n').at(-1)).asset, null);
  await assert.rejects(modelReturning('• *Kode 999* — Rumah.\n\nMau viewing?').generate(input), { code: 'UNSUPPORTED_RECOMMENDATION' });
  await assert.rejects(modelReturning('• *Kode 123* — Minggu ini sudah ada waiting list.\n\nMau viewing?').generate(input), { code: 'UNSUPPORTED_SALES_CLAIM' });
  await modelReturning('Belum ada data waiting list untuk unit ini.\n\nUnit kode 123 ingin Bapak/Ibu periksa lebih lanjut?').generate(input);
  const legacy = new Catalog([{ id: '123', name: 'Available', availability_status: 'available' }, { id: '999', name: 'Sold', availability_status: 'sold' }]);
  assert.deepEqual(legacy.list(), [{ id: '123', name: 'Available' }]);
});

test('two questions are limited to qualifying; viewing requests initiate human handover', async () => {
  const reply = 'Berapa budget Bapak/Ibu? Jenis properti apa yang dicari? Perlu lokasi lain?';
  assert.equal(formatSalesReply(reply, { maxQuestions: 2 }), 'Berapa budget Bapak/Ibu? Jenis properti apa yang dicari?');
  assert.equal(formatSalesReply(reply), 'Berapa budget Bapak/Ibu?');
  assert.equal(formatSalesReply('*   *Kode 123* — Rumah.\n\nMau viewing?'), '• *Kode 123* — Rumah.\n\nMau viewing?');
  for (const text of ['Saya mau viewing', 'Saya ingin survei', 'Bantu jadwalkan viewing']) assert.ok(detectHandover(text));
});

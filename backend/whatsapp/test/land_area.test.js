import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLandArea } from '../services/land_area.js';
import { buyerContext, extractBudget } from '../services/buyer_profile.js';
import { searchReply } from '../services/search_reply.js';
import { resolvePropertyContext } from '../services/property_reply.js';
import { getPropertyKnowledge, isBuyerCriteria } from '../../../src/lib/chatbot/property-knowledge.ts';

const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const question = 'Apakah ada luas tanah minimal atau maksimal? Jika tidak ada, boleh bebas.';
const opening = 'Cari lelang rumah di kelurahan Manukan Kulon, Surabaya budget 700 juta untuk investasi';
const history = [user(opening), assistant(question)];

test('land bounds accept minimum, maximum, inclusive ranges and Indonesian decimal/grouped units', () => {
  for (const [text, expected] of [
    ['minimal 100 m²', { min_land_area_m2: 100 }], ['maksimal 200 m2', { max_land_area_m2: 200 }],
    ['LT minimal 100 m2 maksimal 200 m2', { min_land_area_m2: 100, max_land_area_m2: 200 }],
    ['100–200 m²', { min_land_area_m2: 100, max_land_area_m2: 200 }],
    ['luas tanah antara 100 sampai 200 meter persegi', { min_land_area_m2: 100, max_land_area_m2: 200 }],
    ['luas tanah minimal 100,5 m2', { min_land_area_m2: 100.5 }], ['LT maksimal 1.000 m2', { max_land_area_m2: 1000 }],
    ['LT minimal 0,5 ha', { min_land_area_m2: 5000 }], ['LT maksimal 2 are', { max_land_area_m2: 200 }],
    ['luas tanah persis 120 m2', { min_land_area_m2: 120, max_land_area_m2: 120 }],
    ['LT minimal 100 maksimalnya bebas', { min_land_area_m2: 100, max_land_area_m2: null }],
  ]) assert.deepEqual(extractLandArea(text), expected, text);
  assert.deepEqual(extractLandArea('minimal 100', { allowImplicit: true }), { min_land_area_m2: 100 });
  assert.deepEqual(extractLandArea('100-200', { allowImplicit: true }), { min_land_area_m2: 100, max_land_area_m2: 200 });
});

test('land preferences are never established by budget, building area, questions or unrelated bare answers', () => {
  for (const text of ['Budget 700 juta', '1M untuk investasi', 'luas bangunan 100 m2', 'LB 200 m²', 'Luas tanahnya berapa?', 'minimal 100', 'bebas']) assert.equal(extractLandArea(text), null, text);
  assert.equal(extractBudget('luas tanah minimal 100 m² maksimal 200 m²'), null);
  assert.equal(extractBudget('Budget 1M, LT minimal 100 m2 maksimal 200 m2').max_price, 1000000000);
});

test('qualification first narrows to a village, then asks remaining budget, category and land preferences', () => {
  const messages = [];
  for (const [text, expectedMissing] of [
    ['Cari lelang rumah di Surabaya', ['location', 'max_price', 'land_area']],
    ['Saya tertarik lelang di daerah Tandes pak', ['max_price', 'land_area']],
    ['Manukan Kulon pak', ['max_price', 'land_area']],
    ['700 juta untuk dihuni sekaligus investasi', ['land_area']],
    ['minimal 100 m2 maksimal 200 m2', []],
  ]) {
    messages.push(user(text)); const buyer = buyerContext(messages, text, null);
    assert.deepEqual(buyer.missing, expectedMissing, text); assert.equal(buyer.profile.city, 'Surabaya');
    const reply = searchReply({ buyer, status: 'not_found' });
    if (reply) messages.push(assistant(reply));
  }
  const buyer = buyerContext(messages, 'minimal 100 m2 maksimal 200 m2', null);
  assert.equal(buyer.profile.location, 'Tandes'); assert.equal(buyer.profile.village, 'Manukan Kulon');
  assert.equal(buyer.profile.max_price, 700000000); assert.equal(buyer.profile.purpose, 'both');
  assert.equal(buyer.profile.min_land_area_m2, 100); assert.equal(buyer.profile.max_land_area_m2, 200);
});

test('a supplied village is not asked again; land scope is asked before recommendations without using AI or DB', async () => {
  const context = await resolvePropertyContext({ resolve() { assert.fail('No premature DB recommendations'); } }, opening, null, [user(opening)]);
  assert.deepEqual(context.buyer.missing, ['land_area']); assert.equal(context.buyer.profile.village, 'Manukan Kulon');
  const reply = searchReply(context); assert.match(reply, /luas tanah minimal atau maksimal/);
  assert.doesNotMatch(reply, /kelurahan mana|[Bb]udget.*\?|dihuni sendiri, investasi/);
});

test('unrestricted land answers are scoped to that question and clear earlier bounds', () => {
  for (const answer of ['bebas pak', 'tidak ada', 'tidak ada pak', 'Tidak ada, Bapak.', 'nggak ada sih pak', 'gak ada bu',
    'ga ada', 'enggak ada pak', 'tdk ada', 'nggak ada batasan', 'tidak ada batasan', 'luas tanah fleksibel', 'tidak ada batasan luas tanah', 'luas tanahnya bebas']) {
    const buyer = buyerContext([...history, user(answer)], answer, null);
    assert.equal(buyer.stage, 'recommendations', answer); assert.equal(buyer.profile.min_land_area_m2, null); assert.equal(buyer.profile.max_land_area_m2, null);
  }
  const updates = [...history, user('minimal 100 m2 maksimal 200 m2'), assistant(question), user('bebas pak')];
  assert.equal(buyerContext(updates, 'bebas pak', null).profile.min_land_area_m2, null);
  const unknown = buyerContext([...history, user('belum tahu pak')], 'belum tahu pak', null);
  assert.deepEqual(unknown.missing, ['land_area']);
});

test('short no-limit replies apply only to a land question and never infer missing budget, category or geography', () => {
  for (const answer of ['tidak ada', 'tidak ada pak', 'nggak ada', 'gak ada sih bu', 'enggak ada']) {
    assert.equal(extractLandArea(answer), null, answer);
    assert.deepEqual(extractLandArea(answer, { allowImplicit: true }), { min_land_area_m2: null, max_land_area_m2: null }, answer);
    const buyer = buyerContext([user(opening), assistant('Berapa batas anggaran Bapak/Ibu?'), user(answer)], answer, null);
    assert.deepEqual(buyer.missing, ['land_area'], answer);
  }
  for (const answer of ['tidak ada budget', 'tidak ada dana', 'tidak ada rumah', 'tidak ada yang cocok', 'belum tahu pak', 'tidak ada?']) {
    assert.equal(extractLandArea(answer, { allowImplicit: true }), null, answer);
  }
  const withoutCriteria = 'Cari lelang aset di kelurahan Manukan Kulon, Surabaya';
  const buyer = buyerContext([user(withoutCriteria), assistant(question), user('tidak ada')], 'tidak ada', null);
  assert.deepEqual(buyer.missing, ['max_price', 'category']);
});

test('tidak ada clears earlier land bounds and validation errors while preserving location, type and budget', () => {
  for (const previous of ['minimal 100 m2 maksimal 200 m2', 'minimal 200 m2 maksimal 100 m2']) {
    const updates = [...history, user(previous), assistant(question), user('tidak ada pak')];
    const buyer = buyerContext(updates, 'tidak ada pak', null);
    assert.equal(buyer.stage, 'recommendations'); assert.deepEqual(buyer.missing, []);
    assert.equal(buyer.land_area_error, null); assert.equal(buyer.profile.min_land_area_m2, null); assert.equal(buyer.profile.max_land_area_m2, null);
    assert.equal(buyer.profile.city, 'Surabaya'); assert.equal(buyer.profile.district, 'Tandes'); assert.equal(buyer.profile.village, 'Manukan Kulon');
    assert.equal(buyer.profile.category, 'RUMAH'); assert.equal(buyer.profile.max_price, 700000000);
  }
});

test('choosing all villages keeps the current district; an unrestricted land preference never broadens the area', () => {
  for (const answer of ['seluruh kawasan Tandes', 'di seluruh Tandes', 'kelurahan bebas']) {
    const opening = 'Cari lelang rumah di Tandes, Surabaya budget 700 juta untuk investasi';
    const initial = buyerContext([], opening, null);
    const messages = [user(opening), assistant(searchReply({ buyer: initial })), user(answer)];
    const buyer = buyerContext(messages, answer, null);
    assert.equal(buyer.profile.location, 'Tandes'); assert.equal(buyer.profile.city, 'Surabaya');
    assert.equal(buyer.profile.village, null); assert.deepEqual(buyer.missing, ['land_area']);
    messages.push(assistant(question), user('bebas'));
    const complete = buyerContext(messages, 'bebas', null);
    assert.equal(complete.stage, 'recommendations'); assert.equal(complete.profile.location, 'Tandes');
    assert.equal(complete.profile.category, 'RUMAH'); assert.equal(complete.profile.max_price, 700000000);
  }
});

test('land follow-up in meter shorthand preserves price, property category and village', () => {
  const buyer = buyerContext([...history, user('maksimal 200 m')], 'maksimal 200 m', null);
  assert.equal(buyer.profile.max_land_area_m2, 200); assert.equal(buyer.profile.max_price, 700000000);
  assert.equal(buyer.profile.category, 'RUMAH'); assert.equal(buyer.profile.village, 'Manukan Kulon');
});

test('bare quantities ask whether the number is a minimum, maximum or exact size and never select another asset', async () => {
  for (const text of ['100', '100 m2', 'luas tanah 100 m²']) {
    const context = await resolvePropertyContext({ resolve() { assert.fail('Do not treat size as an asset code'); } }, text, null, [...history, user(text)]);
    assert.equal(context.buyer.land_area_error, 'ambiguous'); assert.match(searchReply(context), /minimal, batas maksimal, atau luas persis/);
  }
});

test('invalid or contradictory bounds retain known criteria and ask for a correction', () => {
  for (const text of ['minimal 200 m2 maksimal 100 m2', 'luas tanah minimal 0 m2', 'LT minimal -100 m2', 'LT maksimal 2000000000 m2']) {
    const buyer = buyerContext([...history, user(text)], text, null);
    assert.equal(buyer.land_area_error, 'invalid', text); assert.equal(buyer.stage, 'qualifying');
    assert.equal(buyer.profile.max_price, 700000000); assert.equal(buyer.profile.village, 'Manukan Kulon');
  }
  const updates = [...history, user('minimal 100 m2 maksimal 200 m2'), assistant('Ada pilihan.'), user('maksimal 50 m2')];
  const invalid = buyerContext(updates, 'maksimal 50 m2', null);
  assert.equal(invalid.profile.min_land_area_m2, 100); assert.equal(invalid.profile.max_land_area_m2, 200); assert.equal(invalid.land_area_error, 'invalid');
  updates.push(assistant(question), user('maksimal 150 m2'));
  const valid = buyerContext(updates, 'maksimal 150 m2', null);
  assert.equal(valid.stage, 'recommendations'); assert.equal(valid.profile.min_land_area_m2, 100); assert.equal(valid.profile.max_land_area_m2, 150);
});

test('area filter validation rejects unsafe, negative, reversed and unknown fields', () => {
  const criteria = { location: 'Tandes', city: 'Surabaya', village: 'Manukan Kulon', max_price: 700000000, purpose: 'investment', min_land_area_m2: 100, max_land_area_m2: 200 };
  assert.equal(isBuyerCriteria(criteria), true);
  for (const changes of [{ min_land_area_m2: '100' }, { min_land_area_m2: -1 }, { max_land_area_m2: 0 },
    { min_land_area_m2: Infinity }, { max_land_area_m2: NaN }, { min_land_area_m2: 300 }, { max_land_area_m2: 1e10 }, { village: '' }, { select: ['password'] }]) assert.equal(isBuyerCriteria({ ...criteria, ...changes }), false);
});

test('DB receives city, village, price and inclusive land bounds, while explicit codes bypass generic filters', async () => {
  const queries = [], db = { listing: { async findMany(input) { queries.push(input); return []; } } };
  const criteria = { location: 'Tandes', city: 'Surabaya', village: 'Manukan Kulon', max_price: 700000000, purpose: 'investment', min_land_area_m2: 100, max_land_area_m2: 200 };
  await getPropertyKnowledge(db, { text: 'minimal 100 m2 maksimal 200 m2', criteria });
  assert.ok(queries.length > 0);
  for (const query of queries) {
    assert.deepEqual(query.where.luas_tanah, { gt: 0, gte: 100, lte: 200 });
    assert.equal(query.where.status_tayang, 'TERSEDIA'); assert.equal(query.where.bukan_properti, false);
    assert.ok(JSON.stringify(query.where).includes('kelurahan')); assert.ok(JSON.stringify(query.where).includes('Manukan Kulon'));
    assert.ok(JSON.stringify(query.where).includes('Surabaya')); assert.ok(JSON.stringify(query.where).includes('700000000'));
  }
  queries.length = 0;
  await getPropertyKnowledge(db, { text: 'Kode 123', criteria });
  assert.equal(queries[0].where.luas_tanah, undefined); assert.equal(queries[0].where.AND, undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { extractBudget, buyerContext } from '../services/buyer_profile.js';
import { extractLandArea, isLandAreaQuestion } from '../services/land_area.js';
import { splitClientIntroduction, SEARCH_INTRODUCTION_QUESTION } from '../services/client_identity.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { quantityRangeScenarios, simulateQuantityRange, PRICE_RANGES } from '../scripts/lib/quantity-range-dialogues.js';
import { getPropertyKnowledge } from '../../../src/lib/chatbot/property-knowledge.ts';
import { clientPreferenceRows } from '../../../src/lib/chatbot/client-preferences.ts';

const user = (content) => ({ role: 'user', content }), assistant = (content) => ({ role: 'assistant', content });
const noAi = { generate() { assert.fail('Explicit quantity ranges must not need AI'); }, interpretBuyer() { assert.fail('A budget answer must not become an interpretation of property type'); } };
const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const opening = 'saya jason, pak, saya tertarik dengan aset lelang, cuman apakah ada yang dekat dengan pakuwon mall?';
const budget = 'hmmm mungkin di angka 500 sampai 1m pak';

test('300 price/land conversations preserve both inclusive bounds for search, CRM capture, and continuation in either answer order', async () => {
  for (const scenario of quantityRangeScenarios()) {
    const result = await simulateQuantityRange(scenario);
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
  }
});
test('everyday budget ranges support shared units, currencies, decimals, mixed scales, separators and spoken amounts', () => {
  for (const [text, min, max] of [...PRICE_RANGES,
    ['saya cari aset lelang budget 300 - 900 juta pak', 300e6, 900e6],
    ['budget 300 juta–900', 300e6, 900e6], ['budget 1M s/d 1,5M', 1e9, 1.5e9],
    ['budget 750 sampai 1,2 M', 750e6, 1.2e9], ['budget 100 sampai 200 miliar', 100e9, 200e9],
    ['budget Rp300000000 sampai Rp900000000', 300e6, 900e6],
    ['budget 300.000.000 - 900.000.000', 300e6, 900e6], ['budget 500rb–1jt', 500000, 1e6],
  ]) assert.deepEqual(extractBudget(text, { allowImplicit: true }), { min_price: min, max_price: max }, text);
  assert.equal(extractBudget(budget, { allowImplicit: true }).max_price, 1e9);
});
test('budget and land quantities stay separate in either field order, with hectare/are conversion and building dimensions ignored', () => {
  for (const text of ['budget 500 sampai 1m, LT 100–200 m2', 'LT 100–200 m2, budget 500 sampai 1m',
    'LB 70–100 m2, budget 500 sampai 1m, LT 100–200 m2']) {
    assert.deepEqual(extractBudget(text), { min_price: 500e6, max_price: 1e9 });
    assert.deepEqual(extractLandArea(text), { min_land_area_m2: 100, max_land_area_m2: 200 });
  }
  assert.deepEqual(extractLandArea('LT 0,5 ha sampai 10.000 m2'), { min_land_area_m2: 5000, max_land_area_m2: 10000 });
  assert.deepEqual(extractLandArea('LT minimal 100 sampai 200 m2'), { min_land_area_m2: 100, max_land_area_m2: 200 });
  for (const text of ['LT 100–200 m²', 'luas bangunan 100–200m', 'harga tanah 10 juta per m2', 'harga tanah 10 juta per m²', 'minimal 2 kamar']) assert.equal(extractBudget(text), null, text);
  assert.equal(extractLandArea('budget 500 sampai 1m', { expected: true }), null);
  assert.equal(splitClientIntroduction(budget, SEARCH_INTRODUCTION_QUESTION).update, null, 'Hmmm Mungkin must never become a client name');
});
test('ambiguous, reversed, nonpositive and unsafe price ranges ask for correction and never search with a partial bound', async () => {
  const initial = 'Saya Nara, cari rumah lelang di Surabaya Barat budget 300-900 juta luas tanah bebas';
  const base = [user(initial), assistant('Ada beberapa pilihan rumah.')];
  for (const [text, error] of [['budget 1–2', 'ambiguous'], ['budget 300 juta sampai', 'ambiguous'], ['budget 900–300 juta', 'invalid'],
    ['budget 0–900 juta', 'invalid'], ['budget -300 juta', 'invalid'], ['budget 1–2000000 miliar', 'invalid']]) {
    assert.equal(extractBudget(text)?.error, error, text);
    const history = [...base, user(text)];
    const catalog = { resolve() { assert.fail('Invalid price ranges must not query inventory'); } };
    const context = buyerContext(history, text, null);
    assert.equal(context.budget_error, error); assert.equal(context.profile.max_price, 900e6);
    assert.equal(context.profile.min_price, 300e6); assert.equal(context.stage, 'qualifying');
    const result = await generatePropertyReply({ text, history, catalog, ai: noAi });
    assert.match(result.reply, /budget/i); assert.doesNotMatch(result.reply, /Jenis properti apa|daerah mana|ngobrol dengan siapa/i);
  }
});
test('separately given minimum and maximum form a range; invalid updates survive bounded history until a correction arrives', async () => {
  const now = () => Date.parse('2026-10-17T15:50:00Z'), store = new MemoryStore(config, now), sent = [], reads = [], phone = '6280000000001';
  const processor = new MessageProcessor({ config, store, now, ai: noAi,
    catalog: { async resolve(_text, _id, criteria) { reads.push(criteria); return { asset: null, catalog: [], status: 'not_found' }; } },
    whatsapp: { async sendText(_phone, text) { sent.push(text); return randomUUID(); } }, logger: { error(value) { assert.fail(value.event); } } });
  const send = async (text) => { processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: now() }]); await processor.drain(); };
  await send('Saya Nara, cari rumah lelang di Surabaya Barat, luas tanah bebas');
  await send('budget minimal 300 juta'); assert.equal(reads.length, 0);
  await send('maksimal 900 juta'); assert.equal(reads.at(-1).min_price, 300e6); assert.equal(reads.at(-1).max_price, 900e6);
  await send('budget 900-300 juta'); assert.equal(reads.length, 1);
  const session = store.get(phone); session.history = session.history.slice(-2);
  await send('rumah'); assert.equal(reads.length, 1); assert.match(sent.at(-1), /Rentang budget/);
  await send('budget 400–800 juta'); assert.equal(reads.length, 2);
  assert.equal(reads.at(-1).min_price, 400e6); assert.equal(reads.at(-1).max_price, 800e6);
  assert.equal(reads.at(-1).city, 'Surabaya'); assert.equal(reads.at(-1).region_group, 'barat');
  assert.equal(store.get(phone).buyer_state.budgetError, null);
});
test('database predicates and editable CRM preference rows contain the same lower/upper price and land limits', async () => {
  const criteria = { city: 'Surabaya', location: 'Surabaya', transaction_type: 'LELANG', category: 'RUMAH', min_price: 300e6, max_price: 900e6, min_land_area_m2: 100, max_land_area_m2: 200 };
  const queries = [];
  await getPropertyKnowledge({ listing: { async findMany(query) { queries.push(query); return []; } } }, { text: 'budget 300–900 juta, LT 100–200 m2', criteria });
  assert.ok(queries.length);
  for (const query of queries) {
    assert.deepEqual(query.where.luas_tanah, { gt: 0, gte: 100, lte: 200 });
    const branches = query.where.AND.find((filter) => filter.OR?.some((item) => item.nilai_limit_lelang?.gte === 300e6)).OR;
    assert.ok(branches.length);
    for (const branch of branches) {
      const price = branch.nilai_limit_lelang || branch.harga_efektif || branch.harga;
      assert.equal(price.gte, 300e6); assert.equal(price.lte, 900e6);
    }
  }
  const [row] = await clientPreferenceRows({}, criteria);
  assert.equal(row.budget_min, 300e6); assert.equal(row.budget_max, 900e6);
  assert.equal(row.luas_min, 100); assert.equal(row.luas_max, 200);
});
test('Playground remembers the exact Pakuwon Mall conversation and searches only after price, category and land are known', async (t) => {
  const reads = [], token = 'x'.repeat(40), app = express();
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, ai: noAi,
    catalog: { async resolve(_text, _id, criteria) { reads.push(criteria); return { asset: null, catalog: [], status: 'not_found' }; } } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID(), replies = [];
  for (const text of [opening, 'surabaya pak', budget, 'rumah pak, luas tanah 100 sampai 200 m2']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); const data = await response.json(); replies.push(data.reply);
    assert.equal(data.generation.mode, 'rules'); assert.equal(data.session.is_bot_active, true);
  }
  assert.equal(reads.length, 1); assert.match(replies[2], /Rp 500\.000\.000–Rp 1\.000\.000\.000/);
  assert.doesNotMatch(replies[2], /500\.000\.000\.000|Budget-nya sampai berapa/);
  const criteria = reads[0];
  assert.equal(criteria.nearby.query, 'pakuwon mall'); assert.equal(criteria.city.toLowerCase(), 'surabaya');
  assert.equal(criteria.min_price, 500e6); assert.equal(criteria.max_price, 1e9);
  assert.equal(criteria.min_land_area_m2, 100); assert.equal(criteria.max_land_area_m2, 200);
});

test('a unitless range after any supported land question defaults to square meters without another clarification', async () => {
  const questions = ['Luas berapa?', 'Luasnya berapa pak?', 'Mau luas berapa?', 'Berapa luasnya?',
    'Ada patokan luas minimal atau maksimal?', 'Ada ukuran tertentu?', 'Luas tanah minimal dan maksimal berapa?',
    'Luas lahannya berapa?', 'LT berapa?'];
  const initial = 'Saya Vera, cari rumah lelang di Surabaya Barat budget 500 juta sampai 1 miliar';
  for (const question of questions) {
    assert.equal(isLandAreaQuestion(question), true, question);
    for (const answer of ['300 - 900', '300–900 pak', '300 sampai 900', 'antara 300 dan 900', '300 s/d 900']) {
      const history = [user(initial), assistant(question), user(answer)], reads = [];
      const result = await generatePropertyReply({ text: answer, history, ai: noAi,
        catalog: { async resolve(_text, _id, criteria) { reads.push(criteria); return { asset: null, catalog: [], status: 'not_found' }; } } });
      assert.equal(reads.length, 1, `${question}: ${answer}`);
      assert.equal(reads[0].min_land_area_m2, 300); assert.equal(reads[0].max_land_area_m2, 900);
      assert.equal(reads[0].min_price, 500e6); assert.equal(reads[0].max_price, 1e9);
      assert.match(result.reply, /luas tanah 300–900 m²/);
      assert.doesNotMatch(result.reply, /maksudnya|satuannya|juta atau miliar|minimal, batas maksimal, atau luas persis|Ada patokan luas/i);
    }
  }
  for (const text of ['Luas bangunan berapa?', 'LB minimal dan maksimal berapa?', 'Budget-nya sampai berapa?', 'Mau cek luas atau harga asetnya?']) assert.equal(isLandAreaQuestion(text), false, text);
});

test('live funnel saves 300–900 square meters from the bare range while retaining the separate budget', async () => {
  const now = () => Date.parse('2026-10-17T16:20:00Z'), store = new MemoryStore(config, now), reads = [], captures = [], sent = [], phone = '6280000000001';
  const processor = new MessageProcessor({ config, store, now, ai: noAi,
    catalog: { async resolve(_text, _id, criteria) { reads.push(criteria); return { asset: null, catalog: [], status: 'not_found' }; } },
    clients: { setName() {}, enqueue(value) { captures.push(value); }, async flush() {} },
    whatsapp: { async sendText(_phone, text) { sent.push(text); return randomUUID(); } }, logger: { error(value) { assert.fail(value.event); } } });
  for (const text of ['Saya Vera, cari rumah lelang di Surabaya Barat budget 500 juta–1 miliar', '300 - 900']) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: now() }]); await processor.drain();
  }
  assert.equal(reads.length, 1); assert.equal(captures.length, 1);
  for (const criteria of [reads[0], captures[0].criteria, store.get(phone).buyer_state.profile]) {
    assert.equal(criteria.min_land_area_m2, 300); assert.equal(criteria.max_land_area_m2, 900);
    assert.equal(criteria.min_price, 500e6); assert.equal(criteria.max_price, 1e9);
  }
  assert.match(sent[0], /Ada patokan luas tanah/); assert.match(sent[1], /luas tanah 300–900 m²/);
  assert.doesNotMatch(sent[1], /satuan|juta atau miliar|Ada patokan luas tanah/);
});

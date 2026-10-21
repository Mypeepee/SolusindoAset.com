import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { parseBudgetAmounts } from '../services/budget_amounts.js';
import { buyerContext } from '../services/buyer_profile.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { searchReply } from '../services/search_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';

const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const initial = 'Cari aset lelang di Driyorejo, Gresik';
const question = 'Oke, kita cari aset lelang di Driyorejo, Gresik ya.\n\nBudget-nya sampai berapa?\nJenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.';
const reported = 'budget saya 400-600 mentok';
const history = [user(initial), assistant(question)];
const noAi = { generate() { assert.fail('Known budget shorthand does not need AI'); },
  interpretBuyer() { assert.fail('A financial answer must not become a category or land interpretation'); } };
const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 20,
  maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const variants = ['budget saya 400-600 mentok', '400–600', '400—600 pak', '400 sampai 600',
  '400 sampe 600 bu', 'antara 400 dan 600', 'budget 400 s/d 600', 'budget minimal 400 maksimal 600'];

function assertPriceRange(profile) {
  assert.equal(profile.min_price, 400e6); assert.equal(profile.max_price, 600e6);
  assert.equal(profile.city, 'Gresik'); assert.equal(profile.district, 'Driyorejo');
  assert.equal(profile.transaction_type, 'LELANG');
}
function assertReply(reply) {
  assert.match(reply, /Rp 400\.000\.000–Rp 600\.000\.000/);
  assert.match(reply, /Driyorejo.*Gresik/); assert.match(reply, /Jenis properti apa/);
  assert.doesNotMatch(reply, /juta atau miliar|satuan|Rentang budget|Budget-nya sampai berapa/);
}

test('reported unitless budget and everyday variants resolve as millions in the auction search context', async () => {
  for (const text of variants) {
    const buyer = buyerContext(history, text, null);
    assertPriceRange(buyer.profile); assert.equal(buyer.budget_error, null, text);
    assert.equal(buyer.profile.category, null); assert.equal(buyer.profile.min_land_area_m2, null);
    assert.deepEqual(buyer.missing, ['category', 'land_area']);
    assertReply(searchReply({ buyer, status: 'qualifying' }));
    const result = await generatePropertyReply({ text, history: [...history, user(text)], ai: noAi,
      catalog: { resolve() { assert.fail('Do not query before category and land preferences are known'); } } });
    assertReply(result.reply); assert.equal(result.generation.mode, 'rules');
  }
});

test('purchase context recognizes unitless hundreds as a ceiling, an inline range, and an explicit correction', () => {
  for (const text of ['600 mentok', 'budget 600', 'maksimal 600', '600']) {
    const buyer = buyerContext(history, text, null);
    assert.equal(buyer.profile.min_price, null, text); assert.equal(buyer.profile.max_price, 600e6, text);
    assert.equal(buyer.budget_error, null); assert.ok(buyer.missing.includes('category'));
  }
  for (const type of ['lelang', 'primary', 'secondary', 'non lelang']) {
    const buyer = buyerContext([], `Cari rumah ${type} di Driyorejo, Gresik, budget saya 400-600 mentok`, null);
    assert.equal(buyer.profile.min_price, 400e6, type); assert.equal(buyer.profile.max_price, 600e6, type);
  }
  const buyer = buyerContext([...history, user(reported), assistant('Jenis properti apa?')], 'budget jadi 450–550', null);
  assert.equal(buyer.profile.min_price, 450e6); assert.equal(buyer.profile.max_price, 550e6);
  assert.equal(buyer.budget_error, null); assert.equal(buyer.profile.district, 'Driyorejo');
});

test('explicit money units and full rupiah amounts take priority over inferred millions', () => {
  for (const [text, min, max] of [['budget 400–600 ribu', 400000, 600000],
    ['budget 400–600 miliar', 400e9, 600e9], ['budget 400 juta–1 miliar', 400e6, 1e9],
    ['budget Rp400–Rp600', 400, 600], ['budget 400–600 rupiah', 400, 600],
    ['budget 400.000.000–600.000.000', 400e6, 600e6]]) {
    assert.deepEqual(parseBudgetAmounts(text, { implicitUnit: 'juta' }), { min_price: min, max_price: max }, text);
  }
  assert.deepEqual(parseBudgetAmounts('Rp600', { implicitUnit: 'juta' }), { min_price: null, max_price: 600 });
  assert.deepEqual(parseBudgetAmounts('600 rupiah', { implicitUnit: 'juta' }), { min_price: null, max_price: 600 });
  assert.deepEqual(parseBudgetAmounts('400–600'), { error: 'ambiguous' }, 'no purchase context means no inference');
  assert.deepEqual(parseBudgetAmounts('600–400', { implicitUnit: 'juta' }), { error: 'invalid' });
  assert.deepEqual(parseBudgetAmounts('1–2', { implicitUnit: 'juta' }), { error: 'ambiguous' });
  assert.deepEqual(parseBudgetAmounts('400–', { implicitUnit: 'juta' }), { error: 'ambiguous' });
});

test('rent and undecided transaction contexts do not inherit the purchase shorthand policy', () => {
  for (const initialText of ['Cari rumah sewa di Gresik', 'Cari rumah di Gresik', 'Cari rumah beli atau sewa di Gresik']) {
    const buyer = buyerContext([user(initialText), assistant('Budget-nya sampai berapa?')], reported, null);
    assert.equal(buyer.budget_error, 'ambiguous', initialText);
    assert.equal(buyer.profile.min_price, null); assert.equal(buyer.profile.max_price, null);
  }
  const switched = buyerContext([...history, user(reported), assistant('Jenis properti apa?')], 'jadi cari sewa, budget 400–600', null);
  assert.equal(switched.profile.transaction_type, 'SEWA'); assert.equal(switched.profile.max_price, null);
  assert.equal(switched.budget_error, 'ambiguous');
});

test('unitless land ranges and explicit land clauses stay separate from inferred purchase budgets', () => {
  const complete = 'Cari rumah lelang di Driyorejo, Gresik, budget 400–600';
  const land = buyerContext([user(complete), assistant('Luas tanah minimal dan maksimal berapa?')], '100–200', null);
  assertPriceRange(land.profile);
  assert.equal(land.profile.min_land_area_m2, 100); assert.equal(land.profile.max_land_area_m2, 200);
  for (const text of ['budget 400–600, LT 100–200 m2', 'LT 100–200 m2, budget 400–600']) {
    const mixed = buyerContext(history, text, null);
    assertPriceRange(mixed.profile);
    assert.equal(mixed.profile.min_land_area_m2, 100); assert.equal(mixed.profile.max_land_area_m2, 200);
  }
});

test('WhatsApp keeps the reported budget through bounded history, then passes both bounds to search and CRM', async () => {
  const phone = '6280000000001', sent = [], reads = [], captures = [], store = new MemoryStore(config);
  const processor = new MessageProcessor({ config, store, ai: noAi,
    catalog: { async resolve(_text, _id, criteria) { reads.push(criteria); return { status: 'not_found', asset: null, catalog: [] }; } },
    clients: { setName() {}, enqueue(value) { captures.push(value); }, async flush() {} },
    whatsapp: { async sendText(_phone, text) { sent.push(text); return randomUUID(); } },
    logger: { error(error) { assert.fail(error.event); } } });
  const send = async (text) => { processor.acceptBatch([{ id: randomUUID(), type: 'text', from: phone, text, timestamp: Date.now() }]); await processor.drain(); };
  await send(initial); await send(reported);
  assertReply(sent.at(-1)); assert.equal(reads.length, 0);
  assertPriceRange(store.get(phone).buyer_state.profile);
  store.get(phone).history = store.get(phone).history.slice(-2);
  await send('rumah, luas tanah bebas');
  assert.equal(reads.length, 1); assertPriceRange(reads[0]);
  assertPriceRange(captures.at(-1).criteria); assertPriceRange(store.get(phone).buyer_state.profile);
  assert.equal(store.get(phone).is_bot_active, true);
});

test('Playground uses the same shorthand policy with server conversation memory', async (t) => {
  const token = 'x'.repeat(40), app = express(), reads = [];
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, ai: noAi,
    catalog: { async resolve(_text, _id, criteria) { reads.push(criteria); return { status: 'not_found', asset: null, catalog: [] }; } } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  for (const text of [initial, reported, 'rumah, luas tanah bebas']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); const data = await response.json();
    assert.equal(data.session.is_bot_active, true); assert.equal(data.generation.mode, 'rules');
    if (text === reported) { assertReply(data.reply); assert.equal(reads.length, 0); }
  }
  assert.equal(reads.length, 1); assertPriceRange(reads[0]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { languageScenarios, runLanguageScenario } from '../scripts/lib/language-dialogues.js';
import { extractPropertyCategories } from '../services/property_category.js';
import { extractLandArea } from '../services/land_area.js';
import { buyerContext } from '../services/buyer_profile.js';
import { searchReply } from '../services/search_reply.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { isBuyerCriteria } from '../../../src/lib/chatbot/property-knowledge.ts';

const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const reported = languageScenarios({ count: 0 })[0];
const NOW = Date.parse('2026-10-12T08:00:00Z');
const noAi = { generate() { assert.fail('No model needed to qualify/search'); } };
function historyBeforeAnswer() {
  const history = [];
  for (const text of reported.messages.slice(0, 2)) {
    history.push(user(text)); history.push(assistant(searchReply({ buyer: buyerContext(history, text, null) })));
  }
  return history;
}

test('seeded Indonesian language corpus keeps independent buyer criteria and only searches complete requests', async () => {
  for (const scenario of languageScenarios()) {
    const result = await runLanguageScenario(scenario);
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
  }
});

test('several categories are alternatives, while compound names and corrections retain their meaning', () => {
  for (const [text, expected] of [
    ['rumah dan toko pak', ['RUMAH', 'TOKO']], ['rmh sama toko', ['RUMAH', 'TOKO']],
    ['rumah toko', ['RUKO']], ['hotel dan villa', ['HOTEL_DAN_VILLA']],
    ['rumah atau rumah, toko', ['RUMAH', 'TOKO']], ['rumah, toko, gudang', ['RUMAH', 'TOKO', 'GUDANG']],
    ['tanah dan rumah', ['TANAH', 'RUMAH']], ['bukan ruko tapi rumah dan toko', ['RUMAH', 'TOKO']],
    ['ganti dari rumah dan toko ke gudang', ['GUDANG']],
    ['ganti dari rumah ke toko dan gudang', ['TOKO', 'GUDANG']],
    ['nggak mau rumah, toko saja', ['TOKO']], ['bukan rumah dan toko', []],
    ['belum tahu rumah atau toko', []], ['luas tanah minimal 100 m2', []],
    ['rumah sakit', []], ['Kelurahan Gudang', []],
  ]) assert.deepEqual(extractPropertyCategories(text, { expected: true }), expected, text);
});

test('only land preference phrases can clear land bounds; uncertainty and negation cannot', () => {
  for (const text of ['tidak ada batasan luasan', 'luasan tdk ada batasan', 'gak ada patokan luas',
    'ukuran tanah ga dibatasi', 'bebas luasnya', 'tidak ada batas luas tanah',
    'luasnya tidak masalah', 'luas tanah berapa saja']) {
    assert.deepEqual(extractLandArea(text, { expected: true }), { min_land_area_m2: null, max_land_area_m2: null }, text);
  }
  for (const text of ['budget bebas', 'jenis bebas', 'luas bangunan bebas', 'tidak ada dana',
    'luas tidak bebas', 'luasnya belum tahu', 'luas bebas?', 'budget bebas luasnya belum tahu',
    'jenis bebas luasnya belum tahu', 'bukan bebas luasnya', 'luas tanah tidak ada batasan?']) {
    assert.equal(extractLandArea(text, { expected: true, allowImplicit: true }), null, text);
  }
});

test('multi-type answers preserve location with search verbs, field reordering and numbers written in words', () => {
  for (const text of ['saya cari lelang rumah dan toko, luas bebas', 'cari rmh sama toko pak, bebas luasnya',
    'rumah atau toko, tidak ada batasan', 'luas tanah bebas, saya mencari lelang rumah dan toko',
    'saya cari lelang rumah dan toko pak. tidak ada batasan luasan', 'tidak ada batasan luasan, cari lelang rumah dan toko',
    'rumah dan toko, luas tidak ada batasan untuk tanah', 'rumah dan toko, gak ada pak']) {
    const buyer = buyerContext(historyBeforeAnswer(), text, null);
    assert.deepEqual(buyer.profile.categories, ['RUMAH', 'TOKO'], text);
    assert.equal(buyer.profile.location, 'Menganti', text);
    assert.equal(buyer.profile.district, 'Menganti', text);
    assert.equal(buyer.profile.max_price, 400000000, text);
    assert.deepEqual(buyer.missing, [], text);
  }
  const buyer = buyerContext(historyBeforeAnswer(), 'rumah dan toko, luas minimal seratus meter persegi, budget tiga ratus juta', null);
  assert.equal(buyer.profile.min_land_area_m2, 100); assert.equal(buyer.profile.max_price, 300000000);
});

test('short unknown land answer keeps both known categories and asks only about land', () => {
  const buyer = buyerContext(historyBeforeAnswer(), 'rumah dan toko pak, luas belum tahu', null);
  assert.deepEqual(buyer.profile.categories, ['RUMAH', 'TOKO']);
  assert.deepEqual(buyer.missing, ['land_area']);
  const reply = searchReply({ buyer });
  assert.match(reply, /rumah atau toko/); assert.doesNotMatch(reply, /Jenis properti apa/);
});

test('API criteria accept a bounded enum list and reject invalid or conflicting category filters', () => {
  const base = { location: 'Menganti', max_price: 400000000 };
  for (const categories of [['RUMAH', 'TOKO'], ['RUMAH']]) assert.equal(isBuyerCriteria({ ...base, categories }), true);
  for (const categories of [[], ['RUMAH', 'RUMAH'], ['RUMAH', 'KANTOR'], ['RUMAH', null], 'RUMAH,TOKO', [1], { in: ['RUMAH'] }]) {
    assert.equal(isBuyerCriteria({ ...base, categories }), false);
  }
  assert.equal(isBuyerCriteria({ ...base, category: 'RUMAH', categories: ['RUMAH', 'TOKO'] }), false);
  assert.equal(isBuyerCriteria({ ...base, category: ['RUMAH'] }), false);
  assert.equal(isBuyerCriteria({ ...base, category: 'RUMAH' }), true);
});

const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
function catalogStub(categories = ['RUMAH', 'TOKO']) {
  const calls = [];
  return { calls, async resolve(_text, _id, criteria) {
    assert.ok(isBuyerCriteria(criteria)); calls.push(criteria);
    assert.deepEqual(criteria.categories, categories);
    assert.equal(criteria.category, null); assert.equal(criteria.max_price, 400000000);
    assert.equal(criteria.district, 'Menganti'); assert.equal(criteria.city, 'Kabupaten Gresik');
    assert.equal(criteria.min_land_area_m2, null); assert.equal(criteria.max_land_area_m2, null);
    return { asset: null, catalog: [], status: 'not_found', source: 'database_listing_publik' };
  } };
}

for (const [label, messages, categories, types] of [
  ['two types', reported.messages, ['RUMAH', 'TOKO'], 'rumah atau toko'],
  ['four types', [...reported.messages.slice(0, 2), 'gudang, pabrik, tanah, atau ruko pak. tidak ada batasan luasan'], ['GUDANG', 'PABRIK', 'TANAH', 'RUKO'], 'gudang, pabrik, tanah, atau ruko'],
]) {
test(`WhatsApp processor resolves ${label} without repeating answered questions`, async () => {
  const catalog = catalogStub(categories), sent = [], store = new MemoryStore(config, () => NOW);
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => NOW,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'sent'; } }, logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  for (const text of messages) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: '6281234567890', timestamp: NOW }]);
    await processor.drain();
  }
  assert.equal(sent.length, 3); assert.equal(catalog.calls.length, 1);
  assert.ok(sent.at(-1).includes(types)); assert.doesNotMatch(sent.at(-1), /Jenis properti apa|Apakah Bapak\/Ibu memiliki batas luas/);
  assert.doesNotMatch(sent.at(-1), /mengubah batas luas/, 'there are no land limits left to relax');
});

test(`Playground server retains Menganti context and accepts ${label}`, async (t) => {
  const catalog = catalogStub(categories), app = express(), token = 'x'.repeat(40);
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  let result;
  for (const text of messages) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }),
    });
    assert.equal(response.status, 200); result = await response.json();
  }
  assert.equal(result.knowledge.status, 'not_found'); assert.ok(result.reply.includes(types));
  assert.equal(catalog.calls.length, 1);
});
}

test('common abbreviation also opens a new search through the interaction policy', async () => {
  const text = 'Cari lelang rmh di Kecamatan Menganti, Kabupaten Gresik';
  const result = await generatePropertyReply({ text, history: [user(text)], catalog: { resolve() { assert.fail('Still qualifying'); } }, ai: noAi });
  assert.equal(result.knowledge.status, 'qualifying'); assert.match(result.reply, /cari rumah/);
});

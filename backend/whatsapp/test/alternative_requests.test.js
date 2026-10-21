import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { requestsAlternatives, geographyWithoutReferences } from '../services/conversation_references.js';
import { normalizeBuyerLanguage } from '../services/buyer_language.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { recommendationIds } from '../services/recommendations.js';
import { fixture, OPENING, NOW, ALTERNATIVE_PHRASES, REPORTED_PROPERTY_REQUEST, reportedFiveHistory, REPORTED_FIVE_IDS } from '../scripts/lib/recommendation-dialogues.js';
import { DatabaseCatalog } from '../services/property_database.js';
import { planPropertyLookup } from '../../../src/lib/chatbot/property-knowledge.ts';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { advancedFixture } from '../scripts/lib/advanced-search-dialogues.js';

const REPORTED_FOLLOWUP = REPORTED_PROPERTY_REQUEST;

for (const text of ALTERNATIVE_PHRASES) test(`alternative request: ${text}`, () => {
  assert.equal(requestsAlternatives(text), true);
  assert.equal(requestsAlternatives(text), requestsAlternatives(normalizeBuyerLanguage(text)), 'Every consumer must agree on the same user intent');
});

test('all five reported Markdown links are recognized as IDs to exclude', () => {
  assert.deepEqual(recommendationIds(reportedFiveHistory().at(-1).content), REPORTED_FIVE_IDS);
});

test('plural property2 references do not become property code 2', () => {
  for (const text of ['selain property2 tersebut ada lagi?', 'properti2 yang tadi', 'aset2 sebelumnya']) {
    assert.deepEqual(planPropertyLookup(text).ids, [], text);
  }
  assert.deepEqual(planPropertyLookup('property2').ids, ['2']);
  assert.deepEqual(planPropertyLookup('kode 2').ids, ['2']);
});

test('the exact reported property spelling excludes all five previous results', async () => {
  const f = fixture(), history = [{ role: 'user', content: OPENING }];
  const first = await generatePropertyReply({ ...f, text: OPENING, history, now: NOW });
  const initial = recommendationIds(first.reply);
  assert.equal(initial.length, 5);
  history.push({ role: 'assistant', content: first.reply }, { role: 'user', content: REPORTED_FOLLOWUP });
  const next = await generatePropertyReply({ ...f, text: REPORTED_FOLLOWUP, history, now: NOW });
  const ids = recommendationIds(next.reply);
  assert.equal(ids.length, 5);
  assert.ok(ids.every((id) => !initial.includes(id)), `Returned the same listings: ${ids}`);
  assert.deepEqual(new Set(f.criteria.at(-1).exclude_ids), new Set(initial));
  assert.equal(f.criteria.at(-1).city, 'Mojokerto'); assert.equal(f.criteria.at(-1).max_price, 50e9);
});

test('the exact follow-up preserves the Surabaya directional area, school radius and hard budget', async () => {
  const f = advancedFixture(), opening = 'Cari secondary rumah di Surabaya Barat dekat sekolah radius 1 km budget 500 juta luas tanah minimal 72 m2';
  const history = [{ role: 'user', content: opening }];
  const initial = await generatePropertyReply({ ...f, text: opening, history });
  const ids = recommendationIds(initial.reply);
  assert.equal(ids.length, 2);
  history.push({ role: 'assistant', content: initial.reply }, { role: 'user', content: REPORTED_FOLLOWUP });
  const next = await generatePropertyReply({ ...f, text: REPORTED_FOLLOWUP, history });
  assert.deepEqual(recommendationIds(next.reply), []);
  assert.equal(next.knowledge.status, 'not_found');
  assert.equal(f.criteria.at(-1).region_group, 'barat');
  assert.deepEqual(f.criteria.at(-1).nearby, { query: 'sekolah', radius_m: 1000 });
  assert.equal(f.criteria.at(-1).max_price, 500e6);
  assert.deepEqual(f.criteria.at(-1).exclude_ids, ids);
  assert.doesNotMatch(next.reply, /kelurahan mana|kecamatan mana|Budget-nya sampai berapa|Jenis properti apa/i);
});

test('alternative property references are masked without losing revised geographic criteria', () => {
  const text = geographyWithoutReferences('adakah selain property tersebut di Surabaya Timur budget 500 juta?');
  assert.doesNotMatch(text, /property|properti tersebut/i);
  assert.match(text, /Surabaya Timur/); assert.match(text, /budget 500 juta/);
});

test('negated searches, detail follow-ups and payment questions never reject a recommendation batch', () => {
  for (const text of ['tidak usah cari yang lain', 'jangan tampilkan properti lain', 'nggak mau pilihan lain',
    'saya belum ingin cari properti lain', 'nggak perlu selain properti tersebut', 'bukan minta pilihan lain',
    'selain itu biayanya berapa?', 'ada biaya lainnya?', 'selain harga limit ada biaya apa?',
    'detail property tersebut dong', 'yang ketiga luasnya berapa?', 'lanjut jelaskan biaya lelang',
    'ada sekolah lain dekat property tersebut?', 'kapan jadwal lelang berikutnya?',
    'masih ada lagi biaya yang harus dibayar?', 'ada lagi kamar tidurnya?', 'lanjut ke pembayaran']) {
    assert.equal(requestsAlternatives(text), false, text);
  }
});

test('connector never returns an excluded property even if an older server ignores the exclusion', async () => {
  const catalog = new DatabaseCatalog({ url: 'https://simulated.invalid/properties', token: 'test', timeoutMs: 5000 }, {
    async fetchImpl() { return Response.json({ source: 'database_listing_publik', status: 'recommendations', asset: null,
      candidates: [{ id: '121815' }, { id: '121192' }] }); },
  });
  const partial = await catalog.resolve('alternatif', null, { exclude_ids: ['121815'] });
  assert.deepEqual(partial.catalog.map((p) => p.id), ['121192']);
  const exhausted = await catalog.resolve('alternatif', null, { exclude_ids: ['121815', '121192'] });
  assert.equal(exhausted.status, 'not_found'); assert.deepEqual(exhausted.catalog, []);
});

const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };

test('WhatsApp keeps exclusions across the reported six-minute pause and repeated requests until exhaustion', async () => {
  let clock = NOW;
  const f = fixture(), store = new MemoryStore(config, () => clock), sent = [], phone = '6281234567890';
  const processor = new MessageProcessor({ ...f, config, store, now: () => clock,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'simulated'; } },
    logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  for (const text of [OPENING, REPORTED_FOLLOWUP, REPORTED_FOLLOWUP, REPORTED_FOLLOWUP]) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: clock }]);
    await processor.drain(); clock += 6 * 60000;
  }
  assert.deepEqual(sent.map((reply) => recommendationIds(reply).length), [5, 5, 2, 0]);
  assert.equal(new Set(sent.flatMap(recommendationIds)).size, 12);
  assert.equal(store.get(phone).is_bot_active, true);
  assert.equal(f.criteria.at(-1).exclude_ids.length, 12);
  assert.match(sent.at(-1), /[Bb]elum ketemu.*lain/);
});

test('Playground excludes the last batch when the browser submits only the reported latest message', async (t) => {
  let clock = NOW;
  const f = fixture(), app = express(), token = 'x'.repeat(40), conversationId = randomUUID();
  app.use('/sandbox', createSandboxRouter({ ...f, config: { ...config, adminToken: token }, now: () => clock }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const post = async (text) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [{ role: 'user', content: text }] }) });
    assert.equal(response.status, 200);
    const result = await response.json();
    return (result.replies || [result.reply]).join('\n\n');
  };
  const first = recommendationIds(await post(OPENING));
  clock += 6 * 60000;
  const second = recommendationIds(await post(REPORTED_FOLLOWUP));
  assert.equal(first.length, 5); assert.equal(second.length, 5);
  assert.ok(second.every((id) => !first.includes(id)));
  assert.deepEqual(f.criteria.at(-1).exclude_ids, first);
  assert.equal(f.criteria.at(-1).city, 'Mojokerto'); assert.equal(f.criteria.at(-1).max_price, 50e9);
});

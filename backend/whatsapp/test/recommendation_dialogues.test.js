import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { scenarios, simulateRecommendations, fixture, legacyHistory, LEGACY_IDS, OPENING, REPORTED, NOW } from '../scripts/lib/recommendation-dialogues.js';
import { requestsAlternatives } from '../services/conversation_references.js';
import { recommendationIds } from '../services/recommendations.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { isPlaygroundResponse } from '../../../src/lib/chatbot/playground.ts';
import { DatabaseCatalog } from '../services/property_database.js';

for (const scenario of scenarios) test(`recommendation dialogue: ${scenario.name}`, () => simulateRecommendations(scenario));

test('legacy formatted links extract listing IDs, not the numeric slug suffix', () => {
  assert.deepEqual(recommendationIds(legacyHistory().at(-1).content), LEGACY_IDS);
});

test('unrelated follow-up questions do not reject the recommended batch', () => {
  for (const text of ['selain itu biayanya berapa?', 'yang ketiga luasnya berapa?', 'detail nomor 5', 'selain harga limit ada biaya apa?', 'biaya yang lain apa saja?']) {
    assert.equal(requestsAlternatives(text), false, text);
  }
});

test('fourth and fifth selections fetch fresh property details', async () => {
  for (const [text, index] of [['yang keempat', 3], ['nomor 4', 3], ['4', 3], ['yang kelima', 4], ['opsi 5', 4], ['5', 4]]) {
    const f = fixture(), history = [{ role: 'user', content: OPENING }];
    const first = await generatePropertyReply({ ...f, text: OPENING, history, now: NOW });
    const ids = recommendationIds(first.reply);
    history.push({ role: 'assistant', content: first.reply }, { role: 'user', content: text });
    const next = await generatePropertyReply({ ...f, text, history, now: NOW });
    assert.equal(next.asset.id, ids[index], text); assert.match(next.reply, /DETAIL ASET/);
    assert.equal(f.criteria.length, 1, 'Selecting an item must not run another search');
  }
});

const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
test('live processor sends 5, 5, 2 then an honest exhausted reply, with no repeated IDs', async () => {
  const f = fixture(), sent = [], store = new MemoryStore(config, () => NOW), phone = '6281234567890';
  const processor = new MessageProcessor({ ...f, config, store, now: () => NOW,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'simulated'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const text of [OPENING, REPORTED, 'selain kelima ini', 'ada yang lain pak?']) {
    processor.acceptBatch([{ id: randomUUID(), text, from: phone, timestamp: NOW, type: 'text' }]); await processor.drain();
  }
  assert.deepEqual(sent.map((text) => recommendationIds(text).length), [5, 5, 2, 0]);
  assert.equal(new Set(sent.flatMap(recommendationIds)).size, 12);
  assert.match(sent.at(-1), /lain/);
});

test('all split cards are delivered, excluded on alternatives, and selectable across message parts', async () => {
  const f = fixture({ long: true }), sent = [], store = new MemoryStore(config, () => NOW), phone = '6281234567890';
  const processor = new MessageProcessor({ ...f, config, store, now: () => NOW,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'simulated'; } }, logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  const send = async (text) => {
    processor.acceptBatch([{ id: randomUUID(), text, from: phone, timestamp: NOW, type: 'text' }]); await processor.drain();
  };
  await send(OPENING);
  assert.ok(sent.length > 1); assert.ok(sent.every((message) => message.length <= 4000));
  assert.equal(sent.flatMap(recommendationIds).length, 5);
  const first = sent.splice(0).flatMap(recommendationIds);
  await send(REPORTED);
  const second = sent.flatMap(recommendationIds);
  assert.equal(second.length, 5); assert.ok(second.every((id) => !first.includes(id)));
  await send('yang kelima');
  assert.equal(store.get(phone).asset_id, second[4]); assert.match(sent.at(-1), /DETAIL ASET/);
});

test('Playground returns and remembers every message part before selecting the fourth listing', async (t) => {
  const f = fixture({ long: true }), app = express(), token = 'x'.repeat(40), conversationId = randomUUID();
  app.use('/sandbox', createSandboxRouter({ ...f, config: { ...config, adminToken: token }, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const post = async (text) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [{ role: 'user', content: text }] }) });
    assert.equal(response.status, 200); return response.json();
  };
  const initial = await post(OPENING);
  assert.ok(initial.replies.length > 1); assert.ok(isPlaygroundResponse(initial));
  const originalIds = initial.replies.flatMap(recommendationIds);
  assert.equal(originalIds.length, 5);
  const next = await post(REPORTED), nextIds = next.replies.flatMap(recommendationIds);
  assert.equal(nextIds.length, 5); assert.ok(nextIds.every((id) => !originalIds.includes(id)));
  const detail = await post('yang keempat');
  assert.equal(detail.session.asset_id, nextIds[3]); assert.match(detail.reply, /DETAIL ASET/);
  for (const replies of [[initial.reply, ''], [initial.reply, 'x'.repeat(4001)], ['different', 'reply'], Array(7).fill(initial.reply)]) {
    assert.equal(isPlaygroundResponse({ ...initial, replies }), false);
  }
});

test('database connector accepts five candidates and rejects oversized responses', async () => {
  const config = { url: 'https://database.example/context', token: 'test', timeoutMs: 5000 };
  for (const count of [5, 6]) {
    const catalog = new DatabaseCatalog(config, { async fetchImpl() {
      return Response.json({ source: 'database_listing_publik', status: 'recommendations', asset: null,
        candidates: Array.from({ length: count }, (_, i) => ({ id: String(i + 1) })) });
    } });
    if (count === 5) assert.equal((await catalog.resolve('cari lelang pabrik')).catalog.length, 5);
    else await assert.rejects(catalog.resolve('cari lelang pabrik'), { code: 'INVALID_PROPERTY_CONTEXT' });
  }
});

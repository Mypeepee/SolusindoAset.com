import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { scenarios, simulateAdvancedSearch, advancedFixture } from '../scripts/lib/advanced-search-dialogues.js';
import { isBuyerCriteria } from '../../../src/lib/chatbot/property-knowledge.ts';
import { buyerContext } from '../services/buyer_profile.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';

for (const scenario of scenarios) test(`advanced search: ${scenario.name}`, () => simulateAdvancedSearch(scenario));

test('API rejects unbounded radius, invalid regions and injected nearby payloads', () => {
  const base = { location: 'Surabaya Barat', city: 'Surabaya', region_group: 'barat', nearby: { query: 'rumah sakit', radius_m: 500 } };
  assert.equal(isBuyerCriteria(base), true);
  for (const changes of [{ region_group: '__proto__' }, { city: 'Malang' }, { nearby: [] },
    { nearby: { query: 'rs', radius_m: 0 } }, { nearby: { query: 'rs', radius_m: 20001 } },
    { nearby: { query: '', radius_m: 500 } }, { nearby: { query: 'rs', where: { OR: [] } } }]) {
    assert.equal(isBuyerCriteria({ ...base, ...changes }), false);
  }
});

test('explicit restart removes old landmark and directional scope', () => {
  const history = [{ role: 'user', content: 'Cari secondary rumah di Surabaya Barat dekat sekolah budget 500 juta luas tanah bebas' },
    { role: 'assistant', content: 'Ada yang ingin diubah?' }];
  const buyer = buyerContext(history, 'Mulai pencarian baru, cari rumah di seluruh Kota Malang', null);
  assert.equal(buyer.profile.region_group, undefined); assert.equal(buyer.profile.nearby, undefined);
  assert.equal(buyer.profile.city, 'Kota Malang');
});

const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const messages = ['Halo', 'Nama saya Budi, cari rumah di Surabaya Barat budget 500 juta', 'secondary saja',
  'dekat sekolah radius 500 meter, luas tanah minimal 72 m2', 'budget jadi 450 juta', 'ganti ke Surabaya Selatan'];

test('WhatsApp processor remembers the funnel and edits without repetitive geography questions', async () => {
  const f = advancedFixture(), store = new MemoryStore(config, () => f.now), sent = [], phone = '6281234567890';
  const processor = new MessageProcessor({ ...f, now: () => f.now, config, store,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'simulated'; } }, logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  for (const text of messages) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: f.now }]); await processor.drain();
  }
  assert.equal(sent.length, messages.length);
  assert.equal(store.get(phone).is_bot_active, true);
  assert.match(sent[0], /siapa/i);
  for (const reply of sent.slice(1)) assert.doesNotMatch(reply, /kelurahan mana|kecamatan mana|[Ii]ncar daerah mana|Pak atau Bu siapa/i);
  assert.match(sent[3], /970001/); assert.match(sent[5], /970004/);
  assert.equal(f.criteria.at(-1).nearby.query, 'sekolah');
  assert.equal(f.criteria.at(-1).region_group, 'selatan'); assert.equal(f.criteria.at(-1).max_price, 450e6);
});

test('Playground uses the same server-owned scope and does not reuse it in a new conversation', async (t) => {
  const f = advancedFixture(), app = express(), token = 'x'.repeat(40), conversationId = randomUUID();
  app.use('/sandbox', createSandboxRouter({ ...f, now: () => f.now, config: { ...config, adminToken: token } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const post = async (text, id = conversationId) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: id, requestId: randomUUID(), history: [{ role: 'user', content: text }] }) });
    assert.equal(response.status, 200); return response.json();
  };
  for (const text of messages) assert.ok((await post(text)).reply);
  assert.equal(f.criteria.at(-1).region_group, 'selatan'); assert.equal(f.criteria.at(-1).nearby.radius_m, 500);
  const fresh = await post('Cari secondary rumah dekat sekolah budget 500 juta luas tanah bebas', randomUUID());
  assert.equal(fresh.knowledge.status, 'qualifying'); assert.match(fresh.reply, /kota atau kabupaten mana/);
});

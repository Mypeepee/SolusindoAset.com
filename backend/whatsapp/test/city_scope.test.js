import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { scenarios, simulateCityScope, fixture, cityFilterValues, REPORTED_OPENING, REPORTED_CHOICE } from '../scripts/lib/city-scope-dialogues.js';
import { buyerContext } from '../services/buyer_profile.js';
import { resolveRegion, cityRegencyPair } from '../services/region_directory.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { getPropertyKnowledge } from '../../../src/lib/chatbot/property-knowledge.ts';

for (const scenario of scenarios) test(`city scope: ${scenario.name}`, () => simulateCityScope(scenario));

test('only a complete same-name city/regency pair within one province can be combined', () => {
  const candidates = resolveRegion('Mojokerto').clarification.candidates;
  assert.ok(cityRegencyPair(candidates));
  assert.equal(cityRegencyPair(candidates.slice(0, 1)), null);
  assert.equal(cityRegencyPair([...candidates, candidates[0]]), null);
  assert.equal(cityRegencyPair([candidates[0], { ...candidates[1], province: 'Jawa Barat' }]), null);
  assert.equal(cityRegencyPair([candidates[0], { ...candidates[1], name: 'Kota Malang' }]), null);
  assert.equal(cityRegencyPair(resolveRegion('Kecamatan Taman').clarification.candidates), null);
});

test('the reported reply acknowledges both regions and budget, then asks only for land bounds', async () => {
  const f = fixture(), history = [{ role: 'user', content: REPORTED_OPENING }];
  const opening = await generatePropertyReply({ ...f, text: REPORTED_OPENING, history });
  history.push({ role: 'assistant', content: opening.reply }, { role: 'user', content: REPORTED_CHOICE });
  const result = await generatePropertyReply({ ...f, text: REPORTED_CHOICE, history });
  const buyer = buyerContext(history, REPORTED_CHOICE, null);
  assert.deepEqual(buyer.missing, ['land_area']); assert.equal(buyer.profile.max_price, 50e9);
  assert.equal(buyer.profile.category, 'PABRIK'); assert.equal(buyer.profile.purpose, null);
  assert.match(result.reply, /Kota dan Kabupaten Mojokerto/); assert.match(result.reply, /50\.000\.000\.000/);
  assert.doesNotMatch(result.reply, /memilih kota|kelurahan mana|kecamatan mana|Budget-nya sampai berapa/);
  assert.equal(f.queries.length, 0, 'Wait for the missing land preference');
});

test('database results from both approved regions render together without an ambiguity loop', async () => {
  const f = fixture(), history = [];
  for (const text of [REPORTED_OPENING, REPORTED_CHOICE]) {
    history.push({ role: 'user', content: text }); const result = await generatePropertyReply({ ...f, history, text });
    history.push({ role: 'assistant', content: result.reply });
  }
  const rows = ['Kota Mojokerto', 'Kab. Mojokerto'].map((city, i) => ({ id_property: BigInt(910001 + i), judul: `Pabrik contoh ${i + 1}`,
    jenis_transaksi: 'LELANG', kategori: 'PABRIK', kota: city, provinsi: 'Jawa Timur', harga: 10e9, nilai_limit_lelang: 10e9,
    tanggal_lelang: new Date('2099-01-01T00:00:00Z'), alamat_lengkap: `Jalan Contoh ${i + 1}`, luas_tanah: 2000 }));
  const catalog = { async resolve(text, previousId, criteria) {
    const result = await getPropertyKnowledge({ listingSekitar: { async findUnique() { return null; } },
      listingTempat: { async findMany() { return []; } }, listing: { async findMany(query) {
      const values = cityFilterValues(query);
      assert.ok(values.includes('kota mojokerto')); assert.ok(values.includes('kab. mojokerto'));
      return rows;
    } } }, { text, previousId, criteria });
    return { ...result, catalog: result.candidates };
  } };
  history.push({ role: 'user', content: 'luas tanah bebas' });
  const result = await generatePropertyReply({ catalog, ai: f.ai, history, text: 'luas tanah bebas' });
  assert.equal(result.knowledge.status, 'recommendations');
  assert.match(result.reply, /Kota dan Kabupaten Mojokerto/); assert.match(result.reply, /Kota Mojokerto/); assert.match(result.reply, /Kab\. Mojokerto/);
  assert.doesNotMatch(result.reply, /kota atau kabupaten yang mana/);
});

const NOW = Date.parse('2026-10-12T16:58:00+07:00');
const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
test('live processor keeps factory, budget and the paired scope through follow-up corrections', async () => {
  const f = fixture(), store = new MemoryStore(config, () => NOW), sent = [], phone = '6281234567890';
  const processor = new MessageProcessor({ ...f, store, config, now: () => NOW,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'simulated'; } }, logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  for (const text of [REPORTED_OPENING, REPORTED_CHOICE, 'minimal 1000 m2', 'budget 40 miliar', 'kotanya aja pak']) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: NOW }]); await processor.drain();
  }
  assert.equal(sent.length, 5); assert.match(sent[1], /Kota dan Kabupaten Mojokerto/);
  assert.equal(store.get(phone).is_bot_active, true);
  assert.equal(f.criteria.at(-1).city, 'Kota Mojokerto'); assert.equal(f.criteria.at(-1).category, 'PABRIK');
  assert.equal(f.criteria.at(-1).max_price, 40e9); assert.equal(f.criteria.at(-1).min_land_area_m2, 1000);
  assert.ok(!cityFilterValues(f.queries.at(-1)).includes('kab. mojokerto'));
});

test('Playground stores the paired choice per conversation and resets it for a new conversation', async (t) => {
  const f = fixture(), app = express(), token = 'x'.repeat(40), conversationId = randomUUID();
  app.use('/sandbox', createSandboxRouter({ ...f, config: { ...config, adminToken: token }, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const post = async (text, id = conversationId) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: id, requestId: randomUUID(), history: [{ role: 'user', content: text }] }) });
    assert.equal(response.status, 200); return response.json();
  };
  await post(REPORTED_OPENING);
  assert.match((await post(REPORTED_CHOICE)).reply, /Kota dan Kabupaten Mojokerto/);
  assert.equal((await post('luas tanah bebas')).knowledge.status, 'not_found');
  assert.equal(f.criteria.at(-1).city, 'Mojokerto'); assert.equal(f.criteria.at(-1).max_price, 50e9);
  await post('kabupatennya aja'); assert.equal(f.criteria.at(-1).city, 'Kabupaten Mojokerto');
  const fresh = await post(REPORTED_OPENING, randomUUID());
  assert.match(fresh.reply, /kota atau kabupaten yang mana/); assert.equal(fresh.knowledge.status, 'qualifying');
});

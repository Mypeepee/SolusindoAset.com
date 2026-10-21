import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { scenarios, simulateDetailAlternatives, detailFixture, OPENING, REPORTED_SELECTION, REPORTED_ALTERNATIVE, REPORTED_IDS, NOW } from '../scripts/lib/detail-alternatives-dialogues.js';
import { generatePropertyReply, resolvePropertyContext } from '../services/property_reply.js';
import { recommendationIds } from '../services/recommendations.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';

for (const scenario of scenarios) test(`detail alternatives: ${scenario.name}`, () => simulateDetailAlternatives(scenario));

test('a bare budget answer remains part of qualification before selecting a detail', async () => {
  const f = detailFixture(), history = [];
  let previousId = null, last;
  for (const text of ['Cari lelang rumah di Surabaya Barat', '1500000000', 'luas tanah bebas', REPORTED_SELECTION, REPORTED_ALTERNATIVE]) {
    history.push({ role: 'user', content: text });
    last = await generatePropertyReply({ ...f, history, text, previousId });
    history.push({ role: 'assistant', content: last.reply }); previousId = last.asset?.id || null;
  }
  assert.equal(last.knowledge.status, 'recommendations');
  assert.equal(f.criteria.at(-1).max_price, 1500e6);
});

test('an unrelated explicit code cannot inherit the old search budget or region', async () => {
  const f = detailFixture(), history = [{ role: 'user', content: OPENING }];
  const first = await generatePropertyReply({ ...f, text: OPENING, history });
  history.push({ role: 'assistant', content: first.reply }, { role: 'user', content: 'Kode 981001' });
  const standalone = await generatePropertyReply({ ...f, text: 'Kode 981001', history });
  history.push({ role: 'assistant', content: standalone.reply });
  const context = await resolvePropertyContext(f.catalog, REPORTED_ALTERNATIVE, '981001', history, NOW);
  assert.equal(context.buyer.profile.city, 'Kota Malang');
  assert.equal(context.buyer.profile.region_group, undefined);
  assert.equal(context.buyer.profile.max_price, null);
  assert.ok(context.buyer.missing.includes('max_price')); assert.ok(context.buyer.missing.includes('land_area'));
});

test('an unavailable selected asset does not discard an independently qualified search', async () => {
  const f = detailFixture(), history = [{ role: 'user', content: OPENING }];
  const first = await generatePropertyReply({ ...f, text: OPENING, history });
  history.push({ role: 'assistant', content: first.reply }, { role: 'user', content: REPORTED_SELECTION });
  const detail = await generatePropertyReply({ ...f, text: REPORTED_SELECTION, history });
  history.push({ role: 'assistant', content: detail.reply });
  const catalog = { async resolve(text, id, criteria) {
    if (!criteria) return { asset: null, catalog: [], status: 'not_found' };
    return f.catalog.resolve(text, id, criteria);
  } };
  const result = await generatePropertyReply({ ...f, catalog, history, text: REPORTED_ALTERNATIVE, previousId: detail.asset.id });
  assert.equal(result.knowledge.status, 'recommendations');
  assert.equal(f.criteria.at(-1).max_price, 1500e6);
  assert.ok(recommendationIds(result.reply).every((id) => !REPORTED_IDS.includes(id)));
});

const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
test('WhatsApp resumes the qualified search after detail and costs across a six-minute pause', async () => {
  let clock = NOW;
  const f = detailFixture(), store = new MemoryStore(config, () => clock), sent = [], phone = '6281234567890';
  const processor = new MessageProcessor({ ...f, config, store, now: () => clock,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'simulated'; } }, logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  for (const text of [OPENING, REPORTED_SELECTION, 'Harga itu sudah all in?', REPORTED_ALTERNATIVE]) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: clock }]); await processor.drain(); clock += 6 * 60000;
  }
  assert.match(sent[1], /DETAIL ASET.*116568/); assert.match(sent[2], /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.equal(recommendationIds(sent.at(-1)).length, 5);
  assert.ok(recommendationIds(sent.at(-1)).every((id) => !REPORTED_IDS.includes(id)));
  assert.doesNotMatch(sent.at(-1), /Budget-nya sampai berapa|luas tanah minimal atau maksimal|kelurahan mana/i);
  assert.equal(f.criteria.at(-1).max_price, 1500e6); assert.equal(f.criteria.at(-1).region_group, 'barat');
  assert.equal(store.get(phone).is_bot_active, true);
});

test('Playground carries the same criteria from list to detail and back when only the latest message is posted', async (t) => {
  const f = detailFixture(), app = express(), token = 'x'.repeat(40), conversationId = randomUUID();
  app.use('/sandbox', createSandboxRouter({ ...f, config: { ...config, adminToken: token }, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const post = async (text) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [{ role: 'user', content: text }] }) });
    assert.equal(res.status, 200); return res.json();
  };
  const first = await post(OPENING); assert.equal(first.knowledge.status, 'recommendations');
  const detail = await post(REPORTED_SELECTION); assert.match(detail.reply, /DETAIL ASET.*116568/);
  const alternatives = await post(REPORTED_ALTERNATIVE);
  assert.equal(alternatives.knowledge.status, 'recommendations');
  assert.match(alternatives.reply, /lanjutkan pencarian.*Surabaya Barat.*1\.500\.000\.000/);
  assert.ok(recommendationIds(alternatives.reply).every((id) => !REPORTED_IDS.includes(id)));
  assert.equal(f.criteria.at(-1).max_price, 1500e6); assert.equal(f.criteria.at(-1).region_group, 'barat');
  assert.doesNotMatch(alternatives.reply, /Budget-nya sampai berapa|luas tanah minimal atau maksimal|kelurahan mana/i);
});

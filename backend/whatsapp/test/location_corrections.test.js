import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { resolveRegion, resolvePendingRegionChoice } from '../services/region_directory.js';
import { buyerContext } from '../services/buyer_profile.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';

const opening = ['siang', 'saya jason dari surabaya', 'saya tertarik beli aset di area banyu urip pak'];
const correction = 'bukan, banyu urip di surabaya';
const scenarios = [
  { name: 'Jason', opening, correction },
  { name: 'Fikri', opening: ['siang', 'saya fikri', 'saya cari aset di banyuurip pak'], correction: 'bukan, di surabaya pak' },
];
const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 20,
  maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const noAi = {
  generate() { assert.fail('Location corrections must work without AI'); },
  interpretBuyer() { assert.fail('Known locations must not need AI interpretation'); },
};
const noLocationQuestion = /Incar daerah mana|kelurahan mana|kecamatan mana|kota atau kabupaten mana/i;

function assertLocation(profile) {
  assert.equal(profile.city.toLowerCase(), 'surabaya');
  assert.equal(profile.province, 'Jawa Timur');
  assert.equal(profile.district, 'Sawahan');
  assert.equal(profile.village.toLowerCase().replace(/\s/g, ''), 'banyuurip');
}

test('Banyu Urip stays ambiguous across district and village candidates', () => {
  const region = resolveRegion('Banyu Urip');
  assert.equal(region.city, null);
  assert.ok(region.clarification);
  assert.equal(resolvePendingRegionChoice('Surabaya', { pending: region.clarification }).city, 'Surabaya');
});

test('an explicit city resolves an unlabelled name across district and village levels', () => {
  for (const [text, scope] of [
    ['Banyu Urip di Surabaya', {}],
    ['Banyuurip di Surabaya', { city: 'Purworejo', province: 'Jawa Tengah' }],
    ['Banyu Urip', { city: 'Surabaya', province: 'Jawa Timur' }],
  ]) {
    const region = resolveRegion(text, scope);
    assert.equal(region.clarification, null, text);
    assertLocation(region);
  }
  const pakis = resolveRegion('Pakis', { city: 'Surabaya' });
  assert.equal(pakis.district, 'Sawahan');
  assert.equal(pakis.village, 'Pakis');
});

test('an explicit conflicting administrative level is still clarified', () => {
  const region = resolveRegion('Kecamatan Banyu Urip di Surabaya');
  assert.equal(region.clarification.kind, 'conflict');
  assert.equal(region.clarification.level, 'district');
  assert.equal(region.village, null);
});

test('the reported correction retains the complete location through transaction, budget and type answers', async () => {
  for (const answer of [correction, 'Banyu Urip di Surabaya pak', 'ralat, Banyu Urip di Surabaya',
    'maksud saya Banyu Urip di Surabaya', 'bukan di Purworejo, tapi Banyu Urip di Surabaya', 'bukan, di Surabaya']) {
    const history = [], queries = [];
    const catalog = { async resolve(_text, _id, criteria) {
      queries.push(structuredClone(criteria));
      return { status: 'not_found', asset: null, catalog: [] };
    } };
    for (const [index, text] of [...opening, answer, 'kecuali sewa pak', 'budget 500 juta', 'rumah, luas tanah bebas'].entries()) {
      const result = await generatePropertyReply({ text, history, catalog, ai: noAi });
      const buyer = buyerContext(history, text, null);
      assert.equal(typeof result.reply, 'string', text);
      if (index >= opening.length) {
        assertLocation(buyer.profile);
        assert.ok(!buyer.missing.some((field) => ['city', 'location', 'region'].includes(field)), text);
        assert.doesNotMatch(result.reply, noLocationQuestion, text);
      }
      if (index === opening.length) assert.match(result.reply, /Banyu Urip.*Surabaya/i, text);
      if (index === opening.length + 1) {
        assert.deepEqual(buyer.profile.transaction_types, ['LELANG', 'PRIMARY', 'SECONDARY']);
        assert.match(result.reply, /[Bb]udget/);
      }
      history.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply });
    }
    assert.equal(queries.length, 1, answer);
    assertLocation(queries[0]);
    assert.equal(queries[0].max_price, 500000000);
    assert.equal(queries[0].category, 'RUMAH');
  }
});

for (const scenario of scenarios) test(`WhatsApp keeps ${scenario.name}'s corrected location when earlier messages leave the chat history`, async () => {
  const store = new MemoryStore(config), phone = '6280000000081', replies = [], queries = [];
  const processor = new MessageProcessor({ config, store, ai: noAi,
    catalog: { async resolve(_text, _id, criteria) {
      queries.push(structuredClone(criteria)); return { status: 'not_found', asset: null, catalog: [] };
    } },
    whatsapp: { async sendText(_phone, text) { replies.push(text); return 'mock'; } },
    logger: { error(error) { assert.fail(JSON.stringify(error)); } },
  });
  for (const [index, text] of [...scenario.opening, scenario.correction, 'kecuali sewa pak', 'budget 500 juta', 'rumah, luas tanah bebas'].entries()) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: Date.now() }]);
    await processor.drain();
    assert.equal(replies.length, index + 1, text);
    const session = store.get(phone);
    if (index >= scenario.opening.length) {
      assertLocation(session.buyer_state.profile);
      assert.doesNotMatch(replies.at(-1), noLocationQuestion);
    }
    session.history = session.history.slice(-2);
  }
  assert.equal(queries.length, 1);
  assertLocation(queries[0]);
  assert.equal(queries[0].max_price, 500000000);
});

test('the original conversation with the old Purworejo reply recovers without asking for the area again', async () => {
  const transactionQuestion = 'Mau beli atau sewa? Pilihannya lelang, primary (baru dari developer), secondary, atau sewa. Boleh pilih beberapa atau jawab “bebas” untuk semua jenis transaksi.';
  const history = [
    { role: 'user', content: opening[1] },
    { role: 'assistant', content: 'Salam kenal, Jason. Lagi cari properti di daerah mana? Kalau sudah ada aset yang diminati, boleh kirim kode atau link-nya ya.' },
    { role: 'user', content: opening[2] },
    { role: 'assistant', content: `Siap, Jason. Saya bantu cari properti di Banyu urip, Purworejo ya.\n\n${transactionQuestion}` },
    { role: 'user', content: correction },
    { role: 'assistant', content: transactionQuestion },
  ];
  const text = 'kecuali sewa pak', buyer = buyerContext(history, text, null);
  assertLocation(buyer.profile);
  const result = await generatePropertyReply({ text, history, ai: noAi,
    catalog: { resolve() { assert.fail('Budget and type must still be collected'); } },
  });
  assert.match(result.reply, /Banyu Urip.*Surabaya/i);
  assert.doesNotMatch(result.reply, noLocationQuestion);
  assert.match(result.reply, /[Bb]udget/);
});

for (const scenario of scenarios) test(`Playground retains ${scenario.name}'s corrected village through its server-owned conversation`, async (t) => {
  const queries = [], conversationId = randomUUID(), token = 'x'.repeat(40), app = express();
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, ai: noAi,
    catalog: { async resolve(_text, _id, criteria) {
      queries.push(structuredClone(criteria)); return { status: 'not_found', asset: null, catalog: [] };
    } },
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  for (const [index, text] of [...scenario.opening, scenario.correction, 'kecuali sewa pak', 'budget 500 juta', 'rumah, luas tanah bebas'].entries()) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [{ role: 'user', content: text }] }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(typeof result.reply, 'string');
    if (index >= scenario.opening.length) assert.doesNotMatch(result.reply, noLocationQuestion);
    if (index === scenario.opening.length) assert.match(result.reply, /Banyu\s*Urip.*Surabaya/i);
  }
  assert.equal(queries.length, 1);
  assertLocation(queries[0]);
  assert.deepEqual(queries[0].transaction_types, ['LELANG', 'PRIMARY', 'SECONDARY']);
});

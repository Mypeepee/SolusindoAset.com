import test from 'node:test';
import assert from 'node:assert/strict';
import { buyerContext } from '../services/buyer_profile.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { getPropertyKnowledge } from '../../../src/lib/chatbot/property-knowledge.ts';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';

const reportedOpening = [
  'selamat siang pak',
  'saya tertarik aset di surabaya pak',
  'saya lebih tertarik lelang sih pak, adakah di daerah tandes pak? budget mentok 350 juta',
  'intinya tandes pak',
];

function conversation() {
  const history = [], queries = [], criteria = [], transcript = [];
  const db = { listing: { async findMany(query) { queries.push(query); return []; } } };
  const catalog = { async resolve(text, previousId, filters) {
    criteria.push(filters);
    return { ...await getPropertyKnowledge(db, { text, previousId, criteria: filters }), catalog: [] };
  } };
  const ai = {
    generate() { assert.fail('Known contextual answers must work without an AI provider'); },
    interpretBuyer() { assert.fail('Known contextual answers must not need model interpretation'); },
  };
  return { history, queries, criteria, transcript, async send(text) {
    const buyer = buyerContext(history, text, null);
    const result = await generatePropertyReply({ text, history, catalog, ai });
    assert.equal(typeof result.reply, 'string', text);
    history.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply });
    transcript.push({ user: text, reply: result.reply, profile: buyer.profile, missing: buyer.missing });
    return { buyer, ...result };
  } };
}
async function start(messages = reportedOpening) {
  const c = conversation();
  for (const text of messages) await c.send(text);
  return c;
}
function assertTandes(buyer, message) {
  assert.equal(buyer.profile.city.toLowerCase(), 'surabaya', message);
  assert.equal(buyer.profile.location.toLowerCase(), 'tandes', message);
  assert.equal(buyer.profile.district.toLowerCase(), 'tandes', message);
  assert.equal(buyer.profile.village, null, message);
  assert.equal(buyer.profile.max_price, 350000000, message);
  assert.equal(buyer.profile.transaction_type, 'LELANG', message);
  assert.ok(!buyer.missing.some((field) => ['city', 'location', 'village', 'region'].includes(field)), message);
}

test('reported Tandes dialogue accepts all pending optional preferences and keeps geography on subsequent type refinement', async () => {
  const c = await start();
  const any = await c.send('semua boleh');
  assertTandes(any.buyer);
  assert.deepEqual(any.buyer.missing, []);
  assert.equal(c.criteria.length, 1);
  const types = await c.send('rumah kalau ada tanah gapapa pak');
  assertTandes(types.buyer);
  assert.deepEqual(types.buyer.profile.categories, ['RUMAH', 'TANAH']);
  assert.deepEqual(types.buyer.missing, []);
  assert.doesNotMatch(types.reply, /kelurahan mana|kota atau kabupaten mana|Kalau gapapa/i);
  assert.equal(c.criteria.length, 2);
  const where = c.queries.at(-1).where;
  assert.equal(where.jenis_transaksi, 'LELANG');
  assert.deepEqual(where.kategori, { in: ['RUMAH', 'TANAH'] });
  assert.match(JSON.stringify(where), /tandes/i);
  assert.match(JSON.stringify(where), /350000000/);
});

for (const answer of ['semua boleh', 'semuanya boleh pak', 'semua bebas', 'semuanya bebas kak', 'dua-duanya boleh', 'keduanya bebas pak', 'SEMUA BOLEH PAK']) {
  test(`collective answer resolves only the pending type and land questions: ${answer}`, async () => {
    const c = await start();
    const { buyer } = await c.send(answer);
    assertTandes(buyer, answer);
    assert.deepEqual(buyer.missing, [], answer);
    assert.equal(buyer.profile.category, null);
    assert.equal(c.criteria.length, 1);
  });
}

for (const answer of [
  'rumah kalau ada tanah gapapa pak', 'rumah, kalau ada tanah juga boleh pak',
  'rumah kalo ada tanah gpp', 'rumah atau tanah boleh juga',
  'cari rumah sama tanah dulu deh', 'kalau ada rumah atau tanah saya tertarik',
  'RUMAH KALAU ADA TANAH GAPAPA PAK',
]) {
  test(`type availability language cannot invent a new location or a land-size choice: ${answer}`, async () => {
    const c = await start();
    const { buyer, reply } = await c.send(answer);
    assertTandes(buyer, answer);
    assert.deepEqual(buyer.profile.categories, ['RUMAH', 'TANAH'], answer);
    assert.deepEqual(buyer.missing, ['land_area'], answer);
    assert.equal(c.criteria.length, 0);
    assert.doesNotMatch(reply, /kelurahan mana|kota atau kabupaten mana/i);
    const ready = await c.send('semua boleh pak');
    assertTandes(ready.buyer);
    assert.deepEqual(ready.buyer.profile.categories, ['RUMAH', 'TANAH']);
    assert.deepEqual(ready.buyer.missing, []);
    assert.equal(c.criteria.length, 1);
  });
}

test('a bare bebas answers the first question, while semua boleh answers both; clauses retain explicit corrections', async () => {
  const c = await start();
  const first = await c.send('bebas pak');
  assertTandes(first.buyer);
  assert.deepEqual(first.buyer.missing, ['land_area']);
  const d = await start();
  const all = await d.send('semua boleh, budget jadi 300 juta');
  assert.equal(all.buyer.profile.district.toLowerCase(), 'tandes');
  assert.equal(all.buyer.profile.max_price, 300000000);
  assert.deepEqual(all.buyer.missing, []);
});

test('type-only unrestricted answers preserve established land bounds', async () => {
  const c = await start(['Cari lelang aset di seluruh Kecamatan Tandes, Surabaya budget 350 juta luas tanah minimal 90 m2']);
  const { buyer } = await c.send('semua boleh pak');
  assertTandes(buyer);
  assert.equal(buyer.profile.category, null);
  assert.equal(buyer.profile.min_land_area_m2, 90);
  assert.deepEqual(buyer.missing, []);
});

test('uncertainty, negation and questions never broaden type or land filters', () => {
  const history = [{ role: 'user', content: 'Cari lelang rumah di seluruh Kecamatan Tandes, Surabaya budget 350 juta luas tanah minimal 90 m2' },
    { role: 'assistant', content: 'Jenis properti apa yang dicari? Ada patokan luas tanah minimal atau maksimal?' }];
  for (const text of ['nggak semua boleh', 'semua boleh?', 'jangan semuanya bebas', 'belum tentu semua boleh']) {
    const buyer = buyerContext(history, text, null);
    assertTandes(buyer, text);
    assert.equal(buyer.profile.category, 'RUMAH', text);
    assert.equal(buyer.profile.min_land_area_m2, 90, text);
  }
});

test('genuine explicit and known implicit geographic changes remain possible in a type answer', async () => {
  for (const answer of ['rumah atau tanah di Manukan Wetan pak', 'cari rumah atau tanah Manukan Wetan pak']) {
    const c = await start();
    const { buyer } = await c.send(answer);
    assert.equal(buyer.profile.village, 'Manukan Wetan', answer);
    assert.equal(buyer.profile.district, 'Tandes', answer);
    assert.equal(buyer.profile.max_price, 350000000, answer);
    assert.deepEqual(buyer.profile.categories, ['RUMAH', 'TANAH'], answer);
    assert.deepEqual(buyer.missing, ['land_area'], answer);
  }
  const c = await start();
  const { buyer } = await c.send('cari rumah di Citraland pak');
  assert.equal(buyer.profile.location, 'Citraland');
  assert.equal(buyer.profile.city.toLowerCase(), 'surabaya');
});

test('collective optional answers preserve auction refusal and an existing narrower village', async () => {
  const c = await start(['Cari aset non lelang di Kelurahan Manukan Kulon, Tandes, Surabaya budget 350 juta']);
  const { buyer } = await c.send('semua boleh');
  assert.deepEqual(buyer.profile.transaction_types, ['PRIMARY', 'SECONDARY']);
  assert.equal(buyer.profile.village, 'Manukan Kulon');
  assert.equal(buyer.profile.max_price, 350000000);
  assert.deepEqual(buyer.missing, ['land_area']);
  assert.deepEqual((await c.send('luas tanah bebas')).buyer.missing, []);
});

test('ordinary property descriptions cannot become a place just because a village shares the word', async () => {
  for (const text of ['cari rumah bagus', 'cari rumah yang bagus', 'cari rumah murah', 'cari rumah nyaman']) {
    const c = await start();
    const { buyer } = await c.send(text);
    assertTandes(buyer, text);
    assert.equal(buyer.profile.category, 'RUMAH');
    assert.deepEqual(buyer.missing, ['land_area']);
  }
});

test('old conversation with an erroneous area reply is rebuilt from the original user preferences', () => {
  const messages = [
    ['saya tertarik aset di surabaya pak', 'Mau beli atau sewa? Kalau beli, lebih tertarik lelang, primary, atau secondary?'],
    [reportedOpening[2], 'Di kelurahan mana? Kalau fleksibel, seluruh kawasan Tandes juga boleh.'],
    ['intinya tandes pak', 'Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Ada patokan luas tanah minimal atau maksimal?'],
    ['semua boleh', 'Saya belum menangkap bagian jenis propertinya. Jenis properti apa yang dicari, rumah, ruko, atau yang lain?'],
    ['rumah kalau ada tanah gapapa pak', 'Oke, kita cari rumah atau tanah lelang di Kalau gapapa, Surabaya. Di kelurahan mana?'],
  ];
  const history = messages.flatMap(([user, assistant]) => [{ role: 'user', content: user }, { role: 'assistant', content: assistant }]);
  const buyer = buyerContext(history, 'intinya tandes pak', null);
  assertTandes(buyer);
  assert.deepEqual(buyer.profile.categories, ['RUMAH', 'TANAH']);
  assert.deepEqual(buyer.missing, []);
});

const config = { transport: 'baileys', maxSessions: 100, maxPending: 100, maxPendingPerPhone: 10, maxDedup: 1000, sessionTtlMs: 86400000 };
const noAi = { generate() { assert.fail('Contextual qualification must work without AI'); } };
const reportedMessages = [...reportedOpening, 'semua boleh', 'rumah kalau ada tanah gapapa pak'];
function transportCatalog() {
  const queries = [];
  return { queries, async resolve(_text, _previousId, criteria) {
    queries.push(criteria);
    return { status: 'not_found', asset: null, catalog: [], source: 'simulation' };
  } };
}
function assertTransportQueries(queries) {
  assert.equal(queries.length, 2);
  for (const profile of queries) assertTandes({ profile, missing: [] });
  assert.equal(queries[0].category, null);
  assert.deepEqual(queries[1].categories, ['RUMAH', 'TANAH']);
}
test('WhatsApp message processing preserves Tandes through the exact reported conversation', async () => {
  const catalog = transportCatalog(), sent = [], store = new MemoryStore(config);
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'mock'; } },
    logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const text of reportedMessages) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: '628123456789', timestamp: Date.now() }]);
    await processor.drain();
  }
  assert.equal(sent.length, reportedMessages.length);
  assertTransportQueries(catalog.queries);
  assert.doesNotMatch(sent.at(-1), /kelurahan mana|Kalau gapapa|belum menangkap/i);
});
test('Playground server-owned history preserves Tandes through the exact reported conversation', async (t) => {
  const catalog = transportCatalog(), token = 'x'.repeat(40), app = express();
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  for (const text of reportedMessages) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [{ role: 'user', content: text }] }) });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.suppressed, false);
    assert.equal(typeof result.reply, 'string');
    if (text === reportedMessages.at(-1)) assert.doesNotMatch(result.reply, /kelurahan mana|Kalau gapapa|belum menangkap/i);
  }
  assertTransportQueries(catalog.queries);
});

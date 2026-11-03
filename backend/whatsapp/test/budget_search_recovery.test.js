import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { advancedFixture, row } from '../scripts/lib/advanced-search-dialogues.js';
import { generatePropertyReply, resolvePropertyContext } from '../services/property_reply.js';
import { recommendationIds } from '../services/recommendations.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';

const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 20,
  maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const reported = ['siang', 'saya jason', 'mau cari rumah', 'surabaya, lelang pak', 'timur', '100000000', 'bebas'];
const complete = 'Cari rumah lelang di Surabaya Timur budget 100 juta luas tanah bebas';
const user = content => ({ role: 'user', content });
const assistant = content => ({ role: 'assistant', content });

function fixture() {
  const auction = (id, price, extra = {}) => row(id, { jenis_transaksi: 'LELANG', kecamatan: 'Rungkut',
    kelurahan: 'Medokan Ayu', harga: price, harga_efektif: price, nilai_limit_lelang: price,
    tanggal_lelang: new Date('2026-11-01T03:00:00Z'), ...extra });
  return advancedFixture({ inventory: [auction(812345, 250e6), auction(812346, 300e6), auction(812347, 450e6),
    auction(812348, 300e6 + 1), auction(812349, 200e6, { kota: 'Malang' }),
    auction(812350, 200e6, { kecamatan: 'Tandes' }), auction(812351, 200e6, { kategori: 'TANAH' }),
    auction(812352, 200e6, { status_tayang: 'TERJUAL' }), auction(812353, 200e6, { bukan_properti: true }),
    auction(812354, 200e6, { jenis_transaksi: 'SECONDARY' }),
    // An accidental lookup of this ID would also bypass city, price and type.
    auction(300000000, 900e6, { kota: 'Malang', kategori: 'RUKO' })] });
}

async function chat(f, texts) {
  const history = [], results = [];
  let preferenceState = null;
  for (const text of texts) {
    history.push(user(text));
    const result = await generatePropertyReply({ ...f, text, history });
    preferenceState = result.buyer_state;
    history.push(assistant(result.reply)); results.push(result);
  }
  return { results, history, preferenceState };
}

function assertScope(criteria, max) {
  assert.equal(criteria.city, 'Surabaya'); assert.equal(criteria.region_group, 'timur');
  assert.equal(criteria.category, 'RUMAH'); assert.equal(criteria.transaction_type, 'LELANG');
  assert.equal(criteria.max_price, max); assert.equal(criteria.min_land_area_m2, null);
  assert.equal(criteria.max_land_area_m2, null);
}

test('reported conversation searches real predicates again at 300 million, then 500 million after cards', async () => {
  const f = fixture();
  const { results } = await chat(f, [...reported, '300000000', '500000000', '200000000']);
  assert.match(results[6].reply, /Belum ketemu.*100\.000\.000/);
  assert.deepEqual(recommendationIds(results[7].reply), ['812345', '812346']);
  assert.deepEqual(recommendationIds(results[8].reply), ['812345', '812346', '812347', '812348']);
  assert.match(results[9].reply, /Belum ketemu.*200\.000\.000/);
  assert.equal(f.criteria.length, 4);
  [100e6, 300e6, 500e6, 200e6].forEach((max, i) => assertScope(f.criteria[i], max));
  assert.ok(f.queries.every(query => !query.where.id_property?.in), 'budget answers must never become ID lookups');
});

for (const amount of ['300000000', '300.000.000', '300,000,000', 'Rp300000000', '300 juta', '300jt',
  '300 jt pak', 'tiga ratus juta', '300', 'naik jadi 300', 'coba 300', 'budget jadi 300 juta',
  '300.000.000,00', '300,000,000.00', 'budget bukan 100 juta, 300 juta saja']) {
  test(`empty search recovers with the same filters: ${amount}`, async () => {
    const f = fixture(), { results } = await chat(f, [complete, amount]);
    assert.deepEqual(recommendationIds(results.at(-1).reply), ['812345', '812346']);
    assertScope(f.criteria.at(-1), 300e6);
  });
}

test('rejected or undecided budgets never raise the ceiling or search until clarified', async () => {
  for (const text of ['budget tidak jadi 500 juta', 'jangan 500 juta', 'budget 300/500 juta', 'budget 300 juta atau 500 juta', 'tambah 100 juta']) {
    const f = fixture(), { results } = await chat(f, [complete, text, 'budget maksimal 300 juta']);
    assert.match(results[1].reply, /Batas budget.*berapa/); assert.equal(results[1].buyer_state.profile.max_price, 100e6);
    assert.equal(f.criteria.length, 2, text);
    assert.deepEqual(recommendationIds(results[2].reply), ['812345', '812346']);
  }
});

test('budget edits after cards accept explicit rupiah, absolute corrections and mixed English monetary units', async () => {
  for (const text of ['Rp500000000', 'IDR 500000000', '500 juta', 'naik jadi 500', 'coba 500', '500 million', 'budget 0.5 billion']) {
    const f = fixture(), { results } = await chat(f, [complete, '300000000', text]);
    assert.equal(recommendationIds(results.at(-1).reply).length, 4, text);
    assertScope(f.criteria.at(-1), 500e6);
  }
});

test('structured search numbers cannot select a colliding ID; labelled codes and bare codes outside search still work', async () => {
  const f = fixture();
  const criteria = { location: 'Surabaya Timur', city: 'Surabaya', region_group: 'timur',
    transaction_type: 'LELANG', category: 'RUMAH', max_price: 300e6 };
  for (const text of ['300000000', '100', '72']) {
    const result = await f.catalog.resolve(text, '300000000', criteria);
    assert.equal(result.asset, null);
    assert.deepEqual(result.catalog.map(asset => asset.id), ['812345', '812346']);
  }
  for (const text of ['Kode 300000000', 'https://solusindoaset.com/Lelang/properti-300000000']) {
    const result = await f.catalog.resolve(text, null, criteria);
    assert.equal(result.asset.id, '300000000');
  }
  assert.equal((await f.catalog.resolve('812345')).asset.id, '812345');
});

test('matching old or undated auctions explain the website discrepancy and keep accepting budget updates', async () => {
  for (const date of [new Date('2026-04-01T00:00:00Z'), null]) {
    const f = advancedFixture({ inventory: [row(812345, { jenis_transaksi: 'LELANG', kecamatan: 'Rungkut',
      nilai_limit_lelang: 250e6, harga: 250e6, harga_efektif: 250e6, tanggal_lelang: date })] });
    const { results, history } = await chat(f, [complete, '300000000', '500000000']);
    assert.match(results[0].reply, /Belum ketemu/);
    for (const result of results.slice(1)) {
      assert.match(result.reply, /Ada listing.*masih tayang di situs/);
      assert.match(result.reply, /lebih dari satu bulan atau belum tercatat/);
      assert.doesNotMatch(result.reply, /Belum ketemu/); assert.deepEqual(recommendationIds(result.reply), []);
    }
    assertScope(f.criteria.at(-1), 500e6);
    const reads = f.queries.length;
    const consent = await generatePropertyReply({ ...f, text: 'boleh', history: [...history, user('boleh')] });
    assert.match(consent.reply, /kirim kode atau tautan/); assert.equal(f.queries.length, reads);
    assert.equal(consent.buyer_state.profile.max_price, 500e6);
    const explicit = await f.catalog.resolve('Kode 812345');
    assert.equal(explicit.asset.id, '812345', 'the buyer can still inspect a specific old website listing');
  }
});

test('schedule diagnostics keep every public search constraint and never loosen an explicit future-only search', async () => {
  const old = { jenis_transaksi: 'LELANG', kecamatan: 'Rungkut', nilai_limit_lelang: 250e6,
    harga: 250e6, harga_efektif: 250e6, tanggal_lelang: new Date('2026-04-01T00:00:00Z') };
  const f = advancedFixture({ inventory: [row(1, { ...old, kota: 'Malang' }), row(2, { ...old, kecamatan: 'Tandes' }),
    row(3, { ...old, kategori: 'TANAH' }), row(4, { ...old, status_tayang: 'TERJUAL' }),
    row(5, { ...old, bukan_properti: true }), row(6, { ...old, nilai_limit_lelang: 300e6 + 1 })] });
  const { results } = await chat(f, [complete, '300000000']);
  assert.match(results.at(-1).reply, /Belum ketemu/); assert.doesNotMatch(results.at(-1).reply, /Ada listing/);
  const criteria = { location: 'Surabaya Timur', city: 'Surabaya', region_group: 'timur',
    transaction_type: 'LELANG', category: 'RUMAH', max_price: 300e6, upcoming_auction_only: true };
  const future = await f.catalog.resolve('300000000', null, criteria);
  assert.equal(future.status, 'not_found'); assert.equal(future.diagnostics, undefined);
});

test('card selection and an explicit unrelated code still select fresh details after a budget correction', async () => {
  for (const [text, expected] of [['2', '812346'], ['yang pertama', '812345'], ['Kode 300000000', '300000000']]) {
    const f = fixture(), { history } = await chat(f, [complete, '300000000']);
    const context = await resolvePropertyContext(f.catalog, text, null, history, f.now);
    assert.equal(context.asset.id, expected); assert.equal(context.status, 'matched');
  }
});

test('WhatsApp preserves budget recovery through bounded history and synchronizes the same preferences to CRM', async () => {
  const f = fixture(), store = new MemoryStore(config, () => f.now), sent = [], captures = [], phone = '6280000000001';
  const processor = new MessageProcessor({ ...f, now: () => f.now, config, store,
    clients: { setName() {}, enqueue(value) { captures.push(value); }, async flush() {} },
    whatsapp: { async sendText(_phone, text) { sent.push(text); return randomUUID(); } },
    logger: { error(error) { assert.fail(error.event); } } });
  const send = async text => {
    processor.acceptBatch([{ id: randomUUID(), type: 'text', from: phone, text, timestamp: f.now }]); await processor.drain();
  };
  for (const text of reported) await send(text);
  store.get(phone).history = store.get(phone).history.slice(-2);
  await send('300000000');
  assert.deepEqual(recommendationIds(sent.at(-1)), ['812345', '812346']);
  assertScope(store.get(phone).buyer_state.profile, 300e6); assertScope(captures.at(-1).criteria, 300e6);
  await send('500000000');
  assert.equal(recommendationIds(sent.at(-1)).length, 4);
  assertScope(captures.at(-1).criteria, 500e6);
  assert.equal(store.get(phone).is_bot_active, true);
});

test('Playground runs the reported empty-result and budget-correction path through the actual database planner', async t => {
  const f = fixture(), app = express(), token = 'x'.repeat(40), conversationId = randomUUID(), replies = [];
  app.use('/sandbox', createSandboxRouter({ ...f, now: () => f.now, config: { ...config, adminToken: token } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  for (const text of [...reported, '300000000', '500000000']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }),
    });
    assert.equal(response.status, 200); const data = await response.json(); replies.push(data.reply);
    assert.equal(data.session.is_bot_active, true); assert.equal(data.generation.mode, 'rules');
  }
  assert.deepEqual(recommendationIds(replies.at(-2)), ['812345', '812346']);
  assert.equal(recommendationIds(replies.at(-1)).length, 4);
  assertScope(f.criteria.at(-1), 500e6);
});

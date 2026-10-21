import test from 'node:test';
import assert from 'node:assert/strict';
import { transactionPreference, transactionValues } from '../services/property_transaction.js';
import { buyerContext } from '../services/buyer_profile.js';
import { searchReply } from '../services/search_reply.js';
import { resolvePropertyContext, generatePropertyReply } from '../services/property_reply.js';
import { isBuyerCriteria, getPropertyKnowledge, planPropertyLookup } from '../../../src/lib/chatbot/property-knowledge.ts';
import { transactionScenarios, runTransactionScenario, transactionUtterances } from '../scripts/lib/transaction-dialogues.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { CONTEXT_REQUIRED_MESSAGE } from '../services/interaction_policy.js';
import { INTRODUCTION_MESSAGE } from '../services/client_identity.js';

for (const [text, expected] of transactionUtterances) test(`transaction language: ${text}`, () => {
  assert.deepEqual(transactionPreference(text)?.values.slice().sort(), [...expected].sort());
});
test('daily language simulations enforce transaction choices in actual database predicates and recommendation cards', async () => {
  const failures = [];
  for (const scenario of transactionScenarios()) {
    const result = await runTransactionScenario(scenario);
    if (!result.passed) failures.push(`${result.name}: ${result.error}`);
  }
  assert.deepEqual(failures, []);
});

function conversation() {
  const history = [];
  return { history, send(text) {
    const buyer = buyerContext(history, text, null);
    const reply = searchReply({ buyer, status: buyer.stage === 'recommendations' ? 'not_found' : 'qualifying' });
    history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
    return { buyer, reply };
  } };
}
test('unknown transaction is asked before querying and vague condition/budget never implies auction consent', async () => {
  const catalog = { resolve() { assert.fail('Must qualify transaction before querying'); } };
  const result = await generatePropertyReply({ catalog, text: 'selamat siang pak, saya sedang cari aset property di surabaya', history: [] });
  assert.match(result.reply, /Surabaya/); assert.match(result.reply, /beli atau sewa/);
  for (const message of ['rumah siap huni', 'yang murah saja', 'belum tahu pak', 'rumah baru renovasi', 'lelang itu apa?', 'mungkin lelang', 'saya baru cari rumah']) {
    const c = conversation(); c.send('Cari rumah di seluruh Surabaya, budget 500 juta, luas tanah bebas');
    const { buyer } = c.send(message);
    assert.equal(buyer.stage, 'qualifying', message); assert.deepEqual(transactionValues(buyer.profile), [], message);
  }
});
test('questions about transaction definitions preserve filters and an explicit trailing answer still updates them', () => {
  const c = conversation(); c.send('Cari rumah secondary di seluruh Surabaya, budget 500 juta, luas tanah bebas');
  const { buyer, reply } = c.send('apa bedanya lelang dan primary?');
  assert.equal(buyer.profile.transaction_type, 'SECONDARY'); assert.match(reply, /developer/);
  assert.equal(c.send('primary itu apa? saya pilih primary aja').buyer.profile.transaction_type, 'PRIMARY');
});
test('auction refusal persists through location and budget corrections; affirmative changes are explicit', () => {
  const c = conversation(); c.send('Cari rumah di seluruh Surabaya, budget 500 juta, luas tanah bebas, jangan lelang');
  c.send('budget jadi 600 juta'); c.send('ganti ke Sidoarjo');
  assert.deepEqual(transactionValues(c.send('transaksi bebas').buyer.profile), ['PRIMARY', 'SECONDARY', 'SEWA']);
  assert.equal(c.send('sekarang lelang boleh').buyer.profile.transaction_type, 'LELANG');
});
test('switching between rent and purchase clears incompatible budget and asks rental period', () => {
  const c = conversation(); c.send('Cari rumah primary di seluruh Surabaya, budget 500 juta, luas tanah bebas');
  let result = c.send('maunya sewa aja');
  assert.equal(result.buyer.profile.max_price, null); assert.ok(result.buyer.missing.includes('rental_period'));
  result = c.send('budget 3 juta per bulan');
  assert.equal(result.buyer.stage, 'recommendations'); assert.equal(result.buyer.profile.rental_period, 'BULANAN');
  result = c.send('jadi pilih secondary');
  assert.equal(result.buyer.profile.max_price, null); assert.equal(result.buyer.profile.rental_period, undefined);
  assert.equal(result.buyer.profile.city, 'Surabaya');
});
test('new rental context cannot inherit purchase budget from a selected listing search', async () => {
  const asset = { id: '900001', transaction_type: 'LELANG', category: 'RUMAH', address: { city: 'Surabaya', district: 'Tandes' } };
  const calls = [];
  const catalog = { async resolve(text, id, criteria) { calls.push(criteria); return criteria ? { status: 'not_found', catalog: [] } : { status: 'matched', asset, catalog: [] }; } };
  const history = [{ role: 'user', content: 'kode 900001' }, { role: 'assistant', content: 'Detail aset lelang.' }];
  const result = await resolvePropertyContext(catalog, 'nggak mau lelang, secondary aja di area tersebut budget 500 juta luas tanah bebas', asset.id, history);
  assert.equal(result.buyer.profile.transaction_type, 'SECONDARY');
  assert.equal(calls.at(-1).transaction_type, 'SECONDARY'); assert.ok(calls.at(-1).exclude_ids.includes(asset.id));
});
test('transaction metadata on the selected listing seeds alternative search instead of forcing auctions', async () => {
  const asset = { id: '900002', transaction_type: 'PRIMARY', category: 'RUMAH', address: { city: 'Surabaya', district: 'Tandes' } };
  const catalog = { async resolve(text, id, criteria) { return criteria ? { status: 'not_found', catalog: [] } : { status: 'matched', asset, catalog: [] }; } };
  const result = await resolvePropertyContext(catalog, 'cari yang lain di area tersebut budget 500 juta luas tanah bebas', asset.id, [{ role: 'user', content: 'kode 900002' }]);
  assert.equal(result.buyer.profile.transaction_type, 'PRIMARY');
});
test('API validates single/multiple transactions and rental periods; structured preferences override rejected raw words', async () => {
  const base = { location: 'Surabaya', city: 'Surabaya', max_price: 500000000 };
  for (const invalid of [{ transaction_types: [] }, { transaction_types: ['LELANG', 'LELANG'] }, { transaction_types: ['INVALID'] },
    { transaction_types: ['PRIMARY'], transaction_type: 'LELANG' }, { transaction_type: 'PRIMARY', rental_period: 'BULANAN' },
    { transaction_type: 'SEWA', rental_period: 'UNKNOWN' }]) assert.equal(isBuyerCriteria({ ...base, ...invalid }), false);
  const calls = [], db = { listing: { async findMany(query) { calls.push(query); return []; } } };
  await getPropertyKnowledge(db, { text: 'nggak mau lelang', criteria: { ...base, transaction_types: ['PRIMARY', 'SECONDARY'] } });
  assert.deepEqual(calls[0].where.jenis_transaksi, { in: ['PRIMARY', 'SECONDARY'] });
  assert.equal(calls.length, 1, 'no auction ranking fallback');
  assert.deepEqual(planPropertyLookup('Cari rumah non-lelang di Surabaya').transactions, ['PRIMARY', 'SECONDARY']);
});
test('rental affordability uses price for the requested period, without comparing purchase capital or a different period', async () => {
  const calls = [], db = { listing: { async findMany(query) { calls.push(query); return []; } } };
  await getPropertyKnowledge(db, { text: 'ngontrak', criteria: { location: 'Surabaya', transaction_type: 'SEWA', rental_period: 'BULANAN', max_price: 3000000 } });
  assert.equal(calls[0].where.jenis_transaksi, 'SEWA');
  assert.ok(calls[0].where.AND.some((filter) => filter.sewaDetail?.is.harga_sewa_bulanan?.lte === 3000000));
});
test('information questions and historical mentions do not switch the search transaction', () => {
  for (const text of ['saya mau tahu harga lelang', 'saya ingin lihat jadwal lelang', 'lelang aman gak?', 'dulu saya pernah sewa', 'harga sewa berapa?']) {
    assert.equal(transactionPreference(text), null, text);
  }
});
test('rental shorthand and period changes never silently reuse a monthly budget for a year', () => {
  const c = conversation(); c.send('Cari rumah sewa di seluruh Surabaya, budget 3jt/bln, luas tanah bebas');
  assert.equal(c.send('luas tetap bebas').buyer.profile.rental_period, 'BULANAN');
  const changed = c.send('tahunan aja');
  assert.equal(changed.buyer.profile.rental_period, 'TAHUNAN'); assert.equal(changed.buyer.profile.max_price, null);
  assert.equal(c.send('30 juta/tahun').buyer.stage, 'recommendations');
});
test('accepting all transactions preserves every choice and clarifies only the rental budget period', () => {
  const c = conversation(); c.send('Cari rumah di seluruh Surabaya, budget 500 juta, luas tanah bebas');
  const all = c.send('semua boleh');
  assert.equal(all.buyer.stage, 'qualifying'); assert.match(all.reply, /Untuk pilihan sewa.*per bulan.*per tahun/);
  assert.deepEqual(transactionValues(all.buyer.profile), ['LELANG', 'PRIMARY', 'SECONDARY', 'SEWA']);
  assert.doesNotMatch(all.reply, /keduanya|beli atau sewa dulu/);
  assert.equal(c.send('per tahun').buyer.stage, 'recommendations');
  const rent = c.send('sewa dulu');
  assert.equal(rent.buyer.profile.transaction_type, 'SEWA');
  assert.equal(rent.buyer.profile.max_price, null);
});
test('the contextual answer yang baru selects primary only when the transaction question is pending', () => {
  assert.equal(transactionPreference('yang baru aja'), null);
  const c = conversation(); c.send('Cari rumah di Surabaya');
  assert.equal(c.send('yang baru aja').buyer.profile.transaction_type, 'PRIMARY');
});

const config = { transport: 'baileys', maxSessions: 100, maxPending: 100, maxPendingPerPhone: 10, maxDedup: 1000, sessionTtlMs: 86400000 };
const noAi = { generate() { assert.fail('Known transaction language must not require external AI'); } };
const auctionInterestAfterGreeting = [
  'saya tertarik beli aset lelang di surabaya pak',
  'saya berminat membeli properti lelang di Surabaya',
  'pak saya pengen beli rumah lelang di Surabaya',
  'saya tertarik beli aset non lelang di Surabaya',
  'saya tertarik beli rumah dari developer di Surabaya',
  'saya mau ngontrak rumah di Surabaya',
];
const liveMessages = ['selamat siang pak, saya sedang cari aset property di surabaya', 'nggak mau lelang',
  'rumah, seluruh Surabaya, budget 800 juta, luas tanah bebas', 'dari developer saja', 'nggak jadi beli, sewa aja', '30 juta/tahun'];
function emptyCatalog() {
  const queries = [];
  return { queries, async resolve(text, id, criteria) { queries.push(criteria); return { status: 'not_found', asset: null, catalog: [], source: 'database_listing_publik' }; } };
}
function checkTransportQueries(queries) {
  assert.equal(queries.length, 3);
  assert.deepEqual(queries[0].transaction_types, ['PRIMARY', 'SECONDARY']);
  assert.equal(queries[1].transaction_type, 'PRIMARY');
  assert.equal(queries[2].transaction_type, 'SEWA'); assert.equal(queries[2].rental_period, 'TAHUNAN');
  assert.equal(queries[2].max_price, 30000000);
  assert.ok(queries.every((query) => query.city.toLowerCase() === 'surabaya'));
}
function assertInterestReply(reply, index) {
  assert.equal(typeof reply, 'string');
  assert.match(reply, /Surabaya/);
  assert.match(reply, /[Ii]ncar daerah mana/);
  assert.match(reply, /[Bb]udget/);
  if (index < 3) assert.match(reply, /(?:aset|properti|rumah) lelang di Surabaya/);
  assert.notEqual(reply, CONTEXT_REQUIRED_MESSAGE);
}
test('a property interest after the greeting always reopens live qualification, including the reported exact sentence', async () => {
  const catalog = emptyCatalog(), sent = [], store = new MemoryStore(config);
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'mock'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const [index, interest] of auctionInterestAfterGreeting.entries()) {
    const phone = `62812345678${index}`;
    for (const text of ['selamat siang pak', interest]) {
      processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: Date.now() }]); await processor.drain();
    }
    assert.equal(sent.length, (index + 1) * 2);
    assert.equal(sent.at(-2), INTRODUCTION_MESSAGE);
    assertInterestReply(sent.at(-1), index);
    assert.equal(store.get(phone).is_bot_active, true);
    assert.equal(store.get(phone).out_of_scope_notified, false);
  }
  assert.deepEqual(catalog.queries, [], 'qualification should need neither inventory nor an AI provider');
});
test('Playground must return an unsuppressed reply when property interest follows the initial greeting', async (t) => {
  const catalog = emptyCatalog(), token = 'x'.repeat(40), app = express();
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  for (const [index, interest] of auctionInterestAfterGreeting.entries()) {
    const conversationId = randomUUID();
    for (const text of ['selamat siang pak', interest]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [{ role: 'user', content: text }] }) });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.suppressed, false, text); assert.equal(result.session.is_bot_active, true);
      if (text === interest) { assert.equal(result.knowledge.status, 'qualifying'); assertInterestReply(result.reply, index); }
    }
  }
  assert.deepEqual(catalog.queries, []);
});
test('live message processing preserves auction refusal and later switches without sending real WhatsApp', async () => {
  const catalog = emptyCatalog(), sent = [], store = new MemoryStore(config), phone = '628123456789';
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'mock'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const text of liveMessages) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: Date.now() }]); await processor.drain();
  }
  checkTransportQueries(catalog.queries); assert.equal(sent.length, liveMessages.length);
  assert.match(sent[0], /beli atau sewa/); assert.equal(store.get(phone).is_bot_active, true);
});
test('Playground applies identical transaction choices using its server-owned conversation', async (t) => {
  const catalog = emptyCatalog(), token = 'x'.repeat(40), app = express();
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  for (const text of liveMessages) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [{ role: 'user', content: text }] }) });
    assert.equal(response.status, 200); assert.ok((await response.json()).reply);
  }
  checkTransportQueries(catalog.queries);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { buyerContext } from '../services/buyer_profile.js';
import { transactionPreference, TRANSACTION_TYPES, TRANSACTION_QUESTION } from '../services/property_transaction.js';
import { searchReply } from '../services/search_reply.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { advancedFixture, row } from '../scripts/lib/advanced-search-dialogues.js';
import { clientPreferenceRows } from '../../../src/lib/chatbot/client-preferences.ts';
import { clientFunnelSummary } from '../../../src/lib/chatbot/client-summary.ts';
import { isBuyerCriteria } from '../../../src/lib/chatbot/property-knowledge.ts';

const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const noAi = { generate() { assert.fail('Clear transaction and budget answers must not need AI'); },
  interpretBuyer() { assert.fail('A unit or rental period is an answer to the pending question'); } };
const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 20, maxPending: 20,
  maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const messages = ['selamat siang pak', 'saya kartini, cari aset di daerah benowo', 'bebas pak',
  'budgetnya 100 - 400 pak', 'juta pak', 'per tahun pak', 'rumah, luas tanah bebas'];
const legacyQuestion = 'Oke, keduanya boleh ya. Mau lihat pilihan beli atau sewa dulu? Budget-nya nanti kita sesuaikan.';
const initialHistory = [user(messages[1]), assistant(TRANSACTION_QUESTION)];

function checkBudget(profile) {
  assert.equal(profile.min_price, 100e6); assert.equal(profile.max_price, 400e6);
  assert.equal(profile.district.toLowerCase(), 'benowo'); assert.equal(profile.city, 'Surabaya');
  assert.deepEqual(profile.transaction_types, TRANSACTION_TYPES);
}
function checkFreeReply(reply) {
  for (const type of ['lelang', 'primary', 'secondary', 'sewa']) assert.match(reply, new RegExp(type));
  assert.match(reply, /[Bb]udget/); assert.doesNotMatch(reply, /keduanya|beli atau sewa dulu/);
}
function checkBudgetReply(reply) {
  assert.match(reply, /[Bb]udget.*juta atau miliar/);
  assert.doesNotMatch(reply, /keduanya|beli atau sewa|Budget-nya sampai berapa/);
}
function inventoryFixture() {
  const property = (id, changes) => row(id, { kecamatan: 'Benowo', ...changes });
  return advancedFixture({ inventory: [
    property(980001, { jenis_transaksi: 'LELANG', nilai_limit_lelang: 100e6, tanggal_lelang: new Date('2099-01-01') }),
    property(980002, { jenis_transaksi: 'PRIMARY', harga: 200e6, harga_efektif: 200e6 }),
    property(980003, { jenis_transaksi: 'SECONDARY', harga: 400e6, harga_efektif: 400e6 }),
    property(980004, { jenis_transaksi: 'SEWA', harga: 25e6, harga_efektif: 25e6,
      sewaDetail: { durasi_sewa: 'BULANAN', harga_sewa_bulanan: 25e6, harga_sewa_tahunan: 300e6 } }),
    // These rentals must fail even though their generic listing price fits.
    property(980005, { jenis_transaksi: 'SEWA', harga: 200e6, harga_efektif: 200e6,
      sewaDetail: { durasi_sewa: 'BULANAN', harga_sewa_bulanan: 200e6, harga_sewa_tahunan: 450e6 } }),
    property(980006, { jenis_transaksi: 'SEWA', harga: 200e6, harga_efektif: 200e6,
      sewaDetail: { durasi_sewa: 'BULANAN', harga_sewa_bulanan: 200e6, harga_sewa_tahunan: null } }),
    property(980007, { jenis_transaksi: 'SECONDARY', harga: 450e6, harga_efektif: 450e6 }),
    property(980008, { jenis_transaksi: 'LELANG', harga: 100e6, nilai_limit_lelang: 450e6, tanggal_lelang: new Date('2099-01-01') }),
    property(980009, { jenis_transaksi: 'SECONDARY', harga: 50e6, harga_efektif: 50e6 }),
  ] });
}

test('unrestricted transaction answers accept all four choices without reopening the transaction question', () => {
  for (const text of ['bebas pak', 'bebas', 'terserah bu', 'semua boleh', 'semuanya pak', 'apa saja kak', 'fleksibel', 'iya bebas pak']) {
    const buyer = buyerContext(initialHistory, text, null);
    assert.deepEqual(buyer.profile.transaction_types, TRANSACTION_TYPES, text);
    assert.ok(!buyer.missing.includes('transaction_type'));
    checkFreeReply(searchReply({ buyer, status: 'qualifying' }));
  }
  for (const text of ['belum tahu pak', 'belum ada pilihan', 'tidak bebas', 'semua boleh?']) {
    assert.equal(transactionPreference(text, { expected: true }), null, text);
  }
  assert.equal(transactionPreference('bebas pak'), null, 'bare free answers need a pending transaction question');
  assert.deepEqual(transactionPreference('bebas pak', { expected: true, excluded: ['LELANG'] }).values, ['PRIMARY', 'SECONDARY', 'SEWA']);
  assert.deepEqual(transactionPreference('bebas, jangan lelang', { expected: true }).values, ['PRIMARY', 'SECONDARY', 'SEWA']);
  assert.deepEqual(transactionPreference('bebas, secondary saja', { expected: true }).values, ['SECONDARY']);
});

test('free choice and a budget in the same answer retain both preferences', () => {
  const buyer = buyerContext(initialHistory, 'bebas pak, budgetnya 100–400 juta', null);
  checkBudget(buyer.profile);
  const reply = searchReply({ buyer, status: 'qualifying' });
  assert.match(reply, /Rp 100\.000\.000–Rp 400\.000\.000/);
  assert.doesNotMatch(reply, /beli atau sewa dulu|juta atau miliar|Budget-nya sampai berapa/);
});

test('the reported budget is clarified after the old erroneous reply and a unit-only answer restores both endpoints', () => {
  const history = [...initialHistory, user('bebas pak'), assistant(legacyQuestion)];
  const pending = buyerContext(history, messages[3], null);
  checkBudgetReply(searchReply({ buyer: pending, status: 'qualifying' }));
  const corrected = buyerContext([...history, user(messages[3]), assistant(searchReply({ buyer: pending, status: 'qualifying' }))], 'juta pak', null);
  checkBudget(corrected.profile);
  assert.equal(corrected.budget_error, null); assert.equal(corrected.needs_interpretation, false);
});

test('a pending unit and transaction choices survive bounded history', () => {
  const history = [...initialHistory, user('bebas pak'), assistant(legacyQuestion)];
  const pending = buyerContext(history, messages[3], null);
  const shortened = [assistant(searchReply({ buyer: pending, status: 'qualifying' }))];
  const corrected = buyerContext(shortened, 'juta pak', null, { continuation: pending.continuation });
  checkBudget(corrected.profile);
  assert.equal(corrected.budget_error, null);
  for (const text of ['mungkin juta', 'bukan juta', 'juta atau miliar?', 'nggak tahu pak']) {
    const uncertain = buyerContext(shortened, text, null, { continuation: pending.continuation });
    assert.equal(uncertain.budget_error, 'ambiguous', text);
    assert.equal(uncertain.profile.max_price, null);
  }
});

test('mixed searches filter purchase and rental budgets separately and show the selected rental period', async () => {
  const f = inventoryFixture(), history = [], results = [];
  const catalog = { async resolve(...args) { const result = await f.catalog.resolve(...args); results.push(result); return result; } };
  let result;
  for (const text of messages.slice(1)) {
    result = await generatePropertyReply({ catalog, ai: noAi, history, text, now: f.now });
    history.push(user(text), assistant(result.reply));
    if (text !== messages.at(-1)) assert.equal(f.queries.length, 0, text);
  }
  assert.equal(result.knowledge.status, 'recommendations');
  const criteria = f.criteria.at(-1); checkBudget(criteria);
  assert.equal(criteria.rental_period, 'TAHUNAN'); assert.equal(isBuyerCriteria(criteria), true);
  for (const id of ['980001', '980002', '980003', '980004']) assert.ok(result.reply.includes(id), id);
  for (const id of ['980005', '980006', '980007', '980008', '980009']) assert.ok(!result.reply.includes(id), id);
  const rental = results.at(-1).catalog.find((asset) => asset.id === '980004');
  assert.equal(rental.asking_price, 300e6); assert.equal(rental.rental.period, 'TAHUNAN');
  const preferences = await clientPreferenceRows({}, criteria);
  assert.deepEqual(preferences.map((p) => p.jenis_transaksi), TRANSACTION_TYPES);
  assert.ok(preferences.filter((p) => p.jenis_transaksi !== 'SEWA').every((p) => p.catatan === null));
  assert.match(preferences.find((p) => p.jenis_transaksi === 'SEWA').catatan, /tahunan/);
  assert.match(clientFunnelSummary(criteria).budget, /sewa Tahunan/);
  assert.equal(isBuyerCriteria({ ...criteria, transaction_types: ['PRIMARY', 'SECONDARY'] }), false);
});

test('WhatsApp preserves Kartini, all four choices and both budget bounds through history trimming and CRM capture', async () => {
  const f = inventoryFixture(), store = new MemoryStore(config), sent = [], captures = [], phone = '6280000000091';
  const processor = new MessageProcessor({ config, store, catalog: f.catalog, ai: noAi,
    clients: { setName() {}, enqueue(value) { captures.push(value); }, async flush() {} },
    whatsapp: { async sendText(_phone, text) { sent.push(text); return randomUUID(); } },
    logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const [index, text] of messages.entries()) {
    processor.acceptBatch([{ id: randomUUID(), type: 'text', from: phone, text, timestamp: Date.now() }]); await processor.drain();
    if (index === 2) checkFreeReply(sent.at(-1));
    if (index === 3) { checkBudgetReply(sent.at(-1)); store.get(phone).history = store.get(phone).history.slice(-2); }
    if (index === 4) checkBudget(store.get(phone).buyer_state.profile);
    if (index < messages.length - 1) assert.equal(captures.length, 0);
  }
  assert.equal(store.get(phone).client_identity.name, 'kartini');
  assert.equal(store.get(phone).is_bot_active, true);
  assert.equal(captures.length, 1); assert.equal(captures[0].name, 'kartini'); checkBudget(captures[0].criteria);
  assert.equal(captures[0].criteria.rental_period, 'TAHUNAN');
  assert.equal(f.queries.length, 1);
});

test('Playground completes the reported conversation using its server-owned context', async (t) => {
  const f = inventoryFixture(), app = express(), token = 'x'.repeat(40), conversationId = randomUUID();
  app.use('/sandbox', createSandboxRouter({ catalog: f.catalog, ai: noAi, config: { ...config, adminToken: token } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  for (const [index, text] of messages.entries()) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); const data = await response.json();
    assert.equal(data.session.is_bot_active, true); assert.equal(data.suppressed, false);
    if (index === 2) checkFreeReply(data.reply);
    if (index === 3) checkBudgetReply(data.reply);
    if (index < messages.length - 1) assert.equal(f.queries.length, 0);
    else assert.equal(data.knowledge.status, 'recommendations');
  }
  checkBudget(f.criteria.at(-1)); assert.equal(f.criteria.at(-1).rental_period, 'TAHUNAN');
});

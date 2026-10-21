import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { TRANSACTION_TYPES, TRANSACTION_QUESTION, transactionPreference, transactionValues } from '../services/property_transaction.js';
import { buyerContext } from '../services/buyer_profile.js';
import { searchReply } from '../services/search_reply.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { transactionExclusionScenarios, simulateTransactionExclusion, purchaseTransactions, exclusionInventory } from '../scripts/lib/transaction-exclusion-dialogues.js';

const user = (content) => ({ role: 'user', content }), assistant = (content) => ({ role: 'assistant', content });

test('27 exception phrases preserve the remaining transactions and budget in three complete conversation contexts', async () => {
  const failures = [];
  for (const scenario of transactionExclusionScenarios()) {
    const result = await simulateTransactionExclusion(scenario);
    if (!result.passed) failures.push(`${result.name}: ${result.error}`);
  }
  assert.deepEqual(failures, []);
});

test('exclusions subtract the named option from every nonempty transaction subset without silently choosing another option', () => {
  const expressions = [(name) => `kecuali ${name}`, (name) => `selain ${name}`, (name) => `${name} dikecualikan`, (name) => `tolong exclude ${name}`];
  for (let mask = 1; mask < 16; mask++) {
    const previous = TRANSACTION_TYPES.filter((_, index) => mask & (1 << index));
    for (const type of TRANSACTION_TYPES) for (const expression of expressions) {
      const text = expression(type.toLowerCase()), result = transactionPreference(text, { previous });
      assert.deepEqual(result.values, previous.filter((value) => value !== type), `${previous}: ${text}`);
      assert.ok(result.excluded.includes(type), text);
    }
  }
});

test('exceptions can cover a list or accompany free choice and explicit replacements', () => {
  for (const text of ['kecuali sewa dan lelang', 'kecuali sewa, lelang', 'sewa dan lelang dikecualikan']) {
    assert.deepEqual(transactionPreference(text, { previous: TRANSACTION_TYPES }).values, ['PRIMARY', 'SECONDARY'], text);
  }
  for (const text of ['bebas kecuali sewa', 'semua kecuali sewa', 'jenisnya bebas kecuali sewa', 'kecuali sewa']) {
    assert.deepEqual(transactionPreference(text, { expected: true }).values, purchaseTransactions, text);
  }
  assert.deepEqual(transactionPreference('bebas tanpa lelang', { expected: true }).values, ['PRIMARY', 'SECONDARY', 'SEWA']);
  assert.deepEqual(transactionPreference('kecuali sewa, secondary aja', { previous: TRANSACTION_TYPES }).values, ['SECONDARY']);
  assert.deepEqual(transactionPreference('kecuali lelang, primary, secondary dan sewa', { previous: TRANSACTION_TYPES }).values, []);
  assert.equal(transactionPreference('kecuali sewa, cocok untuk usaha roti', { previous: TRANSACTION_TYPES }).only_transaction, false);
});

test('questions and uncertainty do not execute exclusions; cancelling an exclusion includes the option', () => {
  for (const text of ['apakah sewa dikecualikan?', 'kalau sewa dikecualikan gimana?', 'selain sewa apa lagi?', 'mungkin kecuali sewa', 'belum tentu sewa dikecualikan']) {
    assert.equal(transactionPreference(text, { previous: TRANSACTION_TYPES }), null, text);
  }
  for (const text of ['jangan kecualikan sewa', 'sewa jangan dikecualikan', 'sewa tidak dikecualikan', 'sewa nggak perlu dikecualikan', 'sewa juga boleh']) {
    const result = transactionPreference(text, { previous: purchaseTransactions, excluded: ['SEWA'] });
    assert.deepEqual(result.values, TRANSACTION_TYPES, text); assert.ok(!result.excluded.includes('SEWA'));
  }
});

test('dropping rental from mixed search preserves both budget bounds and land while clearing only the rental period', () => {
  const history = [user('cari rumah di Benowo Surabaya budget 100–300 juta luas tanah minimal 72m2'), assistant(TRANSACTION_QUESTION),
    user('bebas sih'), assistant('Untuk pilihan sewa, budget tadi per bulan, per tahun, atau periode lain?'),
    user('per tahun'), assistant('Ada beberapa pilihan.')];
  const buyer = buyerContext(history, 'oh kecuali sewa pak...', null);
  assert.deepEqual(transactionValues(buyer.profile), purchaseTransactions);
  assert.equal(buyer.profile.min_price, 100e6); assert.equal(buyer.profile.max_price, 300e6);
  assert.equal(buyer.profile.min_land_area_m2, 72); assert.equal(buyer.profile.rental_period, undefined);
  assert.equal(buyer.stage, 'recommendations'); assert.equal(buyer.needs_interpretation, false);
  const pureRental = buyerContext([user('cari sewa rumah di Benowo Surabaya budget 3 juta per bulan luas tanah bebas'), assistant('Ada pilihan rumah sewa.')], 'kecuali sewa', null);
  assert.deepEqual(transactionValues(pureRental.profile), []);
  assert.equal(pureRental.profile.max_price, null, 'A rental-only periodic budget cannot become purchase capital');
  assert.ok(pureRental.missing.includes('transaction_type')); assert.ok(!pureRental.missing.includes('rental_period'));
});

test('the reported sentence acknowledges rental removal and asks only the remaining property preferences', () => {
  const history = [user('saya dengan kartini, ingin cari aset di benowo situ'), assistant(TRANSACTION_QUESTION),
    user('bebas sih pak, budget saya di angka dibawah 300 juta pak'),
    assistant('Untuk pilihan sewa, budget tadi per bulan, per tahun, atau periode lain?\nJenis properti apa yang dicari, rumah, ruko, atau yang lain?')];
  const buyer = buyerContext(history, 'oh kecuali sewa pak...', null);
  const reply = searchReply({ buyer, status: 'qualifying' });
  assert.deepEqual(transactionValues(buyer.profile), purchaseTransactions);
  assert.equal(buyer.profile.max_price, 300e6); assert.equal(buyer.needs_interpretation, false);
  assert.match(reply, /sewa saya kecualikan/); assert.match(reply, /lelang, primary, dan secondary/);
  assert.match(reply, /Rp 300\.000\.000/); assert.match(reply, /Jenis properti apa/);
  assert.doesNotMatch(reply, /Budget sewanya|Untuk pilihan sewa|Budget-nya sampai berapa|Mau beli atau sewa/);
});

test('Playground applies the exact exclusion to actual search predicates and preserves the 300 million budget', async (t) => {
  const f = exclusionInventory(), app = express(), token = 'x'.repeat(40), conversationId = randomUUID();
  const noAi = { generate() { assert.fail('Clear exception must not need AI'); }, interpretBuyer() { assert.fail('Clear exception must not need interpretation'); } };
  app.use('/sandbox', createSandboxRouter({ catalog: f.catalog, ai: noAi, config: { adminToken: token, maxSessions: 100, sessionTtlMs: 86400000 } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const messages = ['selamat siang', 'saya dengan kartini, ingin cari aset di benowo situ',
    'bebas sih pak, budget saya di angka dibawah 300 juta pak', 'oh kecuali sewa pak...', 'rumah, luas tanah bebas'];
  for (const [index, text] of messages.entries()) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }),
    });
    assert.equal(response.status, 200); const result = await response.json();
    assert.equal(result.suppressed, false); assert.equal(result.session.is_bot_active, true);
    if (index === 3) { assert.match(result.reply, /sewa saya kecualikan/); assert.match(result.reply, /Rp 300\.000\.000/); }
    if (index < 4) assert.equal(f.criteria.length, 0);
    else { assert.equal(result.knowledge.status, 'recommendations'); assert.ok(!result.reply.includes('986004')); }
  }
  assert.deepEqual(transactionValues(f.criteria.at(-1)), purchaseTransactions);
  assert.equal(f.criteria.at(-1).max_price, 300e6); assert.equal(f.criteria.at(-1).rental_period, undefined);
});

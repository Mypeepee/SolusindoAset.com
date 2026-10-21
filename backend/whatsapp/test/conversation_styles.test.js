import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { conversationStyleScenarios, simulateConversationStyle } from '../scripts/lib/conversation-style-dialogues.js';
import { preferenceAnswerText, unrestrictedPreferenceAnswer } from '../services/buyer_language.js';
import { TRANSACTION_QUESTION, TRANSACTION_TYPES, transactionValues, rentalPeriod } from '../services/property_transaction.js';
import { buyerContext } from '../services/buyer_profile.js';
import { searchReply } from '../services/search_reply.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { advancedFixture, row } from '../scripts/lib/advanced-search-dialogues.js';

test('different conversational styles preserve the intended field, budget, identity and CRM criteria through the real processor', async () => {
  const failures = [];
  for (const scenario of conversationStyleScenarios()) {
    const result = await simulateConversationStyle(scenario);
    if (!result.passed) failures.push(`${result.name}: ${result.error}`);
  }
  assert.deepEqual(failures, []);
});

test('the exact second Kartini report completes without repeating the answered transaction question', async () => {
  const result = await simulateConversationStyle({ name: 'Kartini 13.47', kind: 'transaction', steps: [
    { text: 'selamat siang pak' }, { text: 'saya kartini' },
    { text: 'saya cari aset di benowo pak budget 100 - 200 mentok', trim: true },
    { text: 'juta pak', min_price: 100e6, max_price: 200e6 },
    { text: 'bebas sih', transactions: TRANSACTION_TYPES, noQuestion: /Mau beli atau sewa/ },
    { text: 'tahun aja', rental_period: 'TAHUNAN' }, { text: 'rumah' },
    { text: 'luas tanah bebas', land: null, queried: true },
  ] });
  assert.equal(result.passed, true, result.error);
});

test('tone normalization preserves quantifiers, questions, negations and uncertainty', () => {
  assert.equal(preferenceAnswerText('iya, apa aja sih pak 😊'), 'apa aja');
  assert.equal(preferenceAnswerText('kalau saya bebas aja sih'), 'bebas');
  for (const text of ['bebas sih', 'apa saja sih', 'saya fleksibel kok', 'bebasss sihh 🙏']) assert.equal(unrestrictedPreferenceAnswer(text), true, text);
  for (const text of ['nggak bebas', 'tidak semua boleh', 'mungkin bebas', 'belum tentu bebas', 'bebas?', 'bebas ongkir']) assert.equal(unrestrictedPreferenceAnswer(text), false, text);
  assert.equal(unrestrictedPreferenceAnswer('belum ada pilihan', { allowUndecided: false }), false);
  assert.equal(rentalPeriod('tahun aja'), null, 'A year is not a rental-period choice without the period question');
  assert.equal(rentalPeriod('tahun aja', { expected: true }), 'TAHUNAN');
});

test('replaying an old transcript with the repeated question recovers the original budget and latest answer', () => {
  const history = [
    { role: 'user', content: 'saya cari aset di benowo pak budget 100 - 200 mentok' },
    { role: 'assistant', content: 'Budget tadi dalam juta atau miliar rupiah, ya?' },
    { role: 'user', content: 'juta pak' }, { role: 'assistant', content: TRANSACTION_QUESTION },
    { role: 'user', content: 'bebas sih' }, { role: 'assistant', content: TRANSACTION_QUESTION },
  ];
  const buyer = buyerContext(history, 'bebas sih pak', null);
  assert.deepEqual(transactionValues(buyer.profile), TRANSACTION_TYPES);
  assert.equal(buyer.profile.min_price, 100e6); assert.equal(buyer.profile.max_price, 200e6);
  assert.doesNotMatch(searchReply({ buyer, status: 'qualifying' }), /Mau beli atau sewa/);
});

test('Playground understands varied answers and returns all matching transaction types through actual database filters', async (t) => {
  const inventory = TRANSACTION_TYPES.map((type, index) => row(985001 + index, {
    jenis_transaksi: type, kecamatan: 'Benowo', harga: 150e6, harga_efektif: 150e6, nilai_limit_lelang: 150e6,
    tanggal_lelang: new Date('2099-01-01'),
    ...(type === 'SEWA' ? { sewaDetail: { durasi_sewa: 'BULANAN', harga_sewa_bulanan: 12e6, harga_sewa_tahunan: 150e6 } } : {}),
  }));
  const f = advancedFixture({ inventory }), token = 'x'.repeat(40), app = express();
  const noAi = { generate() { assert.fail('Clear answers must not need AI'); }, interpretBuyer() { assert.fail('Clear answers must not need interpretation'); } };
  app.use('/sandbox', createSandboxRouter({ catalog: f.catalog, ai: noAi, config: { adminToken: token, maxSessions: 100, sessionTtlMs: 86400000 } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const answers = ['bebas sih', 'kalau saya bebas aja', 'apa saja sih', 'saya fleksibel kok', 'jenisnya bebas sih', 'beli atau sewa sama aja'];
  for (const [index, answer] of answers.entries()) {
    const conversationId = randomUUID(), before = f.criteria.length;
    const messages = ['selamat siang pak', 'saya kartini', 'saya cari aset di benowo pak budget 100 - 200 mentok',
      'juta pak', answer, 'tahun aja', 'rumah', 'luas tanah bebas'];
    for (const [turn, text] of messages.entries()) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG${2200 + index}/messages`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [{ role: 'user', content: text }] }),
      });
      assert.equal(response.status, 200); const result = await response.json();
      assert.equal(result.suppressed, false); assert.equal(result.session.is_bot_active, true);
      if (turn === 4) assert.doesNotMatch(result.reply, /Mau beli atau sewa/);
      if (turn < messages.length - 1) assert.equal(f.criteria.length, before, 'Do not search before the remaining preferences');
      else {
        assert.equal(result.knowledge.status, 'recommendations', answer);
        for (const id of ['985001', '985002', '985003', '985004']) assert.ok(result.reply.includes(id), `${answer}: ${id}`);
      }
    }
    const criteria = f.criteria.at(-1);
    assert.equal(criteria.min_price, 100e6); assert.equal(criteria.max_price, 200e6);
    assert.equal(criteria.rental_period, 'TAHUNAN'); assert.deepEqual(transactionValues(criteria), TRANSACTION_TYPES);
  }
});

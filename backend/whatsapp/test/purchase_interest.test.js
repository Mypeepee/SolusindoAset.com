import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { detectClosingIntent, planClosingTurn, SEARCH_STATE } from '../services/closing_state.js';
import { interactionDecision } from '../services/interaction_policy.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { propertyDetailsReply } from '../services/property_details.js';
import { purchaseCostReply } from '../services/property_costs.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { ASSET, config, noAi, singleList } from '../scripts/lib/single-recommendation-dialogues.js';
import { NOW, COST, REPORTED, INTEREST_PHRASES, interestFixture,
  SERIOUS_REPORTED, SERIOUS_PHRASES, purchaseInterestScenarios, simulatePurchaseInterest } from '../scripts/lib/purchase-interest-dialogues.js';

const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const detail = propertyDetailsReply(ASSET, { now: NOW });
const costs = purchaseCostReply(ASSET, COST, { now: NOW });

test('short interest statements require a selected property and retain their meaning after details or costs', () => {
  for (const text of [...INTEREST_PHRASES, ...SERIOUS_PHRASES]) {
    for (const previous of [detail, costs]) {
      const context = { selectedAssetId: ASSET.id, history: [assistant(previous)] };
      assert.equal(detectClosingIntent(text, context), true, text);
      assert.equal(interactionDecision({ text, previousId: ASSET.id, history: context.history }), 'allow', text);
    }
  }
  for (const text of [REPORTED, SERIOUS_REPORTED, 'saya serius', 'sy serius pak', 'saya sudah mantap',
    'saya siap lanjut', 'saya tertarik', 'saya minat', 'wah menarik nih pak', 'mau lanjut pak']) {
    assert.equal(detectClosingIntent(text), false, text);
    assert.equal(detectClosingIntent(text, { history: [assistant(costs)] }), false, 'assistant text alone cannot establish a selected asset');
    assert.equal(detectClosingIntent(text, { selectedAssetId: ASSET.id, history: [assistant(singleList())] }), false, 'a newer result list must not close an older selected asset');
  }
});

test('interest in a location, a question, refusal, hypothetical intent, and hesitation never become purchase consent', () => {
  const context = { selectedAssetId: ASSET.id, history: [assistant(costs)] };
  for (const text of ['saya tidak tertarik', 'saya belum tertarik', 'gak minat pak', 'gk tertarik', 'belum mau lanjut',
    'saya tertarik di Driyorejo', 'saya tertarik beli aset lelang di surabaya pak', 'saya tertarik cari rumah lain',
    'saya tertarik tapi belum ada dana', 'kalau saya tertarik bagaimana?', 'mungkin saya tertarik',
    'saya tertarik, boleh lihat detail dulu?', 'saya tertarik tapi mau pikir dulu', 'kenapa saya harus tertarik?',
    'saya tertarik dengan rincian biaya saja', 'wah mahal ya pak', 'lanjut', 'lanjut pak',
    'serius?', 'serius pak?', 'oke pak saya belum serius', 'saya gak serius', 'sy gk serius',
    'saya serius cari properti di Tambaksari', 'saya serius tapi mau pikir dulu',
    'kalau saya serius', 'mungkin saya serius', 'saya serius dengan aset ini tapi mau pikir dulu',
    'saya serius dengan aset ini?', 'saya serius dengan aset ini tapi masih ragu',
    'saya serius tapi belum siap', 'saya serius tapi ingin lihat rumah lain',
    'saya serius soal biaya saja', 'saya sudah mantap tapi belum ada dana',
    'oke pak', 'siap pak', 'mantap pak', 'baik', 'saya serius tapi syaratnya apa?']) {
    assert.equal(detectClosingIntent(text, context), false, text);
  }
  assert.equal(planClosingTurn({ asset: null, conversion: { mode: SEARCH_STATE }, text: REPORTED, history: context.history, now: NOW }), null);
});

test('real processor follows the full reported list → details → costs → interest sequence, including bounded history', async () => {
  for (const scenario of purchaseInterestScenarios()) {
    const result = await simulatePurchaseInterest(scenario);
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
  }
});

test('interest starts purchase preparation with payment gated by stock, and honors verified sold/available outcomes', async () => {
  for (const scenario of [{ continueJourney: true }, { future: true }, { verdict: 'available' }, { verdict: 'sold' }]) {
    const result = await simulatePurchaseInterest(scenario);
    assert.equal(result.passed, true, `${JSON.stringify(scenario)}: ${result.error}`);
    assert.equal(result.searches, 1); assert.equal(result.selected_id, ASSET.id);
  }
});

test('number 4 → costs → serious interest → baik keeps MOU questions open before explicit document readiness', async () => {
  for (const memory of ['full', 'truncated']) {
    const result = await simulatePurchaseInterest({ example: 'pacarkembang', text: SERIOUS_REPORTED, memory, continueJourney: true });
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
    assert.equal(result.selected_id, '121037'); assert.equal(result.topic, 'purchase_preparation');
    assert.equal(result.phase, 'purchasing_handoff');
    const serious = result.transcript[3]; assert.equal(serious.user, SERIOUS_REPORTED);
    assert.match(serious.bot, /Pembayaran tanda jadi menunggu kepastian aset dari tim/);
    assert.match(serious.bot, /KTP.*cover buku tabungan/);
    const questions = result.transcript[4]; assert.equal(questions.user, 'baik');
    assert.match(questions.bot, /Bagian mana yang ingin ditanyakan\?/);
    assert.doesNotMatch(questions.bot, /Mau saya teruskan ke tim|maksimal|dasar nilai|ilustrasi|10\s*%|tanda tangan/);
  }
});

test('serious intent also works immediately after details, without requiring a cost breakdown first', async () => {
  for (const text of [SERIOUS_REPORTED, 'sy serius pak', 'saya sudah mantap', 'saya siap lanjut']) {
    const result = await simulatePurchaseInterest({ example: 'pacarkembang', text, after: 'details' });
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
    assert.equal(result.selected_id, '121037'); assert.equal(result.topic, 'purchase_preparation');
  }
});

test('an old generic clarification does not lose the selected property or prevent recovery into closing', async () => {
  const catalog = interestFixture();
  const history = [user('Kode 106286'), assistant(detail), user(COST), assistant(costs),
    user(REPORTED), assistant('Mau tahu bagian yang mana ya, harga, lokasi, fasilitas, atau biaya? Kalau ingin cari properti lain juga boleh.')];
  for (const text of [REPORTED, SERIOUS_REPORTED]) {
    const result = await generatePropertyReply({ text, history, previousId: ASSET.id,
      catalog, ai: noAi, now: NOW, policyState: { is_bot_active: true, conversion: { mode: SEARCH_STATE } } });
    assert.equal(result.asset.id, ASSET.id); assert.equal(result.conversion.topic, 'purchase_preparation');
    assert.equal(result.conversion.stock_status, 'pending');
    assert.equal(catalog.calls.at(-1).criteria, undefined); assert.doesNotMatch(result.reply, /Mau tahu bagian yang mana/);
  }
  assert.equal(catalog.calls.length, 2);
});

for (const example of ['sumberpasir', 'pacarkembang']) test(`Playground retains the selected asset for interest/serious intent after costs (${example})`, async (t) => {
  const token = 'x'.repeat(40), app = express(), catalog = interestFixture({ example }), selectedId = catalog.first.id;
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  const post = async (text) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); return response.json();
  };
  await post(catalog.example.opening); const chosen = await post(catalog.example.choice); assert.equal(chosen.asset.id, selectedId);
  const breakdown = await post(catalog.example.cost); assert.match(breakdown.reply, /ESTIMASI BIAYA PEMBELIAN LELANG/);
  const interested = await post(example === 'pacarkembang' ? SERIOUS_REPORTED : REPORTED);
  assert.equal(interested.session.conversion.mode, 'Closing_State'); assert.equal(interested.session.conversion.asset_id, selectedId);
  assert.equal(interested.session.conversion.topic, 'purchase_preparation'); assert.equal(interested.session.conversion.stock_status, 'pending');
  assert.equal(interested.session.is_bot_active, true); assert.equal(catalog.calls.length, 4);
  assert.ok(catalog.calls.slice(1).every((item) => item.criteria === undefined));
  assert.doesNotMatch(interested.reply, /Mau tahu bagian yang mana|harga, lokasi, fasilitas/);
  const questions = await post('baik'); assert.equal(questions.session.conversion.topic, 'clarify');
  assert.match(questions.reply, /Bagian mana yang ingin ditanyakan\?/);
  assert.equal(questions.session.is_bot_active, true);
  const ready = await post('KTP dan cover buku tabungan sudah siap');
  assert.equal(ready.session.conversion.phase, 'purchasing_handoff'); assert.equal(ready.session.is_bot_active, false);
});

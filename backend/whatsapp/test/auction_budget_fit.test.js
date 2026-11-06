import test from 'node:test';
import assert from 'node:assert/strict';
import { consultationFixture, NOW, PHONE } from '../scripts/lib/consultation-fixture.js';
import { purchaseCostReply, AUCTION_BUDGET_QUESTION } from '../services/property_costs.js';
import { auctionBudgetAnswer } from '../services/asset_consultation.js';
import { LINKED_SEARCH_CONFIRMATION } from '../services/linked_search.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { AUCTION_BUDGET_RANGE_QUESTION } from '../services/budget_response.js';

test('the auction cost breakdown ends with budget fit before offering another asset', t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close());
  const reply = purchaseCostReply(f.asset, 'rincian biaya', { now: NOW });
  assert.ok(reply.endsWith(AUCTION_BUDGET_QUESTION));
  assert.doesNotMatch(reply, /cara melihatnya dari luar\?|carikan aset lain/);
});

for (const answer of ['iya', 'masih masuk budget', 'cocok', 'sesuai pak', 'budget saya 2 miliar']) {
  test(`budget fit starts the MOU reading flow without verifying funds: ${answer}`, async t => {
    const f = consultationFixture('LELANG'); t.after(() => f.close());
    assert.ok((await f.send('rincian biaya')).endsWith(AUCTION_BUDGET_QUESTION));
    const reply = await f.send(answer);
    assert.match(reply, /estimasi totalnya sesuai anggaran/);
    assert.match(reply, /draf MOU aset kode/);
    const session = f.processor.store.get(PHONE);
    assert.equal(session.consultation.budget_fit, 'within');
    assert.equal(session.conversion.mode, 'Closing_State');
    assert.equal(session.conversion.purchase_intake.payment_verified, false);
    assert.equal(session.qualification.funds, undefined);
    assert.equal(session.buyer_state?.searchStarted, false);
    assert.deepEqual(f.errors, []);
  });
}

for (const answer of ['tidak', 'belum sesuai', 'di luar budget', 'kemahalan']) {
  test(`a budget objection asks the total budget before starting a search: ${answer}`, async t => {
    const f = consultationFixture('LELANG'); t.after(() => f.close());
    await f.send('rincian biaya');
    const reply = await f.send(answer);
    assert.ok(reply.endsWith(AUCTION_BUDGET_RANGE_QUESTION));
    const session = f.processor.store.get(PHONE);
    assert.equal(session.consultation.budget_fit, 'outside');
    assert.equal(session.buyer_state?.searchStarted, false);
    assert.equal(session.asset_id, f.asset.id);
    assert.deepEqual(f.errors, []);
  });
}

test('consent to the alternative offer starts qualification instead of describing the old property', async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close());
  await f.send('rincian biaya'); await f.send('kemahalan'); await f.send('400–500 juta');
  const reply = await f.send('boleh');
  assert.equal(f.processor.store.get(PHONE).buyer_state.searchStarted, true);
  assert.match(reply, /(?:budget|anggaran|kota|daerah|kawasan|kecamatan)/i);
  assert.doesNotMatch(reply, /sendiri dari luar|ESTIMASI BIAYA PEMBELIAN|ketentuan DP/);
  assert.deepEqual(f.errors, []);
});

test('known budget answers and alternative consent do not depend on an AI scope classification', async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close());
  let classifications = 0;
  f.processor.ai.classifyPropertyScope = async () => { classifications++; return 'other'; };
  await f.send('rincian biaya');
  assert.ok((await f.send('tidak')).endsWith(AUCTION_BUDGET_RANGE_QUESTION));
  await f.send('400–500 juta'); assert.ok(await f.send('boleh'));
  assert.equal(classifications, 0);
  assert.equal(f.processor.store.get(PHONE).buyer_state.searchStarted, true);
  assert.deepEqual(f.errors, []);
});

test('a total budget above the listing price but below total costs does not become a listing-price ceiling', async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close());
  await f.send('rincian biaya');
  const reply = await f.send('budget saya 1,1 miliar');
  assert.ok(reply.endsWith(LINKED_SEARCH_CONFIRMATION));
  const session = f.processor.store.get(PHONE);
  assert.equal(session.consultation.total_budget, 1_100_000_000);
  assert.equal(session.consultation.budget_fit, 'outside');
  assert.equal(session.buyer_state.profile.max_price, null);
  assert.equal(session.buyer_state.searchStarted, false);
  await f.send('boleh');
  assert.equal(f.processor.store.get(PHONE).buyer_state.searchStarted, true);
  assert.equal(f.processor.store.get(PHONE).buyer_state.profile.max_price, 1_100_000_000);
  assert.equal(f.processor.store.get(PHONE).buyer_state.profile.max_total_budget, 1_100_000_000);
  assert.deepEqual(f.errors, []);
});

test('hesitation is acknowledged without declaring readiness or changing the selected asset', async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close());
  await f.send('rincian biaya');
  assert.match(await f.send('saya pikir dulu'), /silakan dipertimbangkan dahulu/);
  const session = f.processor.store.get(PHONE);
  assert.equal(session.consultation.budget_fit, 'undecided');
  assert.equal(session.asset_id, f.asset.id);
  assert.equal(session.conversion.mode, 'Search_State');
  assert.deepEqual(f.errors, []);
});

test('a stale budget offer or another asset cannot reinterpret a short answer', () => {
  const consultation = { asset_id: '123', costs_explained: true, last_offer: 'budget' };
  assert.equal(auctionBudgetAnswer('iya', { consultation, assetId: '123', history: [
    { role: 'assistant', content: AUCTION_BUDGET_QUESTION }, { role: 'assistant', content: 'Ada pertanyaan tentang MOU?' },
  ] }), null);
  assert.equal(auctionBudgetAnswer('iya', { consultation, assetId: '456', history: [
    { role: 'assistant', content: AUCTION_BUDGET_QUESTION },
  ] }), null);
});

test('an actual purchase request still starts the existing purchase flow after budget qualification', async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close());
  await f.send('rincian biaya');
  await f.send('saya mau beli aset ini');
  assert.equal(f.processor.store.get(PHONE).conversion.mode, 'Closing_State');
  assert.deepEqual(f.errors, []);
});

test('a missing listing cannot be approved from a budget answer or old cost breakdown', async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close());
  const result = await generatePropertyReply({ now: NOW, previousId: f.asset.id, text: 'iya',
    history: [{ role: 'user', content: `Kode ${f.asset.id}` }, { role: 'assistant', content: purchaseCostReply(f.asset, 'biaya', { now: NOW }) }],
    catalog: { async resolve() { return { asset: null, catalog: [], status: 'not_found' }; } }, ai: {},
    policyState: { consultation: { asset_id: f.asset.id, costs_explained: true, last_offer: 'budget' } },
  });
  assert.match(result.reply, /pilih satu aset|listing terbaru/);
  assert.doesNotMatch(result.reply, /masih sesuai anggaran/);
});

test('an unavailable limit neither asks for nor confirms budget fit', async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close());
  await f.send('rincian biaya'); f.asset.limit_price = null;
  assert.match(await f.send('iya'), /Harga limit terbaru belum dapat diverifikasi/);
  const reply = await f.send('rincian biaya');
  assert.match(reply, /harga limit yang valid belum tersedia/);
  assert.ok(!reply.includes(AUCTION_BUDGET_QUESTION));
  assert.deepEqual(f.errors, []);
});

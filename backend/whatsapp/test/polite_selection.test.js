import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { selectedRecommendation, MISSING_SELECTION_REPLY } from '../services/property_selection.js';
import { selectionHistory, selectionFixture } from '../scripts/lib/selection-language-dialogues.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { ASSETS, OPENING, REPORTED, NOW, config, noAi, politeSelectionScenarios, simulatePoliteSelection } from '../scripts/lib/polite-selection-dialogues.js';

const history = () => selectionHistory('html', { assets: ASSETS, opening: OPENING });

test('the exact Menganti chat and varied polite requests select number four across render formats and bounded memory', async () => {
  for (const scenario of politeSelectionScenarios()) {
    const result = await simulatePoliteSelection(scenario);
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
  }
});

test('the chosen Menganti asset stays selected for the cost breakdown, buying interest, and correct DP calculation', async () => {
  const result = await simulatePoliteSelection({ journey: true });
  assert.equal(result.passed, true, result.error); assert.equal(result.selected_id, '113175'); assert.equal(result.searches, 1);
});

test('negation with courtesy words, quantity units, and unrelated identifiers must not select a recommendation', () => {
  for (const text of ['jangan pak nomor 4', 'jangan, pak, yang 4', 'bukan bu nomor 4', 'bukan, pak, nomor 4',
    'saya belum mau nomor 4 pak', 'nomor 4 nggak dulu', 'bukan nomor 1 dan nomor 4', 'bukan pak nomor 1 atau nomor 4',
    'tidak bisa pak nomor 4', 'jangan pak coba buka nomor 4', 'lupakan nomor 4', 'nomor 4 coret',
    'budget saya nomor 4', 'dokumen nomor 4', 'rekening no 4', 'sertifikat no 4', 'yang 4 kamar',
    'nomor 4 miliar', 'nomor 4,5 juta', 'nomor 4.5', 'di Jalan Melati nomor 4']) {
    assert.equal(selectedRecommendation(text, history())?.id ?? null, null, text);
  }
});

test('multiple choices remain ambiguous and an explicit positive correction selects only the replacement', () => {
  for (const text of ['coba pak nomor 4 atau 2', 'nomor empat atau nomor dua pak', 'boleh pak nomor 4, 2', '4,2 pak',
    'nomor 4 dan nomor 2']) assert.equal(selectedRecommendation(text, history())?.kind, 'ambiguous', text);
  for (const text of ['bukan pak nomor 1 tapi bu nomor 4', 'bukan, pak, nomor 3, saya pilih nomor 4']) {
    assert.equal(selectedRecommendation(text, history())?.id, '113175', text);
  }
  assert.equal(selectedRecommendation('Kode 119573, coba pak nomor 4', history()), null);
  assert.equal(selectedRecommendation(`${ASSETS[0].detail_url} coba pak nomor 4`, history()), null);
});

test('a polite selection without its list asks for an asset pointer; a specific cost request keeps its meaning', async () => {
  const missing = await generatePropertyReply({ text: REPORTED, history: [], ai: noAi,
    catalog: { resolve() { assert.fail('A missing recommendation list cannot justify an asset lookup'); } } });
  assert.equal(missing.reply, MISSING_SELECTION_REPLY);
  const catalog = selectionFixture({ assets: ASSETS, priceAdjustment: 0 });
  const costs = await generatePropertyReply({ text: 'bisa pak nomor 4 minta rincian biaya', history: history(), catalog, ai: noAi, now: NOW });
  assert.equal(costs.asset.id, '113175'); assert.match(costs.reply, /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.match(costs.reply.replace(/\*/g, ''), /HARGA LIMIT\nRp 133\.000\.000/); assert.equal(catalog.calls.length, 1);
  assert.equal(catalog.calls[0].criteria, undefined);
});

test('Playground resolves coba pak nomor 4 from its own five-asset list and keeps that asset for costs', async (t) => {
  const app = express(), token = 'x'.repeat(40), catalog = selectionFixture({ assets: ASSETS, priceAdjustment: 0 });
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  const post = async (text) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [{ role: 'user', content: text }] }) });
    assert.equal(response.status, 200); return response.json();
  };
  const listed = await post(OPENING); assert.match(listed.reply, /PERMATA GREEN MENGANTI/);
  const detail = await post(REPORTED); assert.equal(detail.asset.id, '113175'); assert.match(detail.reply, /DETAIL ASET.*113175/);
  assert.doesNotMatch(detail.reply, /Berikut pilihan|Sebutkan nomor pilihannya/);
  const costs = await post('coba pak breakdownkan biaya'); assert.equal(costs.asset.id, '113175');
  assert.match(costs.reply.replace(/\*/g, ''), /HARGA LIMIT\nRp 133\.000\.000/); assert.equal(costs.session.is_bot_active, true);
  assert.equal(catalog.calls.length, 3); assert.ok(catalog.calls.slice(1).every((call) => call.text === 'Kode 113175' && call.criteria === undefined));
});

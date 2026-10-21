import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { selectedRecommendation, AMBIGUOUS_SELECTION_REPLY } from '../services/property_selection.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { interactionDecision } from '../services/interaction_policy.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { singleSelectionScenarios, simulateSingleSelection, singleList, singleFixture,
  NOW, OPENING, REPORTED, ASSET, PHRASES, noAi, config } from '../scripts/lib/single-recommendation-dialogues.js';

const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });

test('the Sumberpasir conversation and everyday single-property replies fetch details without replaying the list', async () => {
  for (const scenario of singleSelectionScenarios()) {
    const result = await simulateSingleSelection(scenario);
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
  }
});

test('selection keeps the asset through purchase intent and stock verification without assuming payment or availability', async () => {
  const result = await simulateSingleSelection({ closing: true });
  assert.equal(result.passed, true, result.error); assert.equal(result.selected_id, ASSET.id);
  assert.equal(result.searches, 1); assert.equal(result.detail_reads, 3);
});

test('multiple offered properties need a specific pointer even for the same positive replies', async () => {
  const other = { ...ASSET, id: '109427', detail_url: 'https://solusindoaset.com/Lelang/another-property-109427' };
  const history = [assistant(singleList('html', [ASSET, other]))];
  for (const text of PHRASES) {
    assert.equal(selectedRecommendation(text, history)?.kind, 'ambiguous', text);
    const result = await generatePropertyReply({ text, history, now: NOW, ai: noAi,
      catalog: { resolve() { assert.fail('An ambiguous reference must not fetch or search properties'); } } });
    assert.equal(result.reply, AMBIGUOUS_SELECTION_REPLY); assert.equal(result.asset, null);
  }
});

test('one recommendation does not override negative answers, new criteria, alternative searches, or explicit pointers', () => {
  const history = [assistant(singleList())];
  for (const text of ['tidak mau aset tersebut', 'bukan aset tersebut pak', 'belum mau yang ini', 'aset itu jangan',
    'budget saya 400-600 mentok', 'luas tanah 100-200', 'cari aset lain', 'carikan rumah di area aset tersebut',
    'Kode 999999', 'boleh aset tersebut https://solusindoaset.com/Lelang/another-property-999999', 'yang nomor 2']) {
    assert.notEqual(selectedRecommendation(text, history)?.id, ASSET.id, text);
  }
  const unrelated = [...history, assistant('Budget-nya ingin diubah sampai berapa?')];
  assert.equal(selectedRecommendation(REPORTED, unrelated), null);
  assert.equal(selectedRecommendation(REPORTED, []), null);
  const afterDetails = [...history, user(REPORTED), assistant('*DETAIL ASET — Kode 106286*\nMau saya jelaskan biayanya?')];
  for (const text of ['boleh', 'iya', 'oke']) assert.equal(selectedRecommendation(text, afterDetails), null, text);
  for (const text of ['boleh', 'iya', 'oke']) assert.equal(interactionDecision({ text, history }), 'allow', text);
});

test('a sole old card is only an ID pointer: fresh price wins and a withdrawn asset never returns stale detail', async () => {
  const history = [assistant(singleList('html'))], fresh = singleFixture({ freshPrice: 490000000 });
  const result = await generatePropertyReply({ text: REPORTED, history, catalog: fresh, ai: noAi, now: NOW });
  assert.equal(result.asset.id, ASSET.id); assert.match(result.reply, /Harga limit: Rp 490\.000\.000/);
  assert.doesNotMatch(result.reply, /500\.000\.000/); assert.equal(fresh.calls.length, 1);
  const missing = singleFixture({ missing: true });
  const withdrawn = await generatePropertyReply({ text: REPORTED, history, catalog: missing, ai: noAi, now: NOW });
  assert.equal(withdrawn.asset, null); assert.match(withdrawn.reply, /belum ditemukan dalam listing publik terbaru/);
  assert.doesNotMatch(withdrawn.reply, /500\.000\.000|149 m²|sudah terjual|Berikut pilihan/);
  assert.equal(missing.calls.length, 1); assert.equal(missing.calls[0].criteria, undefined);
});

test('Playground selects the sole offer from its own stored conversation instead of repeating the search', async (t) => {
  const token = 'x'.repeat(40), app = express(), catalog = singleFixture();
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
  const list = await post(OPENING);
  assert.match(list.reply, /Mau saya bantu cek detail aset ini\?/); assert.doesNotMatch(list.reply, /Sebutkan nomor/);
  const detail = await post(REPORTED);
  assert.equal(detail.asset.id, ASSET.id); assert.match(detail.reply, /DETAIL ASET.*106286/);
  assert.doesNotMatch(detail.reply, /Berikut pilihan|Sebutkan nomor/);
  assert.equal(detail.session.is_bot_active, true); assert.equal(catalog.calls.length, 2);
  assert.equal(catalog.calls[1].text, `Kode ${ASSET.id}`); assert.equal(catalog.calls[1].criteria, undefined);
});

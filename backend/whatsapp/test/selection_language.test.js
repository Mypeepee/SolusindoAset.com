import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { selectionLanguageScenarios, simulateSelectionLanguage, selectionFixture, selectionHistory, ASSETS, NOW, OPENING } from '../scripts/lib/selection-language-dialogues.js';
import { selectedRecommendation, MISSING_SELECTION_REPLY } from '../services/property_selection.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';

test('everyday selection phrases open the correct fresh property across raw, escaped Markdown and split lists', async () => {
  for (const scenario of selectionLanguageScenarios()) {
    const result = await simulateSelectionLanguage(scenario);
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
  }
});
test('reported Sukodono conversation selects 118928 after 12 minutes, then another item, retaining search requirements', async () => {
  let now = NOW;
  const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
  const store = new MemoryStore(config, () => now), catalog = selectionFixture(), sent = [], phone = '6280000000001';
  const processor = new MessageProcessor({ config, store, catalog, now: () => now,
    ai: { generate() { assert.fail('Selection must work without AI'); } }, whatsapp: { async sendText(contact, text) { sent.push(text); return randomUUID(); } },
    logger: { error(value) { assert.fail(value.event); } } });
  const send = async (text) => { processor.acceptBatch([{ id: randomUUID(), from: phone, type: 'text', text, timestamp: now }]); await processor.drain(); };
  await send(OPENING); now += 12 * 60000;
  await send('coba nomor 1');
  assert.match(sent.at(-1), /DETAIL ASET.*118928/); assert.equal(store.get(phone).asset_id, '118928');
  assert.equal(catalog.calls.length, 2); assert.equal(catalog.calls.at(-1).criteria, undefined);
  await send('boleh lihat nomor 2?');
  assert.match(sent.at(-1), /DETAIL ASET.*118762/); assert.equal(store.get(phone).asset_id, '118762');
  assert.equal(catalog.calls.length, 3); assert.equal(catalog.calls.at(-1).criteria, undefined);
  await send('ada yang lain?');
  assert.equal(catalog.calls.at(-1).criteria.max_price, 350000000);
  assert.equal(catalog.calls.at(-1).criteria.district.toLowerCase(), 'sukodono');
  assert.deepEqual(new Set(catalog.calls.at(-1).criteria.exclude_ids), new Set(ASSETS.map((asset) => asset.id)));
  assert.match(sent.at(-1), /Belum ketemu/); assert.doesNotMatch(sent.at(-1), /Budget-nya sampai berapa|kelurahan mana/);
});
test('ambiguous numbers and deictic pointers clarify instead of selecting an arbitrary card', () => {
  const history = selectionHistory();
  for (const text of ['nomor 1 atau 2', 'nomor 1 dan 2', '1 atau 2', 'coba 1 dan 2', 'yang itu', 'coba yang itu', 'boleh detail yang itu?']) assert.equal(selectedRecommendation(text, history)?.kind, 'ambiguous', text);
  for (const text of ['nomor 0', 'coba nomor 6', 'no 99', '7']) assert.equal(selectedRecommendation(text, history)?.kind, 'invalid', text);
});
test('rejected choices, street numbers, quantity requests and explicit property codes cannot become an ordinal', () => {
  const history = selectionHistory();
  for (const text of ['bukan yang 1', 'yang 1 jangan', 'saya tidak suka yang nomor 1', 'skip nomor 1', 'nomor 1 nggak dulu',
    'budget saya nomor 2', 'nomor 2 miliar', 'yang 2 kamar', 'di Jalan Melati nomor 2', 'Kode 118762', ASSETS[1].detail_url]) assert.equal(selectedRecommendation(text, history)?.id ?? null, null, text);
  assert.equal(selectedRecommendation('bukan nomor 1, tapi nomor 2 saja', history)?.id, ASSETS[1].id);
});
test('a missing recommendation list asks for a property pointer without re-running a search', async () => {
  const catalog = { resolve() { assert.fail('Missing list cannot justify a catalog search'); } };
  const text = 'coba nomor 1';
  const result = await generatePropertyReply({ text, history: [], catalog, ai: { generate() { assert.fail('Missing list cannot be guessed by AI'); } } });
  assert.equal(result.reply, MISSING_SELECTION_REPLY); assert.equal(result.asset, null);
});

test('selection corrections retain the list and a newer list replaces its number order', async () => {
  const catalog = selectionFixture(), history = selectionHistory('markdown');
  for (const text of ['coba nomor 9', 'nomor 1 atau 2']) {
    const result = await generatePropertyReply({ text, history, catalog, ai: { generate() { assert.fail('Clarification must not invoke AI'); } }, now: NOW });
    history.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply });
  }
  assert.equal(catalog.calls.length, 0);
  assert.equal(selectedRecommendation('coba nomor 1', history)?.id, ASSETS[0].id);
  history.push({ role: 'user', content: 'ada yang lain?' }, { role: 'assistant', content: `1. **Pilihan pengganti**\nLihat detail: ${ASSETS[4].detail_url}` });
  const result = await generatePropertyReply({ text: 'coba nomor 1', history, catalog, ai: { generate() { assert.fail('Selection must not invoke AI'); } }, now: NOW });
  assert.equal(result.asset.id, ASSETS[4].id);
  assert.match(result.reply, /DETAIL ASET.*115588/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { understandingScenarios, runUnderstandingScenario } from '../scripts/lib/understanding-dialogues.js';
import { buyerContext } from '../services/buyer_profile.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { createAiController } from '../services/ai_controller.js';
import { interpretationConfirmation } from '../services/buyer_interpreter.js';
import { confirmedPreferenceText, UNDERSTANDING_VERSION } from '../services/buyer_turn.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { createApp } from '../app.js';

const opening = ['Cari lelang aset di Kecamatan Menganti, Kabupaten Gresik', 'seluruh Menganti pak budget 400 juta'];
const novel = 'Buat tempat tinggal ataupun buka warung pak, soal ukuran jangan dipikirin';
const proposal = { categories: ['RUMAH', 'TOKO'], category_evidence: 'tempat tinggal ataupun buka warung',
  land_unrestricted: true, land_evidence: 'soal ukuran jangan dipikirin' };
const confirmation = 'Apakah maksud Bapak/Ibu: jenis rumah atau toko; luas tanah bebas?';
const user = (content) => ({ role: 'user', content });
const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000, adminToken: 'x'.repeat(40) };

function stubCatalog() {
  const calls = [];
  return { calls, async resolve(_text, _id, criteria) {
    calls.push(criteria);
    return { asset: null, catalog: [], status: 'not_found', source: 'simulation' };
  } };
}
function modelStub({ provider = 'openai', output = proposal, error, incomplete = false } = {}) {
  const requests = [];
  const ai = createAiController({ provider, model: 'test-model', apiKey: 'test-key', timeoutMs: 1000 }, {
    fetchImpl: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (error) return Response.json({ error: { code: 'insufficient_quota' } }, { status: error });
      const text = typeof output === 'string' ? output : JSON.stringify(output);
      return provider === 'openai'
        ? Response.json({ status: incomplete ? 'incomplete' : 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] })
        : Response.json({ candidates: [{ finishReason: incomplete ? 'MAX_TOKENS' : 'STOP', content: { parts: [{ text }] } }] });
    },
  });
  return { ai, requests };
}
function dialogue(ai) {
  const history = [], catalog = stubCatalog();
  return { history, catalog, async send(text) {
    history.push(user(text));
    const response = await generatePropertyReply({ text, history, catalog, ai });
    const buyer = buyerContext(history, text, null);
    history.push({ role: 'assistant', content: response.reply });
    return { ...response, buyer };
  } };
}

test('524 independent state-transition and language scenarios retain meaning across turns', async () => {
  for (const scenario of understandingScenarios()) {
    const result = await runUnderstandingScenario(scenario);
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
  }
});

for (const provider of ['openai', 'gemini']) test(`${provider} semantic fallback proposes a grounded interpretation, applies it only after client confirmation`, async () => {
  const { ai, requests } = modelStub({ provider }), d = dialogue(ai);
  for (const text of opening) await d.send(text);
  const pending = await d.send(novel);
  assert.equal(pending.reply, confirmation);
  assert.equal(pending.buyer.profile.category, null); assert.equal(d.catalog.calls.length, 0);
  assert.equal(pending.knowledge.understanding.version, UNDERSTANDING_VERSION);
  assert.equal(requests.length, 1);
  const body = requests[0].body;
  if (provider === 'openai') {
    assert.equal(body.store, false); assert.equal(body.text.format.name, 'buyer_interpretation'); assert.equal(body.text.format.strict, true);
  } else assert.equal(body.generationConfig.responseMimeType, 'application/json');
  const ready = await d.send('iya betul pak');
  assert.equal(ready.knowledge.status, 'not_found'); assert.equal(d.catalog.calls.length, 1);
  const criteria = d.catalog.calls[0];
  assert.deepEqual(criteria.categories, ['RUMAH', 'TOKO']); assert.equal(criteria.max_price, 400000000);
  assert.equal(criteria.district, 'Menganti'); assert.equal(criteria.min_land_area_m2, null);
  assert.equal(requests.length, 1, 'confirmation is deterministic');
  const corrected = await d.send('toko jangan, rumah saja');
  assert.equal(corrected.buyer.profile.category, 'RUMAH'); assert.equal(corrected.buyer.profile.categories, undefined);
  assert.equal(corrected.buyer.profile.max_price, 400000000);
});

test('ordinary short approval confirms only the bounded proposal, not questionnaire options', () => {
  for (const text of ['iya', 'betul pak', 'oke', 'ok', 'setuju', 'benar bu']) assert.equal(confirmedPreferenceText(text, confirmation), 'jenis rumah atau toko, luas tanah bebas');
  for (const text of ['iya tapi bukan toko', 'tidak', 'belum yakin', 'iya?']) assert.equal(confirmedPreferenceText(text, confirmation), null);
  assert.equal(confirmedPreferenceText('iya', 'Jenis properti apa: rumah atau toko?'), null);
  assert.equal(confirmedPreferenceText('iya', 'Apakah maksud Bapak/Ibu: budget 400000000; lokasi Surabaya?'), null);
});

test('rejection, uncertainty and corrections never silently adopt an AI suggestion', async () => {
  for (const text of ['bukan itu', 'belum yakin pak', 'rumah saja, luas minimal 150m2']) {
    const d = dialogue(modelStub().ai);
    for (const message of [...opening, novel]) await d.send(message);
    const result = await d.send(text);
    if (text.startsWith('rumah')) {
      assert.equal(result.buyer.profile.category, 'RUMAH'); assert.equal(result.buyer.profile.min_land_area_m2, 150);
      assert.equal(d.catalog.calls.length, 1);
    } else { assert.equal(result.buyer.profile.category, null); assert.equal(d.catalog.calls.length, 0); }
  }
});

test('malformed, ungrounded, unavailable and quota-limited model results fall back without changing filters or querying', async () => {
  for (const options of [{ output: '{broken' }, { output: { ...proposal, category_evidence: 'fabricated', land_evidence: 'fabricated' } },
    { error: 429 }, { error: 503 }, { incomplete: true }, { output: { ...proposal, categories: ['UNSUPPORTED'], land_unrestricted: false } }]) {
    const d = dialogue(modelStub(options).ai);
    for (const text of opening) await d.send(text);
    const result = await d.send(novel);
    assert.match(result.reply, /belum menangkap/); assert.doesNotMatch(result.reply, /Apakah maksud/);
    assert.equal(d.catalog.calls.length, 0); assert.equal(result.buyer.profile.max_price, 400000000);
    assert.equal(result.buyer.profile.location, 'Menganti');
  }
});

test('only unresolved slots may be proposed; model cannot broaden known fields or use numbers as unlimited area', () => {
  assert.equal(interpretationConfirmation(proposal, novel, ['max_price']), null);
  assert.equal(interpretationConfirmation({ ...proposal, land_evidence: 'luas 120 meter' }, 'luas 120 meter', ['land_area']), null);
  assert.equal(interpretationConfirmation({ ...proposal, land_evidence: 'luas bangunan bebas' }, 'luas bangunan bebas', ['land_area']), null);
  assert.equal(interpretationConfirmation({ ...proposal, categories: ['RUMAH', 'RUMAH'], land_unrestricted: null }, novel, ['category']), null);
  assert.equal(interpretationConfirmation({ ...proposal, sql: 'SELECT *' }, novel, ['category', 'land_area']), null);
  assert.equal(interpretationConfirmation({ ...proposal, categories: [['RUMAH']], land_unrestricted: null }, novel, ['category']), null);
});

test('questions, preferences and negated quantity bounds remain separate within a message', async () => {
  const d = dialogue({ generate() { assert.fail(); } });
  for (const text of opening) await d.send(text);
  const explanation = await d.send('apa bedanya rumah dan ruko? saya pilih toko, luas bebas');
  assert.match(explanation.reply, /ruko menggabungkan/);
  assert.equal(explanation.buyer.profile.category, 'TOKO');
  assert.equal(explanation.buyer.profile.min_land_area_m2, null); assert.equal(d.catalog.calls.length, 0);
  const ready = await d.send('rumah dan toko, luas bebas. gak jadi toko. budget jangan di atas 350 juta');
  assert.equal(ready.buyer.profile.category, 'RUMAH'); assert.equal(ready.buyer.profile.max_price, 350000000);
  assert.equal(ready.buyer.profile.min_price, null); assert.equal(d.catalog.calls.length, 1);
});

test('Indonesian negation tak stays negation; land language never turns a boarding house into TANAH', async () => {
  for (const text of ['rumah, tak ada batasan luas', 'Bangunan kamar-kamar untuk indekos, besar kecil tanah tidak masalah.']) {
    const d = dialogue({ generate() { assert.fail(); } });
    for (const message of [...opening, text]) await d.send(message);
    assert.equal(d.catalog.calls.length, 1);
    assert.equal(d.catalog.calls[0].category, text.startsWith('rumah') ? 'RUMAH' : 'KOS');
    assert.equal(d.catalog.calls[0].min_land_area_m2, null);
  }
});

test('a confirmation can include a new explicit bound, and an educational land explanation accepts yes', async () => {
  const d = dialogue(modelStub().ai);
  for (const text of [...opening, novel]) await d.send(text);
  const result = await d.send('iya, luas minimal 150m2');
  assert.deepEqual(result.buyer.profile.categories, ['RUMAH', 'TOKO']);
  assert.equal(result.buyer.profile.min_land_area_m2, 150); assert.equal(d.catalog.calls.length, 1);
  await d.send('kalau luasnya bebas maksudnya apa?');
  assert.equal(d.catalog.calls.length, 1);
  const free = await d.send('iya pak');
  assert.equal(free.buyer.profile.min_land_area_m2, null); assert.equal(d.catalog.calls.length, 2);
});

test('well-understood answers and explicit unknowns never spend a model request', async () => {
  for (const text of ['rumah dan toko pak. tidak ada batasan luasan', 'belum tahu pak', 'rumah saja', 'rumah saja pak', 'bebas pak', 'rumah, 120m2']) {
    const { ai, requests } = modelStub(), d = dialogue(ai);
    for (const message of [...opening, text]) await d.send(message);
    assert.equal(requests.length, 0, text);
  }
});

test('model cancellation propagates instead of emitting a fallback after Reset', async () => {
  const d = dialogue({ generate() { assert.fail(); } });
  for (const text of opening) await d.send(text);
  const controller = new AbortController();
  const ai = { async interpretBuyer() { controller.abort(new Error('reset')); throw new Error('reset'); } };
  await assert.rejects(generatePropertyReply({ text: novel, history: [...d.history, user(novel)], catalog: d.catalog, ai, signal: controller.signal }), /reset/);
  assert.equal(d.catalog.calls.length, 0);
});

test('WhatsApp and Playground share the same semantic confirmation lifecycle', async (t) => {
  const catalog = stubCatalog(), { ai, requests } = modelStub(), sent = [], now = () => Date.parse('2026-10-13T08:00:00Z');
  const store = new MemoryStore(config, now);
  const processor = new MessageProcessor({ config, store, catalog, ai, now,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'sent'; } }, logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  for (const text of [...opening, novel, 'oke']) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: '6281234567890', timestamp: now() }]); await processor.drain();
  }
  assert.equal(sent[2], confirmation); assert.equal(catalog.calls.length, 1); assert.equal(requests.length, 1);
  assert.deepEqual(catalog.calls[0].categories, ['RUMAH', 'TOKO']);
  const app = express(); app.use('/sandbox', createSandboxRouter({ config, catalog, ai, now }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID(); let result;
  for (const text of [...opening, novel, 'betul']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${config.adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); result = await response.json();
    if (text === novel) assert.equal(result.reply, confirmation);
  }
  assert.equal(result.knowledge.status, 'not_found'); assert.equal(catalog.calls.length, 2); assert.equal(requests.length, 2);
});

test('health endpoint identifies the loaded understanding version without exposing configuration', async (t) => {
  const app = createApp({ config, processor: { accepting: true } });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const body = await (await fetch(`http://127.0.0.1:${server.address().port}/health`)).json();
  assert.equal(body.understanding_version, UNDERSTANDING_VERSION);
  assert.doesNotMatch(JSON.stringify(body), /apiKey|adminToken|DATABASE/);
});

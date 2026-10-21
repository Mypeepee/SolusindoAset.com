import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { CONTEXT_REQUIRED_MESSAGE, HANDOVER_MESSAGE, IDLE_TIMEOUT_MS, detectHandover } from '../services/interaction_policy.js';
import { INTRODUCTION_MESSAGE } from '../services/client_identity.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { extractMessages } from '../routes/webhook.js';
import { createAiController } from '../services/ai_controller.js';
import { loadConfig } from '../config.js';
import { CLARIFY_PROPERTY_MESSAGE } from '../services/search_reply.js';

const NOW = Date.parse('2026-10-09T03:00:00Z'), PHONE = '6281234567890';
const asset = (id) => ({ id, transaction_type: 'LELANG', name: `Aset ${id}`, location: 'Sumenep', address: { city: 'Sumenep' },
  limit_price: 500000000, auction_at: '2027-01-01T00:00:00Z', publication: { status: 'TERSEDIA' } });
function fixture(options = {}) {
  let time = NOW;
  const config = { transport: 'baileys', defaultAssetId: '999', maxSessions: 100, maxPending: 100, maxPendingPerPhone: 20,
    maxDedup: 1000, sessionTtlMs: 86400000, sessionIdleMs: IDLE_TIMEOUT_MS };
  const store = new MemoryStore(config, () => time), sent = [], reads = [], calls = [];
  const catalog = { async resolve(text, previousId, criteria) {
    reads.push({ text, previousId, criteria });
    const id = /\bKode\s+(\d+)/i.exec(text)?.[1] || previousId;
    return { asset: id ? asset(id) : null, catalog: [], status: id ? 'matched' : 'not_found', source: 'database_listing_publik' };
  } };
  const ai = options.ai || { async generate(input) { calls.push(input); return { reply: `Harga limit aset ${input.facts?.id} adalah Rp500 juta.`, qualification: {} }; } };
  const processor = new MessageProcessor({ config, store, catalog, ai, now: () => time, logger: { error() {} },
    whatsapp: { async sendText(to, text) { sent.push(text); return 'sent'; } } });
  const accept = (id, text, extra = {}) => processor.acceptBatch([{ id, from: PHONE, text, type: 'text', timestamp: time, ...extra }]);
  const send = async (id, text, extra) => { accept(id, text, extra); await processor.drain(); };
  return { config, store, processor, catalog, ai, reads, calls, sent, accept, send, setTime: (value) => { time = value; } };
}

test('greeting/media/off-topic send exactly one fixed reply without reading DB or LLM until property context arrives', async () => {
  const f = fixture();
  await f.send('hello', 'Halo'); await f.send('ping', 'P'); await f.send('sticker', null, { type: 'sticker' });
  await f.send('weather', 'Bagaimana cuaca hari ini?');
  assert.deepEqual(f.sent, [INTRODUCTION_MESSAGE]); assert.equal(f.reads.length, 0); assert.equal(f.calls.length, 0);
  assert.equal(f.store.get(PHONE).asset_id, null, 'configured default asset cannot establish customer context');
  await f.send('asset', 'Kode 121791, masih tersedia?');
  assert.equal(f.calls.length, 1); assert.equal(f.store.get(PHONE).asset_id, '121791');
  await f.send('offtopic', 'Buat pantun dong'); await f.send('again', 'Pagi');
  assert.equal(f.sent.filter((text) => text === CONTEXT_REQUIRED_MESSAGE).length, 0);
  await f.send('resume', 'brp harganya?');
  assert.equal(f.calls.length, 2); assert.equal(f.calls.at(-1).facts.id, '121791');
  await f.send('facility', 'Dekat lapangan bola?');
  assert.equal(f.calls.length, 3, 'facility questions must not be mistaken for casual sports talk');
});

test('session stays on the chosen asset; budget alone cannot trigger alternatives and explicit new asset replaces old context', async () => {
  const f = fixture(); await f.send('first', 'Kode 121791, luasnya?');
  await f.send('budget', 'Budget 500 juta untuk dihuni sekaligus investasi');
  assert.equal(f.calls.at(-1).facts.id, '121791'); assert.deepEqual(f.calls.at(-1).catalog, []);
  assert.ok(f.reads.every((call) => !call.criteria));
  await f.send('switch', 'Kode 119497, lokasi?');
  assert.equal(f.store.get(PHONE).asset_id, '119497');
  assert.deepEqual(f.calls.at(-1).history.map((m) => m.content), ['Kode 119497, lokasi?']);
  await f.send('explicit-search', 'Cari lelang alternatif ruko di seluruh Sumenep budget 500 juta untuk investasi, luas tanah bebas');
  assert.equal(f.reads.at(-1).criteria.transaction_type, 'LELANG');
  assert.equal(f.reads.at(-1).criteria.max_price, 500000000);
});

test('negotiation, viewing and specific legal documents pause before analysis and notify only once', async () => {
  for (const text of ['bisa nego?', 'Saya tawar 400 juta', 'Mau viewing besok', 'Sertifikatnya SHM?', 'Minta akta grosse', 'Apakah HGB?', 'harga bisa turun?', 'Bisa jadwal survei?']) {
    const f = fixture(); await f.send('trigger', text);
    assert.equal(f.calls.length, 0, text); assert.equal(f.reads.length, 0, text);
    assert.equal(f.store.get(PHONE).is_bot_active, false, text);
    await f.send('after', 'Kode 121791, luasnya?');
    assert.deepEqual(f.sent, [HANDOVER_MESSAGE], text);
  }
  assert.equal(detectHandover('Halo Jason, Saya tertarik dengan properti lelang berikut, apakah masih tersedia?\n🔨 Rumah SHM\nKode: 121791'), null, 'certificate type embedded in template is not a document request');
  assert.equal(detectHandover('Cari lelang rumah dengan harga kurang dari Rp500 juta'), null, 'a price ceiling is not a negotiation');
});

test('explicit alternative request may collect follow-up criteria without unlocking an unrelated selected property', async () => {
  const f = fixture(); await f.send('first', 'Kode 121791');
  await f.send('search', 'Ada alternatif?');
  assert.match(f.sent.at(-1), /[Ii]ncar daerah mana/); assert.match(f.sent.at(-1), /Pak atau Bu siapa/);
  await f.send('criteria', 'Jenis ruko di seluruh Sumenep, budget 500 juta untuk investasi, luas tanah bebas');
  assert.equal(f.reads.at(-1).criteria.max_price, 500000000);
  assert.equal(f.reads.at(-1).criteria.location, 'Sumenep');
  await f.send('select', 'Kode 119497');
  await f.send('followup', 'brp harganya?');
  assert.equal(f.calls.at(-1).facts.id, '119497');
  assert.equal(f.reads.at(-1).criteria, undefined);
});

test('semantic out-of-scope classification cannot create repeated notices after the first response', async () => {
  let classify = false;
  const f = fixture({ ai: { async generate() { return classify
    ? { action: 'out_of_scope', reply: 'Never send model wording.', qualification: {} }
    : { reply: 'Harga limit tercatat Rp500 juta.', qualification: {} }; } } });
  await f.send('first', 'Kode 121791'); classify = true;
  await f.send('off-topic', 'Detail rumah tangga artis itu');
  await f.send('repeat', 'Detail rumah tangga artis lainnya');
  assert.deepEqual(f.sent, ['Harga limit tercatat Rp500 juta.']);
  assert.equal(f.store.get(PHONE).is_bot_active, true);
});

test('unrecognized property follow-ups ask for clarification and retain the active conversation', async () => {
  let entered, release; const started = new Promise((resolve) => { entered = resolve; });
  const f = fixture({ ai: { async generate() { entered(); return new Promise((resolve) => { release = resolve; }); } } });
  f.accept('asset', 'Kode 121791'); await started;
  f.accept('slang', 'skibibop zxr nganuuu');
  assert.equal(f.store.get(PHONE).is_bot_active, true);
  release({ reply: 'Late property answer', qualification: {} }); await f.processor.drain();
  assert.deepEqual(f.sent, ['Late property answer', CLARIFY_PROPERTY_MESSAGE]);
  assert.equal(f.store.get(PHONE).asset_id, '121791');
  assert.equal(f.store.get(PHONE).handover, null);
});

test('idle reset clears asset, history and qualification using last inbound time; human handoff survives timeout', async () => {
  const f = fixture(); await f.send('asset', 'Kode 121791');
  f.store.get(PHONE).qualification = { funds: { value: 'ready' } };
  f.setTime(NOW + IDLE_TIMEOUT_MS + 1); await f.send('tomorrow', 'Halo');
  assert.equal(f.store.get(PHONE).asset_id, null); assert.deepEqual(f.store.get(PHONE).qualification, {});
  assert.equal(f.store.get(PHONE).history[0].content, 'Halo'); assert.equal(f.sent.at(-1), INTRODUCTION_MESSAGE);
  await f.send('new', 'Kode 119497'); assert.equal(f.calls.at(-1).facts.id, '119497');
  await f.send('handoff', 'bisa nego?'); const sent = f.sent.length;
  f.setTime(NOW + IDLE_TIMEOUT_MS * 3); await f.send('late', 'Kode 121791');
  assert.equal(f.store.get(PHONE).is_bot_active, false); assert.equal(f.sent.length, sent);
});

test('idle reset while a model is running discards its stale result and starts the new property cleanly', async () => {
  let release, enter, count = 0; const started = new Promise((resolve) => { enter = resolve; });
  const f = fixture({ ai: { async generate(input) {
    count++; if (count === 1) { enter(); return new Promise((resolve) => { release = resolve; }); }
    assert.equal(input.facts.id, '119497'); assert.deepEqual(input.history.map((m) => m.content), ['Kode 119497']);
    return { reply: 'Jawaban aset baru.', qualification: {} };
  } } });
  f.accept('old', 'Kode 121791'); await started;
  f.setTime(NOW + IDLE_TIMEOUT_MS + 1); f.accept('new', 'Kode 119497');
  release({ reply: 'Jawaban lama.', qualification: {} }); await f.processor.drain();
  assert.deepEqual(f.sent, ['Jawaban aset baru.']);
});

test('groups, broadcasts, statuses and own messages are ignored before touching content or reserving session memory', () => {
  const f = fixture();
  for (const flag of [{ isGroup: true }, { isStatus: true }, { isBroadcast: true }, { broadcast: true }, { fromMe: true }, { from: 'status@broadcast' }, { from: '123@g.us' }]) {
    assert.equal(f.processor.acceptBatch([{ id: randomUUID(), from: PHONE, ...flag, get text() { throw new Error('must never read content'); } }]), 0);
  }
  assert.equal(f.store.sessions.size, 0); assert.equal(f.store.seen.size, 0);
  const messages = [{ id: 'group', from: PHONE, isGroup: true }, { id: 'status', from: PHONE, isStatus: true }];
  assert.deepEqual(extractMessages({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: '1' }, messages } }] }] }, '1', NOW), []);
});

test('model semantic handoff uses the exact approved message and pauses subsequent live responses', async () => {
  const unknown = Object.fromEntries(['purpose', 'funds', 'settlement'].map((key) => [key, { value: 'unknown', evidence: '' }]));
  const ai = createAiController({ provider: 'gemini', model: 'test', apiKey: 'test', timeoutMs: 1000 }, {
    fetchImpl: async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ action: 'handoff', reply: 'Model must not negotiate here.', qualification: unknown }) }] } }] }),
  });
  const f = fixture({ ai }); await f.send('asset', 'Kode 121791, mohon jelaskan');
  await f.send('after', 'Masih tersedia?');
  assert.deepEqual(f.sent, [HANDOVER_MESSAGE]); assert.equal(f.store.get(PHONE).is_bot_active, false);
});

test('sandbox mirrors one-time greeting, locks and handoff per conversation/agent, including idle reset', async (t) => {
  const f = fixture(), app = express(), token = 'x'.repeat(40); let time = NOW;
  app.use('/sandbox', createSandboxRouter({ config: { ...f.config, adminToken: token }, catalog: f.catalog, ai: f.ai, now: () => time }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const cid = randomUUID(); const post = async (text, conversationId = cid, agent = 'AG1', history = []) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/${agent}/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [...history, { role: 'user', content: text }] }) });
    assert.equal(response.status, 200); return response.json();
  };
  assert.equal((await post('Halo')).reply, INTRODUCTION_MESSAGE);
  assert.equal((await post('P')).suppressed, true);
  assert.equal((await post('Kode 121791')).session.asset_id, '121791');
  assert.equal((await post('luasnya?')).asset.id, '121791');
  assert.equal((await post('Halo', cid, 'AG2')).reply, INTRODUCTION_MESSAGE);
  time += IDLE_TIMEOUT_MS + 1;
  const expired = await post('Halo', cid, 'AG1', [{ role: 'user', content: 'Kode 121791' }]);
  assert.equal(expired.session.asset_id, null); assert.equal(expired.reply, CONTEXT_REQUIRED_MESSAGE);
  const stale = await post('Budget 500 juta', cid, 'AG1', [{ role: 'user', content: 'Cari lelang aset di Sumenep' }, { role: 'user', content: 'Kode 121791' }]);
  assert.equal(stale.suppressed, true); assert.equal(stale.session.asset_id, null, 'stale browser history cannot restore expired context on a later turn');
  await post('Kode 119497', cid, 'AG1', [{ role: 'user', content: 'Kode 121791' }]);
  assert.ok(f.calls.at(-1).history.every((message) => !message.content.includes('121791')));
  assert.equal((await post('bisa nego?')).reply, HANDOVER_MESSAGE);
  time += IDLE_TIMEOUT_MS + 1;
  const paused = await post('Kode 119497'); assert.equal(paused.suppressed, true); assert.equal(paused.session.is_bot_active, false);
  assert.equal((await post('Kode 119497', randomUUID())).asset.id, '119497');
});

test('session idle configuration is bounded to the requested 30–60 minute range', () => {
  const env = { LLM_PROVIDER: 'gemini', LLM_MODEL: 'test', GEMINI_API_KEY: 'test', ADMIN_API_TOKEN: 'x'.repeat(40) };
  assert.equal(loadConfig(env).sessionIdleMs, 45 * 60000);
  assert.equal(loadConfig({ ...env, SESSION_IDLE_MINUTES: '60' }).sessionIdleMs, 60 * 60000);
  assert.throws(() => loadConfig({ ...env, SESSION_IDLE_MINUTES: '29' }), /SESSION_IDLE_MINUTES/);
});

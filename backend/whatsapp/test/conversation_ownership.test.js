import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { ConversationControl } from '../state/conversation_control.js';

const NOW = Date.parse('2026-10-20T19:55:03+07:00'), PHONE = '6281234567890', LID = 'lid:1234567890123';
const QUERY = 'Carikan Ruko prefer manyar/ngagel/pucang ga mau ijo\nnol jalan 2arah aspal. hitung tanah luas min 80 lelang dibawah 1m';
function fixture(t, overrides = {}) {
  let time = NOW, seq = 0, connected = true;
  const controls = new ConversationControl(':memory:', () => time); t.after(() => controls.close());
  const control = controls.forTenant('AG1');
  const config = { transport: 'baileys', replyDelayMs: 0, manualReplyPauseMs: 300000, maxSessions: 100, maxPending: 100,
    maxPendingPerPhone: 20, maxDedup: 1000, sessionTtlMs: 86400000, ...overrides };
  const sent = [], filters = [], errors = [];
  const whatsapp = { getStatus: () => ({ connected, phone: '6289999999999' }), getContactPhone: (p) => p === LID ? PHONE : p,
    getContactAliases: (p) => [PHONE, LID].includes(p) ? [PHONE, LID] : [p],
    async sendText(to, text) { sent.push({ to, text }); return `out-${sent.length}`; } };
  const catalog = { async resolve(text, previousId, criteria) {
    filters.push(criteria); return { status: 'not_found', source: 'database_listing_publik', asset: null, catalog: [] };
  } };
  const ai = { generate() { assert.fail('Known search criteria require no LLM'); } };
  const build = (store) => new MessageProcessor({ config, store, whatsapp, catalog, ai, now: () => time, logger: { error(e) { errors.push(e); } } });
  const store = new MemoryStore(config, () => time, control), processor = build(store);
  const message = (text, extra = {}) => ({ id: `msg-${++seq}`, from: PHONE, timestamp: time, type: 'text', text, ...extra });
  return { controls, control, config, store, processor, whatsapp, sent, filters, errors, build, message,
    advance(ms) { time += ms; }, get time() { return time; }, setConnected(value) { connected = value; },
    async client(text = QUERY, extra = {}) { const m = message(text, extra); processor.acceptBatch([m]); await processor.drain(); return m; },
    owner(text = 'coba lagi pa', extra = {}) { const m = message(text, { type: 'human_takeover', ...extra }); processor.acceptBatch([m]); return m; } };
}

test('reported reminders pause briefly; repeated client messages never restart the owner pause clock', async (t) => {
  const f = fixture(t); f.owner();
  const deadline = f.control.get(PHONE).resume_at;
  f.advance(44000); await f.client();
  f.advance(40000); await f.client();
  assert.equal(f.sent.length, 0);
  assert.equal(f.control.get(PHONE).at, NOW); assert.equal(f.control.get(PHONE).resume_at, deadline);
  assert.equal(f.store.get(PHONE).handover.at, NOW);
  const summary = f.processor.listConversations();
  assert.equal(summary.attention, 1); assert.equal(summary.items[0].resume_at, deadline); assert.equal(summary.items[0].pending_reply, true);
  f.advance(216001); f.processor.flushManualPauses(); await f.processor.drain();
  assert.equal(f.sent.length, 1); assert.equal(f.store.get(PHONE).is_bot_active, true);
  assert.equal(f.control.get(PHONE), undefined); assert.equal(f.control.get(LID), undefined);
  assert.equal(f.filters.at(-1).category, 'RUKO'); assert.equal(f.filters.at(-1).max_price, 1e9);
  assert.deepEqual(f.filters.at(-1).locations, ['Manyar', 'Ngagel', 'Pucang']);
});

test('activating the displayed phone clears its LID too and immediately continues only the latest unanswered message', async (t) => {
  const f = fixture(t); f.owner('saya bantu', { from: LID });
  await f.client('Carikan rumah lelang di Surabaya', { from: LID });
  f.advance(1000); await f.client(QUERY, { from: LID });
  f.processor.setBotActive(PHONE, true); await f.processor.drain();
  assert.equal(f.sent.length, 1); assert.equal(f.store.get(LID).is_bot_active, true);
  assert.equal(f.control.get(PHONE), undefined); assert.equal(f.control.get(LID), undefined);
  assert.equal(f.filters.at(-1).category, 'RUKO');
  f.advance(1000); await f.client('budget maksimal 900 juta', { from: LID });
  assert.equal(f.sent.length, 2); assert.equal(f.filters.at(-1).max_price, 900e6);
});

test('a late duplicate manual message cannot pause the bot again after activation', async (t) => {
  const f = fixture(t), owner = f.owner();
  f.advance(2000); f.processor.setBotActive(PHONE, true);
  f.processor.acceptBatch([owner]); assert.equal(f.store.get(PHONE).is_bot_active, true);
  f.processor.acceptBatch([{ ...owner, id: 'different-old-echo' }]); assert.equal(f.store.get(PHONE).is_bot_active, true);
  await f.client(); assert.equal(f.sent.length, 1);
  f.advance(2000); f.owner('Saya jawab lagi'); assert.equal(f.store.get(PHONE).is_bot_active, false);
  assert.equal(f.control.get(PHONE).at, f.time);
});

test('owner IDs stay deduplicated after restart even in the same timestamp second', async (t) => {
  const f = fixture(t), owner = f.owner('coba lagi', { whatsapp_id: 'stable-owner-id' });
  f.advance(100); f.processor.setBotActive(PHONE, true);
  const store = new MemoryStore(f.config, () => f.time, f.control), processor = f.build(store);
  processor.acceptBatch([{ ...owner, id: `${LID}/stable-owner-id`, from: LID }]);
  assert.equal(f.control.get(PHONE), undefined); assert.equal(f.control.get(LID), undefined);
  processor.acceptBatch([f.message(QUERY)]); await processor.drain(); assert.equal(f.sent.length, 1);
});

test('a phone activation made before LID mapping exists overrides the older LID pause when metadata arrives', async (t) => {
  const f = fixture(t); f.control.pause(LID, 'manual_cs');
  f.whatsapp.getContactAliases = (p) => [p]; f.whatsapp.getContactPhone = (p) => p === LID ? null : p;
  f.control.pause(PHONE, 'manual_cs'); f.advance(2000); f.processor.setBotActive(PHONE, true);
  f.whatsapp.getContactAliases = (p) => [PHONE, LID].includes(p) ? [PHONE, LID] : [p];
  f.whatsapp.getContactPhone = (p) => p === LID ? PHONE : p;
  await f.client(QUERY, { from: LID });
  assert.equal(f.sent.length, 1); assert.equal(f.store.get(LID).is_bot_active, true); assert.equal(f.control.get(LID), undefined);
});

test('only an authenticated owner event recognizes #bot on/off; client text cannot enable itself', async (t) => {
  const f = fixture(t); f.owner('#bot off');
  f.advance(600000); await f.client('#bot on'); f.processor.flushManualPauses(); await f.processor.drain();
  assert.equal(f.sent.length, 0); assert.equal(f.store.get(PHONE).is_bot_active, false);
  await f.client(); f.advance(2000); f.owner('#bot on'); await f.processor.drain();
  assert.equal(f.sent.length, 1); assert.equal(f.store.get(PHONE).is_bot_active, true);
  assert.ok(!f.store.get(PHONE).history.some((m) => m.content === '#bot off'));
  f.advance(1000); f.owner('#bot off'); assert.equal(f.store.get(PHONE).is_bot_active, false);
  assert.equal(f.control.get(PHONE).resume_at, undefined);
});

test('a later owner answer clears the pending client question and restarts only the manual pause', async (t) => {
  const f = fixture(t); f.owner(); await f.client();
  f.advance(100000); f.owner('Saya sudah jawab langsung ya');
  assert.equal(f.store.get(PHONE).pending_reply, null);
  f.advance(300001); f.processor.flushManualPauses(); await f.processor.drain();
  assert.equal(f.sent.length, 0); assert.equal(f.store.get(PHONE).is_bot_active, true);
});

test('explicit dashboard pause and human/document handoffs never expire automatically', async (t) => {
  const f = fixture(t); f.store.create(PHONE); f.processor.setBotActive(PHONE, false);
  f.advance(1000); f.owner('saya bantu'); f.advance(600000); f.processor.flushManualPauses();
  assert.equal(f.store.get(PHONE).is_bot_active, false); assert.equal(f.control.get(PHONE).resume_at, undefined);
  f.processor.setBotActive(PHONE, true); await f.client('hubungkan CS');
  assert.match(f.store.get(PHONE).handover.reason, /keyword/);
  f.advance(1000); f.owner(); f.advance(600000); f.processor.flushManualPauses();
  assert.equal(f.store.get(PHONE).is_bot_active, false); assert.match(f.store.get(PHONE).handover.reason, /keyword/);
});

test('a new request for CS during a timed pause pins the handoff instead of auto-resuming it', async (t) => {
  const f = fixture(t); f.owner(); await f.client('hubungkan CS');
  f.advance(600000); f.processor.flushManualPauses(); await f.processor.drain();
  assert.equal(f.store.get(PHONE).is_bot_active, false); assert.match(f.store.get(PHONE).handover.reason, /keyword/);
  assert.equal(f.control.get(PHONE).resume_at, undefined); assert.equal(f.sent.length, 0);
});

test('timed ownership and one pending text survive restart without duplicate generation', async (t) => {
  const f = fixture(t); f.owner(); await f.client();
  const restartedStore = new MemoryStore(f.config, () => f.time, f.control), restarted = f.build(restartedStore);
  f.advance(300001); restarted.flushManualPauses(); await restarted.drain();
  assert.equal(f.sent.length, 1); assert.equal(restartedStore.get(PHONE).history.filter((m) => m.role === 'user').length, 1);
  restarted.flushManualPauses(); await restarted.drain(); assert.equal(f.sent.length, 1);
});

test('offline connections do not consume pending replies; expiry continues after reconnection', async (t) => {
  const f = fixture(t); f.owner(); await f.client(); f.setConnected(false);
  f.advance(300001); f.processor.flushManualPauses(); assert.equal(f.sent.length, 0);
  assert.equal(f.store.get(PHONE).is_bot_active, false);
  f.setConnected(true); f.processor.flushManualPauses(); await f.processor.drain(); assert.equal(f.sent.length, 1);
});

test('activation while disconnected retains the latest reply until the connection returns', async (t) => {
  const f = fixture(t); f.owner(); await f.client(); f.setConnected(false);
  f.processor.setBotActive(PHONE, true); await f.processor.drain();
  assert.equal(f.sent.length, 0); assert.equal(f.processor.listConversations().items[0].reply_state, 'waiting_connection');
  f.setConnected(true); f.processor.flushManualPauses(); await f.processor.drain(); assert.equal(f.sent.length, 1);
});

test('an explicit handoff trigger is not replayed into a second immediate handoff on activation', async (t) => {
  const f = fixture(t); await f.client('hubungkan CS'); assert.equal(f.sent.length, 1);
  assert.equal(f.store.get(PHONE).pending_reply, null);
  f.processor.setBotActive(PHONE, true); await f.processor.drain();
  assert.equal(f.sent.length, 1); assert.equal(f.store.get(PHONE).is_bot_active, true);
});

for (const seconds of [0, -1]) test(`manual pause policy supports ${seconds === 0 ? 'the next client message' : 'explicit activation only'}`, async (t) => {
  const f = fixture(t, { manualReplyPauseMs: seconds * 1000 }); f.owner(); f.advance(1000); await f.client();
  assert.equal(f.sent.length, seconds === 0 ? 1 : 0);
});

test('internal stoker accounts are clearly excluded and cannot appear as successfully enabled', async (t) => {
  const f = fixture(t, { stokerPhone: PHONE }); f.owner();
  assert.equal(f.store.sessions.size, 0);
  f.control.pause(PHONE, 'manual_cs');
  assert.throws(() => f.processor.setBotActive(PHONE, true), { code: 'BOT_CONTACT_EXCLUDED' });
  const summary = f.processor.listConversations();
  assert.equal(summary.attention, 0); assert.equal(summary.items[0].blocked_reason, 'internal_stock_contact');
});

test('resume during queued work invalidates old tasks without failing the activation request', async (t) => {
  const f = fixture(t); f.owner();
  f.processor.acceptBatch([f.message(QUERY)]);
  assert.ok(f.processor.pending > 0);
  assert.doesNotThrow(() => f.processor.setBotActive(PHONE, true));
  await f.processor.drain(); assert.equal(f.sent.length, 1); assert.deepEqual(f.errors, []);
});

test('expired or sensitive pending input is not replayed by automatic activation', async (t) => {
  const f = fixture(t); f.owner(); await f.client('password saya rahasia');
  assert.equal(f.store.get(PHONE).pending_reply, null);
  f.advance(300001); f.processor.flushManualPauses(); await f.processor.drain(); assert.equal(f.sent.length, 0);
  f.owner(); await f.client(); f.advance(16 * 60000); f.processor.flushManualPauses(); await f.processor.drain();
  assert.equal(f.sent.length, 0);
});

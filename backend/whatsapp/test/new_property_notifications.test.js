import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RecommendationOutbox } from '../state/recommendation_outbox.js';
import { NewPropertyNotifications, recommendationDay, nextRecommendationMorning } from '../services/new_property_notifications.js';
import { MemoryStore } from '../state/memory_store.js';
import { MessageProcessor } from '../services/message_processor.js';
import { ConversationControl } from '../state/conversation_control.js';
import { selectedRecommendation } from '../services/property_selection.js';
import { CLOSING_STATE } from '../services/closing_state.js';
import { loadConfig } from '../config.js';
import { qualifiedClientFunnel } from '../services/client_capture.js';
import { DEFAULT_BOT_CONTROL_PHONE as CONTROL } from '../services/bot_control.js';

const NOW = Date.parse('2026-10-20T10:00:00+07:00'), PHONE = '6280000000001', AGENT = 'AG108';
const TEXT = 'Halo Rina, saya ada 2 tanah baru yang cocok.\n\n1. *Tanah Surabaya*\nRp 800 jt\nLT 100 m²\nhttps://solusindoaset.com/Lelang/tanah-surabaya-101/AG108\n\n2. *Tanah Surabaya*\nRp 900 jt\nLT 120 m²\nhttps://solusindoaset.com/Lelang/tanah-surabaya-102/AG108';
function fixture(t, { filename = ':memory:' } = {}) {
  let now = NOW, online = true, data = [], dailyData = [], draft, failAck = false, failSend = false;
  const queue = new RecommendationOutbox(filename, () => now); t.after(() => queue.close());
  const controls = new ConversationControl(':memory:', () => now); t.after(() => controls.close());
  const config = { transport: 'baileys', maxSessions: 100, maxPending: 100, maxPendingPerPhone: 20, maxDedup: 1000, sessionTtlMs: 86400000 };
  const store = new MemoryStore(config, () => now, controls.forTenant(AGENT)), sent = [], actions = [];
  const whatsapp = { auth: {}, getStatus: () => ({ connected: online, phone: '6280000000099' }), getContactAliases: p => [p], async sendText(phone, text) {
    if (failSend) throw new Error('simulated uncertain delivery'); sent.push({ phone, text }); return 'wa-id';
  } };
  const processor = new MessageProcessor({ config, store, whatsapp, now: () => now });
  const entry = { processor, whatsapp };
  const notifications = new NewPropertyNotifications({ queue, entries: () => [[AGENT, entry]], now: () => now,
    connection: { url: 'https://example.invalid/recommendations', token: 'x'.repeat(32), timeoutMs: 1000 }, logger: { error() {} },
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body); actions.push(body);
      if (body.action === 'initialize') return Response.json({ cursor: '100' });
      if (body.action === 'daily') return Response.json({ after_client: dailyData.at(-1)?.client_id || body.after_client, more: false, candidates: dailyData,
        checked: dailyData.length ? new Set(dailyData.map(c => c.client_id)).size : 0, matched: dailyData.length ? new Set(dailyData.map(c => c.client_id)).size : 0 });
      if (body.action === 'scan') { const candidates = data.filter(c => BigInt(c.property_id) > BigInt(body.cursor));
        return Response.json({ cursor: candidates.at(-1)?.property_id || body.cursor, more: false, candidates }); }
      if (body.action === 'prepare') return Response.json(draft || { phone: PHONE, text: TEXT, receipt: 'signed-test-receipt', name: 'Rina', property_ids: body.property_ids });
      if (failAck) return new Response('{}', { status: 503 });
      return Response.json({ acknowledged: true });
    } });
  return { queue, store, processor, whatsapp, notifications, sent, actions,
    data(v) { data = v.map((property_id, i) => typeof property_id === 'string' ? { client_id: 'KL00001', property_id, preference_id: String(i + 1) } : property_id); },
    dailyData(v) { dailyData = v; },
    draft(v) { draft = v; }, online(v) { online = v; }, failAck(v) { failAck = v; }, failSend(v) { failSend = v; }, advance(ms) { now += ms; }, time(v) { now = v; } };
}

test('starts at current inventory, groups future matches, records CRM only after send and never repeats on rescans', async t => {
  const f = fixture(t); await f.notifications.flush();
  assert.equal(f.queue.agent(AGENT).cursor, '100'); assert.equal(f.sent.length, 0);
  f.data(['101', '102', '103', '104', '105']); await f.notifications.flush();
  assert.equal(f.sent.length, 1); assert.equal(f.queue.status(AGENT).delivered, 4); assert.equal(f.queue.status(AGENT).pending, 1);
  assert.equal(f.actions.filter(a => a.action === 'acknowledge').length, 0);
  await f.notifications.flush(); await f.notifications.flush();
  assert.equal(f.sent.length, 1); assert.equal(f.queue.status(AGENT).awaiting_ack, 0);
  assert.equal(f.store.get(PHONE).outbound_recommendation.text, TEXT);
});

test('disconnected and outside business hours retain matches until connection and hours allow send', async t => {
  const f = fixture(t); await f.notifications.flush(); f.data(['101']); f.online(false); await f.notifications.flush();
  assert.equal(f.queue.status(AGENT).pending, 1); assert.equal(f.sent.length, 0);
  f.online(true); f.time(Date.parse('2026-10-20T21:00:00+07:00')); await f.notifications.flush(); assert.equal(f.sent.length, 0);
  f.time(Date.parse('2026-10-21T08:00:00+07:00')); await f.notifications.flush(); assert.equal(f.sent.length, 1);
});

test('paused conversations and the owner account never receive proactive messages', async t => {
  const f = fixture(t); await f.notifications.flush(); f.data(['101']); f.processor.takeOver(PHONE);
  await f.notifications.flush(); assert.equal(f.sent.length, 0); assert.equal(f.queue.status(AGENT).pending, 1);
  f.processor.setBotActive(PHONE, true, { replayPending: false });
  f.processor.config.stokerPhone = PHONE; await f.notifications.flush(); assert.equal(f.sent.length, 0);
  delete f.processor.config.stokerPhone;
  f.draft({ phone: '6280000000099', text: TEXT, receipt: 'r', property_ids: ['101'] });
  await f.notifications.flush(); assert.equal(f.sent.length, 0);
});

test('a changed preference or sold asset is discarded by the fresh prepare check', async t => {
  const f = fixture(t); await f.notifications.flush(); f.data(['101']); f.draft({ skipped: true });
  await f.notifications.flush(); assert.equal(f.sent.length, 0); assert.equal(f.queue.status(AGENT).pending, 0);
});

test('central botoff also pauses matching recommendations until boton explicitly resumes that client', async t => {
  const f = fixture(t); await f.notifications.flush(); f.data(['101']);
  f.processor.acceptBatch([{ id: 'central-off', whatsapp_id: 'central-off', from: CONTROL, type: 'human_takeover', timestamp: NOW, text: `#botoff ${PHONE}` }]);
  f.advance(3600000); f.processor.flushManualPauses(); await f.notifications.flush();
  assert.equal(f.sent.length, 0); assert.equal(f.queue.status(AGENT).pending, 1);
  f.processor.acceptBatch([{ id: 'central-on', whatsapp_id: 'central-on', from: CONTROL, type: 'human_takeover', timestamp: NOW + 3600000, text: `#boton ${PHONE}` }]);
  await f.notifications.flush(); assert.equal(f.sent.length, 1); assert.equal(f.sent[0].phone, PHONE);
});

test('the dedicated control contact receives no property recommendations even if it was a test client', async t => {
  const f = fixture(t); await f.notifications.flush(); f.data(['101']);
  f.processor.config.testClientPhone = CONTROL;
  f.draft({ phone: CONTROL, text: TEXT, receipt: 'r', property_ids: ['101'] });
  await f.notifications.flush();
  assert.equal(f.processor.blockedContact(CONTROL), 'bot_control_contact'); assert.equal(f.sent.length, 0);
});

test('failed CRM acknowledgement retries without resending the WhatsApp message', async t => {
  const f = fixture(t); await f.notifications.flush(); f.data(['101']); await f.notifications.flush();
  f.failAck(true); await f.notifications.flush(); assert.equal(f.sent.length, 1); assert.equal(f.queue.status(AGENT).awaiting_ack, 1);
  f.failAck(false); await f.notifications.flush(); assert.equal(f.sent.length, 1); assert.equal(f.queue.status(AGENT).awaiting_ack, 0);
});

test('an ambiguous transport error holds the message instead of retrying and duplicating it', async t => {
  const f = fixture(t); await f.notifications.flush(); f.data(['101']); f.failSend(true); await f.notifications.flush();
  assert.equal(f.queue.status(AGENT).uncertain, 1); f.failSend(false); f.advance(86400000); await f.notifications.flush();
  assert.equal(f.sent.length, 0); assert.equal(f.queue.status(AGENT).uncertain, 1);
});

test('restart preserves scan cursor and dedupe and holds a send whose completion was interrupted', t => {
  const dir = mkdtempSync(join(tmpdir(), 'recommendations-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = join(dir, 'outbox.sqlite');
  let q = new RecommendationOutbox(filename, () => NOW); q.initialize(AGENT, '100');
  q.page(AGENT, '100', '101', [{ client_id: 'KL00001', property_id: '101' }]);
  q.begin(AGENT, 'KL00001', { phone: PHONE, text: TEXT, receipt: 'r', property_ids: ['101'] }); q.close();
  q = new RecommendationOutbox(filename, () => NOW + 1000); t.after(() => q.close());
  assert.equal(q.agent(AGENT).cursor, '101'); assert.equal(q.status(AGENT).uncertain, 1); assert.equal(q.pending(AGENT).length, 0);
  assert.equal(q.cooling(AGENT, PHONE), true);
});

test('global pause and same-phone duplicate client records share the daily frequency limit', async t => {
  const f = fixture(t); await f.notifications.flush(); f.data([{ client_id: 'KL00001', property_id: '101' }, { client_id: 'KL00002', property_id: '102' }]);
  f.notifications.setEnabled(AGENT, false); await f.notifications.flush(); assert.equal(f.sent.length, 0);
  f.notifications.setEnabled(AGENT, true); await f.notifications.flush(); assert.equal(f.sent.length, 1);
  assert.equal(f.queue.status(AGENT).pending, 1);
});

test('active conversations and closing take priority over notifications', async t => {
  const f = fixture(t); await f.notifications.flush(); f.data(['101']); const s = f.store.create(PHONE);
  s.last_user_received_at = NOW; await f.notifications.flush(); assert.equal(f.sent.length, 0);
  s.last_user_received_at = NOW - 11 * 60000; s.conversion.mode = CLOSING_STATE;
  await f.notifications.flush(); assert.equal(f.sent.length, 0);
});

test('numbered replies still point to the delivered properties after restart and through LID aliases', t => {
  const f = fixture(t), control = f.store.control;
  const session = f.store.create(PHONE); session.outbound_recommendation = { text: TEXT, at: NOW }; f.store.rememberSearch(session);
  const restarted = new MemoryStore(f.processor.config, () => NOW + 3600000, control);
  const wa = { ...f.whatsapp, getContactPhone: () => PHONE, getContactAliases: () => [PHONE, 'lid:999'] };
  const processor = new MessageProcessor({ config: f.processor.config, store: restarted, whatsapp: wa, now: () => NOW + 3600000 });
  const incoming = restarted.create('lid:999'); restarted.append(incoming, 'user', 'yang nomor 2');
  const history = processor.conversationHistory(incoming);
  assert.equal(selectedRecommendation('yang nomor 2', history).id, '102'); assert.equal(incoming.last_user_at, null);
});

test('new automatic offers replace an older recommendation list in an existing conversation', async t => {
  const f = fixture(t); await f.notifications.flush();
  const session = f.store.create(PHONE);
  f.store.append(session, 'user', 'Carikan tanah di Surabaya');
  f.store.append(session, 'assistant', TEXT.replaceAll('-101/', '-91/').replaceAll('-102/', '-92/'));
  f.data(['101', '102']); await f.notifications.flush();
  assert.equal(f.sent.length, 1, JSON.stringify(f.queue.status(AGENT)));
  assert.equal(session.history.at(-1)?.content, TEXT);
  f.store.append(session, 'user', 'nomor 2');
  assert.equal(selectedRecommendation('nomor 2', f.processor.conversationHistory(session)).id, '102');
});

test('capture persists all named areas and legal restrictions for future matching', () => {
  const profile = { location: 'Manyar', city: 'Surabaya', max_price: 1000000000, transaction_type: 'LELANG', category: 'RUKO',
    locations: ['Manyar', 'Ngagel', 'Pucang'], certificate_types: ['SHM', 'HGB'], legal_requirements: ['Bukan Surat Ijo'], special_requirements: 'Nol jalan' };
  const capture = qualifiedClientFunnel({ buyer: { profile, searching: true, stage: 'recommendations', missing: [] }, identity: { name: 'Koko' }, now: NOW });
  assert.deepEqual(capture.criteria.locations, profile.locations); assert.deepEqual(capture.criteria.certificate_types, ['SHM', 'HGB']);
});

test('connector derives the fixed authenticated API and supports explicit environment disable', () => {
  const env = { WA_TRANSPORT: 'baileys', ADMIN_API_TOKEN: 'a'.repeat(32), LLM_MODEL: 'fake', OPENAI_API_KEY: 'fake', CLIENT_API_URL: 'https://example.invalid/api/internal/chatbot/clients', CHATBOT_CLIENT_TOKEN: 'c'.repeat(32) };
  assert.equal(loadConfig(env).recommendations.url, 'https://example.invalid/api/internal/chatbot/recommendations');
  assert.equal(loadConfig({ ...env, AUTO_RECOMMENDATIONS: '0' }).recommendations, null);
});

test('client can stop recommendations, including while the chat is owned by an agent', async t => {
  const f = fixture(t); f.processor.recommendationPreferences = f.notifications.forAgent(AGENT);
  f.processor.acceptBatch([{ id: 'stop-1', from: PHONE, timestamp: NOW, type: 'text', text: 'berhenti rekomendasi' }]);
  await f.processor.drain();
  assert.equal(f.queue.recipientAllows(AGENT, PHONE), false); assert.match(f.sent[0].text, /saya hentikan/);
  f.processor.takeOver(PHONE);
  f.processor.acceptBatch([{ id: 'on-2', from: PHONE, timestamp: NOW, type: 'text', text: 'aktifkan rekomendasi' }]);
  await f.processor.drain(); assert.equal(f.queue.recipientAllows(AGENT, PHONE), true);
  assert.equal(f.sent.length, 1); assert.equal(f.store.get(PHONE).is_bot_active, false);
});

test('reviewing ambiguous delivery records evidence or skips without sending a new message', async t => {
  const f = fixture(t); await f.notifications.flush(); f.data(['101']); f.failSend(true); await f.notifications.flush();
  const row = f.queue.status(AGENT).needs_review[0];
  assert.throws(() => f.notifications.reviewDelivery('AG999', row.id, 'delivered'), /DELIVERY_NOT_FOUND/);
  f.notifications.reviewDelivery(AGENT, row.id, 'delivered');
  assert.equal(f.queue.status(AGENT).uncertain, 0); assert.equal(f.queue.status(AGENT).delivered, 1);
  await f.notifications.flush(); assert.equal(f.queue.status(AGENT).awaiting_ack, 0); assert.equal(f.sent.length, 0);
});

test('queue pagination is fair when one client has hundreds of matches', t => {
  const f = fixture(t); f.queue.initialize(AGENT, '100');
  const candidates = Array.from({ length: 400 }, (_, i) => ({ client_id: 'KL00001', property_id: String(101 + i) }));
  candidates.push({ client_id: 'KL00002', property_id: '501' });
  f.queue.page(AGENT, '100', '501', candidates);
  assert.deepEqual(f.queue.pending(AGENT).map(g => [g.client, g.properties.length]), [['KL00001', 4], ['KL00002', 1]]);
});

test('completed deliveries remain excluded after restart, after 24 hours, and when candidates are replayed', t => {
  const dir = mkdtempSync(join(tmpdir(), 'recommendation-dedup-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = join(dir, 'outbox.sqlite');
  let now = NOW;
  let queue = new RecommendationOutbox(filename, () => now);
  queue.initialize(AGENT, '100');
  queue.page(AGENT, '100', '101', [{ client_id: 'KL00001', property_id: '101' }]);
  const batch = queue.begin(AGENT, 'KL00001', { phone: PHONE, text: TEXT, receipt: 'receipt', property_ids: ['101'] });
  assert.ok(batch);
  queue.sent(batch, 'accepted-message-id'); queue.acknowledged(batch); queue.close();

  now += 2 * 86400000;
  queue = new RecommendationOutbox(filename, () => now); t.after(() => queue.close());
  assert.equal(queue.cooling(AGENT, PHONE), false, 'The daily limit has elapsed; permanent asset deduplication must still hold.');
  // Exercise the queue's independent unique constraint even if an upstream
  // scanner unexpectedly returns the previously delivered candidate again.
  queue.page(AGENT, '101', '102', [
    { client_id: 'KL00001', property_id: '101' },
    { client_id: 'KL00001', property_id: '102' },
  ]);
  assert.deepEqual(queue.pending(AGENT), [{ client: 'KL00001', properties: ['102'] }]);
  assert.equal(queue.begin(AGENT, 'KL00001', { phone: PHONE, text: TEXT, receipt: 'receipt', property_ids: ['101'] }), null);
  assert.ok(queue.begin(AGENT, 'KL00001', { phone: PHONE, text: TEXT, receipt: 'new-receipt', property_ids: ['102'] }));
});

test('08:00 WIB checks existing inventory even below the new-listing cursor, with catch-up after offline time', async t => {
  const f = fixture(t); f.time(Date.parse('2026-10-21T07:59:00+07:00'));
  f.dailyData([{ client_id: 'KL00001', property_id: '90' }]);
  await f.notifications.flush(); assert.equal(f.actions.some(a => a.action === 'daily'), false); assert.equal(f.sent.length, 0);
  f.time(Date.parse('2026-10-21T08:00:00+07:00')); f.online(false); await f.notifications.flush();
  assert.equal(f.queue.status(AGENT).pending, 1); assert.equal(f.sent.length, 0); assert.equal(f.queue.agent(AGENT).cursor, '100');
  const checks = f.actions.filter(a => a.action === 'daily').length;
  f.online(true); f.time(Date.parse('2026-10-21T08:10:00+07:00')); await f.notifications.flush();
  assert.equal(f.sent.length, 1); assert.deepEqual(f.store.get(PHONE).outbound_recommendation.property_ids, ['90']);
  assert.equal(f.actions.filter(a => a.action === 'daily').length, checks, 'completed morning pass is not run every minute');
  assert.equal(f.notifications.status(AGENT).daily_matched, 1);
});

test('daily pagination survives restart and never replaces delivered candidates', t => {
  const dir = mkdtempSync(join(tmpdir(), 'daily-recommendations-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'queue.sqlite'); let q = new RecommendationOutbox(file, () => NOW);
  q.daily(AGENT, '2026-10-20'); q.dailyPage(AGENT, '2026-10-20', '', { after_client: 'KL00010', more: true, checked: 10, matched: 1, candidates: [{ client_id: 'KL00001', property_id: '90' }] });
  const batch = q.begin(AGENT, 'KL00001', { phone: PHONE, text: TEXT, receipt: 'r', property_ids: ['90'] }); q.sent(batch, 'sent'); q.acknowledged(batch); q.close();
  q = new RecommendationOutbox(file, () => NOW + 86400000); t.after(() => q.close());
  assert.equal(q.agent(AGENT).daily_after_client, 'KL00010'); assert.equal(q.agent(AGENT).daily_checked, 10);
  q.daily(AGENT, '2026-10-21'); q.dailyPage(AGENT, '2026-10-21', '', { after_client: 'KL00010', more: false, checked: 10, matched: 1, candidates: [{ client_id: 'KL00001', property_id: '90' }] });
  assert.equal(q.status(AGENT).delivered, 1); assert.equal(q.status(AGENT).pending, 0); assert.equal(q.status(AGENT).daily_checked, 10);
});

test('same phone on a second CRM card does not receive the same property on the next morning', async t => {
  const f = fixture(t); await f.notifications.flush(); f.data(['101']); await f.notifications.flush(); assert.equal(f.sent.length, 1);
  f.dailyData([{ client_id: 'KL00002', property_id: '101' }]); f.advance(86400000); await f.notifications.flush();
  assert.equal(f.sent.length, 1); assert.equal(f.queue.status(AGENT).pending, 0);
});

test('only an explicitly configured client test number may overlap the internal stock contact', async t => {
  const f = fixture(t); await f.notifications.flush(); f.processor.config.stokerPhone = PHONE; f.data(['101']);
  await f.notifications.flush(); assert.equal(f.sent.length, 0); assert.equal(f.processor.blockedContact(PHONE), 'internal_stock_contact');
  f.processor.config.testClientPhone = PHONE; await f.notifications.flush(); assert.equal(f.sent.length, 1);
  f.processor.recommendationPreferences = f.notifications.forAgent(AGENT);
  f.processor.acceptBatch([{ id: 'test-stop', from: PHONE, timestamp: NOW, type: 'text', text: 'berhenti rekomendasi' }]); await f.processor.drain();
  assert.equal(f.queue.recipientAllows(AGENT, PHONE), false, 'client messages also pass the internal-contact gate');
  f.processor.config.testClientPhone = '6280000000099'; assert.equal(f.processor.blockedContact('6280000000099'), 'connected_account');
});

test('daily status reports offline delivery and computes morning in WIB across UTC midnight', t => {
  const f = fixture(t); f.online(false);
  assert.equal(f.notifications.status(AGENT).whatsapp_connected, false);
  const now = Date.parse('2026-10-20T23:59:00Z'); assert.equal(recommendationDay(now), '2026-10-21');
  assert.equal(nextRecommendationMorning(now), Date.parse('2026-10-21T01:00:00Z'));
});

test('a changed freshness policy reruns an already completed morning pass without clearing send deduplication', t => {
  const f = fixture(t); f.queue.daily(AGENT, '2026-10-20');
  f.queue.dailyPage(AGENT, '2026-10-20', '', { after_client: '', more: false, checked: 0, matched: 0, candidates: [] });
  assert.ok(f.queue.agent(AGENT).daily_completed_at);
  f.queue.db.prepare("UPDATE recommendation_agents SET daily_policy='old-policy' WHERE agent=?").run(AGENT);
  assert.equal(f.queue.daily(AGENT, '2026-10-20').daily_completed_at, null);
});

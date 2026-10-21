import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { EventEmitter, once } from 'node:events';
import express from 'express';
import { AgentConnections } from '../services/agent_connections.js';
import { AssetCheckStore } from '../state/asset_checks.js';
import { StockConfirmation, stockConfirmationMessage } from '../services/stock_confirmation.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { BaileysClient } from '../services/baileys.js';
import { ServiceError } from '../lib/http.js';
import { loadConfig } from '../config.js';
import { auctionCheckReply, requestAuctionCheck, unsupportedAuctionCheckClaim } from '../services/auction_check.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { emojiSegments } from '../../../src/lib/chatbot/emoji-text.ts';
import { assetCheckQueue } from '../../../src/lib/chatbot/asset-checks.ts';

const NOW = Date.parse('2026-10-20T10:00:00+07:00');
const RECIPIENT = '6285707379606', CONTACT = '6281234567890';
const asset = { id: '169816', name: 'Rumah Petemon', transaction_type: 'LELANG', publication: { status: 'TERSEDIA' },
  location: 'Sawahan, Surabaya', full_address: 'Jl. Petemon Kuburan No. 59, Kel. Sawahan, Kec. Sawahan, Kota Surabaya, Prov. Jawa Timur',
  auction_at: '2026-10-19T10:00:00+07:00', detail_url: 'https://solusindoaset.com/Lelang/1-bidang-tanah-dengan-total-luas-190-m-berikut-bangunan-di-kota-surabaya-1790172016955-yucv-169816' };
const logger = { error() {} };

function fixture(t, { filename = ':memory:', tenant = 'AG1', database, send, transport = 'baileys' } = {}) {
  let clock = NOW, connected = true;
  const db = database || new AssetCheckStore(filename, { now: () => clock });
  if (!database) t.after(() => db.close());
  const raw = db.forTenant(tenant), sent = [];
  const whatsapp = { getStatus: () => ({ connected, phone: CONTACT }),
    async sendText(to, body, replyTo, options) { sent.push({ to, body, replyTo, options }); return send ? send(to, body, options) : options?.messageId || 'customer-response'; } };
  const service = new StockConfirmation({ checks: raw, whatsapp, recipient: RECIPIENT, transport, now: () => clock, logger });
  return { db, raw, service, sent, whatsapp, advance: (ms) => { clock += ms; }, disconnect: () => { connected = false; }, reconnect: () => { connected = true; } };
}

test('SOP uses the exact public property, full address, Jakarta date, canonical link and intact Unicode', () => {
  const body = stockConfirmationMessage(asset);
  assert.equal(body, `🔍 *Konfirmasi Stok Properti*\n\n🆔 *ID:* 169816\n📍 *Lokasi:* ${asset.full_address}\n📅 *Tanggal Lelang:* 19 Oktober 2026\n\n❓ Apakah aset ini masih *TERSEDIA* atau sudah *TERJUAL*?\n\nAda respon dari klien kami yang sedang menanyakan. Mohon konfirmasi segera. 🙏\n\n🔗 *Lihat detail properti:*\n${asset.detail_url}`);
  assert.doesNotMatch(body, /�|undefined|null/);
  assert.match(stockConfirmationMessage({ ...asset, auction_at: '2026-10-18T18:00:00Z' }), /19 Oktober 2026/);
  assert.match(stockConfirmationMessage({ ...asset, detail_url: 'https://attacker.example/Lelang/aset-169816' }), /https:\/\/solusindoaset.com\/Lelang\/properti-169816$/);
  assert.match(stockConfirmationMessage({ ...asset, detail_url: asset.detail_url.replace('169816', '169817') }), /properti-169816$/);
});

test('one live inquiry sends to the configured stoker, with a durable message ID and no customer details', async (t) => {
  const f = fixture(t);
  const result = await requestAuctionCheck({ asset, checks: f.service, contact: CONTACT, now: NOW });
  assert.equal(result.notification_status, 'sent');
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].to, RECIPIENT);
  assert.equal(f.sent[0].body, stockConfirmationMessage(asset));
  assert.equal(f.sent[0].replyTo, undefined); assert.match(f.sent[0].options.messageId, /^3EB0[A-F0-9]+$/);
  assert.doesNotMatch(f.sent[0].body, new RegExp(CONTACT));
  assert.equal(result.external_check_performed, false, 'sending a request is not a stock confirmation');
  assert.match(auctionCheckReply(asset, result), /sudah saya kirim ke bagian stoker melalui WhatsApp/);
  assert.equal(unsupportedAuctionCheckClaim(auctionCheckReply(asset, result), result), false);
});

test('concurrent repeated inquiries and multiple customers share one send for the same lot/date', async (t) => {
  const f = fixture(t);
  await Promise.all(Array.from({ length: 40 }, (_, i) => f.service.enqueue({ contact: `6281234567${String(i % 5).padStart(2, '0')}`, asset })));
  await f.service.flush();
  assert.equal(f.sent.length, 1); assert.equal(f.raw.list().total, 5);
  assert.ok(f.raw.list().items.every((row) => row.notification_status === 'sent'));
  await f.service.enqueue({ contact: CONTACT, asset: { ...asset, auction_at: '2026-10-18T03:00:00Z' } });
  assert.equal(f.sent.length, 2, 'a different auction schedule is a different request');
});

test('future/sold/withdrawn/demo/non-auction assets and sandbox never send or create an outbox row', async (t) => {
  const f = fixture(t);
  for (const changes of [{ auction_at: '2026-10-21T00:00:00Z' }, { publication: { status: 'TERJUAL' } },
    { availability_status: 'withdrawn' }, { is_demo: true }, { transaction_type: 'SEWA' }, { auction_at: null }]) {
    assert.equal(await f.service.enqueue({ contact: CONTACT, asset: { ...asset, ...changes } }), null);
  }
  await requestAuctionCheck({ asset, checks: f.service, contact: CONTACT, sandbox: true, now: NOW });
  await generatePropertyReply({ catalog: { async resolve() { return { asset, catalog: [], status: 'matched' }; } },
    ai: { async generate() { assert.fail('expired response should be deterministic'); } }, text: 'Kode 169816', history: [], now: NOW });
  assert.equal(f.sent.length, 0); assert.equal(f.raw.list().total, 0);
});

test('disconnected WhatsApp keeps durable work, retries after reconnection and never claims it was sent early', async (t) => {
  const f = fixture(t); f.disconnect();
  const task = await f.service.enqueue({ contact: CONTACT, asset });
  assert.equal(task.notification_status, 'retry'); assert.equal(f.sent.length, 0);
  assert.doesNotMatch(auctionCheckReply(asset, { status: task.status, notification_status: task.notification_status }), /sudah saya kirim/);
  f.reconnect(); await f.service.flush(); assert.equal(f.sent.length, 0, 'backoff respected');
  f.advance(10000); await f.service.flush();
  assert.equal(f.sent.length, 1); assert.equal(f.raw.get(task.id).notification_status, 'sent');
  await f.service.flush(); assert.equal(f.sent.length, 1);
});

test('an ambiguous timeout stays visible and is not blindly resent; explicit retry reuses the persisted message ID', async (t) => {
  let fail = true;
  const f = fixture(t, { send: async () => { if (fail) throw new ServiceError('WA_SEND_TIMEOUT', 504); return 'accepted'; } });
  const task = await f.service.enqueue({ contact: CONTACT, asset });
  assert.equal(task.notification_status, 'uncertain');
  f.advance(3600000); await f.service.flush();
  await f.service.enqueue({ contact: '6287654321000', asset }); assert.equal(f.sent.length, 1);
  fail = false; await f.service.retry(task.id);
  assert.equal(f.sent.length, 2); assert.equal(f.sent[0].options.messageId, f.sent[1].options.messageId);
  assert.equal(f.raw.get(task.id).notification_status, 'sent');
  await assert.rejects(() => f.service.retry(task.id), { code: 'NOTIFICATION_NOT_RETRYABLE' });
});

test('pending sends survive restart and sent sends are never duplicated after restart', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'stock-restart-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'checks.sqlite');
  const first = new AssetCheckStore(path, { now: () => NOW });
  const initial = fixture(t, { database: first }); initial.disconnect();
  const task = await initial.service.enqueue({ contact: CONTACT, asset }); first.close();
  const db = new AssetCheckStore(path, { now: () => NOW + 20000 });
  const restored = fixture(t, { database: db }); await restored.service.flush();
  assert.equal(restored.sent.length, 1); assert.equal(db.forTenant('AG1').get(task.id).notification_status, 'sent'); db.close();
  // A restart keeps the same test clock; real wall time would also exercise
  // stock-result expiry and can invalidate this restart-only assertion.
  const finalDb = new AssetCheckStore(path, { now: () => NOW + 20000 }); t.after(() => finalDb.close());
  const final = fixture(t, { database: finalDb }); await final.service.enqueue({ contact: CONTACT, asset });
  assert.equal(final.sent.length, 0);
});

test('two workers cannot claim the same notification; an expired send lease requires review', async (t) => {
  const f = fixture(t); f.disconnect();
  const task = await f.service.enqueue({ contact: CONTACT, asset });
  f.advance(10000);
  const claimed = f.raw.claimNotification(); assert.ok(claimed);
  assert.equal(f.db.forTenant('AG1').claimNotification(), null);
  f.advance(120001); await f.service.flush();
  assert.equal(f.raw.get(task.id).notification_status, 'uncertain'); assert.equal(f.sent.length, 0);
  f.raw.finishNotification(claimed.id, claimed.lease_token, { status: 'sent' });
  assert.equal(f.raw.get(task.id).notification_status, 'uncertain', 'expired workers cannot overwrite a later state');
});

test('completion cancels queued sends once all interested customers are handled', async (t) => {
  const f = fixture(t); f.disconnect();
  const a = await f.service.enqueue({ contact: CONTACT, asset });
  const b = await f.service.enqueue({ contact: '6287654321000', asset });
  f.service.complete(a.id); f.service.complete(b.id);
  f.reconnect(); f.advance(60000); await f.service.flush();
  assert.equal(f.sent.length, 0);
  await assert.rejects(() => f.service.retry(a.id), { code: 'ASSET_CHECK_NOT_FOUND' });
});

test('one completed customer does not cancel the shared request needed by another', async (t) => {
  const f = fixture(t); f.disconnect();
  const a = await f.service.enqueue({ contact: CONTACT, asset });
  await f.service.enqueue({ contact: '6287654321000', asset });
  f.service.complete(a.id); f.reconnect(); f.advance(60000); await f.service.flush();
  assert.equal(f.sent.length, 1);
});

test('legacy database migrates without sending historical notes; a fresh inquiry upgrades a pending note', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'stock-migration-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'old.sqlite'), legacy = new DatabaseSync(path);
  legacy.exec(`CREATE TABLE asset_checks (id TEXT PRIMARY KEY, tenant TEXT NOT NULL, contact TEXT NOT NULL, asset_id TEXT NOT NULL,
    location TEXT NOT NULL, auction_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, completed_at INTEGER,
    UNIQUE(tenant, contact, asset_id, auction_at))`);
  legacy.prepare('INSERT INTO asset_checks VALUES (?,?,?,?,?,?,?,?,?)').run('33333333-3333-4333-8333-333333333333', 'AG1', CONTACT, asset.id, asset.location, new Date(asset.auction_at).toISOString(), 'pending', NOW, null);
  legacy.close();
  const f = fixture(t, { filename: path }); await f.service.flush(); assert.equal(f.sent.length, 0);
  await f.service.enqueue({ contact: CONTACT, asset }); assert.equal(f.sent.length, 1); assert.equal(f.raw.list().total, 1);
});

test('tenant isolation covers notification queues and manual retry', async (t) => {
  const f = fixture(t); f.disconnect(); const task = await f.service.enqueue({ contact: CONTACT, asset });
  const other = fixture(t, { database: f.db, tenant: 'AG2' });
  assert.equal(other.raw.get(task.id), undefined);
  assert.throws(() => other.raw.retryNotification(task.id), { code: 'ASSET_CHECK_NOT_FOUND' });
  f.advance(60000); await other.service.flush(); assert.equal(other.sent.length, 0);
  await other.service.enqueue({ contact: CONTACT, asset }); assert.equal(other.sent.length, 1);
});

test('self-target and unsupported proactive Cloud sends fail visibly without sending', async (t) => {
  const f = fixture(t); f.whatsapp.getStatus = () => ({ connected: true, phone: RECIPIENT });
  assert.equal((await f.service.enqueue({ contact: CONTACT, asset })).notification_status, 'failed'); assert.equal(f.sent.length, 0);
  const cloud = fixture(t, { transport: 'cloud' });
  assert.equal((await cloud.service.enqueue({ contact: CONTACT, asset })).notification_status, 'failed'); assert.equal(cloud.sent.length, 0);
});

test('real processor sends the stoker SOP and the customer acknowledgement, while internal phone/LID messages are ignored', async (t) => {
  const f = fixture(t);
  const config = { transport: 'baileys', stokerPhone: RECIPIENT, maxSessions: 20, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
  const store = new MemoryStore(config, () => NOW);
  f.whatsapp.getContactPhone = (contact) => contact === 'lid:123456' ? RECIPIENT : contact;
  const processor = new MessageProcessor({ config, store, whatsapp: f.whatsapp, checks: f.service, now: () => NOW, logger,
    catalog: { async resolve() { return { asset, catalog: [], status: 'matched', source: 'database_listing_publik' }; } },
    ai: { async generate() { assert.fail('no model needed'); } } });
  assert.equal(processor.acceptBatch([RECIPIENT, 'lid:123456'].map((from, i) => ({ id: `internal-${i}`, from, timestamp: NOW, type: 'text', text: 'Aset sudah terjual' }))), 0);
  processor.acceptBatch([{ id: 'client-1', from: CONTACT, timestamp: NOW, type: 'text', text: 'Kode 169816 masih tersedia?' }]);
  await processor.drain();
  assert.equal(f.sent.length, 2); assert.equal(f.sent[0].to, RECIPIENT); assert.equal(f.sent[1].to, CONTACT);
  assert.match(f.sent[1].body, /sudah saya kirim ke bagian stoker melalui WhatsApp/);
  assert.equal(store.get(CONTACT).is_bot_active, true);
});

test('outbox capacity failure is atomic and cannot create an orphan notification', async (t) => {
  const db = new AssetCheckStore(':memory:', { maxRows: 0 }); t.after(() => db.close());
  const f = fixture(t, { database: db });
  await assert.rejects(() => f.service.enqueue({ contact: CONTACT, asset }), { code: 'ASSET_CHECK_CAPACITY' });
  assert.equal(db.db.prepare('SELECT COUNT(*) AS count FROM stock_notifications').get().count, 0); assert.equal(f.sent.length, 0);
});

test('Baileys uses the persisted stock message ID and recognizes its own echo', async () => {
  const ev = new EventEmitter(), controls = new Set(), received = [], calls = [];
  const id = `3EB0${'A'.repeat(36)}`;
  const socket = { ev, user: { id: `${CONTACT}@s.whatsapp.net` }, end() {},
    async sendMessage(jid, content, options) { calls.push(options); return { key: { id: options.messageId, remoteJid: jid }, message: { conversation: content.text } }; } };
  const client = new BaileysClient({ timeoutMs: 100, maxContacts: 100, control: { markOutbound: (value) => controls.add(value), isOutbound: (value) => controls.has(value) } },
    { socketFactory: () => socket, authFactory: () => ({ state: { creds: {}, keys: {} } }), now: () => NOW, logger });
  client.start((messages) => { received.push(...messages); return messages.length; });
  await client.updateConnection(socket, { connection: 'open' });
  assert.equal(await client.sendText(RECIPIENT, '📋 Konfirmasi', undefined, { messageId: id }), id);
  assert.equal(calls[0].messageId, id); assert.ok(controls.has(id));
  await client.receive(socket, { messages: [{ key: { id, fromMe: true, remoteJid: `${RECIPIENT}@s.whatsapp.net` }, messageTimestamp: NOW / 1000, message: { conversation: '📋 Konfirmasi' } }] });
  assert.equal(received.length, 0); await client.stop();
});

test('notification DTO rejects invalid delivery metadata and excludes internal message/lease data', async (t) => {
  const f = fixture(t); await f.service.enqueue({ contact: CONTACT, asset });
  const queue = f.raw.list(), dto = assetCheckQueue(queue); assert.equal(dto.items[0].notification_status, 'sent');
  assert.doesNotMatch(JSON.stringify(dto), /message_id|lease_token|notification_id|Konfirmasi Stok/);
  assert.equal(assetCheckQueue({ ...queue, items: [{ ...queue.items[0], notification_status: 'invented' }] }), null);
  assert.equal(assetCheckQueue({ ...queue, items: [{ ...queue.items[0], notification_attempts: -1 }] }), null);
});

test('desktop emoji segments preserve full Unicode sequences, text, bold markers and links', () => {
  const text = 'Halo 👋🏽 keluarga 👨‍👩‍👧‍👦 🇮🇩 1️⃣ ❤️ 📍 *ID:* 169816 https://solusindoaset.com/Lelang/aset-169816';
  const parts = emojiSegments(text);
  assert.equal(parts.map((part) => part.text).join(''), text);
  assert.deepEqual(parts.filter((part) => part.emoji).map((part) => part.text), ['👋🏽', '👨‍👩‍👧‍👦', '🇮🇩', '1️⃣', '❤️', '📍']);
});

test('stoker recipient is normalized and invalid configuration cannot silently target a different number', () => {
  const env = { LLM_PROVIDER: 'gemini', LLM_MODEL: 'test', GEMINI_API_KEY: 'fake', ADMIN_API_TOKEN: 'a'.repeat(32) };
  assert.equal(loadConfig(env).stokerPhone, RECIPIENT);
  assert.equal(loadConfig({ ...env, STOKER_WHATSAPP_NUMBER: '+62 857-0737-9606' }).stokerPhone, RECIPIENT);
  assert.throws(() => loadConfig({ ...env, STOKER_WHATSAPP_NUMBER: '0822oops' }), /STOKER_WHATSAPP_NUMBER/);
});

test('delayed sends recheck public data and stop if the asset was sold or rescheduled during an outage', async (t) => {
  for (const changes of [{ publication: { status: 'TERJUAL' } }, { auction_at: '2026-10-25T03:00:00Z' }, null]) {
    const f = fixture(t); f.disconnect();
    f.service.catalog = { async resolve() { return { asset: changes === null ? null : { ...asset, ...changes } }; } };
    const task = await f.service.enqueue({ contact: CONTACT, asset });
    f.reconnect(); f.advance(10000); await f.service.flush();
    assert.equal(f.sent.length, 0); assert.equal(f.raw.get(task.id).notification_error, 'STOCK_ASSET_CHANGED');
  }
});

test('temporary catalog failure before a delayed send retries safely without claiming delivery', async (t) => {
  const f = fixture(t); f.disconnect(); let available = false;
  f.service.catalog = { async resolve() { if (!available) throw new Error('offline'); return { asset }; } };
  const task = await f.service.enqueue({ contact: CONTACT, asset });
  f.reconnect(); f.advance(10000); await f.service.flush();
  assert.equal(f.raw.get(task.id).notification_status, 'retry'); assert.equal(f.sent.length, 0);
  available = true; f.advance(20000); await f.service.flush(); assert.equal(f.sent.length, 1);
});

test('changing the stoker number blocks old queued destinations and routes a fresh request to the new number', async (t) => {
  const f = fixture(t); f.disconnect();
  const task = await f.service.enqueue({ contact: CONTACT, asset });
  f.service.recipient = '6281111111111'; f.reconnect(); f.advance(10000); await f.service.flush();
  assert.equal(f.raw.get(task.id).notification_error, 'STOCK_RECIPIENT_CHANGED'); assert.equal(f.sent.length, 0);
  await f.service.enqueue({ contact: CONTACT, asset }); assert.equal(f.sent.length, 1); assert.equal(f.sent[0].to, '6281111111111');
});

test('agent cleanup retains pending stock work even when no customer session is in memory', async (t) => {
  const db = new AssetCheckStore(':memory:', { now: () => NOW });
  const config = loadConfig({ LLM_PROVIDER: 'gemini', LLM_MODEL: 'test', GEMINI_API_KEY: 'fake', ADMIN_API_TOKEN: 'a'.repeat(32) });
  const agents = new AgentConnections(config, {}, { assetChecks: db, logger, createClient: () => ({ auth: null,
    getStatus: () => ({ connected: false }), async stop() {},
  }) });
  t.after(async () => { await agents.shutdown(); db.close(); });
  const entry = agents.get('AG1'); entry.checks.now = () => NOW;
  const task = await entry.checks.enqueue({ contact: CONTACT, asset }); agents.get('AG2');
  agents.cleanup(); assert.ok(agents.entries.has('AG1')); assert.equal(agents.entries.has('AG2'), false);
  entry.checks.complete(task.id); agents.cleanup(); assert.equal(agents.entries.has('AG1'), false);
});

test('independent SQLite connections reserve one notification and cannot deliver it concurrently', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'stock-workers-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'checks.sqlite'), a = new AssetCheckStore(path, { now: () => NOW }), b = new AssetCheckStore(path, { now: () => NOW });
  t.after(() => { a.close(); b.close(); });
  const first = fixture(t, { database: a }), second = fixture(t, { database: b });
  await Promise.all([first.service.enqueue({ contact: CONTACT, asset }), second.service.enqueue({ contact: '6287654321000', asset })]);
  assert.equal(first.sent.length + second.sent.length, 1); assert.equal(a.forTenant('AG1').list().total, 2);
});

test('retry HTTP endpoint authenticates, isolates agents and rejects extra recipients and malformed bodies', async (t) => {
  const db = new AssetCheckStore(':memory:', { now: () => NOW });
  const config = loadConfig({ LLM_PROVIDER: 'gemini', LLM_MODEL: 'test', GEMINI_API_KEY: 'fake', ADMIN_API_TOKEN: 'a'.repeat(32) });
  let fail = true, sends = 0;
  const agents = new AgentConnections(config, { async resolve() { return { asset }; } }, { assetChecks: db, logger, createClient: () => ({
    getStatus: () => ({ connected: true, phone: CONTACT }), async stop() {},
    async sendText() { sends++; if (fail) throw new ServiceError('WA_SEND_TIMEOUT', 504); return 'sent'; },
  }) });
  const app = express(); app.use('/agents', agents.router()); app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.code }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await agents.shutdown(); db.close(); });
  const entry = agents.get('AG1'); entry.checks.now = () => NOW;
  const task = await entry.checks.enqueue({ contact: CONTACT, asset }); assert.equal(task.notification_status, 'uncertain');
  const base = `http://127.0.0.1:${server.address().port}/agents`, headers = { Authorization: `Bearer ${config.adminToken}`, 'Content-Type': 'application/json' };
  const url = `${base}/AG1/admin/asset-checks/${task.id}/retry`;
  assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  assert.equal((await fetch(`${base}/AG2/admin/asset-checks/${task.id}/retry`, { method: 'POST', headers, body: '{}' })).status, 404);
  for (const body of ['[]', '{"recipient":"6280000000"}']) assert.equal((await fetch(url, { method: 'POST', headers, body })).status, 400);
  assert.equal((await fetch(`${base}/AG1/admin/asset-checks/bad-id/retry`, { method: 'POST', headers, body: '{}' })).status, 400);
  assert.equal(sends, 1); fail = false;
  assert.equal((await fetch(url, { method: 'POST', headers, body: '{}' })).status, 200);
  assert.equal((await fetch(url, { method: 'POST', headers, body: '{}' })).status, 409); assert.equal(sends, 2);
});

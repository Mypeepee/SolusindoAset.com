import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { AssetCheckStore } from '../state/asset_checks.js';
import { MemoryStore } from '../state/memory_store.js';
import { needsAuctionCheck, auctionCheckReply, unsupportedAuctionCheckClaim } from '../services/auction_check.js';
import { assetFacts } from '../services/catalog.js';
import { generatePropertyReply, resolvePropertyContext } from '../services/property_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { createAiController, HANDOVER_MESSAGE } from '../services/ai_controller.js';
import { AgentConnections } from '../services/agent_connections.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { loadConfig } from '../config.js';
import { BACKUP_AREA_QUESTION } from '../services/buyer_profile.js';
import { getPropertyKnowledge, isBuyerCriteria, planPropertyLookup } from '../../../src/lib/chatbot/property-knowledge.ts';
import { assetCheckQueue } from '../../../src/lib/chatbot/asset-checks.ts';

const now = Date.parse('2026-10-08T10:00:00+07:00'), contact = '6281234567890';
const asset = { id: '121820', name: 'Rumah Waru', location: 'Waru, Sidoarjo', address: { city: 'Sidoarjo', district: 'Waru' },
  category: 'RUMAH', transaction_type: 'LELANG', limit_price: 417128521,
  auction_at: '2026-07-02T10:00:00+07:00', publication: { status: 'TERSEDIA' } };
const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const matched = (item = asset) => ({ asset: item, catalog: [], status: item ? 'matched' : 'not_found', source: 'database_listing_publik' });
const silent = { error() {} };
const reportedInquiry = 'Halo Jason Christopher Liendo 👋\n\nSaya tertarik dengan properti berikut, apakah masih tersedia?\n\n🔨 **RUMAH – SIDOARJO · LT 101 m²**\n📍 Waru, KAB. SIDOARJO\n💰 **Rp\u00a0417.128.521**\n🔖 Kode: **121820**\n\nMohon infonya, terima kasih! 🙏';
const detailedAsset = { ...asset, auction_at: '2026-07-02T17:00:00Z', deposit: 83_425_705,
  full_address: 'Jalan Kenanga No. 8, Waru, Kabupaten Sidoarjo, Jawa Timur',
  specifications: { land_area_m2: 101, building_area_m2: 80, bedrooms: 2, bathrooms: 1, certificate_type: 'SHM', electricity_watts: 1300, floors: 1 },
  detail_url: 'https://solusindoaset.com/Lelang/rumah-waru-121820' };
function fixture(checks, ai = { async generate() { throw new Error('initial expired response must not require AI'); } }, publicAsset = asset) {
  const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
  const store = new MemoryStore(config, () => now), sent = [];
  const processor = new MessageProcessor({ config, store, checks, ai, catalog: { async resolve() { return matched(publicAsset); } },
    whatsapp: { async sendText(phone, text) { sent.push(text); return 'fake-sent'; } }, logger: silent, now: () => now });
  const accept = (id, text) => processor.acceptBatch([{ id, text, from: contact, timestamp: now, type: 'text' }]);
  return { processor, store, sent, accept };
}

test('expired check is derived only from available auction facts, including the exact timestamp boundary', () => {
  assert.equal(needsAuctionCheck(asset, now), true);
  assert.equal(assetFacts(asset, now).auction_check_required, true);
  assert.equal(needsAuctionCheck(asset, Date.parse(asset.auction_at) - 1), false);
  assert.equal(needsAuctionCheck(asset, Date.parse(asset.auction_at)), true);
  for (const changes of [{ auction_at: null }, { auction_at: 'bad date' }, { auction_at: '2027-01-01T00:00:00Z' },
    { publication: { status: 'TERJUAL' } }, { availability_status: 'sold' }, { transaction_type: 'SEWA' }, { is_demo: true }]) assert.equal(needsAuctionCheck({ ...asset, ...changes }, now), false);
  assert.equal(needsAuctionCheck({ id: '123', auction_at: asset.auction_at }, now), false);
});

test('live expired response queues a real follow-up, explains both outcomes, and keeps the bot active without an LLM', async (t) => {
  const database = new AssetCheckStore(':memory:', { now: () => now }); t.after(() => database.close());
  const checks = database.forTenant('AG1'), f = fixture(checks);
  f.accept('one', 'Kode 121820 masih tersedia?'); await f.processor.drain();
  assert.equal(f.sent.length, 1); const reply = f.sent[0];
  for (const pattern of [/Tersedia/, /2 Juli 2026/, /permintaan cross-check sudah saya catat/i, /KPKNL/, /dimenangkan pihak lain/, /data belum diperbarui/, /lelang ulang \(retender\)/]) assert.match(reply, pattern);
  assert.doesNotMatch(reply, /tidak siap|sudah menghubungi|sedang mengecek|undervalue|siap dilelang/i);
  assert.match(reply, /DETAIL ASET.*121820/); assert.match(reply, /Harga limit: Rp 417\.128\.521/);
  assert.ok(reply.indexOf('DETAIL ASET') < reply.indexOf('jadwal lelang pada'));
  assert.ok(reply.endsWith(BACKUP_AREA_QUESTION));
  assert.equal((reply.match(/\?/g) || []).length, 1);
  assert.equal(checks.list().total, 1); assert.equal(f.store.get(contact).is_bot_active, true);
  assert.equal(f.store.get(contact).asset_id, asset.id);
  const duplicate = checks.enqueue({ contact, asset }); assert.equal(duplicate.created, false); assert.equal(checks.list().total, 1);
});

test('queue survives restart, is private on disk, isolates tenants, and never exposes chat or qualification', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'solusindo-checks-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = join(dir, 'checks.sqlite');
  const first = new AssetCheckStore(filename, { now: () => now });
  const task = first.forTenant('AG1').enqueue({ contact, asset: { ...asset, password: 'PRIVATE_SENTINEL' }, history: 'PRIVATE_SENTINEL' });
  first.close();
  const restored = new AssetCheckStore(filename); t.after(() => restored.close());
  assert.equal(statSync(filename).mode & 0o777, 0o600);
  assert.equal(restored.forTenant('AG1').list().total, 1); assert.equal(restored.forTenant('AG2').list().total, 0);
  assert.throws(() => restored.forTenant('AG2').complete(task.id), { code: 'ASSET_CHECK_NOT_FOUND' });
  assert.doesNotMatch(JSON.stringify(restored.forTenant('AG1').list()), /PRIVATE_SENTINEL|qualification|history|tenant/);
  assert.equal(restored.forTenant('AG1').complete(task.id).status, 'completed');
  assert.equal(restored.forTenant('AG1').enqueue({ contact, asset }).status, 'completed', 'closed note is not proof of a refreshed public status');
  assert.equal(restored.forTenant('AG1').list().total, 0);
});

test('queue capacity or write failure cannot become a false promise that checking was requested', async (t) => {
  const database = new AssetCheckStore(':memory:', { maxRows: 0 }); t.after(() => database.close());
  const f = fixture(database.forTenant('AG1')); f.accept('one', 'Kode 121820'); await f.processor.drain();
  assert.match(f.sent[0], /belum tercatat otomatis/); assert.doesNotMatch(f.sent[0], /sudah saya catat|sedang mengecek/);
  assert.equal(database.forTenant('AG1').list().total, 0); assert.equal(f.store.get(contact).is_bot_active, true);
});

test('sandbox expiry keeps simulation in UI metadata and asks one area question without pretending to have requested a check', async () => {
  const result = await generatePropertyReply({ text: 'Kode 121820', history: [user('Kode 121820')], catalog: { async resolve() { return matched(); } },
    ai: { async generate() { throw new Error('no LLM needed'); } }, now });
  assert.equal(result.knowledge.status, 'auction_check_needed'); assert.match(result.reply, /perlu dikonfirmasi/);
  assert.ok(result.reply.endsWith(BACKUP_AREA_QUESTION));
  assert.doesNotMatch(result.reply, /sudah saya catat|sudah menghubungi|mode pengujian|disimulasikan/);
});

test('reported website inquiry shows fresh property details before stock confirmation and a single backup question', async (t) => {
  const database = new AssetCheckStore(':memory:', { now: () => now }); t.after(() => database.close());
  const checks = database.forTenant('AG1'), f = fixture(checks, undefined, detailedAsset);
  f.accept('reported-inquiry', reportedInquiry); await f.processor.drain();
  assert.equal(f.sent.length, 1); const reply = f.sent[0];
  for (const pattern of [/DETAIL ASET.*121820/, /Jalan Kenanga No\. 8/, /Jenis properti: rumah/i,
    /Harga limit: Rp 417\.128\.521/, /Uang jaminan: Rp 83\.425\.705/, /Luas tanah: 101 m²/,
    /Luas bangunan: 80 m²/, /Kamar tidur: 2/, /Legalitas tercatat: SHM/, /Daya listrik: 1\.300 watt/,
    /3 Juli 2026/, /permintaan cross-check sudah saya catat/i]) assert.match(reply, pattern);
  assert.ok(reply.indexOf('SPESIFIKASI') < reply.indexOf('jadwal lelang pada'));
  assert.ok(reply.includes(detailedAsset.detail_url)); assert.ok(reply.endsWith(BACKUP_AREA_QUESTION));
  assert.equal((reply.match(/\?/g) || []).length, 1); assert.ok(reply.length <= 4000);
  assert.doesNotMatch(reply, /lantai|sudah.*menghubungi|sudah saya kirim|rincian biaya pembelian atau kondisi aset/i);
  assert.equal(checks.list().total, 1); assert.equal(f.store.get(contact).is_bot_active, true);
});

test('Playground renders the reported template and a direct property link without a model or real stock notification', async (t) => {
  const token = 'x'.repeat(40), catalog = { async resolve(text, previousId) {
    assert.deepEqual(planPropertyLookup(text, previousId).ids, [asset.id]); return matched(detailedAsset);
  } };
  const app = express(); app.use('/sandbox', createSandboxRouter({ config: { adminToken: token }, catalog,
    ai: { async generate() { assert.fail('The first expired inquiry should render public details locally'); } }, now: () => now }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  for (const text of [reportedInquiry, detailedAsset.detail_url]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: randomUUID(), history: [user(text)] }),
    });
    assert.equal(response.status, 200); const result = await response.json();
    assert.match(result.reply, /Luas tanah: 101 m²/); assert.match(result.reply, /Luas bangunan: 80 m²/);
    assert.match(result.reply, /Harga limit: Rp 417\.128\.521/); assert.match(result.reply, /Status terbarunya perlu dikonfirmasi/);
    assert.doesNotMatch(result.reply, /sudah saya catat|sudah saya kirim|sudah menghubungi/);
    assert.equal(result.generation.mode, 'rules'); assert.equal(result.session.asset_id, asset.id);
    assert.equal(result.knowledge.status, 'auction_check_needed'); assert.equal(result.session.is_bot_active, true);
    assert.ok(result.reply.endsWith(BACKUP_AREA_QUESTION)); assert.equal((result.reply.match(/\?/g) || []).length, 1);
  }
});

test('advertised price and specifications cannot fill missing public data or override refreshed details', async () => {
  const stale = reportedInquiry.replace('LT 101', 'LT 999').replace('417.128.521', '1.000.000');
  const result = await generatePropertyReply({ text: stale, history: [user(stale)], now,
    catalog: { async resolve() { return matched({ ...asset, limit_price: 418_000_001, specifications: {} }); } },
    ai: { async generate() { assert.fail('No model is needed for missing listing fields'); } } });
  assert.match(result.reply, /Harga limit: Rp 418\.000\.001/); assert.match(result.reply, /Luas tanah: belum tercatat/);
  assert.match(result.reply, /Luas bangunan: belum tercatat/); assert.doesNotMatch(result.reply, /999|Rp 1\.000\.000|Kamar tidur:|Legalitas tercatat:/);
  const withoutBackup = auctionCheckReply(detailedAsset, { status: 'pending', notification_status: 'sent' }, { offerBackup: false });
  assert.match(withoutBackup, /Luas tanah: 101 m²/); assert.match(withoutBackup, /sudah saya kirim ke bagian stoker/);
  assert.equal((withoutBackup.match(/\?/g) || []).length, 0);
});

test('backup budget reply uses original city and excludes expired lot while allowing ranked fallback without assuming ready funds', async () => {
  const calls = [];
  const catalog = { async resolve(...args) { calls.push(args); return args[2] ? { asset: null, catalog: [], status: 'not_found', source: 'database_listing_publik' } : matched(); } };
  const history = [user('Kode 121820'), assistant(auctionCheckReply(asset, { status: 'pending' })), user('Cari lelang alternatif aset, budget 700 juta untuk investasi, kelurahan bebas, luas tanah bebas')];
  const context = await resolvePropertyContext(catalog, history.at(-1).content, asset.id, history, now);
  assert.equal(context.buyer.stage, 'recommendations'); assert.equal(context.buyer.backup_for, asset.id);
  assert.equal(calls[1][2].location, 'Waru'); assert.equal(calls[1][2].city, 'Sidoarjo'); assert.equal(calls[1][2].max_price, 700000000);
  assert.equal(calls[1][2].purpose, 'investment'); assert.equal(calls[1][2].upcoming_auction_only, undefined, 'database ranking prefers upcoming but permits fallback');
  assert.deepEqual(calls[1][2].exclude_ids, [asset.id]); assert.equal(calls[1][2].funds, undefined);
  const partial = await resolvePropertyContext(catalog, 'Cari lelang alternatif aset, budget 500 juta', asset.id, history.slice(0, 2), now);
  assert.equal(partial.status, 'qualifying'); assert.equal(partial.asset.id, asset.id, 'preserve original pointer across qualifying turns');
  assert.deepEqual(partial.buyer.missing, ['land_area']);
  const detail = await resolvePropertyContext(catalog, 'Luasnya berapa?', asset.id, history.slice(0, 2), now);
  assert.equal(detail.buyer.stage, 'consultation'); assert.equal(detail.asset.id, asset.id);
});

test('backup query enforces future auction date, excludes old code, and retains public privacy constraints', async () => {
  let query;
  const criteria = { location: 'Sidoarjo', transaction_type: 'LELANG', purpose: 'investment', max_price: 700000000, upcoming_auction_only: true, exclude_ids: [asset.id] };
  await getPropertyKnowledge({ listing: { async findMany(input) { query = input; return []; } } }, { text: '700 juta untuk investasi', criteria }, now);
  assert.deepEqual(query.where.tanggal_lelang, { gt: new Date(now) });
  assert.deepEqual(query.where.id_property, { notIn: [121820n] }); assert.equal(query.where.jenis_transaksi, 'LELANG');
  assert.equal(query.where.status_tayang, 'TERSEDIA'); assert.equal(query.where.bukan_properti, false); assert.equal(query.take, 5);
  assert.equal(isBuyerCriteria({ ...criteria, upcoming_auction_only: 'yes' }), false);
  assert.equal(isBuyerCriteria({ ...criteria, transaction_type: 'SEWA' }), false);
  assert.equal(isBuyerCriteria({ ...criteria, exclude_ids: ['121820 OR 1=1'] }), false);
});

test('fresh sold status never revives expired property facts from conversation history', async () => {
  let calls = 0;
  const context = await resolvePropertyContext({ async resolve() { calls++; return matched(null); } }, 'Budget 500 juta untuk investasi', asset.id,
    [user('Kode 121820'), assistant(auctionCheckReply(asset, { status: 'pending' }))], now);
  assert.equal(context.asset, null); assert.equal(context.status, 'not_found'); assert.equal(calls, 1);
});

test('handover during pending queue write prevents a late bot response', async () => {
  let release, started;
  const ready = new Promise((resolve) => { started = resolve; });
  const f = fixture({ async enqueue() { started(); return new Promise((resolve) => { release = resolve; }); } });
  f.accept('one', 'Kode 121820'); await ready;
  f.accept('two', 'survei lokasi'); release({ status: 'pending' }); await f.processor.drain();
  assert.deepEqual(f.sent, [HANDOVER_MESSAGE]); assert.equal(f.store.get(contact).is_bot_active, false);
});

test('follow-up model cannot replace a queued check with a claim of an actual KPKNL call', async () => {
  const qualification = Object.fromEntries(['purpose', 'funds', 'settlement'].map((key) => [key, { value: 'unknown', evidence: '' }]));
  const ai = createAiController({ provider: 'gemini', model: 'test', apiKey: 'test', timeoutMs: 1000 }, {
    fetchImpl: async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ reply: 'Saya sudah menghubungi KPKNL dan mengecek aset. Berapa budget Bapak/Ibu?', qualification }) }] } }] }),
  });
  const result = await ai.generate({ history: [user('Sudah dicek?')], facts: assetFacts(asset, now), catalog: [], qualification: {},
    userText: 'Sudah dicek?', knowledge: { auction_check: { status: 'pending' } }, now });
  assert.doesNotMatch(result.reply, /sudah menghubungi/); assert.match(result.reply, /sudah saya catat/);
});

test('agent check routes require authentication and enforce isolation for listing and completion', async (t) => {
  const database = new AssetCheckStore(':memory:', { now: () => now });
  const config = loadConfig({ LLM_PROVIDER: 'gemini', LLM_MODEL: 'test', GEMINI_API_KEY: 'fake', ADMIN_API_TOKEN: 'a'.repeat(32) });
  const agents = new AgentConnections(config, {}, { assetChecks: database, logger: silent, createClient: () => ({ async stop() {}, getStatus() { return {}; } }) });
  const app = express(); app.use('/agents', agents.router()); app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.code }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await agents.shutdown(); database.close(); });
  const base = `http://127.0.0.1:${server.address().port}/agents`, headers = { Authorization: `Bearer ${config.adminToken}`, 'Content-Type': 'application/json' };
  const task = database.forTenant('AG1').enqueue({ contact, asset });
  assert.equal((await fetch(`${base}/AG1/admin/asset-checks`)).status, 401);
  assert.equal((await (await fetch(`${base}/AG1/admin/asset-checks`, { headers })).json()).total, 1);
  assert.equal((await (await fetch(`${base}/AG2/admin/asset-checks`, { headers })).json()).total, 0);
  const patch = { method: 'PATCH', headers, body: JSON.stringify({ status: 'completed' }) };
  assert.equal((await fetch(`${base}/AG2/admin/asset-checks/${task.id}`, patch)).status, 404);
  assert.equal((await fetch(`${base}/AG1/admin/asset-checks/${task.id}`, { ...patch, body: JSON.stringify({ status: 'completed', agentId: 'AG2' }) })).status, 400);
  assert.equal((await fetch(`${base}/AG1/admin/asset-checks/${task.id}`, patch)).status, 200);
  const closed = database.forTenant('AG1').list(); assert.equal(closed.total, 0);
});

test('dashboard queue DTO strips unknown fields and rejects malformed rows', () => {
  const item = { id: '33333333-3333-4333-8333-333333333333', contact, asset_id: asset.id, location: asset.location,
    auction_at: asset.auction_at, status: 'pending', created_at: now, password: 'PRIVATE_SENTINEL', history: 'PRIVATE_SENTINEL' };
  assert.doesNotMatch(JSON.stringify(assetCheckQueue({ total: 1, items: [item] })), /PRIVATE_SENTINEL/);
  assert.equal(assetCheckQueue({ total: 1, items: [{ ...item, contact: 'invalid' }] }), null);
});

test('backup follow-ups explain missing alternatives without fictional progress or a model dependency', async () => {
  const history = [user('Kode 121820'), assistant(auctionCheckReply(asset, { status: 'simulated' })), user('Budget 700 juta untuk investasi, kelurahan bebas, luas tanah bebas')];
  const result = await generatePropertyReply({ text: history.at(-1).content, previousId: asset.id, history, now,
    catalog: { async resolve(text, previousId, criteria) { return criteria ? { asset: null, catalog: [], status: 'not_found', source: 'database_listing_publik' } : matched(); } },
    ai: { async generate() { assert.fail('No model needed for a missing search result'); } } });
  assert.match(result.reply, /[Bb]elum ketemu rumah/); assert.doesNotMatch(result.reply, /sudah menghubungi|disimulasikan/);
  assert.ok(!result.reply.includes(BACKUP_AREA_QUESTION), 'the same area question is not repeated after the client answers');
  assert.equal(unsupportedAuctionCheckClaim('Jadwal sudah terlewat, sehingga perlu cross-check. Apa kriteria Bapak/Ibu?', { status: 'pending' }), false);
  assert.equal(unsupportedAuctionCheckClaim('Permintaan sudah saya catat. Apa kriteria Bapak/Ibu?', { status: 'unavailable' }), true);
});

test('asking for alternatives without a location keeps the original city and still qualifies missing budget', async () => {
  const context = await resolvePropertyContext({ async resolve() { return matched(); } }, 'Ada alternatif?', asset.id,
    [user('Kode 121820'), assistant(auctionCheckReply(asset, { status: 'pending' }))], now);
  assert.equal(context.buyer.profile.location, 'Waru'); assert.equal(context.buyer.profile.city, 'Sidoarjo'); assert.equal(context.status, 'qualifying');
  assert.deepEqual(context.buyer.missing, ['max_price', 'land_area']);
});

test('bare area reply to expired-lot invitation qualifies then searches with the user budget and purpose', async () => {
  const calls = [], inputs = [], history = [user('Kode 121820'), assistant(auctionCheckReply(asset, { status: 'simulated' }))];
  const catalog = { async resolve(...args) { calls.push(args); return args[2] ? { asset: null, catalog: [], status: 'not_found', source: 'database_listing_publik' } : matched(); } };
  const ai = { async generate(input) { inputs.push(input); return { reply: 'Berapa budget yang Bapak/Ibu siapkan? Untuk dihuni sendiri atau investasi?', qualification: {} }; } };
  history.push(user('Manukan'));
  const area = await generatePropertyReply({ catalog, ai, text: 'Manukan', previousId: asset.id, history, now });
  assert.equal(area.knowledge.status, 'qualifying'); assert.equal(area.action, undefined);
  assert.equal(inputs.length, 0); assert.match(area.reply, /Manukan/);
  assert.match(area.reply, /kota atau kabupaten mana/);
  assert.equal(calls.filter((call) => call[2]).length, 0, 'do not show unsolicited candidates before qualification');
  history.push(assistant(area.reply), user('di Surabaya'));
  const city = await generatePropertyReply({ catalog, ai, text: 'di Surabaya', previousId: asset.id, history, now });
  assert.doesNotMatch(city.reply, /kelurahan mana/);
  history.push(assistant(city.reply), user('kelurahan bebas'));
  const village = await generatePropertyReply({ catalog, ai, text: 'kelurahan bebas', previousId: asset.id, history, now });
  assert.match(village.reply, /[Bb]udget/);
  history.push(assistant(village.reply), user('500 juta untuk dihuni sekaligus investasi, luas tanah bebas'));
  await generatePropertyReply({ catalog, ai, text: history.at(-1).content, previousId: asset.id, history, now });
  const criteria = calls.at(-1)[2];
  assert.equal(criteria.location, 'Manukan'); assert.equal(criteria.max_price, 500000000);
  assert.equal(criteria.purpose, 'both'); assert.equal(criteria.transaction_type, 'LELANG');
  assert.deepEqual(criteria.exclude_ids, [asset.id]);
});

test('expired backup exception accepts a combined location/budget reply but keeps detail questions and refusals on the original asset', async () => {
  const history = [user('Kode 121820'), assistant(auctionCheckReply(asset, { status: 'pending' }))];
  const catalog = { async resolve(text, previousId, criteria) { assert.equal(criteria, undefined); return matched(); } };
  const combined = await resolvePropertyContext(catalog, 'Manukan, budget 500 juta', asset.id, history, now);
  assert.equal(combined.buyer.profile.location, 'Manukan'); assert.equal(combined.buyer.profile.max_price, 500000000);
  assert.deepEqual(combined.buyer.missing, ['city', 'land_area']);
  for (const text of ['Luasnya berapa?', 'Tidak perlu, fokus aset ini dulu']) {
    let input;
    await generatePropertyReply({ catalog, text, history: [...history, user(text)], previousId: asset.id, now,
      ai: { async generate(value) { input = value; return { reply: 'Baik, Bapak/Ibu.', qualification: {} }; } } });
    assert.equal(input.facts.id, asset.id); assert.equal(input.knowledge.buyer.searching, false);
  }
});

test('backup invitation cannot unlock a fresh or sold lot, a newly selected property, or a conversation without that invitation', async () => {
  const history = [user('Kode 121820'), assistant(auctionCheckReply(asset, { status: 'pending' })), user('Manukan')];
  const fresh = { ...asset, auction_at: '2027-01-01T00:00:00Z' };
  const catalog = (item) => ({ async resolve(text, previousId, criteria) { assert.equal(criteria, undefined); return matched(item); } });
  assert.equal((await resolvePropertyContext(catalog(fresh), 'Manukan', asset.id, history, now)).buyer.searching, false);
  assert.equal((await resolvePropertyContext(catalog(null), 'Manukan', asset.id, history, now)).asset, null);
  const other = { ...asset, id: '94639' };
  const selected = [...history, user('Kode 94639'), user('Budget 500 juta untuk investasi')];
  assert.equal((await resolvePropertyContext(catalog(other), selected.at(-1).content, other.id, selected, now)).buyer.searching, false);
  const withoutInvite = [user('Kode 121820'), user('Budget 500 juta untuk investasi')];
  assert.equal((await resolvePropertyContext(catalog(asset), withoutInvite.at(-1).content, asset.id, withoutInvite, now)).buyer.searching, false);
});

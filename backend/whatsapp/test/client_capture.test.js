import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clientCapture, validClientCapture } from '../services/client_capture.js';
import { ClientOutbox } from '../state/client_outbox.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { loadConfig } from '../config.js';
import { createApp } from '../app.js';

const PHONE = '6280000000001'; // Fixtures never leave mocked transport.
const NOW = Date.parse('2026-10-15T10:00:00+07:00');
const criteria = { location: 'Surabaya Barat', city: 'Surabaya', region_group: 'barat', transaction_type: 'LELANG', category: 'RUMAH', max_price: 500000000, min_land_area_m2: 150 };
const payload = (changes = {}) => ({ phone: PHONE, name: 'Rina', criteria, captured_at: NOW, ...changes });
const connection = { url: 'http://127.0.0.1/mock-clients', token: 'c'.repeat(32), timeoutMs: 1000 };
const receipt = () => Response.json({ id_klien: 'KL00001', id_agent: 'AG108', status: 'created' });
const config = { transport: 'baileys', adminToken: 'a'.repeat(32), maxSessions: 100, maxPending: 100, maxPendingPerPhone: 20, maxDedup: 1000, sessionTtlMs: 86400000,
  llm: { provider: 'openai', model: 'fake', apiKey: 'fake', timeoutMs: 1000 } };
const logger = { error() {} };

function chatFixture(t, { from = PHONE, getContactPhone } = {}) {
  const sent = [], saved = [], lookups = [];
  const clients = new ClientOutbox(':memory:', connection, { now: () => NOW, logger, fetchImpl: async (_url, options) => { saved.push(JSON.parse(options.body)); return receipt(); } });
  t.after(() => clients.close());
  const store = new MemoryStore(config, () => NOW);
  const catalog = { async resolve(_text, _previous, filters) { lookups.push(filters); return { status: 'not_found', catalog: [], source: 'property_database' }; } };
  const ai = { generate() { assert.fail('Structured buyer funnel does not require AI'); } };
  const whatsapp = { getContactPhone, async sendText(_phone, text) { sent.push(text); return 'mock'; } };
  const processor = new MessageProcessor({ config, store, catalog, clients, ai, whatsapp, logger, now: () => NOW });
  let id = 0;
  const chat = async (text) => {
    processor.acceptBatch([{ id: `fixture-${++id}`, from, type: 'text', text, timestamp: NOW }]);
    await processor.drain(); await clients.flush();
    return sent.at(-1);
  };
  return { chat, saved, clients, store, processor, catalog, sent, whatsapp, lookups };
}

test('capture requires completed funnel and verified phone; drops operational exclusions', () => {
  const buyer = { searching: true, stage: 'recommendations', missing: [], profile: { ...criteria, exclude_ids: ['123'], search_turn: 3 } };
  assert.deepEqual(clientCapture({ buyer, phone: PHONE, identity: { name: 'Rina' }, now: NOW }), payload());
  for (const update of [{ searching: false }, { stage: 'qualifying' }, { missing: ['land_area'] }]) assert.equal(clientCapture({ buyer: { ...buyer, ...update }, phone: PHONE }), null);
  for (const phone of ['lid:999999999', '+628123', '081234567890', null]) assert.equal(clientCapture({ buyer, phone }), null);
  assert.equal(validClientCapture({ ...payload(), id_agent: 'AG999' }), false);
  assert.equal(validClientCapture({ ...payload(), criteria: { ...criteria, raw_history: 'private' } }), false);
});

test('customer simulation: introduction → complete funnel → revision → alternatives without duplicate saves', async (t) => {
  const f = chatFixture(t);
  for (const text of ['halo', 'Bu Rina', 'saya cari rumah lelang', 'Surabaya Barat', 'budget mentok 500 juta']) {
    await f.chat(text); assert.equal(f.saved.length, 0, text);
  }
  const reply = await f.chat('luas tanah minimal 150 m2');
  assert.equal(f.saved.length, 1);
  const saved = f.saved[0];
  assert.equal(saved.phone, PHONE); assert.equal(saved.name, 'Rina');
  for (const [key, value] of Object.entries(criteria)) assert.equal(saved.criteria[key], value, key);
  assert.doesNotMatch(reply, /kelurahan|Budget-nya sampai berapa|patokan luas tanah/i);
  await f.chat('adakah yang lain?');
  assert.equal(f.saved.length, 1);
  await f.chat('budget saya naikkan jadi 600 juta');
  assert.equal(f.saved.length, 2); assert.equal(f.saved[1].criteria.max_price, 600000000);
  assert.equal(f.saved[1].criteria.region_group, 'barat'); assert.equal(f.saved[1].criteria.min_land_area_m2, 150);
});

test('customer simulation: landmark radius persists with region, budget and land preference', async (t) => {
  const f = chatFixture(t);
  await f.chat('nama saya Budi, cari rumah lelang di Surabaya Barat dekat pintu tol radius 2 km budget 500 juta luas tanah minimal 150 m2');
  assert.equal(f.saved.length, 1);
  assert.equal(f.saved[0].criteria.nearby.query, 'pintu tol');
  assert.equal(f.saved[0].criteria.nearby.radius_m, 2000);
  assert.equal(f.saved[0].name, 'Budi');
});

test('LID is never stored as phone; later authenticated mapping saves the qualified snapshot', async (t) => {
  let mapped = null;
  const f = chatFixture(t, { from: 'lid:999999999999', getContactPhone: () => mapped });
  await f.chat('cari rumah lelang di Surabaya Barat budget 500 juta luas tanah minimal 150 m2');
  assert.equal(f.saved.length, 0);
  mapped = PHONE;
  await f.chat('terima kasih');
  assert.equal(f.saved.length, 1); assert.equal(f.saved[0].phone, PHONE); assert.equal(f.saved[0].name, null);
});

test('queue retains changes arriving during an in-flight save', async () => {
  let release;
  const saved = [];
  const box = new ClientOutbox(':memory:', connection, { logger, now: () => NOW, fetchImpl: async (_u, o) => {
    saved.push(JSON.parse(o.body)); if (saved.length === 1) await new Promise((r) => { release = r; }); return receipt();
  } });
  box.enqueue(payload()); const running = box.flush();
  assert.equal(box.enqueue(payload({ captured_at: NOW + 1 })), false);
  box.enqueue(payload({ criteria: { ...criteria, max_price: 600000000 }, captured_at: NOW + 2 }));
  release(); await running; await box.flush();
  assert.equal(saved.length, 2); assert.equal(saved[1].criteria.max_price, 600000000);
  assert.equal(box.db.prepare('SELECT pending FROM client_outbox').get().pending, 0);
  await box.close();
});

test('failed saves retry after restart without leaking secret error responses', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'client-outbox-test-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'clients.sqlite'), errors = []; let now = NOW;
  const options = { now: () => now, logger: { error(e) { errors.push(e); } }, fetchImpl: async () => { throw new Error('private secret raw response'); } };
  const first = new ClientOutbox(file, connection, options);
  first.enqueue(payload()); await first.flush();
  assert.equal(first.db.prepare('SELECT pending FROM client_outbox').get().pending, 1);
  assert.doesNotMatch(JSON.stringify(errors), /private|secret|6280000000001/); await first.close();
  const saved = [];
  const second = new ClientOutbox(file, connection, { ...options, fetchImpl: async (_u, o) => { saved.push(JSON.parse(o.body)); return receipt(); } });
  await second.flush(); assert.equal(saved.length, 0);
  now += 1001; await second.flush(); assert.equal(saved.length, 1);
  second.setName(PHONE, 'Budi'); await second.flush(); assert.equal(saved.at(-1).name, 'Budi');
  await second.close();
});

test('connector uses separate write token and refuses remote HTTP', () => {
  const base = { LLM_MODEL: 'fake', OPENAI_API_KEY: 'fake', ADMIN_API_TOKEN: 'a'.repeat(32), PROPERTY_API_URL: 'http://localhost:3000/api/internal/chatbot/properties', CHATBOT_PROPERTY_TOKEN: 'p'.repeat(32), CLIENT_API_URL: connection.url, CHATBOT_CLIENT_TOKEN: connection.token };
  assert.ok(loadConfig(base).clientDatabase);
  for (const changes of [{ CHATBOT_CLIENT_TOKEN: base.ADMIN_API_TOKEN }, { CHATBOT_CLIENT_TOKEN: base.CHATBOT_PROPERTY_TOKEN }, { CLIENT_API_URL: 'http://remote.example/clients' }]) assert.throws(() => loadConfig({ ...base, ...changes }));
});

test('Playground simulation never creates a CRM client with a complete profile', async (t) => {
  const f = chatFixture(t);
  const app = createApp({ config, store: f.store, processor: f.processor, catalog: f.catalog, whatsapp: f.whatsapp });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise((r) => server.close(r)); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, { method: 'POST',
    headers: { Authorization: `Bearer ${config.adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ history: [{ role: 'user', content: 'cari rumah lelang di Surabaya Barat budget 500 juta luas tanah minimal 150 m2' }] }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).knowledge.status, 'not_found');
  assert.equal(f.lookups[0].max_price, 500000000);
  assert.equal(f.saved.length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePropertyReply } from '../services/property_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { ConversationControl } from '../state/conversation_control.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { once } from 'node:events';
import { createAdminRouter } from '../routes/admin.js';

const noAi = { async generate() { assert.fail('Search and recovery should not guess through AI'); } };
function simulation() {
  const history = [], reads = [];
  const catalog = { async resolve(text, id, criteria) { reads.push(structuredClone(criteria)); return { status: 'not_found', asset: null, catalog: [] }; } };
  return { reads, history, async send(text) {
    history.push({ role: 'user', content: text });
    const result = await generatePropertyReply({ text, history, catalog, ai: noAi });
    history.push({ role: 'assistant', content: result.reply }); return result.reply;
  } };
}
test('exact Kebayoran–Gandaria City conversation never creates a village from uncertainty and recovers without repeating searches', async () => {
  const chat = simulation();
  await chat.send('mau cari properti lelang di jakarta selatan');
  await chat.send('di kebayoran');
  const landmark = await chat.send('waduh gatau di dekat mall gandaria city');
  assert.doesNotMatch(landmark, /Waduh|Gatau|kelurahan mana/i);
  await chat.send('rumah'); await chat.send('300 juta'); await chat.send('bebas');
  assert.equal(chat.reads.length, 1); const saved = chat.reads[0];
  assert.equal(saved.village, null); assert.equal(saved.city.toLowerCase(), 'jakarta selatan');
  assert.equal(saved.nearby.query, 'mall gandaria city'); assert.equal(saved.max_price, 300000000);
  assert.equal(saved.min_land_area_m2, null);
  assert.match(await chat.send('boleh'), /pilih dulu/); assert.equal(chat.reads.length, 1);
  const expand = await chat.send('perluas area');
  assert.match(expand, /radius/); assert.doesNotMatch(expand, /Belum ketemu/); assert.equal(chat.reads.length, 1);
  await chat.send('ubah radius'); await chat.send('2 km');
  assert.equal(chat.reads.at(-1).nearby.radius_m, 2000); assert.equal(chat.reads.at(-1).max_price, 300000000);
  assert.match(await chat.send('sesuaikan budget'), /batas budget baru/i);
  await chat.send('400 juta'); assert.equal(chat.reads.at(-1).max_price, 400000000);
  assert.equal(chat.reads.at(-1).nearby.query, 'mall gandaria city');
});
test('perluas area drops only the narrow administrative scope, preserving price, land, type and landmark', async () => {
  const chat = simulation();
  await chat.send('cari rumah lelang di Surabaya Barat budget 500 juta luas tanah minimal 150 m2 dekat sekolah radius 1 km');
  const reply = await chat.send('perluas area');
  assert.match(reply, /Saya perluas ke seluruh Surabaya/);
  const c = chat.reads.at(-1); assert.equal(c.region_group, undefined); assert.equal(c.location, 'Surabaya');
  assert.equal(c.max_price, 500000000); assert.equal(c.min_land_area_m2, 150); assert.equal(c.category, 'RUMAH');
  assert.deepEqual(c.nearby, { query: 'sekolah', radius_m: 1000 });
});
test('manual takeover cancels a reply during its 2 second wait and never sends a takeover notice', async () => {
  const config = { transport: 'baileys', replyDelayMs: 2000, maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
  const store = new MemoryStore(config); const sent = [], delays = [];
  let finish; const waiting = new Promise((resolve) => { finish = resolve; });
  const processor = new MessageProcessor({ config, store, ai: noAi, catalog: {}, whatsapp: { sendText: async (...args) => { sent.push(args); return 'out'; } }, sleep: async (ms) => { delays.push(ms); await waiting; } });
  const phone = '6280000000001';
  processor.acceptBatch([{ id: 'in1', from: phone, timestamp: Date.now(), type: 'text', text: 'halo' }]);
  while (!delays.length) await new Promise((resolve) => setImmediate(resolve));
  processor.acceptBatch([{ id: 'owner1', from: phone, timestamp: Date.now(), type: 'human_takeover' }]);
  finish(); await processor.drain(); assert.deepEqual(delays, [2000]); assert.deepEqual(sent, []);
  processor.acceptBatch([{ id: 'in2', from: phone, timestamp: Date.now(), type: 'text', text: 'mau cari rumah di surabaya' }]);
  await processor.drain(); assert.deepEqual(sent, []); assert.equal(store.get(phone).is_bot_active, false);
});
test('human ownership and bot echo identifiers survive a process restart and stay isolated by tenant', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kosku-ownership-')); const path = join(directory, 'control.sqlite');
  try {
    let db = new ConversationControl(path);
    const first = db.forTenant('AG108'); first.pause('6280000000001', 'manual_cs'); first.markOutbound('bot-123'); db.close();
    db = new ConversationControl(path);
    const config = {}; const control = db.forTenant('AG108');
    const store = new MemoryStore(config, Date.now, control);
    assert.equal(store.create('6280000000001').is_bot_active, false); assert.equal(control.isOutbound('bot-123'), true);
    assert.equal(new MemoryStore(config, Date.now, db.forTenant('AG999')).create('6280000000001').is_bot_active, true);
    control.resume('6280000000001'); assert.equal(new MemoryStore(config, Date.now, control).create('6280000000001').is_bot_active, true);
    db.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('long conversations and quick message batches retain the original region and combine every new preference', async () => {
  const config = { transport: 'baileys', replyDelayMs: 2000, maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
  const store = new MemoryStore(config), reads = [], sent = [], phone = '6280000000001';
  const processor = new MessageProcessor({ config, store, ai: noAi, sleep: async () => {},
    catalog: { async resolve(text, id, criteria) { reads.push(structuredClone(criteria)); return { status: 'not_found', asset: null, catalog: [] }; } },
    whatsapp: { async sendText(contact, text) { sent.push(text); return 'out'; } } });
  let sequence = 0;
  const message = (text) => ({ id: `long-${++sequence}`, from: phone, type: 'text', text, timestamp: Date.now() });
  processor.acceptBatch([message('Cari rumah lelang di Surabaya Barat budget 500 juta luas tanah minimal 150 m2 dekat sekolah radius 1 km')]); await processor.drain();
  for (let i = 0; i < 20; i++) { processor.acceptBatch([message('budget tetap 500 juta')]); await processor.drain(); }
  assert.equal(store.get(phone).history.length, 24);
  const before = sent.length;
  processor.acceptBatch([message('budget 400 juta'), message('luas tanah minimal 200 m2')]); await processor.drain();
  assert.equal(sent.length, before + 1, 'only the consolidated response is sent');
  const criteria = reads.at(-1);
  assert.equal(criteria.city, 'Surabaya'); assert.equal(criteria.region_group, 'barat'); assert.equal(criteria.transaction_type, 'LELANG');
  assert.equal(criteria.category, 'RUMAH'); assert.equal(criteria.max_price, 400000000); assert.equal(criteria.min_land_area_m2, 200);
  assert.deepEqual(criteria.nearby, { query: 'sekolah', radius_m: 1000 });
  assert.doesNotMatch(sent.at(-1), /kota atau kabupaten mana|Jenis properti apa|Budget-nya sampai berapa|kelurahan mana/);
});

test('Owner controls list durable pauses after restart and resume only on an authenticated explicit action', async (t) => {
  const db = new ConversationControl(':memory:'), control = db.forTenant('AG108'), phone = '6280000000001';
  control.pause(phone, 'manual_cs');
  const store = new MemoryStore({}, Date.now, control);
  const processor = new MessageProcessor({ config: {}, store, whatsapp: {}, ai: noAi });
  const app = express(), token = 'a'.repeat(40);
  app.use('/admin', createAdminRouter({ token, store, processor, whatsapp: {} }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); db.close(); });
  const url = `http://127.0.0.1:${server.address().port}/admin/conversations`;
  assert.equal((await fetch(url)).status, 401);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const list = await (await fetch(url, { headers })).json();
  assert.deepEqual(list.items.map((row) => [row.contact, row.is_bot_active]), [[phone, false]]);
  const resumed = await fetch(`${url}/${phone}/bot`, { method: 'PATCH', headers, body: JSON.stringify({ is_bot_active: true }) });
  assert.equal(resumed.status, 200); assert.equal(store.get(phone).is_bot_active, true); assert.equal(control.get(phone), undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { buyerContext, extractBudget } from '../services/buyer_profile.js';
import { extractLandArea } from '../services/land_area.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { searchReply } from '../services/search_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';

const user = (content) => ({ role: 'user', content }), assistant = (content) => ({ role: 'assistant', content });
const opening = 'saya ingin mencari lelang aset di daerah rungkut pak';
const scope = 'pokoknya rungkut pak, budget mentok saya di angka 1 m';
const reported = 'saya mencari lelang rumah pak, luasnya ya 100 - 120 m lah';
function qualifiedHistory() {
  const history = [];
  for (const text of [opening, scope]) {
    history.push(user(text)); history.push(assistant(searchReply({ buyer: buyerContext(history, text, null) })));
  }
  return history;
}
function checkScope(buyer) {
  assert.equal(buyer.profile.city.toLowerCase(), 'surabaya'); assert.equal(buyer.profile.location.toLowerCase(), 'rungkut');
  assert.equal(buyer.profile.district.toLowerCase(), 'rungkut'); assert.equal(buyer.profile.village, null);
  assert.equal(buyer.profile.max_price, 1e9); assert.equal(buyer.profile.min_price, null);
}

test('the exact Rungkut type and land answer keeps district and budget then searches immediately', async () => {
  const history = qualifiedHistory(), calls = [];
  const catalog = { async resolve(_text, _id, criteria) { calls.push(criteria); return { asset: null, catalog: [], status: 'not_found' }; } };
  history.push(user(reported));
  const buyer = buyerContext(history, reported, null); checkScope(buyer);
  assert.equal(buyer.profile.category, 'RUMAH'); assert.equal(buyer.profile.min_land_area_m2, 100); assert.equal(buyer.profile.max_land_area_m2, 120);
  assert.deepEqual(buyer.missing, []); assert.equal(buyer.stage, 'recommendations');
  const result = await generatePropertyReply({ catalog, ai: { generate() { assert.fail('A complete search must not need a model'); } }, text: reported, history });
  assert.equal(calls.length, 1); assert.equal(calls[0].district.toLowerCase(), 'rungkut'); assert.equal(calls[0].category, 'RUMAH');
  assert.equal(calls[0].min_land_area_m2, 100); assert.equal(calls[0].max_land_area_m2, 120); assert.equal(calls[0].max_price, 1e9);
  assert.equal(result.knowledge.status, 'not_found'); assert.doesNotMatch(result.reply, /kelurahan mana|Luasnya 100|Budget-nya sampai berapa|Jenis properti apa/i);
});

test('explicit colloquial size answers work when land is the second question, while a bare bebas still answers only type', () => {
  for (const text of [reported, 'rumah pak, luasnya 100–120 meter', 'cari lelang rumah dong, luas 100 sampe 120 m2',
    'luasnya antara 100 dan 120 meter, saya mencari lelang rumah', 'saya cari lelang rumah, tanahnya minimal 100 maksimal 120 m',
    'saya mencari lelang rumah pak, 100-120 m', 'rumah aja, 100 s/d 120', 'rumah, luas tanah seratus sampai seratus dua puluh meter persegi']) {
    const history = qualifiedHistory(), buyer = buyerContext(history, text, null);
    checkScope(buyer); assert.equal(buyer.profile.category, 'RUMAH', text);
    assert.equal(buyer.profile.min_land_area_m2, 100, text); assert.equal(buyer.profile.max_land_area_m2, 120, text);
    assert.deepEqual(buyer.missing, [], text);
  }
  const free = buyerContext(qualifiedHistory(), 'bebas pak', null); checkScope(free); assert.deepEqual(free.missing, ['land_area']);
});

test('land and financial units stay separate even with reordered clauses and shorthand m', () => {
  for (const text of ['luasnya 100-120 m, budget 1 m', 'budget 1 m, luasnya ya 100 - 120 m lah',
    'luas tanah 100-120m, anggaran satu miliar', 'luas bangunannya 100-120m, budget 1m']) {
    assert.deepEqual(extractBudget(text), { min_price: null, max_price: 1e9 }, text);
  }
  assert.equal(extractBudget(reported), null);
  assert.deepEqual(extractLandArea(reported, { expected: true }), { min_land_area_m2: 100, max_land_area_m2: 120 });
  assert.equal(extractLandArea('budget 1 m', { expected: true }), null);
  assert.equal(extractLandArea('budget 500-700 juta, rumah pak', { expected: true }), null);
  assert.equal(extractLandArea('LB 100-120 m, rumah pak', { expected: true }), null);
  assert.equal(extractLandArea('luasnya bangunan 100-120 m, rumah pak', { expected: true }), null);
});

test('unclear or invalid land measurements clarify only size and cannot become a location', () => {
  for (const text of ['saya mencari lelang rumah, luasnya sekitar 100 m', 'saya mencari lelang rumah, luasnya ya 120-100 m',
    'rumah pak, luasnya belum tahu', 'saya mencari lelang rumah, luasnya di angka 100 m']) {
    const buyer = buyerContext(qualifiedHistory(), text, null); checkScope(buyer);
    assert.equal(buyer.profile.category, 'RUMAH', text); assert.deepEqual(buyer.missing, ['land_area'], text);
    const reply = searchReply({ buyer, status: 'qualifying' }); assert.doesNotMatch(reply, /kelurahan mana|kecamatan mana|kota atau kabupaten mana/i, text);
  }
});

test('separate land and building clauses use land bounds in either order', () => {
  for (const text of ['rumah, LB 80 m2, luas tanah 100-120 m2',
    'rumah, luas bangunannya 80 m, luas tanah 100-120 m', 'rumah, luas tanah 100-120 m2, LB 80 m2']) {
    const buyer = buyerContext(qualifiedHistory(), text, null); checkScope(buyer);
    assert.equal(buyer.profile.category, 'RUMAH', text); assert.equal(buyer.profile.min_land_area_m2, 100, text);
    assert.equal(buyer.profile.max_land_area_m2, 120, text); assert.deepEqual(buyer.missing, [], text);
  }
});

test('a genuine new village is still accepted alongside type and size in either order', () => {
  for (const text of ['saya cari lelang rumah di Medokan Ayu, luasnya 100-120 m',
    'luasnya 100-120 m, saya mencari lelang rumah di Medokan Ayu', 'rumah, luasnya 100-120 m di Medokan Ayu']) {
    const buyer = buyerContext(qualifiedHistory(), text, null);
    assert.equal(buyer.profile.city.toLowerCase(), 'surabaya', text); assert.equal(buyer.profile.district.toLowerCase(), 'rungkut', text);
    assert.equal(buyer.profile.village.toLowerCase(), 'medokan ayu', text); assert.equal(buyer.profile.category, 'RUMAH', text);
    assert.equal(buyer.profile.max_price, 1e9, text); assert.equal(buyer.profile.min_land_area_m2, 100, text); assert.equal(buyer.profile.max_land_area_m2, 120, text);
    assert.deepEqual(buyer.missing, [], text);
  }
});

const NOW = Date.parse('2026-10-11T08:00:00Z');
const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const noAi = { generate() { assert.fail('Qualification and recommendations must work without a model'); } };
function scopedCatalog() {
  const calls = [], item = { id: '789', name: 'Rumah Rungkut', transaction_type: 'LELANG', category: 'RUMAH', limit_price: 900000000,
    price_display: 'Rp 900.000.000', full_address: 'Jalan Rungkut, Surabaya', address: { city: 'Surabaya', district: 'Rungkut' },
    specifications: { land_area_m2: 110 }, detail_url: 'https://solusindoaset.com/Lelang/rumah-rungkut-789',
    auction_at: '2026-12-01T00:00:00Z', publication: { status: 'TERSEDIA' } };
  return { calls, async resolve(_text, _id, criteria) {
    calls.push(criteria); checkScope({ profile: criteria });
    assert.equal(criteria.category, 'RUMAH'); assert.equal(criteria.min_land_area_m2, 100); assert.equal(criteria.max_land_area_m2, 120);
    return { asset: null, catalog: [item], status: 'recommendations', source: 'database_listing_publik', selection: { schedule_priority: 'upcoming' } };
  } };
}

test('WhatsApp processor preserves Rungkut and budget across the exact combined type/land answer', async () => {
  const catalog = scopedCatalog(), store = new MemoryStore(config, () => NOW), sent = [], phone = '6281234567890';
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => NOW,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'sent'; } }, logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  for (const [i, text] of ['siang pak', opening, scope, reported].entries()) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: NOW }]); await processor.drain();
    assert.equal(sent.length, i + 1); assert.equal(catalog.calls.length, i === 3 ? 1 : 0);
    assert.equal(store.get(phone).is_bot_active, true);
  }
  assert.match(sent[2], /Rp 1\.000\.000\.000/); assert.match(sent[2], /Jenis properti apa/); assert.match(sent[2], /luas tanah/);
  assert.match(sent[3], /rumah-rungkut-789/); assert.match(sent[3], /LT 110 m²/);
  assert.doesNotMatch(sent[3], /kelurahan mana|kecamatan mana|Budget-nya sampai berapa|Jenis properti apa|Luasnya 100/);
});

test('Playground uses server-owned Rungkut context and immediately returns cards after the reported reply', async (t) => {
  const catalog = scopedCatalog(), app = express(), token = 'x'.repeat(40);
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  const post = async (text) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); return response.json();
  };
  await post('siang pak'); await post(opening); const qualified = await post(scope);
  assert.match(qualified.reply, /Rp 1\.000\.000\.000/); assert.match(qualified.reply, /Jenis properti apa/); assert.match(qualified.reply, /luas tanah/);
  assert.equal(catalog.calls.length, 0);
  const result = await post(reported);
  assert.equal(result.knowledge.status, 'recommendations'); assert.equal(catalog.calls.length, 1);
  assert.match(result.reply, /rumah-rungkut-789/); assert.match(result.reply, /LT 110 m²/);
  assert.doesNotMatch(result.reply, /kelurahan mana|kecamatan mana|Budget-nya sampai berapa|Jenis properti apa|Luasnya 100/);
});

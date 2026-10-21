import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { buyerContext } from '../services/buyer_profile.js';
import { interactionDecision, HANDOVER_MESSAGE } from '../services/interaction_policy.js';
import { searchReply } from '../services/search_reply.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';

const NOW = Date.parse('2026-10-09T10:00:00Z'), PHONE = '6281234567890';
const QUESTION = 'bisa tolong carikan lelang saya aset di manukan kah pak?';
const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const noAi = { async generate() { assert.fail('Search acknowledgements and database recommendation cards must not depend on AI'); } };
const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const asset = { id: '123', name: 'Rumah Manukan', transaction_type: 'LELANG', limit_price: 500000000, price_display: 'Rp 500.000.000',
  full_address: 'Jl. Manukan Kulon 10, Surabaya', address: { street: 'Jl. Manukan Kulon 10', city: 'Surabaya' },
  detail_url: 'https://solusindoaset.com/Lelang/rumah-manukan-123', publication: { status: 'TERSEDIA' }, auction_at: '2026-11-01T00:00:00Z' };
function catalogFixture({ location = 'manukan', city = 'surabaya', district = null, purpose = null, category = 'RUMAH', maxPrice = 700000000, item = asset, village = null, minLand = null, maxLand = null } = {}) {
  const reads = [];
  return { reads, async resolve(text, previousId, criteria) {
    reads.push({ text, previousId, criteria });
    assert.equal(criteria.location.toLowerCase(), location);
    assert.equal(criteria.city.toLowerCase(), city);
    if (district) assert.equal(criteria.district, district);
    assert.equal(criteria.max_price, maxPrice);
    assert.equal(criteria.purpose, purpose); assert.equal(criteria.category, category);
    assert.equal(criteria.village, village); assert.equal(criteria.min_land_area_m2, minLand); assert.equal(criteria.max_land_area_m2, maxLand);
    return { asset: null, catalog: [item], source: 'database_listing_publik', status: 'recommendations', selection: { schedule_priority: 'upcoming' } };
  } };
}

test('courtesy particles never enter area filters, including the exact reported request', () => {
  for (const [text, location] of [[QUESTION, 'manukan'], ['Bisa bantu cari lelang aset Manukan pak?', 'Manukan'],
    ['Cari lelang rumah di Manukan ya bu', 'Manukan'], ['Carikan lelang properti di Pakuwon dong pak', 'Pakuwon']]) {
    assert.equal(interactionDecision({ text }), 'allow', text);
    const context = buyerContext([], text, null);
    assert.equal(context.profile.location, location, text);
    assert.deepEqual(context.missing, ['city', 'max_price', ...(context.profile.category ? [] : ['category']), 'land_area']);
  }
  const knownVillage = buyerContext([], 'Cari lelang aset di Manukan Kulon ya pak', null);
  assert.equal(knownVillage.profile.village, 'Manukan Kulon');
  assert.equal(knownVillage.profile.location, 'Tandes'); assert.equal(knownVillage.profile.city, 'Surabaya');
  assert.deepEqual(knownVillage.missing, ['max_price', 'category', 'land_area']);
});

test('reported search gets an immediate professional response despite a failed model or prior greeting', async () => {
  const catalog = catalogFixture();
  const result = await generatePropertyReply({ text: QUESTION, history: [user('Halo'), user(QUESTION)], catalog, ai: noAi,
    policyState: { is_bot_active: true, out_of_scope_notified: true }, now: NOW });
  assert.equal(result.suppressed, undefined); assert.equal(result.generation.mode, 'rules');
  assert.match(result.reply, /Siap, saya bantu cari aset lelang di Manukan/);
  assert.match(result.reply, /kota atau kabupaten mana/); assert.doesNotMatch(result.reply, /[Bb]udget|investasi/);
  assert.doesNotMatch(result.reply, /kah pak|kode|link|30 tahun/);
  assert.equal(catalog.reads.length, 0);
});

test('follow-up answers retain area and ask only remaining criteria, then display real cards', async () => {
  const history = [], catalog = catalogFixture();
  const send = async (text) => {
    history.push(user(text));
    const result = await generatePropertyReply({ text, history, catalog, ai: noAi, now: NOW });
    history.push(assistant(result.reply)); return result;
  };
  await send(QUESTION);
  const city = await send('di Surabaya pak');
  assert.doesNotMatch(city.reply, /kelurahan mana/);
  const village = await send('kelurahan bebas'); assert.match(village.reply, /[Bb]udget/);
  const budget = await send('700 juta pak');
  assert.match(budget.reply, /Jenis properti apa/); assert.doesNotMatch(budget.reply, /Budget-nya sampai berapa/);
  assert.equal(catalog.reads.length, 0);
  const category = await send('rumah pak'); assert.match(category.reply, /luas tanah/);
  const choices = await send('bebas');
  assert.match(choices.reply, /Jl. Manukan Kulon 10/); assert.ok(choices.reply.includes(asset.detail_url));
  assert.equal(choices.knowledge.status, 'recommendations'); assert.equal(choices.generation.mode, 'rules');
  assert.equal(catalog.reads.length, 1);
});

test('bare area answer is understood after the location question and uncertainty does not permanently hand off', async () => {
  const text = 'Tolong carikan lelang aset di Surabaya';
  const opening = searchReply({ buyer: buyerContext([], text, null) });
  const history = [user(text), assistant(opening), user('Manukan pak')];
  assert.equal(buyerContext(history, 'Manukan pak', null).profile.location, 'Manukan');
  assert.equal(interactionDecision({ text: 'belum yakin pak', history, previousId: null }), 'allow');
  assert.equal(interactionDecision({ text: 'maksudnya gimana pak', history, previousId: null }), 'clarify');
  assert.equal(interactionDecision({ text: QUESTION, state: { is_bot_active: false } }), 'silent', 'human handover ownership must remain intact');
});

test('empty search and expired schedules give actionable answers without unsupported sales claims', () => {
  const buyer = buyerContext([], 'Cari lelang rumah di Manukan, Surabaya budget 700 juta untuk investasi, kelurahan bebas, luas tanah bebas', null);
  const empty = searchReply({ buyer, status: 'not_found', catalog: [] });
  assert.match(empty, /[Bb]elum ketemu.*Manukan/); assert.match(empty, /perluas area.*sesuaikan budget/);
  const reply = searchReply({ buyer, status: 'recommendations', catalog: [{ ...asset, auction_at: '2026-01-01T00:00:00Z' }], selection: { schedule_priority: 'needs_confirmation' } }, NOW);
  assert.match(reply, /jadwal ulang perlu dikonfirmasi/); assert.match(reply, /sudah lewat/);
  assert.doesNotMatch(reply, /pasti|siap dilelang|sudah menghubungi|waiting list/);
});

test('live processor answers the exact search and subsequent criteria without pausing', async () => {
  const catalog = catalogFixture(), store = new MemoryStore(config, () => NOW), sent = [];
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => NOW,
    whatsapp: { async sendText(phone, text) { sent.push(text); return 'sent'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const text of [QUESTION, 'di Surabaya pak', 'kelurahan bebas', '700 juta pak', 'rumah pak', 'bebas']) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: PHONE, timestamp: NOW }]); await processor.drain();
    assert.equal(store.get(PHONE).is_bot_active, true);
  }
  assert.equal(sent.length, 6); assert.match(sent[0], /Manukan/); assert.ok(sent[5].includes(asset.detail_url));
});

test('live city -> full area interest -> budget/category retains Surabaya and searches Tandes', async () => {
  const catalog = catalogFixture({ location: 'tandes', purpose: 'investment' }), store = new MemoryStore(config, () => NOW), sent = [];
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => NOW,
    whatsapp: { async sendText(phone, text) { sent.push(text); return 'sent'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const text of ['selamat siang, saya lagi cari lelang aset di surabaya', 'saya tertarik lelang di daerah tandes pak', 'kelurahan bebas', 'Jenis rumah, budget 700 juta untuk investasi', 'bebas']) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: PHONE, timestamp: NOW }]); await processor.drain();
  }
  assert.equal(sent.length, 5); assert.equal(store.get(PHONE).is_bot_active, true);
  assert.match(sent[1], /Tandes.*Surabaya/s); assert.doesNotMatch(sent[1], /kelurahan mana/);
  assert.doesNotMatch(sent[1], /kota atau kabupaten mana|Daerah tandes/);
  assert.equal(catalog.reads.length, 1); assert.ok(sent[4].includes(asset.detail_url));
});

test('Playground remembers the city when the next request contains a full interest sentence', async (t) => {
  const app = express(), token = 'x'.repeat(40), catalog = catalogFixture({ location: 'tandes', purpose: 'investment' });
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  const post = async (text) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(res.status, 200); return res.json();
  };
  const first = await post('selamat siang, saya lagi cari lelang aset di surabaya'); assert.match(first.reply, /Surabaya/);
  const area = await post('saya tertarik lelang di daerah tandes pak');
  assert.equal(area.knowledge.status, 'qualifying'); assert.match(area.reply, /Tandes.*Surabaya/s);
  assert.doesNotMatch(area.reply, /kelurahan mana/); assert.doesNotMatch(area.reply, /kota atau kabupaten mana/);
  assert.equal(catalog.reads.length, 0);
  assert.match((await post('kelurahan bebas')).reply, /[Bb]udget/);
  assert.match((await post('Jenis rumah, budget 700 juta untuk investasi')).reply, /luas tanah/);
  const recommendations = await post('bebas');
  assert.equal(recommendations.knowledge.status, 'recommendations'); assert.equal(catalog.reads.length, 1);
  assert.ok(recommendations.reply.includes(asset.detail_url));
});

test('Playground responds throughout search; actual handoff is visibly flagged and a new session can search again', async (t) => {
  const app = express(), token = 'x'.repeat(40), catalog = catalogFixture();
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  const post = async (text, id = conversationId) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: id, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(res.status, 200); return res.json();
  };
  assert.match((await post(QUESTION)).reply, /Manukan/);
  assert.doesNotMatch((await post('di Surabaya pak')).reply, /kelurahan mana/);
  assert.match((await post('kelurahan bebas')).reply, /[Bb]udget/);
  assert.match((await post('700 juta pak')).reply, /Jenis properti apa/);
  assert.match((await post('rumah pak')).reply, /luas tanah/);
  assert.ok((await post('bebas')).reply.includes(asset.detail_url));
  const viewing = await post('Mau survei lokasi'); assert.match(viewing.reply, /pilih satu aset/); assert.equal(viewing.session.is_bot_active, true);
  const handoff = await post('hubungkan CS'); assert.equal(handoff.reply, HANDOVER_MESSAGE);
  assert.equal(handoff.session.is_bot_active, false);
  assert.equal((await post(QUESTION)).knowledge.status, 'human_handoff_paused');
  const fresh = await post(QUESTION, randomUUID()); assert.match(fresh.reply, /Manukan/); assert.equal(fresh.session.is_bot_active, true);
});

test('live qualification collects the village and land bounds before recommendations without calling a model', async () => {
  const item = { ...asset, address: { ...asset.address, district: 'Tandes', village: 'Manukan Kulon' }, specifications: { land_area_m2: 120 } };
  const catalog = catalogFixture({ location: 'tandes', purpose: 'investment', village: 'Manukan Kulon', minLand: 100, maxLand: 200, item });
  const store = new MemoryStore(config, () => NOW), sent = [];
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => NOW,
    whatsapp: { async sendText(phone, text) { sent.push(text); return 'sent'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  const messages = ['Cari lelang aset di Surabaya', 'saya tertarik lelang di daerah Tandes pak', 'Manukan Kulon pak', 'rumah, budget 700 juta untuk investasi', 'minimal 100 m² maksimal 200 m²'];
  for (const [i, text] of messages.entries()) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: PHONE, timestamp: NOW }]); await processor.drain();
    assert.equal(store.get(PHONE).is_bot_active, true); assert.equal(catalog.reads.length, i === 4 ? 1 : 0);
  }
  assert.equal(sent.length, 5); assert.doesNotMatch(sent[1], /kelurahan mana/); assert.match(sent[3], /luas tanah minimal atau maksimal/);
  assert.ok(sent[4].includes(item.detail_url)); assert.match(sent[4], /LT 120 m²/);
});

test('Playground retains all filters and asks only the missing land preference before rendering cards', async (t) => {
  const catalog = catalogFixture({ location: 'tandes', purpose: 'investment', village: 'Manukan Kulon', minLand: 100, maxLand: 200 });
  const app = express(), token = 'x'.repeat(40);
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  const post = async (text) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(res.status, 200); return res.json();
  };
  const first = await post('Cari lelang rumah di Tandes, Surabaya kelurahan Manukan Kulon budget 700 juta untuk investasi');
  assert.equal(first.knowledge.status, 'qualifying'); assert.match(first.reply, /luas tanah minimal atau maksimal/);
  assert.doesNotMatch(first.reply, /kelurahan mana|Budget-nya sampai berapa/); assert.equal(catalog.reads.length, 0);
  const result = await post('100-200 m2');
  assert.equal(result.knowledge.status, 'recommendations'); assert.equal(catalog.reads.length, 1); assert.ok(result.reply.includes(asset.detail_url));
});

const JAKARTA_REQUEST = 'halo pak, saya ingin cari lelang aset di daerah jakarta selatan, apa adakah pak?';
const jakartaMessages = [JAKARTA_REQUEST, 'Tebet pak', 'Tebet Barat pak', 'rumah, budget 700 juta untuk investasi', '100-200 m2'];
const jakartaCatalog = () => catalogFixture({ location: 'tebet', city: 'jakarta selatan', district: 'Tebet', purpose: 'investment', village: 'Tebet Barat', minLand: 100, maxLand: 200,
  item: { ...asset, name: 'Rumah Tebet Barat', full_address: 'Jl. Tebet Barat, Jakarta Selatan',
    address: { city: 'Jakarta Selatan', district: 'Tebet', village: 'Tebet Barat' }, detail_url: 'https://solusindoaset.com/Lelang/rumah-tebet-123' } });

test('live WhatsApp recognizes the reported Jakarta request and qualifies its hierarchy without AI', async () => {
  const catalog = jakartaCatalog(), store = new MemoryStore(config, () => NOW), sent = [];
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => NOW,
    whatsapp: { async sendText(phone, text) { sent.push(text); return 'sent'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const [i, text] of jakartaMessages.entries()) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: PHONE, timestamp: NOW }]); await processor.drain();
    assert.equal(sent.length, i + 1); assert.equal(store.get(PHONE).is_bot_active, true);
    assert.equal(catalog.reads.length, i === 4 ? 1 : 0);
  }
  assert.match(sent[0], /[Ii]ncar daerah mana/); assert.doesNotMatch(sent[0], /apa adakah|kota atau kabupaten mana/);
  assert.doesNotMatch(sent[1], /kelurahan mana/); assert.match(sent[4], /rumah-tebet-123/);
});

test('Playground uses server-owned region context for Jakarta Selatan -> Tebet -> Tebet Barat', async (t) => {
  const app = express(), token = 'x'.repeat(40), catalog = jakartaCatalog();
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  for (const [i, text] of jakartaMessages.entries()) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); const result = await response.json();
    assert.equal(result.session.is_bot_active, true); assert.equal(result.generation.mode, 'rules');
    assert.equal(catalog.reads.length, i === 4 ? 1 : 0);
    if (i === 0) { assert.match(result.reply, /[Ii]ncar daerah mana/); assert.doesNotMatch(result.reply, /kota atau kabupaten mana|apa adakah/); }
    if (i === 4) assert.match(result.reply, /rumah-tebet-123/);
  }
});

const waruScenarios = [
  { category: 'RUKO', purpose: 'investment', district: 'waru', messages: [
    'selamat siang, saya sedang cari lelang ruko di daerah sidoarjo pak, apakah ada?',
    'di daerah waru pak...', 'intinya di waru , dengan budget 600 juta pak',
    'diinvestasi pak, untuk luas tanah sih minimal 120 m',
  ] },
  { category: 'GUDANG', purpose: null, district: 'Waru', messages: [
    'Cari lelang aset di Kecamatan Waru, Sidoarjo kelurahan bebas budget 600 juta luas tanah minimal 120 m', 'gudang pak',
  ] },
];
function waruCatalog(scenario) {
  return catalogFixture({ location: 'waru', city: 'sidoarjo', district: scenario.district, category: scenario.category,
    purpose: scenario.purpose, maxPrice: 600000000, minLand: 120,
    item: { ...asset, category: scenario.category, name: `${scenario.category} Kepuhkiriman`,
      full_address: 'Kepuhkiriman, Waru, Sidoarjo', address: { city: 'Sidoarjo', district: 'Waru', village: 'Kepuhkiriman' },
      specifications: { land_area_m2: 137 } } });
}

test('live WhatsApp preserves Waru district and property category without repeating purchase-purpose questions', async () => {
  for (const scenario of waruScenarios) {
    const catalog = waruCatalog(scenario), store = new MemoryStore(config, () => NOW), sent = [];
    const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => NOW,
      whatsapp: { async sendText(phone, text) { sent.push(text); return 'sent'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
    for (const [i, text] of scenario.messages.entries()) {
      processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: PHONE, timestamp: NOW }]); await processor.drain();
      assert.equal(sent.length, i + 1); assert.equal(store.get(PHONE).is_bot_active, true);
      assert.equal(catalog.reads.length, i === scenario.messages.length - 1 ? 1 : 0);
      assert.doesNotMatch(sent[i], /untuk dihuni|untuk investasi|atau keduanya|kelurahan \*Waru\*/i);
      if (scenario.category === 'RUKO') assert.doesNotMatch(sent[i], /Jenis properti apa/);
    }
    assert.ok(sent.at(-1).includes(asset.detail_url)); assert.match(sent.at(-1), /Kepuhkiriman/);
  }
});

test('Playground uses the same Waru scope and strict property type as live WhatsApp', async (t) => {
  for (const scenario of waruScenarios) {
    const app = express(), token = 'x'.repeat(40), catalog = waruCatalog(scenario);
    app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => NOW }));
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
    const conversationId = randomUUID();
    for (const [i, text] of scenario.messages.entries()) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
      assert.equal(response.status, 200); const result = await response.json();
      assert.equal(result.session.is_bot_active, true); assert.equal(result.generation.mode, 'rules');
      assert.doesNotMatch(result.reply, /untuk dihuni|untuk investasi|atau keduanya|kelurahan \*Waru\*/i);
      assert.equal(catalog.reads.length, i === scenario.messages.length - 1 ? 1 : 0);
      if (i === scenario.messages.length - 1) {
        assert.equal(result.knowledge.status, 'recommendations'); assert.ok(result.reply.includes(asset.detail_url));
      }
    }
  }
});

const manukanBudgetMessages = ['selamat siang', 'tolong bantu carikan lelang saya property dong di daerah surabaya',
  'lebih tepatnya manukan kulon pak...', 'saya cari lelang rumah sih pak, budget saya di angka 350 juta pak', 'tidak ada'];
const manukanBudgetCatalog = () => catalogFixture({ location: 'tandes', district: 'Tandes', village: 'manukan kulon', maxPrice: 350000000,
  item: { ...asset, category: 'RUMAH', limit_price: 300000000, price_display: 'Rp 300.000.000',
    address: { ...asset.address, district: 'Tandes', village: 'Manukan Kulon' } } });
function assertBudgetReply(reply) {
  assert.match(reply, /rumah.*Manukan Kulon.*Tandes.*Surabaya/s);
  assert.match(reply, /luas tanah minimal atau maksimal/);
  assert.doesNotMatch(reply, /kelurahan mana|kecamatan mana|kota atau kabupaten mana|Budget-nya sampai berapa|Jenis properti apa|Angka 350/i);
}

test('live WhatsApp retains Manukan Kulon, type and budget across a seven-minute gap and searches after tidak ada land bounds', async () => {
  let clock = NOW;
  const catalog = manukanBudgetCatalog(), store = new MemoryStore(config, () => clock), sent = [];
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => clock,
    whatsapp: { async sendText(phone, text) { sent.push(text); return 'sent'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const [i, text] of manukanBudgetMessages.entries()) {
    if (i === 2) clock += 7 * 60000;
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: PHONE, timestamp: clock }]); await processor.drain();
    assert.equal(sent.length, i + 1); assert.equal(store.get(PHONE).is_bot_active, true);
    assert.equal(catalog.reads.length, i === 4 ? 1 : 0);
    if (i === 3) assertBudgetReply(sent[i]);
  }
  assert.ok(sent[4].includes(asset.detail_url)); assert.match(sent[4], /300\.000\.000/);
});

test('Playground preserves Manukan Kulon with budget di angka and continues directly after tidak ada land bounds', async (t) => {
  let clock = NOW;
  const app = express(), token = 'x'.repeat(40), catalog = manukanBudgetCatalog();
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => clock }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  for (const [i, text] of manukanBudgetMessages.entries()) {
    if (i === 2) clock += 7 * 60000;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); const result = await response.json();
    assert.equal(result.session.is_bot_active, true); assert.equal(result.generation.mode, 'rules');
    assert.equal(catalog.reads.length, i === 4 ? 1 : 0);
    if (i === 3) { assert.equal(result.knowledge.status, 'qualifying'); assertBudgetReply(result.reply); }
    if (i === 4) { assert.equal(result.knowledge.status, 'recommendations'); assert.ok(result.reply.includes(asset.detail_url)); }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { buyerContext, extractBudget, explicitAsset } from '../services/buyer_profile.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { searchReply } from '../services/search_reply.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';

const user = (content) => ({ role: 'user', content }), assistant = (content) => ({ role: 'assistant', content });
function dialogue(opening = 'Cari lelang ruko di Gresik') {
  const history = [];
  return { history, send(text) {
    history.push(user(text));
    const buyer = buyerContext(history, text, null);
    const reply = searchReply({ buyer, status: buyer.stage === 'recommendations' ? 'not_found' : 'qualifying' });
    if (reply) history.push(assistant(reply));
    return { buyer, reply };
  }, start() { return this.send(opening); } };
}

const wholeGresikReplies = [
  'pokoknya di gresik pak , budget saya 1m',
  'Gresik aja pak 1M',
  'intinya Gresik, budget satu miliar',
  'yang penting masih di Gresik, dana 1 miliar',
  'kecamatannya terserah asal di Gresik, budget 1m',
  'bebas kecamatan pak, budget 1m',
  'dimana aja boleh, dana satu miliar',
  'semua Gresik, budget 1m',
  'di mana saja asal Gresik, 1m',
  'Gresik mana pun boleh, anggaran 1.000.000.000',
  'lokasinya terserah pak, mentok satu milyar',
  'nggak masalah kecamatannya, yang penting di Gresik. Budget semiliar',
  'cari lelang di seluruh Gresik, budget Rp 1.000.000.000',
  'nggak masalah kecamatannya pak, budget 1m',
];

test('reported whole-city answer and natural variants accept Gresik once and advance to land preference', () => {
  for (const text of wholeGresikReplies) {
    const d = dialogue(); d.start(); const result = d.send(text);
    assert.equal(result.buyer.profile.city.toLowerCase(), 'gresik', text);
    assert.equal(result.buyer.profile.location.toLowerCase(), 'gresik', text);
    assert.equal(result.buyer.profile.district, null, text); assert.equal(result.buyer.profile.village, null, text);
    assert.equal(result.buyer.profile.category, 'RUKO', text); assert.equal(result.buyer.profile.max_price, 1000000000, text);
    assert.deepEqual(result.buyer.missing, ['land_area'], text);
    assert.doesNotMatch(result.reply, /kecamatan mana|kelurahan mana|kota atau kabupaten mana|Budget-nya sampai berapa|Jenis properti apa/i, text);
    assert.match(result.reply, /luas tanah/, text);
    const ready = d.send('tidak ada');
    assert.equal(ready.buyer.stage, 'recommendations', text);
    assert.equal(ready.buyer.profile.location.toLowerCase(), 'gresik', text);
    assert.equal(ready.buyer.profile.max_price, 1000000000, text);
  }
});

test('repeated city works in other regions but a city-only first message still asks for area', () => {
  for (const city of ['Surabaya', 'Kabupaten Sidoarjo', 'Jakarta Selatan', 'Kota Bandung']) {
    const d = dialogue(`Cari lelang gudang di ${city}`), first = d.start();
    assert.equal(first.buyer.profile.location, null, city); assert.match(first.reply, /[Ii]ncar daerah mana/);
    const result = d.send(`pokoknya ${city} aja pak, budget 2M, luas tanah minimal 200 m2`);
    assert.equal(result.buyer.stage, 'recommendations', city);
    assert.equal(result.buyer.profile.location, result.buyer.profile.city, city);
    assert.equal(result.buyer.profile.category, 'GUDANG', city); assert.equal(result.buyer.profile.max_price, 2000000000, city);
    assert.equal(result.buyer.profile.min_land_area_m2, 200, city);
  }
});

test('whole-district replies never broaden a Waru search to all of Sidoarjo', () => {
  for (const text of ['pokoknya Waru aja pak, budget 600 juta', 'intinya di Waru, budget enam ratus juta',
    'kelurahannya terserah, anggaran 600jt', 'semua kelurahan di Waru pak, budget 600 juta',
    'di mana aja asal masih Waru, dana 600 juta', 'desa bebas pak, budget 600 juta']) {
    const d = dialogue('Cari lelang ruko di Kecamatan Waru, Sidoarjo'); d.start();
    const result = d.send(text);
    assert.equal(result.buyer.profile.city, 'Sidoarjo', text); assert.equal(result.buyer.profile.district.toLowerCase(), 'waru', text);
    assert.equal(result.buyer.profile.location.toLowerCase(), 'waru', text); assert.equal(result.buyer.profile.village, null, text);
    assert.equal(result.buyer.profile.max_price, 600000000, text); assert.deepEqual(result.buyer.missing, ['land_area'], text);
  }
});

test('unanswered geography is not inferred from a financial, category, land or uncertain answer', () => {
  for (const text of ['budget 1M', 'luas tanah bebas, budget 1M', 'jenis bebas, budget 1M',
    'budget bebas, luas tanah minimal 120 m2', 'nggak masalah budgetnya pak', 'terserah jenisnya pak',
    'belum tahu pak', 'Gresik yang mana pak?', 'bukan Gresik pak']) {
    const d = dialogue(); d.start(); const result = d.send(text);
    assert.equal(result.buyer.profile.location, null, text);
    assert.ok(result.buyer.missing.includes('location'), text);
  }
});

test('one bare free-choice answer only completes the first question; labelled preferences remain independent', () => {
  const d = dialogue('Cari lelang aset di seluruh Gresik budget 1m'); d.start();
  const type = d.send('bebas pak');
  assert.equal(type.buyer.profile.category, null); assert.deepEqual(type.buyer.missing, ['land_area']);
  const land = d.send('terserah pak');
  assert.equal(land.buyer.stage, 'recommendations'); assert.equal(land.buyer.profile.location, 'Gresik');
  for (const answer of ['luas tanah terserah pak', 'luas tanah berapa aja', 'nggak ada patokan pak', 'besar kecil nggak masalah']) {
    const c = dialogue(); c.start(); c.send(wholeGresikReplies[0]);
    assert.equal(c.send(answer).buyer.stage, 'recommendations', answer);
  }
  const firstLand = buyerContext([user('Cari lelang aset di seluruh Gresik budget 1m'), assistant('Apakah ada batas luas tanah? Jenis properti apa yang Bapak/Ibu cari?')], 'bebas', null);
  assert.deepEqual(firstLand.missing, ['category']);
});

test('conversational and written budget amounts are exact and never establish readiness of funds', () => {
  for (const [text, value] of [['budget satu miliar', 1e9], ['anggaran semiliar', 1e9], ['mentok satu setengah miliar', 1.5e9],
    ['budget lima ratus juta', 5e8], ['dana tujuh ratus lima puluh juta', 750000000], ['budget satu koma dua miliar', 1.2e9],
    ['budget 1.000.000.000', 1e9], ['1000000000', 1e9], ['Rp 1.000.000.000', 1e9], ['budget setengah miliar', 5e8]]) {
    assert.equal(extractBudget(text, { allowImplicit: true })?.max_price, value, text);
  }
  assert.equal(explicitAsset('1000000000', assistant('Berapa batas anggaran yang Bapak/Ibu siapkan?')), false);
  assert.equal(explicitAsset('Kode 114108', assistant('Berapa batas anggaran yang Bapak/Ibu siapkan?')), true);
  assert.deepEqual(extractBudget('LT minimal 120 m2, budget 1M, cari lelang ruko di seluruh Gresik'), { min_price: null, max_price: 1000000000 });
  assert.deepEqual(extractBudget('minimal 120 m2, budget 1M'), { min_price: null, max_price: 1000000000 });
});

test('all criteria may arrive in any order and explicit whole-district consent is accepted before qualification', () => {
  for (const text of ['LT minimal 120 m2, budget 1M, cari lelang ruko di seluruh Gresik',
    'Cari lelang ruko di Gresik, seluruh kecamatan boleh, budget 1M, luas tanah minimal 120 m2',
    'Budget 1m, saya cari lelang ruko di seluruh Gresik, LT minimal 120 m2']) {
    const { buyer } = dialogue(text).start();
    assert.equal(buyer.stage, 'recommendations', text); assert.equal(buyer.profile.max_price, 1e9, text);
    assert.equal(buyer.profile.min_price, null, text); assert.equal(buyer.profile.min_land_area_m2, 120, text);
    assert.equal(buyer.profile.category, 'RUKO', text); assert.equal(buyer.profile.location.toLowerCase(), 'gresik', text);
  }
});

test('correcting a city or type changes only the client-specified filters and preserves earlier budget', () => {
  const d = dialogue('Cari lelang ruko di seluruh Gresik budget 1m luas tanah minimal 120 m2'); d.start();
  const corrected = d.send('bukan Gresik pak, ganti ke Sidoarjo aja, jenisnya gudang');
  assert.equal(corrected.buyer.profile.city, 'Sidoarjo'); assert.equal(corrected.buyer.profile.category, 'GUDANG');
  assert.equal(corrected.buyer.profile.max_price, 1e9); assert.equal(corrected.buyer.profile.min_land_area_m2, 120);
});

test('complete multi-field answers search immediately; a vague or invalid answer never queries unconfirmed filters', async () => {
  const history = [], calls = [], ai = { generate() { assert.fail('Qualification must work without a language model'); } };
  const catalog = { async resolve(text, previousId, criteria) { calls.push(criteria); return { asset: null, catalog: [], status: 'not_found' }; } };
  const send = async (text) => { history.push(user(text)); const result = await generatePropertyReply({ text, history, catalog, ai }); history.push(assistant(result.reply)); return result; };
  await send('Cari lelang ruko di Gresik'); assert.equal(calls.length, 0);
  await send('pokoknya di gresik pak , budget saya 1m'); assert.equal(calls.length, 0);
  const ready = await send('luasnya minimal seratus dua puluh meter persegi');
  assert.equal(ready.knowledge.status, 'not_found'); assert.equal(calls.length, 1);
  assert.equal(calls[0].location.toLowerCase(), 'gresik'); assert.equal(calls[0].city.toLowerCase(), 'gresik');
  assert.equal(calls[0].district, null); assert.equal(calls[0].village, null); assert.equal(calls[0].category, 'RUKO');
  assert.equal(calls[0].min_land_area_m2, 120); assert.equal(calls[0].max_price, 1000000000);
});

const NOW = Date.parse('2026-10-11T08:00:00Z'), config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
function scopedCatalog() {
  const calls = [], asset = { id: '456', name: 'Ruko Cerme', transaction_type: 'LELANG', category: 'RUKO', limit_price: 800000000,
    price_display: 'Rp 800.000.000', full_address: 'Jalan Raya Cerme, Gresik', address: { street: 'Jalan Raya Cerme', city: 'Gresik', district: 'Cerme' },
    specifications: { land_area_m2: 150 }, detail_url: 'https://solusindoaset.com/Lelang/ruko-cerme-456', auction_at: '2026-12-01T00:00:00Z', publication: { status: 'TERSEDIA' } };
  return { calls, async resolve(_text, _previousId, criteria) {
    calls.push(criteria); assert.equal(criteria.city.toLowerCase(), 'gresik'); assert.equal(criteria.location.toLowerCase(), 'gresik');
    assert.equal(criteria.district, null); assert.equal(criteria.village, null); assert.equal(criteria.category, 'RUKO');
    assert.equal(criteria.max_price, 1e9); assert.equal(criteria.min_land_area_m2, 120);
    return { asset: null, catalog: [asset], status: 'recommendations', source: 'database_listing_publik' };
  } };
}

test('live processor accepts the reported Gresik reply, asks only land and queries the right type and whole city', async () => {
  const catalog = scopedCatalog(), store = new MemoryStore(config, () => NOW), sent = [], phone = '6281234567890';
  const processor = new MessageProcessor({ config, store, catalog, ai: { generate() { assert.fail('No model is needed for qualification'); } }, now: () => NOW,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'sent'; } }, logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  for (const text of ['Cari lelang ruko di Gresik', wholeGresikReplies[0], 'minimal 120 m2']) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: NOW }]); await processor.drain();
  }
  assert.equal(sent.length, 3); assert.match(sent[1], /seluruh wilayah Gresik/); assert.match(sent[1], /Rp 1\.000\.000\.000/);
  assert.doesNotMatch(sent[1], /kecamatan mana|kelurahan mana|Budget-nya sampai berapa/);
  assert.match(sent[2], /ruko-cerme-456/); assert.equal(catalog.calls.length, 1); assert.equal(store.get(phone).is_bot_active, true);
});

test('Playground server context accepts a colloquial whole-city and spoken budget, then spoken land bounds', async (t) => {
  const catalog = scopedCatalog(), app = express(), token = 'x'.repeat(40);
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: { generate() { assert.fail('No model is needed for qualification'); } }, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  const post = async (text) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); return response.json();
  };
  await post('Cari lelang ruko di Gresik'); const scope = await post('dimana aja boleh, dana satu miliar');
  assert.match(scope.reply, /seluruh wilayah Gresik/); assert.match(scope.reply, /Rp 1\.000\.000\.000/);
  assert.doesNotMatch(scope.reply, /kecamatan mana|kelurahan mana|Budget-nya sampai berapa/);
  const result = await post('luasnya minimal seratus dua puluh meter persegi');
  assert.equal(result.knowledge.status, 'recommendations'); assert.match(result.reply, /ruko-cerme-456/); assert.equal(catalog.calls.length, 1);
});

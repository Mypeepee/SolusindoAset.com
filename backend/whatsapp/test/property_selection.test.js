import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { renderRecommendations, recommendationMessages } from '../services/recommendations.js';
import { selectedRecommendation, AMBIGUOUS_SELECTION_REPLY, INVALID_SELECTION_REPLY } from '../services/property_selection.js';
import { generatePropertyReply, resolvePropertyContext } from '../services/property_reply.js';
import { propertyDetailsReply, requestsPropertyDetails } from '../services/property_details.js';
import { interactionDecision } from '../services/interaction_policy.js';
import { BACKUP_AREA_QUESTION } from '../services/buyer_profile.js';
import { auctionCheckExplained } from '../services/auction_check.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';

const NOW = Date.parse('2026-10-11T08:00:00Z');
const user = (content) => ({ role: 'user', content }), assistant = (content) => ({ role: 'assistant', content });
const addresses = [
  'Manukan Madya No 24 Blok 34A Kelurahan Manukan Wetan Kecamatan Tandes Kota Surabaya',
  'Manukan Madya No 24 Blok 34 A Kelurahan Manukan Wetan Kecamatan Tandes Kota Surabaya',
  'Jl. Manukan Madya No 24 / Blok 34 A, Kel. Manukan Wetan, Kec.Tandes, Surabaya. Provinsi Jawa timur.',
];
const options = ['114108', '102381', '63612'].map((id, i) => ({
  id, name: 'Rumah Manukan Madya', transaction_type: 'LELANG', category: 'RUMAH', limit_price: [194000000, 195000000, 325000000][i],
  price_display: `Rp ${[194, 195, 325][i]}.000.000`, deposit: 38800000,
  full_address: addresses[i] + (i < 2 ? ', Jawa Timur' : ''),
  address: { street: addresses[i], province: 'Jawa Timur', city: 'Surabaya', district: 'Tandes', village: 'Manukan Wetan' },
  specifications: { land_area_m2: 111, building_area_m2: 70, floors: 1, bedrooms: 2, bathrooms: 1, certificate_type: 'SHM' },
  auction_at: ['2026-05-20T17:00:00Z', '2026-04-14T17:00:00Z', '2025-12-22T17:00:00Z'][i],
  publication: { status: 'TERSEDIA' }, detail_url: `https://solusindoaset.com/Lelang/rumah-manukan-madya-${id}`,
}));
const query = 'Cari lelang rumah di Tandes, Surabaya kelurahan Manukan Wetan budget 350 juta luas tanah bebas';
const request = `boleh minta detail terhadap aset yang ini pak? ${addresses[0]}`;
const noAi = { async generate() { assert.fail('Asset selection and details must work without the model'); } };
const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
function cards(items = options) {
  return renderRecommendations(`Berikut pilihannya.\n\n${items.map((p) => `[[PROPERTY:${p.id}]]`).join('\n')}\n\nProperti mana yang ingin Bapak/Ibu bahas lebih lanjut?`, items, { schedule_priority: 'needs_confirmation' }, NOW);
}
const history = () => [user(query), assistant(cards())];

test('everyday numbered choices select the displayed second property, including the reported sentence', async () => {
  for (const text of ['saya tertarik yang nomor 2 pak', 'saya tertarik nomor 2 pak', 'yang no. 2 aja',
    'nomer 2 pak', 'nomor dua', 'pilihan ke-2', 'saya pilih yang kedua', 'no.2', '2']) {
    const catalog = fixture();
    assert.equal(selectedRecommendation(text, history())?.id, options[1].id, text);
    const result = await generatePropertyReply({ text, history: history(), catalog, ai: noAi, now: NOW });
    assert.equal(result.asset.id, options[1].id, text);
    assert.deepEqual(catalog.calls, [{ text: `Kode ${options[1].id}`, previousId: null, criteria: undefined }]);
    assert.match(result.reply, /DETAIL ASET/);
    assert.doesNotMatch(result.reply, /Budget-nya sampai berapa|kelurahan mana/);
  }
});

test('ordinal pointers work with old bullet cards, rendered markdown links, and split numbered lists', () => {
  const old = cards().replace(/^\d+\. /gm, '• ').replace(/Lihat detail: (https:\/\/\S+)/g, 'Lihat detail: [**Buka detail properti ↗**]($1)');
  assert.equal(selectedRecommendation('saya tertarik yang nomor 2 pak', [assistant(old)])?.id, options[1].id);
  const long = options.map((p) => ({ ...p, full_address: `Jalan ${'Manukan '.repeat(160)}Nomor 24` }));
  const messages = recommendationMessages(cards(long));
  assert.ok(messages.length > 1);
  assert.equal(selectedRecommendation('saya tertarik yang nomor 2 pak', messages.map(assistant))?.id, options[1].id);
});

test('invalid and multiple numbered choices clarify; prices, rooms, rejected choices and street numbers are not selections', () => {
  assert.equal(selectedRecommendation('yang nomor 6 pak', history())?.kind, 'invalid');
  assert.equal(selectedRecommendation('yang nomor 1 atau nomor 2', history())?.kind, 'ambiguous');
  for (const text of ['yang 2 kamar', 'budget saya nomor 2', 'nomor 2 miliar', 'saya tidak tertarik nomor 2',
    'di Jalan Melati nomor 2 pak', 'bukan yang nomor 2']) {
    assert.equal(selectedRecommendation(text, history())?.id ?? null, null, text);
  }
});
function fixture({ missing = false } = {}) {
  const calls = [];
  return { calls, async resolve(text, previousId, criteria) {
    calls.push({ text, previousId, criteria });
    if (criteria) return { asset: null, catalog: options, status: 'recommendations', source: 'database_listing_publik', selection: { schedule_priority: 'needs_confirmation' } };
    const selected = options.find((p) => text === `Kode ${p.id}`);
    assert.ok(selected, `Only the selected ID may be looked up: ${text}`);
    return { asset: missing ? null : { ...selected, limit_price: selected.limit_price - 1000000 }, catalog: [], status: missing ? 'not_found' : 'matched', source: 'database_listing_publik' };
  } };
}

test('exact copied addresses distinguish the three similar listings, including an appended province', () => {
  for (const [i, address] of addresses.entries()) {
    assert.equal(selectedRecommendation(`boleh minta detail terhadap aset yang ini pak? ${address}`, history()).id, options[i].id);
    assert.equal(selectedRecommendation(address.toUpperCase(), history()).id, options[i].id);
    assert.equal(interactionDecision({ text: address, history: history() }), 'allow');
  }
  const doubleBold = history(); doubleBold[1].content = doubleBold[1].content.replace(/\*/g, '**');
  assert.equal(selectedRecommendation(request, doubleBold).id, '114108');
});

test('abbreviations work for a unique address; house numbers never become numbered choices', () => {
  const single = [assistant(cards([options[0]]))];
  assert.equal(selectedRecommendation('Minta detail Manukan Madya nomor 24 Blok 34 A Kel. Manukan Wetan Kec. Tandes Kota Surabaya', single).id, '114108');
  const unit = { ...options[0], full_address: 'Jalan Kenari No 2 Blok A, Surabaya' };
  // Give the house-number fixture a distinct pointer: matching No 2 must
  // resolve its address, not silently interpret it as the second card.
  const different = { ...unit, id: '999', detail_url: 'https://solusindoaset.com/Lelang/kenari-999' };
  assert.equal(selectedRecommendation('detail Jalan Kenari No 2 Blok A, Surabaya', [assistant(cards([different, options[1]]))]).id, '999');
});

test('ambiguous address asks once for a pointer and an ordinal then re-fetches the chosen asset', async () => {
  const catalog = fixture(), h = history(), text = 'Minta detail Manukan Madya No 24';
  assert.equal(selectedRecommendation(text, h).kind, 'ambiguous');
  h.push(user(text));
  const result = await generatePropertyReply({ catalog, ai: noAi, text, history: h, now: NOW });
  assert.equal(result.reply, AMBIGUOUS_SELECTION_REPLY); assert.equal(catalog.calls.length, 0);
  assert.equal(result.knowledge.status, 'ambiguous_selection');
  h.push(assistant(result.reply), user('yang kedua'));
  const chosen = await generatePropertyReply({ catalog, ai: noAi, text: 'yang kedua', history: h, now: NOW });
  assert.equal(chosen.asset.id, '102381'); assert.equal(catalog.calls[0].text, 'Kode 102381');
  assert.equal(catalog.calls[0].criteria, undefined); assert.match(chosen.reply, /DETAIL ASET/);
  const identical = [{ ...options[0], full_address: addresses[0] }, { ...options[1], full_address: addresses[0] }];
  assert.equal(selectedRecommendation(addresses[0], [assistant(cards(identical))]).kind, 'ambiguous');
});

test('a mismatched address is clarified and explicit pointers or new searches retain priority', async () => {
  const catalog = fixture(), h = history(), text = request.replace('No 24', 'No 25');
  const result = await generatePropertyReply({ catalog, ai: noAi, text, history: [...h, user(text)], now: NOW });
  assert.equal(result.reply, INVALID_SELECTION_REPLY); assert.equal(catalog.calls.length, 0);
  assert.equal(selectedRecommendation(`Kode 63612, detail ${addresses[0]}`, h), null);
  assert.equal(selectedRecommendation(`${options[2].detail_url} ${addresses[0]}`, h), null);
  assert.equal(selectedRecommendation('Carikan lelang rumah di Manukan Madya budget 300 juta', h), null);
  assert.equal(selectedRecommendation(addresses[0], [...h, assistant('Bapak/Ibu membutuhkan informasi apa?')]), null, 'An unrelated later reply cannot revive an old list');
  const invalid = selectedRecommendation('yang ketiga', [assistant(cards(options.slice(0, 2)))]);
  assert.equal(invalid.kind, 'invalid');
});

test('selected details use only fresh public facts and do not replay the expired-asset search introduction', async () => {
  const catalog = fixture(), h = [...history(), user(request)];
  const result = await generatePropertyReply({ catalog, ai: noAi, text: request, history: h, now: NOW });
  assert.equal(result.asset.id, '114108'); assert.equal(result.generation.mode, 'rules');
  assert.match(result.reply, /DETAIL ASET.*Kode 114108/); assert.match(result.reply, /Harga limit: Rp 193\.000\.000/);
  assert.match(result.reply, /Luas tanah: 111 m²/); assert.match(result.reply, /Luas bangunan: 70 m²/);
  assert.match(result.reply, /Kamar tidur: 2/); assert.match(result.reply, /SHM/);
  assert.match(result.reply, /21 Mei 2026 WIB \(sudah lewat\)/); assert.match(result.reply, /lelang ulang perlu dikonfirmasi/);
  assert.ok(result.reply.includes(options[0].detail_url));
  assert.ok(!result.reply.includes(options[1].detail_url)); assert.ok(!result.reply.includes(options[2].detail_url));
  assert.ok(!result.reply.includes(BACKUP_AREA_QUESTION));
  assert.doesNotMatch(result.reply, /194\.000\.000|195\.000\.000|325\.000\.000|Properti mana|Budget-nya sampai berapa|kelurahan mana|sudah.*menghubungi/);
  assert.ok(auctionCheckExplained([assistant(result.reply)], '114108'));
});

test('an asset withdrawn since recommendation yields no stale prices, details or alternatives', async () => {
  const catalog = fixture({ missing: true });
  const result = await generatePropertyReply({ catalog, ai: noAi, text: request, history: [...history(), user(request)], now: NOW });
  assert.equal(result.asset, null); assert.match(result.reply, /belum ditemukan dalam listing publik terbaru/);
  assert.doesNotMatch(result.reply, /194\.000\.000|111 m²|sudah terjual|Berikut pilihan/);
  assert.equal(catalog.calls.length, 1); assert.equal(catalog.calls[0].criteria, undefined);
});

test('next questions stay locked to the address selection; previous cards are excluded from model context', async () => {
  const catalog = fixture(), h = [...history(), user(request)];
  const selected = await generatePropertyReply({ catalog, ai: noAi, text: request, history: h, now: NOW });
  h.push(assistant(selected.reply), user('Ada informasi fasilitas sekitar?'));
  let input;
  const answer = await generatePropertyReply({ catalog, ai: { async generate(value) { input = value; return { reply: 'Bapak/Ibu, informasi akses jalan belum tercatat.', qualification: {} }; } },
    text: h.at(-1).content, history: h, previousId: selected.asset.id, now: NOW });
  assert.equal(answer.asset.id, '114108'); assert.equal(input.knowledge.locked_asset_id, '114108');
  assert.equal(input.knowledge.buyer.searching, false); assert.deepEqual(input.catalog, []);
  assert.equal(input.history[0].content, request); assert.ok(!JSON.stringify(input.history).includes(options[1].detail_url));
  const context = await resolvePropertyContext(catalog, 'Boleh detail lengkap lagi?', selected.asset.id, h, NOW);
  assert.equal(context.buyer.stage, 'consultation'); assert.equal(context.buyer.searching, false);
  assert.ok(catalog.calls.every((c) => c.text === 'Kode 114108' && !c.criteria));
});

test('details leave absent specifications unknown and respect each transaction type without template floors', async () => {
  assert.equal(requestsPropertyDetails('Boleh detail lengkap lagi?'), true);
  assert.equal(requestsPropertyDetails('Tolong jelaskan aset Kode 114108'), true);
  assert.equal(requestsPropertyDetails('Detail rumah tangga artis itu'), false);
  const text = 'saya mau tahu detail rumah tersebut';
  const result = await generatePropertyReply({ catalog: fixture(), ai: noAi, text,
    history: [user('Kode 114108'), user(text)], previousId: '114108', now: NOW });
  assert.match(result.reply, /Jenis transaksi: Lelang/);
  assert.doesNotMatch(result.reply, /lantai/i);
  assert.equal(result.generation.mode, 'rules');
  const minimal = { ...options[0], specifications: {}, deposit: null, auction_at: null };
  const reply = propertyDetailsReply(minimal, { now: NOW });
  assert.match(reply, /Luas tanah: belum tercatat/); assert.match(reply, /Luas bangunan: belum tercatat/);
  assert.match(reply, /Jadwal lelang belum tercatat/); assert.doesNotMatch(reply, /Kamar tidur|SHM|21 Mei/);
  const sale = propertyDetailsReply({ ...minimal, transaction_type: 'SECONDARY', asking_price: 400000000 }, { now: NOW });
  assert.match(sale, /Jenis transaksi: Secondary/); assert.match(sale, /Harga penawaran: Rp 400\.000\.000/);
  assert.doesNotMatch(sale, /Harga limit|JADWAL DAN STATUS|Uang jaminan|lelang ulang/);
  assert.equal(propertyDetailsReply({ ...options[0], publication: { status: 'TERJUAL' } }), null);
  assert.equal(propertyDetailsReply({ ...options[0], availability_status: 'withdrawn' }), null);
  for (const [type, label] of [['PRIMARY', 'Primary'], ['SECONDARY', 'Secondary'], ['SEWA', 'Sewa'], ['LELANG', 'Lelang']]) {
    const detail = propertyDetailsReply({ ...options[0], transaction_type: type });
    assert.ok(detail.includes(`Jenis transaksi: ${label}`));
    assert.doesNotMatch(detail, /lantai/i);
  }
});

test('live processor searches, selects a copied address, then calculates costs for that one asset', async () => {
  const catalog = fixture(), store = new MemoryStore(config, () => NOW), sent = [], phone = '6281234567890';
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => NOW,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'sent'; } }, logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  for (const text of [query, request, 'itu harga 194 juta apakah sudah termasuk biaya biaya?']) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: NOW }]); await processor.drain();
  }
  assert.equal(sent.length, 3); assert.ok(sent[0].includes(options[2].detail_url));
  assert.match(sent[1], /DETAIL ASET.*114108/); assert.match(sent[2], /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.match(sent[2], /Rp 193\.000\.000/); assert.doesNotMatch(sent[2], /Rp 194\.000\.000|195\.000\.000|325\.000\.000/);
  assert.equal(store.get(phone).asset_id, '114108'); assert.equal(store.get(phone).is_bot_active, true);
  assert.ok(catalog.calls[0].criteria); assert.ok(catalog.calls.slice(1).every((c) => c.text === 'Kode 114108' && !c.criteria));
});

test('Playground uses server conversation context to open one address and retain the choice for costs', async (t) => {
  const catalog = fixture(), app = express(), token = 'x'.repeat(40);
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
  const listed = await post(query); assert.equal(listed.knowledge.status, 'recommendations');
  const selected = await post(request);
  assert.equal(selected.session.asset_id, '114108'); assert.equal(selected.generation.mode, 'rules');
  assert.match(selected.reply, /DETAIL ASET/); assert.match(selected.reply, /Rp 193\.000\.000/);
  const costs = await post('Harga itu sudah all in?');
  assert.equal(costs.asset.id, '114108'); assert.equal(costs.session.is_bot_active, true);
  assert.match(costs.reply, /ESTIMASI BIAYA PEMBELIAN LELANG/); assert.match(costs.reply, /Rp 193\.000\.000/);
  assert.ok(catalog.calls.slice(1).every((c) => c.text === 'Kode 114108' && !c.criteria));
});

test('WhatsApp opens the second asset for saya tertarik yang nomor 2 and locks subsequent cost questions to it', async () => {
  const catalog = fixture(), store = new MemoryStore(config, () => NOW), sent = [], phone = '6281234567890';
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => NOW,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'sent'; } }, logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  for (const text of [query, 'saya tertarik yang nomor 2 pak', 'harga itu sudah all in?']) {
    processor.acceptBatch([{ id: randomUUID(), text, type: 'text', from: phone, timestamp: NOW }]); await processor.drain();
  }
  assert.equal(sent.length, 3);
  assert.match(sent[0], /^2\. \*/m);
  assert.match(sent[1], /DETAIL ASET.*102381/);
  assert.match(sent[2], /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.equal(store.get(phone).asset_id, options[1].id);
  assert.ok(catalog.calls.slice(1).every((c) => c.text === `Kode ${options[1].id}` && !c.criteria));
});

test('Playground opens the second asset from server-owned recommendation order', async (t) => {
  const catalog = fixture(), app = express(), token = 'x'.repeat(40);
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  for (const text of [query, 'saya tertarik yang nomor 2 pak']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200);
    const result = await response.json();
    if (text !== query) {
      assert.equal(result.session.asset_id, options[1].id);
      assert.match(result.reply, /DETAIL ASET.*102381/);
      assert.equal(result.suppressed, false);
    }
  }
  assert.equal(catalog.calls[1].text, `Kode ${options[1].id}`);
});

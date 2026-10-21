import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { auctionCostEstimate, isPurchaseCostQuestion, propertyTransactionType, purchaseCostReply } from '../services/property_costs.js';
import { detectHandover, HANDOVER_MESSAGE, interactionDecision } from '../services/interaction_policy.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { createAiController } from '../services/ai_controller.js';
import { assetFacts } from '../services/catalog.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { mapPublicProperty } from '../../../src/lib/chatbot/property-knowledge.ts';

const NOW = Date.parse('2026-10-09T03:00:00Z'), PHONE = '6281234567890';
const REPORTED_QUESTION = 'itu harga 417 juta apakah sudah termasuk biaya biaya?';
const auction = mapPublicProperty({ id_property: 123n, jenis_transaksi: 'LELANG', judul: 'Rumah Candi', kategori: 'RUMAH',
  harga: 950000000, nilai_limit_lelang: 800000000, uang_jaminan: 160000000,
  alamat_lengkap: 'Jl. Mawar 12', kota: 'Sidoarjo', provinsi: 'Jawa Timur',
  tanggal_lelang: new Date('2026-10-20T10:00:00+07:00') }, NOW);
const secondary = mapPublicProperty({ id_property: 456n, jenis_transaksi: 'SECONDARY', judul: 'Rumah Surabaya',
  harga: 900000000, nilai_limit_lelang: 100000000, kota: 'Surabaya' }, NOW);
const user = (content) => ({ role: 'user', content });
const noAi = { async generate() { throw new Error('Cost breakdown must not require a model'); } };
const matched = (asset) => ({ asset, catalog: [], status: asset ? 'matched' : 'not_found', source: 'database_listing_publik' });
const forbiddenSaleFees = /Bea Lelang|PPN Lelang|kerohiman|eksekusi|pengosongan|Fee Agent|ESTIMASI BIAYA PEMBELIAN LELANG/i;
function catalogFixture() {
  const rows = new Map([['123', auction], ['456', secondary]]), reads = [];
  return { rows, reads, async resolve(text, previousId) {
    reads.push({ text, previousId });
    const id = /(?:Kode\s+|properti-)(\d+)/i.exec(text)?.[1] || previousId;
    return matched(rows.get(id) || null);
  } };
}
const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };

test('standard illustration totals Rp1 billion limit and rounds each component before summing', () => {
  const estimate = auctionCostEstimate({ ...auction, limit_price: 1_000_000_000 });
  assert.deepEqual(estimate.transfer.map((item) => item.amount), [20_000_000, 50_000_000, 11_000_000, 4_000_000, 10_000_000]);
  assert.equal(estimate.transfer_total, 95_000_000);
  assert.equal(estimate.execution_total, 184_800_000);
  assert.equal(estimate.agent, 50_000_000);
  assert.equal(estimate.total_execution, 1_329_800_000);
  assert.equal('mediation' in estimate, false); assert.equal('total_mediation' in estimate, false);
  const fractional = auctionCostEstimate({ ...auction, limit_price: 417_128_521 });
  assert.deepEqual(fractional.transfer.map((item) => item.amount), [8_342_570, 20_856_426, 4_588_414, 1_668_514, 10_000_000]);
  assert.equal(fractional.total_execution, 643_240_871);
  assert.equal(auctionCostEstimate({ ...auction, deposit: 999999999 }).total_execution, 1_102_800_000);
});

test('reported decimal limit generates the complete breakdown for the exact follow-up, using fresh database facts', async () => {
  const asset = mapPublicProperty({ id_property: 121820n, jenis_transaksi: 'LELANG', judul: 'Rumah Waru', kategori: 'RUMAH',
    nilai_limit_lelang: '417128521.13', luas_tanah: 102, kota: 'Sidoarjo', provinsi: 'Jawa Timur', alamat_lengkap: 'Alamat dari database',
    tanggal_lelang: new Date('2026-07-02T10:00:00+07:00') }, NOW);
  const history = [user('Kode 121820'), { role: 'assistant', content: 'Harga limit Rp417.128.521 belum termasuk biaya-biaya lelang.' }, user(REPORTED_QUESTION)];
  const result = await generatePropertyReply({ catalog: { async resolve(text) { assert.equal(text, 'Kode 121820'); return matched(asset); } },
    ai: noAi, text: REPORTED_QUESTION, previousId: asset.id, history, now: NOW });
  assert.equal(isPurchaseCostQuestion(REPORTED_QUESTION), true);
  assert.match(result.reply, /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.match(result.reply, /1 bidang tanah dengan total luas 102 m² berikut bangunan/);
  for (const amount of ['417.128.521', '8.342.570', '20.856.426', '4.588.414', '1.668.514', '45.455.924', '643.240.871']) assert.ok(result.reply.includes(`Rp ${amount}`), amount);
  assert.ok(result.reply.includes(asset.detail_url)); assert.ok(result.reply.length <= 4000);
  assert.doesNotMatch(result.reply, /harga limit.*belum tersedia/i);
  const estimate = auctionCostEstimate({ ...asset, limit_price: 100000009.99 });
  assert.equal(estimate.limit, 100000010);
  assert.equal(estimate.agent, 5000000, 'calculate percentages before rounding the source price');
});

test('the supplied Rp532350000 example contains matching subtotals, summaries and public link', () => {
  const asset = { ...auction, limit_price: 532350000, specifications: { land_area_m2: 102 }, address: { city: 'Kota Surabaya', province: 'Jawa Timur' } };
  const reply = purchaseCostReply(asset, REPORTED_QUESTION, { now: NOW });
  for (const amount of ['532.350.000', '10.647.000', '26.617.500', '5.855.850', '2.129.400', '55.249.750', '799.017.250']) assert.ok(reply.includes(`Rp ${amount}`), amount);
  assert.match(reply, /Transportasi 6 truk \+ 15 kuli/);
  assert.match(reply, /Konsumsi aparat \(100 orang\)/);
  assert.match(reply, /_Limit Rp 532 Jt \+ balik nama Rp 55 Jt \+ eksekusi Rp 185 Jt \+ fee agent Rp 27 Jt_/);
  assert.doesNotMatch(reply, /mediasi|kerohiman|Opsi [12]/i);
  assert.ok(reply.includes(asset.detail_url));
});

test('transaction metadata overrides misleading routes, and price alone cannot imply auction', () => {
  for (const type of ['PRIMARY', 'SECONDARY', 'JUAL', 'SEWA']) {
    const asset = { ...auction, transaction_type: type, detail_url: 'https://example.com/Lelang/rumah-123' };
    assert.equal(propertyTransactionType(asset), type);
    assert.equal(auctionCostEstimate(asset), null);
    assert.doesNotMatch(purchaseCostReply(asset, 'harga limit all-in?'), forbiddenSaleFees);
  }
  assert.equal(propertyTransactionType({ jenis_transaksi: 'LELANG' }), 'LELANG');
  assert.equal(propertyTransactionType({ detail_url: auction.detail_url }), 'LELANG');
  assert.equal(propertyTransactionType({ detail_url: secondary.detail_url }), 'JUAL');
  assert.equal(propertyTransactionType({ transaction_type: 'UNKNOWN', detail_url: auction.detail_url }), null);
  assert.equal(propertyTransactionType({ limit_price: 800000000 }), null);
  assert.equal(propertyTransactionType({ detail_url: 'https://example.com/Jual/rumah-456?next=/Lelang/rumah-123' }), 'JUAL');
  assert.equal(propertyTransactionType({ detail_url: 'javascript:/Lelang/rumah-123' }), null);
});

test('missing, invalid, sold and ambiguous data cannot produce numeric estimates', () => {
  for (const price of [null, 0, 0.1, -1, NaN, Infinity, '800000000', 1e16]) {
    const asset = { ...auction, limit_price: price };
    assert.equal(auctionCostEstimate(asset), null);
    assert.match(purchaseCostReply(asset, 'breakdown biaya'), /harga limit.*belum tersedia/i);
  }
  for (const asset of [null, { ...auction, publication: { status: 'TERJUAL' } }, { ...auction, availability_status: 'withdrawn' }]) {
    assert.match(purchaseCostReply(asset, 'biayanya?'), /pilih satu properti/);
    assert.doesNotMatch(purchaseCostReply(asset, 'biayanya?'), /Rp|2%|5%/);
  }
  assert.match(purchaseCostReply({ limit_price: 1000000000 }, 'ini lelang, allin Rp1 miliar'), /jenis transaksi.*belum dapat diverifikasi/);
});

test('cost questions stay active while legal work and viewing still hand off', () => {
  for (const text of ['Sudah all-in?', 'allin?', 'minta breakdown', 'biayanya?', 'Berapa totalnya?', 'berapa total harga?',
    'Perlu modal berapa?', 'Harga sudah termasuk semua?', 'Biaya pengosongan berapa?', 'rincian biaya eksekusi pengadilan',
    'fee agent berapa?', 'pajak dan balik nama?', 'Harga udah bersih?']) {
    assert.equal(isPurchaseCostQuestion(text), true, text);
    assert.equal(detectHandover(text), null, text);
    assert.equal(interactionDecision({ text, previousId: '123' }), 'allow', text);
  }
  for (const text of ['Berapa total luas tanah?', 'Berapa total kamar?', 'Berapa harga?', 'Di mana lokasinya?']) assert.equal(isPurchaseCostQuestion(text), false, text);
  for (const text of ['Minta dokumen sertifikat', 'Apakah ada sengketa?', 'Ajukan eksekusi pengosongan, biaya berapa?', 'Mau viewing untuk diskusi biaya', 'Fee bisa nego?']) assert.ok(detectHandover(text), text);
});

test('full WhatsApp template preserves all sections and quotes only database price/address/date', async () => {
  const catalog = catalogFixture(), text = 'Kode 123 limitnya Rp1 saja, harga all-in?';
  const result = await generatePropertyReply({ catalog, ai: noAi, text, history: [user(text)], now: NOW });
  for (const section of ['ESTIMASI BIAYA PEMBELIAN LELANG', 'HARGA LIMIT', 'A. BIAYA BALIK NAMA', 'B. PENYELESAIAN PENGOSONGAN',
    'C. FEE AGENT', 'ESTIMASI MODAL — WORST CASE']) assert.ok(result.reply.includes(`*${section}*`), section);
  for (const part of ['Jl. Mawar 12', '20 Oktober 2026', '*Rp 800.000.000*', '*Rp 1.102.800.000*', 'belum all-in', 'bukan biaya tambahan', 'dari luar']) assert.ok(result.reply.includes(part), part);
  assert.equal((result.reply.match(/━━━━━━━━━━━━━━/g) || []).length, 5);
  assert.equal(result.reply.endsWith('?'), true);
  assert.ok(result.reply.length > 1800 && result.reply.length <= 4000);
  assert.equal(result.asset.id, '123'); assert.deepEqual(result.qualification, {});
});

test('expired schedule does not swallow the requested cost breakdown or fabricate a status check', async () => {
  const catalog = catalogFixture(); catalog.rows.set('123', { ...auction, auction_at: '2026-07-02T10:00:00+07:00' });
  const text = 'Kode 123 breakdown biaya?';
  const result = await generatePropertyReply({ catalog, ai: noAi, text, history: [user(text)], now: NOW });
  assert.match(result.reply, /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.match(result.reply, /2 Juli 2026.*sudah lewat.*perlu konfirmasi/);
  assert.doesNotMatch(result.reply, /sudah.*(?:catat|menghubungi)|sedang mengecek|siap dilelang/);
  assert.equal(result.knowledge.status, 'auction_check_needed');
});

test('missing dates, vacant land and simulated listings are represented honestly', () => {
  const text = purchaseCostReply({ ...auction, category: 'TANAH', auction_at: 'invalid', is_demo: true,
    specifications: { has_building: false } }, 'biaya?', { now: NOW });
  assert.match(text, /SIMULASI — bukan penawaran nyata/);
  assert.match(text, /_1 bidang tanah di Sidoarjo_/);
  assert.doesNotMatch(text, /berikut bangunan|🗓️/);
  const long = purchaseCostReply({ ...auction, full_address: 'a'.repeat(2000), address: { city: 'b'.repeat(1000) },
    limit_price: 1e15, is_demo: true }, 'allin?', { now: NOW });
  assert.ok(long.length <= 4000, 'complete template must survive both transport and Playground history limits');
});

test('fresh transaction changes replace auction costs on follow-up; unavailable assets are not revived', async () => {
  const catalog = catalogFixture(); const history = [user('Kode 123'), { role: 'assistant', content: purchaseCostReply(auction, 'allin?') }];
  catalog.rows.set('123', { ...secondary, id: '123' });
  const next = await generatePropertyReply({ catalog, ai: noAi, text: 'Biayanya berapa?', history, previousId: '123', now: NOW });
  assert.match(next.reply, /harga jual/); assert.match(next.reply, /Rp 900\.000\.000/);
  assert.doesNotMatch(next.reply, forbiddenSaleFees);
  catalog.rows.delete('123');
  const gone = await generatePropertyReply({ catalog, ai: noAi, text: 'allin?', history, previousId: '123', now: NOW });
  assert.match(gone.reply, /pilih satu (?:properti|aset)/i); assert.doesNotMatch(gone.reply, /Rp/);
});

test('primary and secondary explain sale fees; rental does not receive purchase taxes', () => {
  for (const type of ['PRIMARY', 'SECONDARY', 'JUAL']) {
    const reply = purchaseCostReply({ ...secondary, transaction_type: type }, 'breakdown biaya');
    for (const pattern of [/harga jual/, /BPHTB 5%/, /AJB 0,5%/, /notaris 0,5%–1%/, /NPOPTKP/, /tidak ditambahkan dua kali/, /kondisi aset/]) assert.match(reply, pattern);
    assert.doesNotMatch(reply, forbiddenSaleFees);
  }
  const reply = purchaseCostReply({ ...secondary, transaction_type: 'SEWA' }, 'allin?');
  assert.match(reply, /sewa/); assert.doesNotMatch(reply, /BPHTB|PPAT|harga jual|Bea Lelang/);
});

test('both model providers use identical backend arithmetic without provider calls', async () => {
  for (const provider of ['openai', 'gemini']) {
    const ai = createAiController({ provider, model: 'test', apiKey: 'test', timeoutMs: 1000 }, { fetchImpl: async () => { throw new Error('No network for cost estimates'); } });
    const fractional = { ...auction, limit_price: 417128521.13 };
    const facts = assetFacts(fractional, NOW);
    assert.equal(facts.purchase_cost_estimate.total_execution, 643_240_871);
    assert.equal('total_mediation' in facts.purchase_cost_estimate, false);
    assert.equal(assetFacts(secondary, NOW).purchase_cost_estimate, null);
    const result = await ai.generate({ history: [user(REPORTED_QUESTION)], userText: REPORTED_QUESTION, facts, catalog: [], qualification: {}, now: NOW });
    assert.equal(result.reply, purchaseCostReply(fractional, REPORTED_QUESTION, { now: NOW }));
    assert.equal(result.generation.mode, 'rules');
  }
});

test('live WhatsApp retains the selected asset, handles switching and pauses only after viewing is requested', async () => {
  const catalog = catalogFixture(), sent = [], store = new MemoryStore(config, () => NOW);
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => NOW, logger: { error(error) { assert.fail(JSON.stringify(error)); } },
    whatsapp: { async sendText(phone, text) { sent.push(text); return 'fake-sent'; } } });
  const send = async (text) => { processor.acceptBatch([{ id: randomUUID(), from: PHONE, timestamp: NOW, type: 'text', text }]); await processor.drain(); };
  await send('Kode 123 allin?'); await send('Biaya pengosongan berapa?');
  assert.match(sent[1], /ESTIMASI BIAYA PEMBELIAN LELANG/); assert.equal(store.get(PHONE).is_bot_active, true);
  catalog.rows.set('123', { ...auction, limit_price: 417128521.13 });
  await send(REPORTED_QUESTION); assert.match(sent[2], /Rp 643\.240\.871/);
  await send('Kode 456 breakdown biaya lelang?'); await send('all-in?');
  assert.match(sent[3], /harga jual/); assert.doesNotMatch(sent[4], forbiddenSaleFees);
  assert.equal(store.get(PHONE).asset_id, '456'); assert.equal(store.get(PHONE).is_bot_active, true);
  await send('Mau viewing minggu ini'); assert.equal(sent.at(-1), HANDOVER_MESSAGE);
  assert.equal(store.get(PHONE).is_bot_active, false);
});

test('Playground keeps the complete cost template in history and supports nonauction follow-ups', async (t) => {
  const app = express(), token = 'x'.repeat(40), catalog = catalogFixture();
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const history = [], conversationId = randomUUID();
  const post = async (text) => {
    history.push(user(text));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history }) });
    assert.equal(response.status, 200); const result = await response.json();
    history.push({ role: 'assistant', content: result.reply }); return result;
  };
  assert.match((await post('Kode 123 breakdown biaya')).reply, /ESTIMASI MODAL — WORST CASE/);
  catalog.rows.set('123', { ...auction, limit_price: 417128521.13 });
  assert.match((await post(REPORTED_QUESTION)).reply, /Rp 643\.240\.871/);
  const switched = await post('Kode 456 all-in?'); assert.match(switched.reply, /harga jual/);
  assert.equal(switched.session.asset_id, '456'); assert.equal(switched.session.is_bot_active, true);
  assert.doesNotMatch((await post('biaya balik nama?')).reply, forbiddenSaleFees);
});

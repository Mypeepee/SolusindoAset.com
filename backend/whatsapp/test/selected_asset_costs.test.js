import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { generatePropertyReply, resolvePropertyContext, selectedAssetIdFromHistory } from '../services/property_reply.js';
import { buyerContext } from '../services/buyer_profile.js';
import { requestsPropertySearch } from '../services/interaction_policy.js';
import { localDiscovery } from '../services/smart_search_parser.js';
import { isPurchaseCostQuestion } from '../services/property_costs.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { ConversationControl } from '../state/conversation_control.js';
import { createSandboxRouter } from '../routes/sandbox.js';

const NOW = Date.parse('2026-10-22T15:52:00+07:00');
const LINK = 'https://solusindoaset.com/Lelang/1-bidang-tanah-dengan-total-luas-138-m-berikut-bangunan-di-kab-bandung-barat-1791865707117-zb7e-180642/AG108';
const REQUEST = 'Boleh bantu di hitungkan semua biaya sampai dengan balik nama / unit bisa di tempati';
const ADDRESS = 'Perum Graha Kencana Batujajar, Blok G3 No. 17 (disertifikat tertulis Blok G3-17), Desa Batujajar Timur, Kec. Batujajar, Kab. Bandung Barat, Prov. Jawa Barat';
const ASSET = { id: '180642', name: 'Rumah di Perum Graha Kencana Batujajar', transaction_type: 'LELANG', category: 'RUMAH',
  limit_price: 218000000, price_display: 'Rp 218.000.000', full_address: ADDRESS,
  address: { street: ADDRESS, city: 'Kab. Bandung Barat', district: 'Batujajar', province: 'Jawa Barat' },
  specifications: { land_area_m2: 138, has_building: true }, auction_at: '2026-10-27T10:00:00+07:00',
  publication: { status: 'TERSEDIA' }, detail_url: LINK };
const noAi = { async generate() { assert.fail('This selected-asset conversation must work without an LLM'); },
  async parseSearch() { assert.fail('A cost request must not invoke search interpretation'); } };
const user = content => ({ role: 'user', content });
const assistant = content => ({ role: 'assistant', content });
const history = () => [user(LINK), assistant('Untuk aset ini jadwal lelang pada 27 Oktober 2026 sudah terlewati. Mau saya hitungkan rincian estimasi biaya pembeliannya?'),
  user('Saya tertarik dengan yg ini'), assistant('Siap, Fikri. Mau saya bantu jelaskan rincian estimasi biaya pembeliannya?')];
function catalogFixture() {
  const reads = [], rows = new Map([[ASSET.id, structuredClone(ASSET)]]);
  return { reads, rows, async resolve(text, previousId, criteria) {
    reads.push({ text, previousId, criteria });
    assert.equal(criteria, undefined, 'Consultation must not search for other listings');
    const id = /\bKode\s+(\d+)/i.exec(text)?.[1] || /-(\d+)(?:\/AG\d+)?\s*$/.exec(text)?.[1] || previousId;
    const asset = rows.get(id) || null;
    return { asset, catalog: [], status: asset ? 'matched' : 'not_found', source: 'database_listing_publik' };
  } };
}
const config = { transport: 'baileys', maxSessions: 10, maxPending: 30, maxPendingPerPhone: 20, maxDedup: 100, sessionTtlMs: 86400000 };
function assertCosts(result) {
  const reply = typeof result === 'string' ? result : result.reply;
  for (const section of ['ESTIMASI BIAYA PEMBELIAN LELANG', 'A. BIAYA BALIK NAMA', 'B. PENYELESAIAN PENGOSONGAN', 'C. FEE AGENT', 'ESTIMASI MODAL — WORST CASE']) assert.ok(reply.includes(section), section);
  for (const amount of ['218.000.000', '28.530.000', '184.800.000', '10.900.000', '442.230.000']) assert.ok(reply.includes(`Rp ${amount}`), amount);
  assert.ok(reply.includes(ADDRESS)); assert.ok(reply.includes(LINK));
  assert.match(reply, /27 Oktober 2026/);
  assert.doesNotMatch(reply, /sudah (?:lewat|terlewat)|terlewati|Budget-nya|luas tanah minimal|Saya cari pilihan|Hitungkan Semua Biaya/i);
  assert.ok(reply.length <= 4000);
}

for (const text of [REQUEST, 'Tolong di hitung biaya balik nama / pengosongan', 'Bisa di kalkulasikan biaya semua sampai di huni?',
  'All-in brp sampe bisa ditempati?', 'biayane kabeh piro nganti balik nama?', 'Please calculate all costs / ownership transfer fees']) {
  test(`cost language preserves the selected property: ${text}`, async () => {
    assert.equal(isPurchaseCostQuestion(text), true);
    assert.equal(requestsPropertySearch(text), false);
    assert.deepEqual(localDiscovery(text), {});
    const seed = { location: 'Batujajar', district: 'Batujajar', city: 'Kab. Bandung Barat', category: 'RUMAH', transaction_type: 'LELANG' };
    const buyer = buyerContext(history(), text, ASSET.id, { seed });
    assert.equal(buyer.searching, false); assert.equal(buyer.profile.location, 'Batujajar');
    const catalog = catalogFixture();
    const context = await resolvePropertyContext(catalog, text, ASSET.id, [...history(), user(text)], NOW, undefined, null, null, noAi, null, true);
    assert.equal(context.buyer.searching, false); assert.equal(context.asset.id, ASSET.id);
    assert.deepEqual(catalog.reads, [{ text: 'Kode 180642', previousId: null, criteria: undefined }]);
  });
}

test('the exact request recovers its selected listing from history and returns the supplied totals', async () => {
  const conversation = [...history(), user(REQUEST)];
  assert.equal(selectedAssetIdFromHistory(conversation), ASSET.id);
  const result = await generatePropertyReply({ catalog: catalogFixture(), ai: noAi, text: REQUEST, history: conversation, now: NOW });
  assert.equal(result.asset.id, ASSET.id); assertCosts(result);
});

test('a bare listing link renders its upcoming date without a model or a false expired warning', async () => {
  const result = await generatePropertyReply({ catalog: catalogFixture(), ai: noAi, text: LINK, history: [user(LINK)], now: NOW });
  assert.equal(result.asset.id, ASSET.id); assert.match(result.reply, /27 Oktober 2026 WIB/);
  assert.doesNotMatch(result.reply, /sudah lewat|terlewati|terlewat/);
});

test('short consent to the actual cost offer works without a pre-existing consultation cursor', async () => {
  const result = await generatePropertyReply({ catalog: catalogFixture(), ai: noAi, text: 'Boleh pak', previousId: ASSET.id, history: [...history(), user('Boleh pak')], now: NOW });
  assertCosts(result);
});

test('fresh price changes replace previous estimates and a removed unit cannot be revived', async () => {
  const catalog = catalogFixture();
  catalog.rows.set(ASSET.id, { ...ASSET, limit_price: 219000000 });
  const result = await generatePropertyReply({ catalog, ai: noAi, text: REQUEST, previousId: ASSET.id, history: [...history(), user(REQUEST)], now: NOW });
  assert.match(result.reply, /Rp 443\.365\.000/); assert.doesNotMatch(result.reply, /Rp 442\.230\.000/);
  catalog.rows.delete(ASSET.id);
  const gone = await generatePropertyReply({ catalog, ai: noAi, text: REQUEST, previousId: ASSET.id, history: [...history(), user(REQUEST)], now: NOW });
  assert.match(gone.reply, /pilih satu (?:aset|properti)/i); assert.doesNotMatch(gone.reply, /Rp/);
});

test('an explicit new property search still accepts areas alongside a cost question', () => {
  const text = 'Cari rumah lelang di Surabaya / Sidoarjo budget 500 juta, nanti hitungkan biaya balik nama';
  assert.equal(requestsPropertySearch(text), true);
  assert.deepEqual(localDiscovery(text).cities, ['Surabaya', 'Sidoarjo']);
});

test('live WhatsApp keeps link -> interest -> costs on the same asset, including after restart', async t => {
  const control = new ConversationControl(':memory:', () => NOW); t.after(() => control.close());
  const catalog = catalogFixture(), sent = [], errors = [], phone = '6280000000001';
  const build = () => new MessageProcessor({ config, store: new MemoryStore(config, () => NOW, control.forTenant('AG108')),
    catalog, ai: noAi, agentId: 'AG108', now: () => NOW, logger: { error(e) { errors.push(e); } },
    whatsapp: { async sendText(_phone, text) { sent.push(text); return `out-${sent.length}`; } } });
  let processor = build(), count = 0;
  const send = async text => { processor.acceptBatch([{ id: `in-${++count}`, from: phone, type: 'text', text, timestamp: NOW }]); await processor.drain(); };
  processor.store.create(phone).client_identity = { name: 'Fikri', salutation: null, asked: true };
  await send(LINK); assert.match(sent.at(-1), /27 Oktober 2026 WIB/);
  await send('Saya tertarik dengan yg ini'); assert.equal(processor.store.get(phone).asset_id, ASSET.id);
  processor = build();
  await send(REQUEST); assertCosts(sent.at(-1));
  assert.equal(processor.store.get(phone).asset_id, ASSET.id);
  assert.equal(processor.store.get(phone).is_bot_active, true); assert.deepEqual(errors, []);
});

test('Playground link -> interest -> exact cost request produces the same complete breakdown', async t => {
  const app = express(), token = 'x'.repeat(40);
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog: catalogFixture(), ai: noAi, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const conversationId = randomUUID();
  const post = async text => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); return response.json();
  };
  assert.match((await post(LINK)).reply, /27 Oktober 2026 WIB/);
  await post('Saya tertarik dengan yg ini');
  const result = await post(REQUEST); assertCosts(result);
  assert.equal(result.session.asset_id, ASSET.id); assert.equal(result.session.is_bot_active, true);
});

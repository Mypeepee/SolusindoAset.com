import test from 'node:test';
import assert from 'node:assert/strict';
import { auctionTimeline } from '../services/auction_timeline.js';
import { AUCTION_COST_QUESTION, upcomingAuctionReply, contradictsUpcomingAuction } from '../services/auction_check.js';
import { stockConfirmationMessage, StockConfirmation } from '../services/stock_confirmation.js';
import { AssetCheckStore } from '../state/asset_checks.js';
import { MemoryStore } from '../state/memory_store.js';
import { MessageProcessor } from '../services/message_processor.js';
import { createAiController } from '../services/ai_controller.js';
import { assetFacts } from '../services/catalog.js';
import { generatePropertyReply } from '../services/property_reply.js';

const NOW = Date.parse('2026-10-22T15:52:00+07:00');
const STOKER = '6285707379606', CLIENT = '6281234567890';
const URL = 'https://solusindoaset.com/Lelang/1-bidang-tanah-dengan-total-luas-138-m-berikut-bangunan-di-kab-bandung-barat-1791865707117-zb7e-180642';
const ASSET = { id: '180642', name: 'Rumah Batujajar', transaction_type: 'LELANG', category: 'RUMAH',
  limit_price: 218000000, price_display: 'Rp 218.000.000', publication: { status: 'TERSEDIA' },
  full_address: 'Perum Graha Kencana Batujajar, Kab. Bandung Barat', location: 'Batujajar, Kab. Bandung Barat',
  address: { street: 'Perum Graha Kencana Batujajar', city: 'Kab. Bandung Barat', district: 'Batujajar', province: 'Jawa Barat' },
  specifications: { land_area_m2: 138, has_building: true }, auction_at: '2026-10-27T10:00:00+07:00', detail_url: URL + '/AG108' };
const noAi = { async generate() { assert.fail('The auction SOP must use verified data without an LLM'); } };
const user = content => ({ role: 'user', content });
const config = { transport: 'baileys', stokerPhone: STOKER, maxSessions: 20, maxPending: 50, maxPendingPerPhone: 20, maxDedup: 100, sessionTtlMs: 86400000 };
function live(t, changes = {}) {
  const database = new AssetCheckStore(':memory:', { now: () => NOW }); t.after(() => database.close());
  const raw = database.forTenant('AG108'), sent = [], errors = [], asset = { ...structuredClone(ASSET), ...changes };
  const catalog = { async resolve(_text, _previous, criteria) {
    assert.equal(criteria, undefined, 'The selected lot must not become a different search');
    return { asset: structuredClone(asset), catalog: [], status: 'matched', source: 'database_listing_publik' };
  } };
  const whatsapp = { getStatus: () => ({ connected: true, phone: '6280000000099' }),
    async sendText(to, text, _replyTo, options) { sent.push({ to, text }); return options?.messageId || `out-${sent.length}`; } };
  const checks = new StockConfirmation({ checks: raw, whatsapp, catalog, recipient: STOKER, transport: 'baileys', now: () => NOW, logger: { error(e) { errors.push(e); } } });
  let sequence = 0, processor;
  const restart = () => { processor = new MessageProcessor({ config, checks, catalog, whatsapp, ai: noAi, store: new MemoryStore(config, () => NOW), now: () => NOW, logger: { error(e) { errors.push(e); } } }); };
  restart();
  return { asset, raw, sent, errors, restart, async send(text, phone = CLIENT) {
    processor.acceptBatch([{ id: `in-${++sequence}`, from: phone, text, type: 'text', timestamp: NOW }]); await processor.drain();
    return sent.findLast(row => row.to === phone)?.text;
  } };
}

test('27 October is five WIB calendar days after 22 October, independent of host timezone', () => {
  const timeline = auctionTimeline(ASSET, NOW);
  assert.equal(timeline.status, 'upcoming'); assert.equal(timeline.days_until, 5);
  assert.equal(timeline.date, '27 Oktober 2026');
  assert.deepEqual(assetFacts(ASSET, NOW).auction_timeline, timeline);
  assert.equal(auctionTimeline(ASSET, Date.parse(ASSET.auction_at) - 1).status, 'upcoming');
  assert.equal(auctionTimeline(ASSET, Date.parse(ASSET.auction_at)).status, 'elapsed');
});
for (const [now, date, days] of [
  ['2026-10-22T23:59:00+07:00', '2026-10-23T00:01:00+07:00', 1],
  ['2026-10-22T16:59:00Z', '2026-10-22T17:01:00Z', 1],
  ['2026-10-31T15:00:00+07:00', '2026-11-01T10:00:00+07:00', 1],
  ['2026-12-31T15:00:00+07:00', '2027-01-01T10:00:00+07:00', 1],
]) test(`countdown crosses WIB calendar boundaries correctly: ${now}`, () => {
  assert.equal(auctionTimeline({ auction_at: date }, Date.parse(now)).days_until, days);
});

test('today and tomorrow use natural countdowns; unknown or passed dates never receive future urgency', () => {
  assert.match(upcomingAuctionReply({ ...ASSET, auction_at: '2026-10-22T17:00:00+07:00' }, NOW), /\*hari ini\*/);
  assert.match(upcomingAuctionReply({ ...ASSET, auction_at: '2026-10-23T10:00:00+07:00' }, NOW), /besok \(1 hari lagi\)/);
  for (const date of [null, '', 'bad', '2026-10-21T10:00:00+07:00']) assert.equal(upcomingAuctionReply({ ...ASSET, auction_at: date }, NOW), null);
  assert.equal(auctionTimeline({ auction_at: 'bad' }, NOW).days_until, null);
  for (const changes of [{ transaction_type: 'SEWA' }, { publication: { status: 'TERJUAL' } }, { availability_status: 'withdrawn' }, { is_demo: true }]) {
    assert.equal(upcomingAuctionReply({ ...ASSET, ...changes }, NOW), null);
    assert.equal(contradictsUpcomingAuction('Jadwal lelang sudah lewat.', { ...ASSET, ...changes }, NOW), false);
  }
});

test('a closed registration or deposit deadline prevents an unsupported invitation to join', () => {
  const asset = { ...ASSET, registration_closes_at: '2026-10-21T16:00:00+07:00', deposit_due_at: '2026-10-22T12:00:00+07:00' };
  const reply = upcomingAuctionReply(asset, NOW);
  assert.match(reply, /Batas pendaftaran dan setoran jaminan yang tercatat sudah lewat/);
  assert.match(reply, /perlu memastikan.*masih dapat mengikuti/);
  assert.match(reply, /5 hari lagi/); assert.ok(reply.endsWith(AUCTION_COST_QUESTION));
  assert.doesNotMatch(reply, /siapkan dokumen.*sejak sekarang/);
  assert.equal(contradictsUpcomingAuction(reply, asset, NOW), false);
});

for (const text of [URL + '/AG108', 'Kode 180642', '**Kode:** **180642**', 'Kode 180642 masih tersedia?',
  'Halo, saya tertarik properti lelang ini, apakah masih tersedia?\n💰 Rp 1\n🔖 Kode: 180642']) {
  test(`upcoming first response uses fresh facts and a cost CTA: ${text.split('\n')[0]}`, async () => {
    const result = await generatePropertyReply({ text, history: [user(text)], ai: noAi, now: NOW,
      catalog: { async resolve() { return { asset: ASSET, catalog: [], status: 'matched' }; } } });
    assert.match(result.reply, /27 Oktober 2026 WIB/); assert.match(result.reply, /tinggal \*5 hari lagi\*/);
    assert.match(result.reply, /Harga limit: Rp 218\.000\.000/); assert.match(result.reply, /Tersedia/);
    assert.doesNotMatch(result.reply, /sudah (?:terlewat|lewat)|tinggal satu unit|pasti kehabisan|sudah saya kirim|Rp 1\*/);
    assert.ok(result.reply.endsWith(AUCTION_COST_QUESTION)); assert.equal((result.reply.match(/\?/g) || []).length, 1);
    assert.equal(result.generation.mode, 'rules'); assert.equal(result.asset.id, ASSET.id);
  });
}

test('upcoming inquiry sends only the client response, and boleh opens costs on that same lot', async t => {
  const f = live(t); const first = await f.send(URL + '/AG108');
  assert.match(first, /5 hari lagi/); assert.ok(first.endsWith(AUCTION_COST_QUESTION));
  assert.equal(f.raw.list().total, 0); assert.equal(f.sent.filter(row => row.to === STOKER).length, 0);
  const costs = await f.send('boleh pak');
  assert.match(costs, /ESTIMASI BIAYA PEMBELIAN LELANG/); assert.match(costs, /Rp 442\.230\.000/);
  assert.doesNotMatch(costs, /Budget-nya|luas tanah minimal/); assert.deepEqual(f.errors, []);
});

test('21 October inquiry sends the exact stock SOP once to 6285707379606 and offers costs to the client', async t => {
  const f = live(t, { auction_at: '2026-10-21T10:00:00+07:00', limit_price: 432000000, specifications: { land_area_m2: 113 } });
  const first = await f.send(URL + '/AG108');
  const request = f.sent.find(row => row.to === STOKER);
  assert.ok(request); assert.equal(request.text, stockConfirmationMessage(f.asset));
  assert.match(request.text, /\*ID:\* 180642/); assert.match(request.text, /21 Oktober 2026/);
  assert.ok(request.text.endsWith(URL)); assert.doesNotMatch(request.text, /\/AG108|6281234567890/);
  assert.match(first, /21 Oktober 2026.*sudah terlewat/); assert.match(first, /sudah saya kirim ke bagian stoker/);
  assert.match(first, /Harga limit: Rp 432\.000\.000/); assert.match(first, /Luas tanah: 113 m²/);
  assert.ok(first.endsWith(AUCTION_COST_QUESTION)); assert.doesNotMatch(first, /di daerah mana/);
  assert.match(await f.send('boleh'), /ESTIMASI BIAYA PEMBELIAN LELANG/);
  await f.send(URL + '/AG108', '6287654321000'); f.restart(); await f.send(URL + '/AG108');
  assert.equal(f.sent.filter(row => row.to === STOKER).length, 1); assert.deepEqual(f.errors, []);
});

test('model expiry guard distinguishes false auction expiry from conditional explanations and other deadlines', () => {
  for (const reply of ['Jadwal tersebut sudah terlewati.', 'Jadwal lelang sudah lewat.', 'Tanggal lelang telah berakhir.', 'Jadwal lelang expired.']) assert.equal(contradictsUpcomingAuction(reply, ASSET, NOW), true, reply);
  for (const reply of ['Jadwal lelang belum lewat.', 'Jika jadwal lelang sudah lewat, tim perlu konfirmasi.',
    'Jadwal lelang 27 Oktober belum lewat, tetapi batas pendaftaran sudah lewat.']) assert.equal(contradictsUpcomingAuction(reply, ASSET, NOW), false, reply);
});
for (const provider of ['openai', 'gemini']) test(`${provider} cannot repeat a false expiry claim from old assistant history`, async () => {
  const qualification = Object.fromEntries(['purpose', 'funds', 'settlement'].map(key => [key, { value: 'unknown', evidence: '' }]));
  const text = JSON.stringify({ action: 'reply', reply: 'Jadwal tersebut sudah terlewati. Mau tahu rincian pembeliannya?', qualification });
  const ai = createAiController({ provider, model: 'test', apiKey: 'test', timeoutMs: 1000 }, { fetchImpl: async () => Response.json(provider === 'openai'
    ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }
    : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] }) });
  const result = await ai.generate({ history: [user('luasnya berapa?')], userText: 'luasnya berapa?', facts: assetFacts(ASSET, NOW), catalog: [], qualification: {}, now: NOW });
  assert.doesNotMatch(result.reply, /sudah terlewati/); assert.match(result.reply, /5 hari lagi/);
  assert.ok(result.reply.endsWith(AUCTION_COST_QUESTION)); assert.equal(result.generation.mode, 'rules');
});

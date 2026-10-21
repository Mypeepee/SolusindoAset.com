import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';
import { AssetCheckStore } from '../../state/asset_checks.js';
import { ASSET, config, noAi } from './single-recommendation-dialogues.js';

export const NOW = Date.parse('2026-10-19T21:16:00+07:00');
export const OPENING = 'Cari rumah lelang di kelurahan Sumber Pasir, Pakis, Kabupaten Malang, budget 300–900 juta, luas tanah bebas';
export const CHOICE = 'boleh pak , yang nomor 1 minta detailnya ya';
export const COST = 'coba pak breakdownkan biaya';
export const REPORTED = 'wow... saya tertarik pak';
export const INTEREST_PHRASES = [REPORTED, 'saya tertarik', 'wah saya tertarik pak!', 'Wow… saya tertarik, Pak 🙏',
  'saya jadi tertarik', 'tertarik pak', 'saya minat', 'saya berminat', 'wah menarik nih pak',
  'saya cocok', 'cocok nih bu', 'oke saya mau lanjut pak', 'mau lanjut pak', 'saya ingin lanjut',
  'saya tertarik dengan aset tersebut', 'aku makin tertarik sama yang ini'];
export const SERIOUS_REPORTED = 'oke pak, saya serius';
export const SERIOUS_PHRASES = [SERIOUS_REPORTED, 'oke pak saya serius', 'oke, Pak. Saya serius! 🙏',
  'saya serius', 'serius pak', 'saya serius pak', 'pak saya serius', 'saya, Pak, serius', 'sy serius pak',
  'aku serius kak', 'kami serius bu', 'saya sudah serius', 'saya udah serius pak', 'saya memang serius',
  'saya benar-benar serius', 'saya bener bener serius', 'saya sudah benar benar serius',
  'oke pak saya serius dengan aset itu', 'saya serius mau beli', 'saya serius ingin lanjut',
  'saya sudah mantap', 'oke saya yakin', 'sudah mantap pak', 'saya udah yakin', 'saya siap lanjut',
  'oke pak saya mau beli', 'saya mau lanjut prosesnya', 'saya jadi ambil', 'fix saya ambil',
  'deal pak saya ambil', 'saya lanjut pak', 'saya ambil'];

// Replay the attached Tambaksari cards. URLs weren't supplied, so every URL
// and the other four IDs are explicitly synthetic; none verifies live stock.
export const PACARKEMBANG_ASSETS = [
  ['900011', 'Jl Ploso Timur 2 No 11 Kelurahan Ploso Kecamatan Tambaksari Kota Surabaya Provinsi Jawa Timur', 250000000, 99, 'SHM', '2026-06-04'],
  ['900012', 'Kelurahan Gading, Kecamatan Tambaksari, Kota Surabaya, Provinsi Jawa Timur', 318000000, 65, 'SHM', '2026-06-03'],
  ['900013', 'Jalan Lebak Permai II No. 42 Kav. 18, Kelurahan Gading, Kecamatan Tambaksari, Kota Surabaya, Provinsi Jawa Timur', 525300000, 37, 'SHM', '2026-06-02'],
  ['121037', 'Kelurahan Pacarkembang Kecamatan Tambaksari Kota Surabaya Provinsi Jawa Timur', 350000000, 200, 'LAINNYA', '2026-05-25'],
  ['900015', 'Jl. Lebak Timur IX No. 6 Kelurahan Gading, Kec. Tambaksari, Kota Surabaya, Propinsi Jawa Timur', 509600000, 97, 'SHM', '2026-05-20'],
].map(([id, address, price, land, certificate, date]) => ({ id, name: address, full_address: address,
  transaction_type: 'LELANG', category: 'RUMAH', limit_price: price, price_display: `Rp ${price.toLocaleString('id-ID')}`,
  address: { city: 'Kota Surabaya', district: 'Tambaksari', street: address, province: 'Jawa Timur' },
  specifications: { land_area_m2: land, certificate_type: certificate },
  ...(id === '121037' ? { deposit: 100000000 } : {}), auction_at: `${date}T03:00:00Z`,
  publication: { status: 'TERSEDIA' }, detail_url: `https://solusindoaset.com/Lelang/simulasi-tambaksari-${id}` }));

const EXAMPLES = {
  sumberpasir: { opening: OPENING, choice: CHOICE, cost: COST, totals: ['762.300.000'],
    profile: { min_price: 300000000, max_price: 900000000, village: 'Sumber Pasir' } },
  pacarkembang: { opening: 'Cari rumah lelang di Kecamatan Tambaksari, Kota Surabaya, budget 250–600 juta, luas tanah bebas',
    choice: 'boleh no 4', cost: 'detail biayanya?', totals: ['567.050.000'],
    profile: { min_price: 250000000, max_price: 600000000, district: 'Tambaksari' } },
};

export function interestFixture({ future = false, example = 'sumberpasir' } = {}) {
  const selected = example === 'pacarkembang' ? PACARKEMBANG_ASSETS[3] : { ...ASSET, deposit: 125000000 };
  const first = { ...selected, ...(future ? { auction_at: '2026-11-20T03:00:00Z' } : {}) };
  // The second listing uses a synthetic pointer because its real URL wasn't
  // supplied. Prices/areas mirror the example; this does not verify live stock.
  const second = { ...ASSET, id: '900002', limit_price: 460000000, price_display: 'Rp 460.000.000',
    full_address: 'DESA/KELURAHAN SUMBER PASIR KECAMATAN PAKIS KABUPATEN MALANG PROVINSI JAWA TIMUR',
    specifications: { land_area_m2: 296, certificate_type: 'SHM' }, auction_at: '2026-03-31T03:00:00Z',
    detail_url: 'https://solusindoaset.com/Lelang/rumah-sumber-pasir-simulasi-900002' };
  const assets = example === 'pacarkembang' ? PACARKEMBANG_ASSETS.map((asset) => asset.id === first.id ? first : asset) : [first, second];
  const calls = [];
  return { calls, first, example: EXAMPLES[example], async resolve(text, previousId, criteria) {
    calls.push({ text, previousId, criteria });
    if (criteria) return { asset: null, catalog: assets, status: 'recommendations', source: 'simulation',
      selection: { schedule_priority: future ? 'upcoming' : 'needs_confirmation' } };
    assert.equal(text, `Kode ${first.id}`, 'Detail, cost and interest remain on the explicitly selected asset');
    return { asset: first, catalog: [], status: 'matched', source: 'simulation' };
  } };
}

export function purchaseInterestScenarios() {
  return Object.keys(EXAMPLES).flatMap((example) => ['full', 'truncated'].flatMap((memory) =>
    [...INTEREST_PHRASES, ...SERIOUS_PHRASES].map((text) => ({ example, text, memory, name: `${example}/${memory}: ${text}` }))));
}

export async function simulatePurchaseInterest({ text = REPORTED, memory = 'full', future = false, verdict = null,
  continueJourney = false, example = 'sumberpasir', after = 'costs' } = {}) {
  let now = NOW;
  const store = new MemoryStore(config, () => now), catalog = interestFixture({ future, example }), sent = [], transcript = [];
  const selectedId = catalog.first.id, scenario = catalog.example, name = `${example}/${memory}/${after}: ${text}`;
  const db = new AssetCheckStore(':memory:', { now: () => now }), checks = db.forTenant('AG108'), phone = '6280000000001';
  const processor = new MessageProcessor({ config, store, catalog, checks, ai: noAi, now: () => now,
    whatsapp: { async sendText(_phone, body) { sent.push(body); return randomUUID(); } },
    logger: { error(error) { assert.fail(error.event); } } });
  const send = async (content) => {
    const before = sent.length;
    processor.acceptBatch([{ id: randomUUID(), from: phone, type: 'text', text: content, timestamp: now }]); await processor.drain();
    assert.ok(sent.length > before, 'The customer receives a reply');
    transcript.push({ user: content, bot: sent.slice(before).join('\n\n') });
  };
  try {
    await send(scenario.opening); assert.equal(catalog.calls.length, 1);
    now += 60000;
    await send(scenario.choice); assert.ok(sent.at(-1).includes(`DETAIL ASET — Kode ${selectedId}`));
    if (example === 'pacarkembang') assert.match(sent.at(-1), /Legalitas tercatat: LAINNYA/);
    if (after === 'costs') {
      await send(scenario.cost); assert.match(sent.at(-1), /ESTIMASI BIAYA PEMBELIAN LELANG/);
      for (const total of scenario.totals) assert.ok(sent.at(-1).includes(total), `Expected cost total ${total}`);
    }
    const session = store.get(phone);
    assert.equal(session.asset_id, selectedId); assert.notEqual(session.conversion?.mode, 'Closing_State');
    if (memory === 'truncated') session.history = session.history.slice(-1);
    if (verdict) checks.complete(checks.list().items[0].id, { result: verdict, reference: 'Controlled operator result in simulation' });
    await send(text);
    const expected = verdict === 'sold' ? 'stock_sold' : 'purchase_preparation';
    assert.equal(session.conversion.mode, 'Closing_State'); assert.equal(session.conversion.asset_id, selectedId);
    assert.equal(session.conversion.topic, expected); assert.equal(session.is_bot_active, true);
    assert.equal(session.conversion.process_understood, false, 'Interest is not agreement/signature/payment consent');
    assert.doesNotMatch(sent.at(-1), /Mau tahu bagian yang mana|harga, lokasi, fasilitas|cari properti lain|Berikut pilihan|Sebutkan nomor/i);
    assert.equal(catalog.calls.at(-1).text, `Kode ${selectedId}`); assert.equal(catalog.calls.at(-1).criteria, undefined);
    assert.equal(catalog.calls.filter((item) => item.criteria).length, 1, 'An interest statement must not restart the search');
    for (const [key, value] of Object.entries(scenario.profile)) assert.equal(session.buyer_state.profile[key], value, key);
    if (!future) {
      assert.equal(checks.list().items.length, verdict ? 0 : 1, 'A completed verdict must not re-open stock verification');
      if (verdict) assert.equal(checks.stockResult(catalog.first)?.result, verdict);
    }
    if (expected === 'purchase_preparation') {
      assert.match(sent.at(-1), /KTP.*cover buku tabungan.*atas nama Anda/);
      assert.match(sent.at(-1), /uang tanda jadi Rp 20\.000\.000/);
      assert.match(sent.at(-1), /draf MOU/);
      assert.equal(session.conversion.pending_action, 'ask_question');
    }
    if (expected === 'purchase_preparation' && !future && verdict !== 'available') {
      assert.equal(session.conversion.stock_status, 'pending');
      assert.match(sent.at(-1), /Pembayaran tanda jadi menunggu kepastian aset dari tim/);
      assert.doesNotMatch(sent.at(-1), /silakan bayar|segera transfer|stoknya sudah tersedia/i);
    }
    if (continueJourney) {
      await send(example === 'pacarkembang' ? 'baik' : 'boleh'); assert.equal(session.conversion.topic, 'clarify');
      assert.match(sent.at(-1), /Bagian mana yang ingin ditanyakan\?/);
      assert.equal(session.conversion.pending_action, 'ask_question');
      assert.equal(session.is_bot_active, true);
      assert.notEqual(session.conversion.purchase_intake.documents_reported_ready, true);
      await send('KTP dan cover buku tabungan sudah siap, saya mau lanjut');
      assert.equal(session.conversion.phase, 'purchasing_handoff'); assert.equal(session.is_bot_active, false);
      assert.match(sent.at(-1), /atas nama Anda/); assert.match(sent.at(-1), /KTP.*cover buku tabungan/);
      assert.equal(session.conversion.purchase_intake.documents_reported_ready, true);
      assert.equal(session.conversion.purchase_intake.documents_verified, false);
      assert.equal(session.conversion.purchase_intake.payment_verified, false);
    }
    return { name, passed: true, selected_id: session.asset_id, topic: session.conversion.topic,
      phase: session.conversion.phase, stock_status: session.conversion.stock_status,
      searches: catalog.calls.filter((item) => item.criteria).length, transcript };
  } catch (error) {
    return { name, passed: false, error: error.message, transcript };
  } finally { db.close(); }
}

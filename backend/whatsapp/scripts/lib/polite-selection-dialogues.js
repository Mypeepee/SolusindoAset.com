import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { selectionFixture } from './selection-language-dialogues.js';
import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';
import { AssetCheckStore } from '../../state/asset_checks.js';
import { recommendationIds } from '../../services/recommendations.js';

export const NOW = Date.parse('2026-10-19T21:45:00+07:00');
export const OPENING = 'Cari aset lelang di seluruh Kecamatan Menganti, Gresik, budget 150 juta, jenis bebas, luas tanah bebas';
export const REPORTED = 'coba pak nomor 4';
// Controlled fixtures from the user's cards. No live inventory is accessed.
export const ASSETS = [
  ['119573', 'Desa/Kel. Hulaan Kec. Menganti, kab. Gresik, Provinsi Jawa Timur', 141000000, 157, '2026-06-09', 'GUDANG', 'gudang-hulaan-menganti-gresik-jawa-timur-gresik-122723-119573'],
  ['116628', 'Randupadangan Regency IV Blok G-17, Desa Randupadangan, Kecamatan Menganti, Kabupaten Gresik, Propinsi Jawa Timur', 85000000, 71, '2026-06-03', 'RUMAH', 'rumah-randupadangan-regency-iv-g-17-randupadangan-menganti-gresik-119778-116628'],
  ['115597', 'Golden Berry Menganti Blok DD-01 Desa Menganti Kecamatan Menganti Kabupaten Gresik Provinsi Jawa Timur', 125000000, 96, '2026-05-26', 'RUMAH', 'rumah-golden-berry-menganti-dd-01-menganti-menganti-gresik-118747-115597'],
  ['113175', 'PERUM PERMATA GREEN MENGANTI REGENCY BLOK B2 NO 09 DESA DRANCANG KECAMATAN MENGANTI KABUPATEN GRESIK', 133000000, 128, '2026-05-20', 'RUMAH', 'rumah-perum-permata-green-menganti-regency-b2-gresik-116325-113175'],
  ['110610', 'Desa Gadingwatu, Kec Menganti, Kab Gresik', 150000000, 129, '2026-05-18', 'RUMAH', 'rumah-gadingwatu-menganti-gresik-gresik-113759-110610'],
].map(([id, address, price, land, date, category, slug]) => ({ id, name: address, full_address: address,
  transaction_type: 'LELANG', category, limit_price: price, price_display: `Rp ${price.toLocaleString('id-ID')}`,
  address: { city: 'Gresik', district: 'Menganti', street: address }, specifications: { land_area_m2: land, certificate_type: 'SHM' },
  auction_at: `${date}T03:00:00Z`, publication: { status: 'TERSEDIA' }, detail_url: `https://solusindoaset.com/Lelang/${slug}` }));
export const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 20,
  maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
export const noAi = { generate() { assert.fail('A numbered selection must not require the model'); } };

export function politeSelectionScenarios() {
  return ['plain', 'markdown', 'html', 'split'].flatMap((format) => ['full', 'truncated'].flatMap((memory) =>
    [REPORTED, 'tolong bu nomor empat', 'bisa gak pak no.4?', 'yang pak nomor empat', 'coba, pak, 4', 'sy penasaran sama nomor 4']
      .map((text) => ({ format, memory, text }))));
}

export async function simulatePoliteSelection({ format = 'html', memory = 'full', text = REPORTED, journey = false } = {}) {
  let now = NOW;
  const listAssets = format === 'split' ? ASSETS.map((asset) => ({ ...asset, full_address: `${asset.full_address}, ${'Alamat panjang untuk pengujian '.repeat(30)}` })) : ASSETS;
  const catalog = selectionFixture({ assets: ASSETS, listAssets, priceAdjustment: 0 });
  const store = new MemoryStore(config, () => now), sent = [], transcript = [], phone = '6280000000001';
  const db = new AssetCheckStore(':memory:', { now: () => now }), checks = db.forTenant('AG108');
  const processor = new MessageProcessor({ config, store, catalog, checks, ai: noAi, now: () => now,
    whatsapp: { async sendText(_phone, body) { sent.push(body); return randomUUID(); } },
    logger: { error(error) { assert.fail(error.event); } } });
  const send = async (content) => {
    const before = sent.length;
    processor.acceptBatch([{ id: randomUUID(), from: phone, type: 'text', text: content, timestamp: now }]); await processor.drain();
    assert.ok(sent.length > before); transcript.push({ user: content, bot: sent.slice(before).join('\n\n') });
  };
  try {
    if (memory === 'truncated') {
      await send(OPENING.replace(', luas tanah bebas', ''));
      await send('luas tanah bebas');
    } else await send(OPENING);
    assert.equal(catalog.calls.length, 1); assert.deepEqual(sent.flatMap(recommendationIds), ASSETS.map((asset) => asset.id));
    const session = store.get(phone), lists = session.history.filter((item) => item.role === 'assistant' && item.content.includes('Lihat detail:'));
    // Reproduce the stored/card text supplied by the UI or a legacy chat.
    if (['markdown', 'html'].includes(format)) for (const item of lists) {
      item.content = item.content.replace(/^(\d+)\. /gm, '$1\\. ').replace(/\*/g, '**')
        .replace(/Lihat detail: (https:\/\/\S+)/g, 'Lihat detail: [**Buka detail properti ↗**]($1)');
      if (format === 'html') item.content = item.content.replace(/^  /gm, '&#x20; ');
    }
    transcript.at(-1).bot = lists.map((item) => item.content).join('\n\n');
    if (memory === 'truncated') session.history = session.history.slice(session.history.findLastIndex((item) => item.role === 'user'));
    now += 60000; await send(text);
    assert.equal(session.asset_id, ASSETS[3].id); assert.equal(session.is_bot_active, true);
    assert.equal(catalog.calls.length, 2); assert.equal(catalog.calls[1].text, 'Kode 113175'); assert.equal(catalog.calls[1].criteria, undefined);
    assert.match(sent.at(-1), /DETAIL ASET.*113175/); assert.match(sent.at(-1), /PERMATA GREEN MENGANTI/);
    assert.match(sent.at(-1), /Harga limit: Rp 133\.000\.000/); assert.match(sent.at(-1), /Luas tanah: 128 m²/);
    assert.doesNotMatch(sent.at(-1), /Berikut pilihan|Sebutkan nomor pilihannya|Budget-nya sampai berapa/);
    assert.equal(session.buyer_state.profile.max_price, 150000000); assert.equal(session.buyer_state.profile.district, 'Menganti');
    assert.equal(session.buyer_state.profile.category, null, 'Reading a house does not overwrite the any-type search');
    assert.equal(checks.list().items.length, 1);
    if (journey) {
      await send('coba pak breakdownkan biaya'); assert.match(sent.at(-1), /ESTIMASI BIAYA PEMBELIAN LELANG/);
      assert.match(sent.at(-1).replace(/\*/g, ''), /HARGA LIMIT\nRp 133\.000\.000/); assert.equal(session.asset_id, '113175');
      await send('wow... saya tertarik pak'); assert.equal(session.conversion.mode, 'Closing_State');
      assert.equal(session.conversion.asset_id, '113175'); assert.equal(session.conversion.topic, 'purchase_preparation');
      await send('boleh'); assert.equal(session.conversion.topic, 'purchase_preparation');
      assert.match(sent.at(-1), /Komitmen tanda jadinya Rp 13\.300\.000/);
      assert.equal(session.conversion.stock_status, 'pending'); assert.equal(checks.list().items.length, 1);
      assert.equal(catalog.calls.filter((item) => item.criteria).length, 1, 'Follow-ups never restart inventory search');
    }
    return { name: `${format}/${memory}: ${text}`, passed: true, selected_id: session.asset_id,
      searches: catalog.calls.filter((item) => item.criteria).length, transcript };
  } catch (error) {
    return { name: `${format}/${memory}: ${text}`, passed: false, error: error.message, transcript };
  } finally { db.close(); }
}

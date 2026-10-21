import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';
import { AssetCheckStore } from '../../state/asset_checks.js';
import { recommendationIds } from '../../services/recommendations.js';

export const NOW = Date.parse('2026-10-19T21:01:00+07:00');
export const OPENING = 'Cari rumah lelang di Desa Sumberpasir, Kecamatan Pakis, Kabupaten Malang, budget 300–500 juta, luas tanah bebas';
export const REPORTED = 'boleh aset tersebut pak';
// Controlled fixture from the user's example; this is not a live stock result.
export const ASSET = { id: '106286', name: 'Rumah Sumberpasir', category: 'RUMAH', transaction_type: 'LELANG',
  full_address: 'DESA SUMBERPASIR,KECAMATAN PAKIS,KABUPATEN MALANG,PROVINSI JAWA TIMUR.',
  address: { street: 'Desa Sumberpasir', village: 'Sumberpasir', district: 'Pakis', city: 'Kabupaten Malang', province: 'Jawa Timur' },
  limit_price: 500000000, price_display: 'Rp 500.000.000', specifications: { land_area_m2: 149, certificate_type: 'SHM' },
  auction_at: '2026-04-29T03:00:00Z', publication: { status: 'TERSEDIA' },
  detail_url: 'https://solusindoaset.com/Lelang/rumah-sumberpasir-pakis-malang-jawa-timur-malang-109427-106286' };
export const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 20,
  maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
export const noAi = { generate() { assert.fail('One offered property must be resolved without an LLM'); } };

export function singleFixture({ missing = false, freshPrice = ASSET.limit_price } = {}) {
  const calls = [];
  return { calls, async resolve(text, previousId, criteria) {
    calls.push({ text, previousId, criteria });
    if (criteria) return { asset: null, catalog: [ASSET], status: 'recommendations', source: 'simulation',
      selection: { schedule_priority: 'needs_confirmation' } };
    assert.equal(text, `Kode ${ASSET.id}`, 'The final ID in the detail URL is the property pointer');
    return { asset: missing ? null : { ...ASSET, limit_price: freshPrice, price_display: `Rp ${freshPrice.toLocaleString('id-ID')}` },
      catalog: [], status: missing ? 'not_found' : 'matched', source: 'simulation' };
  } };
}

export function singleList(format = 'plain', items = [ASSET]) {
  const list = `Saya cari aset lelang di Sumberpasir, Kabupaten Malang, budget Rp 300.000.000–Rp 500.000.000.\n\nBelum ada jadwal lelang mendatang yang sesuai kriteria Bapak/Ibu. Berikut pilihan yang masih ditayangkan sebagai *Tersedia*, diurutkan dari jadwal tercatat terbaru; hasil lelang atau jadwal ulang perlu dikonfirmasi tim.\n\n${items.map((asset, index) => `${index + 1}. *${asset.full_address}*\n  Transaksi: lelang\n  Harga limit: *${asset.price_display}* · LT 149 m² · SHM\n  Lelang tercatat: 29 April 2026 WIB (sudah lewat).\n  Lihat detail: ${asset.detail_url}`).join('\n\n')}\n\nAda yang menarik? Sebutkan nomor pilihannya, nanti saya bantu cek detailnya.`;
  if (format === 'plain') return list;
  const markdown = list.replace(/^(\d+)\. /gm, '$1\\. ').replace(/\*/g, '**')
    .replace(/Lihat detail: (https:\/\/\S+)/g, 'Lihat detail: [**Buka detail properti ↗**]($1)');
  return format === 'html' ? markdown.replace(/^  /gm, '&#x20; ') : markdown;
}

export const PHRASES = [REPORTED, 'aset tersebut', 'boleh aset itu pak', 'boleh aset yang ini',
  'properti yang tadi bu', 'rumah tadi saja', 'saya tertarik dengan aset tersebut', 'tolong buka unit itu',
  'mau lihat properti yang direkomendasikan', 'minta detail aset tersebut', 'coba yang itu', 'boleh yang tadi pak',
  'yang ini saja', 'boleh', 'boleh pak', 'iya pak', 'oke', 'siap', 'boleh 🙏'];

export function singleSelectionScenarios() {
  return ['plain', 'markdown', 'html'].flatMap((format) => PHRASES.map((text) => ({ format, text, name: `${format}: ${text}` })));
}

export async function simulateSingleSelection({ format = 'html', text = REPORTED, closing = false } = {}) {
  let now = NOW;
  const store = new MemoryStore(config, () => now), catalog = singleFixture(), sent = [], transcript = [];
  const db = new AssetCheckStore(':memory:', { now: () => now }), checks = db.forTenant('AG108'), phone = '6280000000001';
  const processor = new MessageProcessor({ config, store, catalog, checks, ai: noAi, now: () => now,
    whatsapp: { async sendText(_phone, body) { sent.push(body); return randomUUID(); } },
    logger: { error(error) { assert.fail(error.event); } } });
  const send = async (content) => {
    const before = sent.length;
    processor.acceptBatch([{ id: randomUUID(), from: phone, type: 'text', text: content, timestamp: now }]); await processor.drain();
    assert.ok(sent.length > before, 'Every message receives a response');
    transcript.push({ user: content, bot: sent.slice(before).join('\n\n') });
  };
  try {
    await send(OPENING);
    assert.equal(catalog.calls.length, 1); assert.deepEqual(recommendationIds(sent.at(-1)), [ASSET.id]);
    assert.match(sent.at(-1), /Mau saya bantu cek detail aset ini\?/);
    // Replay the user's already-delivered card format, including its old CTA.
    const session = store.get(phone);
    session.history.findLast((item) => item.role === 'assistant').content = singleList(format);
    transcript[0].bot = singleList(format);
    now += 8 * 60000;
    await send(text);
    assert.equal(session.asset_id, ASSET.id); assert.equal(session.is_bot_active, true);
    assert.equal(catalog.calls.length, 2); assert.equal(catalog.calls[1].text, `Kode ${ASSET.id}`);
    assert.equal(catalog.calls[1].criteria, undefined, 'Selection fetches fresh details instead of repeating the search');
    const reply = sent.at(-1);
    assert.match(reply, /DETAIL ASET.*106286/); assert.match(reply, /Luas tanah: 149 m²/); assert.match(reply, /SHM/);
    assert.match(reply, /29 April 2026 WIB \(sudah lewat\)/); assert.match(reply, /lelang ulang perlu dikonfirmasi/);
    assert.doesNotMatch(reply, /Berikut pilihan|Sebutkan nomor pilihannya|Budget-nya sampai berapa|sudah.*menghubungi/);
    assert.equal(checks.list().items.length, 1, 'Expired property is queued for verification, never reported as confirmed');
    assert.equal(session.buyer_state.profile.min_price, 300000000); assert.equal(session.buyer_state.profile.max_price, 500000000);
    if (closing) {
      await send('Baik pak, saya serius untuk aset ini, langkah selanjutnya bagaimana ya?');
      assert.equal(session.conversion.topic, 'purchase_preparation'); assert.equal(session.conversion.stock_status, 'pending');
      await send('boleh'); assert.equal(session.conversion.topic, 'purchase_preparation');
      assert.equal(session.conversion.stock_status, 'pending');
      assert.match(sent.at(-1), /Komitmen tanda jadinya Rp 20\.000\.000/);
      assert.match(sent.at(-1), /Pembayaran tanda jadi menunggu kepastian aset/);
      assert.equal(checks.list().items.length, 1, 'Repeated discussion cannot create duplicate stock tasks');
    }
    return { name: `${format}: ${text}`, passed: true, selected_id: session.asset_id,
      searches: catalog.calls.filter((item) => item.criteria).length,
      detail_reads: catalog.calls.filter((item) => !item.criteria).length, transcript };
  } catch (error) {
    return { name: `${format}: ${text}`, passed: false, error: error.message, transcript };
  } finally { db.close(); }
}

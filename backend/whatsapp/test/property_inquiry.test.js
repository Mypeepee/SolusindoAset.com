import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePropertyInquiry } from '../services/property_inquiry.js';
import { assetFacts, validateAssets } from '../services/catalog.js';
import { formatSalesReply } from '../services/ai_controller.js';

const NOW = Date.parse('2026-10-08T10:00:00+07:00');
const asset = {
  id: 'TEST-001', name: 'Aset pengujian', limit_price: 110000000, origin: 'bank',
  availability_status: 'scheduled', availability_source: 'Sumber pengujian',
  availability_verified_at: '2026-10-08T09:00:00+07:00',
  availability_valid_until: '2026-10-09T09:00:00+07:00',
  auction_at: '2026-10-11T10:00:00+07:00',
};

test('template website dibaca sebagai konteks belum terverifikasi; nama agent bukan nama klien', () => {
  const inquiry = parsePropertyInquiry('Halo Jason Christopher Liendo 👋\n\nSaya tertarik dengan properti lelang berikut, apakah masih tersedia?\n🔨 *Tanah & Bangunan 72m²*\n📍 Candi, Sidoarjo\n💰 *Rp110.000.000*\n🔖 Kode: 169312\n🔗 Detail lengkap:\nhttps://example.com/169312');
  assert.equal(inquiry.code, '169312');
  assert.equal(inquiry.location, 'Candi, Sidoarjo');
  assert.equal(inquiry.price_text, 'Rp110.000.000');
  assert.equal(inquiry.description, 'Tanah & Bangunan 72m²');
  assert.equal(inquiry.verified, false);
  assert.equal(inquiry.client_name, undefined);
  assert.equal(parsePropertyInquiry('Berapa harga 169312?'), null);
});

test('ketersediaan hanya dikonfirmasi selama verifikasi berlaku; siap lelang memerlukan jadwal', () => {
  validateAssets([asset]);
  assert.equal(assetFacts(asset, NOW).availability.confirmed_available, true);
  assert.equal(assetFacts(asset, NOW).availability.ready_for_auction, true);
  assert.equal(assetFacts({ ...asset, auction_at: null }, NOW).availability.ready_for_auction, false);
  assert.equal(assetFacts(asset, NOW + 86400000).availability.confirmed_available, false);
  assert.equal(assetFacts({ ...asset, availability_verified_at: '2026-10-08T11:00:00+07:00' }, NOW).availability.confirmed_available, false);
  assert.equal(assetFacts({ ...asset, availability_status: 'sold' }, NOW).availability.confirmed_available, false);
  assert.equal(assetFacts({ ...asset, is_demo: true }, NOW).availability.confirmed_available, false);
  assert.equal(assetFacts({ ...asset, auction_at: '2026-10-08T08:00:00+07:00' }, NOW).availability.confirmed_available, false);
  assert.equal(assetFacts({ ...asset, registration_closes_at: '2026-10-08T08:00:00+07:00' }, NOW).availability.ready_for_auction, false);
  assert.throws(() => validateAssets([{ ...asset, availability_source: null }]));
  assert.throws(() => validateAssets([{ ...asset, availability_valid_until: asset.availability_verified_at }]));
});

test('format WhatsApp menggabungkan pembuka dan mempertahankan satu CTA dengan maksimal tiga emoji', () => {
  const reply = formatSalesReply('Halo Bapak/Ibu. 🙏\n\nKode **TEST-001**, harga **Rp110.000.000**. 🏡\n\nHarga limit adalah awal penawaran. ✨\n\nTim menjelaskan proses resmi. 😊\n\nBagaimana pengalaman Bapak/Ibu dengan lelang? Atau apa pertimbangan utama Anda?');
  assert.equal(reply.split('\n\n').length, 4);
  assert.equal((reply.match(/\?/g) || []).length, 1);
  assert.ok(reply.endsWith('Bagaimana pengalaman Bapak/Ibu dengan lelang?'));
  assert.match(reply, /\*Rp110\.000\.000\*/);
  assert.equal(reply.includes('**'), false);
  assert.equal(reply.includes('😊'), false);
  assert.throws(() => formatSalesReply('Ragu?\n\nBagaimana pengalaman Bapak/Ibu?'), { code: 'INVALID_AI_OUTPUT' });
  assert.throws(() => formatSalesReply('a'.repeat(1800) + '?'), { code: 'INVALID_AI_OUTPUT' });
});

import assert from 'node:assert/strict';
import { renderRecommendations, recommendationMessages } from '../../services/recommendations.js';
import { selectedRecommendation } from '../../services/property_selection.js';
import { generatePropertyReply } from '../../services/property_reply.js';

export const NOW = Date.parse('2026-10-17T14:11:00Z');
export const OPENING = 'Cari rumah lelang di Sukodono Sidoarjo budget 350 juta luas tanah bebas';
// Public IDs from the reported list are pointers. These are controlled fixtures;
// test prices deliberately change on detail lookup to prove fresh data is used.
export const ASSETS = [
  ['118928', 'Mutiara Kebonagung, Desa Kebonagung, Kecamatan Sukodono, Kabupaten Sidoarjo', 200000000, 193, 'SHM'],
  ['118762', 'Perum Citra Surya Mas Blok B-12, Desa Jumputrejo, Kecamatan Sukodono, Kabupaten Sidoarjo', 350000000, 90, 'HGB'],
  ['117412', 'Dusun Beciro RT 006 RW 002, Kelurahan Jumputrejo, Kecamatan Sukodono, Kabupaten Sidoarjo', 195000000, 62, 'SHM'],
  ['116545', 'Grand Masangan Blok B2 No 53, Desa Masanganwetan, Kecamatan Sukodono, Kabupaten Sidoarjo', 275000000, 90, 'HGB'],
  ['115588', 'Perum Green Kebonagung Regency Blok D/62, Kelurahan Kebonagung, Kecamatan Sukodono, Kabupaten Sidoarjo', 250000000, 92, 'SHM'],
].map(([id, address, price, land, certificate]) => ({ id, full_address: address, name: address, transaction_type: 'LELANG', category: 'RUMAH',
  limit_price: price, price_display: `Rp ${price.toLocaleString('id-ID')}`, deposit: price / 5,
  address: { city: 'Sidoarjo', district: 'Sukodono', street: address }, specifications: { land_area_m2: land, certificate_type: certificate },
  auction_at: '2026-06-09T03:00:00Z', publication: { status: 'TERSEDIA' }, detail_url: `https://solusindoaset.com/Lelang/rumah-simulasi-sukodono-${id}` }));

export function selectionFixture({ assets = ASSETS, listAssets = assets, priceAdjustment = 1000000 } = {}) {
  const calls = [];
  return { calls, async resolve(text, previousId, criteria) {
    calls.push({ text, previousId, criteria });
    if (criteria) {
      const options = listAssets.filter((asset) => !criteria.exclude_ids?.includes(asset.id));
      return { asset: null, catalog: options, status: options.length ? 'recommendations' : 'not_found', selection: { schedule_priority: 'needs_confirmation' } };
    }
    const asset = assets.find((candidate) => `Kode ${candidate.id}` === text);
    assert.ok(asset, 'Only an actual property ID from the displayed list may be fetched');
    const price = asset.limit_price + priceAdjustment;
    return { asset: { ...asset, limit_price: price, price_display: `Rp ${price.toLocaleString('id-ID')}` }, catalog: [], status: 'matched' };
  } };
}
export function selectionHistory(format = 'plain', { assets = ASSETS, opening = OPENING } = {}) {
  const options = format === 'split' ? assets.map((asset) => ({ ...asset, full_address: `${asset.full_address}, ${'Alamat panjang untuk pengujian '.repeat(30)}` })) : assets;
  const list = renderRecommendations(`Pilihan:\n\n${options.map((asset) => `[[PROPERTY:${asset.id}]]`).join('\n')}\n\nAda yang menarik? Sebutkan nomor pilihannya, nanti saya bantu cek detailnya.`, options, { schedule_priority: 'needs_confirmation' }, NOW);
  const markdown = list.replace(/^(\d+)\. /gm, '$1\\. ').replace(/\*/g, '**').replace(/Lihat detail: (https:\/\/\S+)/g, 'Lihat detail: [**Buka detail properti ↗**]($1)');
  const messages = format === 'split' ? recommendationMessages(list) : [format === 'markdown' ? markdown : format === 'html' ? markdown.replace(/^  /gm, '&#x20; ') : list];
  return [{ role: 'user', content: opening }, ...messages.map((content) => ({ role: 'assistant', content }))];
}
const numerals = ['pertama', 'kedua', 'ketiga', 'keempat', 'kelima'];
const spoken = ['satu', 'dua', 'tiga', 'empat', 'lima'];
export function selectionLanguageScenarios() {
  const scenarios = [];
  for (const format of ['plain', 'markdown', 'html', 'split']) for (let i = 0; i < 5; i++) {
    const n = i + 1;
    const phrases = [ `coba nomor ${n}`, `coba no. ${n}`, `coba dulu nomor ${n}`, `cobain nomor ${n} dong`, `buka nomor ${n}`,
      `boleh nomor ${n}?`, `boleh lihat nomor ${n} dulu pak?`, `tolong tampilkan nomor ${n}`, `jelasin nomor ${n} dong`,
      `pilih ${n}`, `saya pilih ${n}`, `coba ${n}`, `${n} dulu`, `${n} aja pak`, `lihat yang ke-${n}`, `yang ${n}nya`,
      `yg nomor ${n}`, `no.${n}`, `nomer ${n} bu`, `nmr ${n}`, `listing nomor ${n}`, `nomor 0${n}`,
      `yang ${numerals[i]}`, `${numerals[i]} dulu dong`, `nomor ${spoken[i]}`, `coba nomor ${spoken[i]}`, `coba ${spoken[i]} dulu`,
      `saya tertarik yang nomor ${n} pak`, `minta detail nomor ${n}`, `DETAIL NOMOR ${n} YA`, `lihat ${n} detailnya`,
      ...['pak', 'bu', 'bapak', 'ibu', 'kak', 'mas', 'mbak'].flatMap((salutation) => [
        `coba ${salutation} nomor ${n}`, `${salutation}, coba nomor ${n}`, `coba, ${salutation}, no. ${n}`,
        `tolong ${salutation} buka yang ke-${n}`, `boleh ${salutation} no ${n}?`, `nomor ${n} ${salutation} detailnya`,
        `yang ${salutation} nomor ${spoken[i]}`, `nomor ${salutation} ${n} dulu`,
        `coba, ${salutation}, ${n}`,
      ]),
      `boleh gak nomor ${n}?`, `bisa ga pak buka nomor ${n}?`, `bs pak dibukain no${n}`,
      `cb bu nmr${n}`, `coba nomer${n}`, `coba untuk no:${n}`, `no: ${spoken[i]}`, `nomor urut ${n}`,
      `saya penasaran sama nomor ${n}`, `sy tertarik no ${n}`, `boleh info nomor ${n}`,
      `aset nomor ${n} pak`, `rumah yang ke-${n}`, `pilihan ke ${spoken[i]}`,
      `${n}, pak`, `coba, ${n}, bu`, `${n} 🙏`, `coba pak nomor ${n} 😊`,
      `cari info nomor ${n}`, `mau lihat urutan ${n}`,
    ];
    for (const text of phrases) scenarios.push({ name: `${format}: ${text}`, format, text, index: i });
  }
  return scenarios;
}
export async function simulateSelectionLanguage(scenario) {
  const history = selectionHistory(scenario.format), catalog = selectionFixture();
  try {
    const expected = ASSETS[scenario.index];
    assert.equal(selectedRecommendation(scenario.text, history)?.id, expected.id);
    const result = await generatePropertyReply({ text: scenario.text, history, catalog,
      ai: { generate() { assert.fail('A numbered selection must not invoke AI'); } }, now: NOW + 12 * 60000 });
    assert.equal(result.asset.id, expected.id); assert.match(result.reply, new RegExp(`DETAIL ASET.*${expected.id}`));
    assert.ok(result.reply.includes(`Rp ${(expected.limit_price + 1000000).toLocaleString('id-ID')}`), 'Fresh price must replace the old card price');
    assert.equal(catalog.calls.length, 1); assert.equal(catalog.calls[0].text, `Kode ${expected.id}`); assert.equal(catalog.calls[0].criteria, undefined);
    assert.doesNotMatch(result.reply, /Berikut pilihan|Sebutkan nomor pilihannya|Budget-nya sampai berapa|kelurahan mana/);
    return { name: scenario.name, passed: true, id: result.asset.id };
  } catch (error) { return { name: scenario.name, passed: false, error: error.message }; }
}

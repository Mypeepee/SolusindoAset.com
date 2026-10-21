import test from 'node:test';
import assert from 'node:assert/strict';
import { propertyDetailUrl, mapPublicProperty, planPropertyLookup } from '../../../src/lib/chatbot/property-knowledge.ts';
import { recommendationIds, renderRecommendations, recommendationMessages } from '../services/recommendations.js';
import { resolvePropertyContext } from '../services/property_reply.js';
import { explicitAsset } from '../services/buyer_profile.js';

const now = Date.parse('2026-10-08T08:00:00Z');
function asset(id, overrides = {}) {
  return mapPublicProperty({ id_property: BigInt(id), slug: 'rumah-manukan', judul: 'Rumah Manukan', jenis_transaksi: 'LELANG',
    kategori: 'RUMAH', alamat_lengkap: `Jalan Manukan Lor VII H No. ${id}`, kecamatan: 'Tandes', kelurahan: 'Banjarsugihan',
    kota: 'Kota Surabaya', provinsi: 'Jawa Timur', nilai_limit_lelang: 450000000, luas_tanah: 60, luas_bangunan: 45,
    legalitas: 'SHM', tanggal_lelang: new Date('2026-10-20T17:00:00Z'), ...overrides }, now);
}
const reply = 'Berikut pilihan sesuai kebutuhan Bapak/Ibu.\n\n[[PROPERTY:123]]\n[[PROPERTY:456]]\n\nProperti mana yang ingin Bapak/Ibu bahas lebih lanjut?';
const madyaAddresses = [
  'Manukan Madya No 24 Blok 34A Kelurahan Manukan Wetan Kecamatan Tandes Kota Surabaya',
  'Manukan Madya No 24 Blok 34 A Kelurahan Manukan Wetan Kecamatan Tandes Kota Surabaya',
  'Jl. Manukan Madya No 24 / Blok 34 A, Kel. Manukan Wetan, Kec.Tandes, Surabaya. Provinsi Jawa timur.',
];
const madyaAssets = () => [114108, 102381, 63612].map((id, i) => asset(id, { alamat_lengkap: madyaAddresses[i], kelurahan: 'Manukan Wetan',
  nilai_limit_lelang: [194000000, 195000000, 325000000][i], luas_tanah: 111, tanggal_lelang: new Date(['2026-05-20T17:00:00Z', '2026-04-14T17:00:00Z', '2025-12-22T17:00:00Z'][i]) }));
function madyaHistory() {
  return [{ role: 'user', content: 'Cari lelang rumah di Tandes, Surabaya kelurahan Manukan Wetan budget 350 juta luas tanah bebas' },
    { role: 'assistant', content: renderRecommendations('Berikut pilihannya.\n\n[[PROPERTY:114108]]\n[[PROPERTY:102381]]\n[[PROPERTY:63612]]\n\nProperti mana yang ingin Bapak/Ibu bahas lebih lanjut?', madyaAssets(), { schedule_priority: 'needs_confirmation' }, now) }];
}

test('the reported address selects the exact first listing and re-fetches it without rerunning the earlier search', async () => {
  const calls = [], text = `boleh minta detail terhadap aset yang ini pak? ${madyaAddresses[0]}`;
  const fresh = { ...madyaAssets()[0], limit_price: 190000000, price_display: 'Rp 190.000.000' };
  const catalog = { async resolve(...args) { calls.push(args); return args[2]
    ? { asset: null, catalog: madyaAssets(), status: 'recommendations' }
    : { asset: fresh, catalog: [], status: 'matched' }; } };
  const selected = await resolvePropertyContext(catalog, text, null, [...madyaHistory(), { role: 'user', content: text }], now);
  assert.deepEqual(calls, [['Kode 114108', null]]);
  assert.equal(selected.asset.id, '114108'); assert.equal(selected.asset.limit_price, 190000000);
  assert.equal(selected.buyer.stage, 'consultation'); assert.equal(selected.buyer.searching, false);
  assert.deepEqual(selected.catalog, []);
});

test('detail links use public canonical routes, never user text or localhost', () => {
  for (const [type, route] of [['LELANG', 'Lelang'], ['SEWA', 'Sewa'], ['PRIMARY', 'Jual'], ['SECONDARY', 'Jual']]) {
    const url = propertyDetailUrl({ id_property: 123n, slug: 'rumah-manukan', jenis_transaksi: type }, 'https://solusindoaset.com');
    assert.equal(url, `https://solusindoaset.com/${route}/rumah-manukan-123`);
    assert.deepEqual(planPropertyLookup(url).ids, ['123']);
    assert.equal(explicitAsset(url), true);
  }
  assert.match(propertyDetailUrl({ id_property: 123n, slug: '../private?token=x', jenis_transaksi: 'LELANG' }), /\/Lelang\/properti-123$/);
  assert.throws(() => propertyDetailUrl({ id_property: 123n, slug: 'rumah', jenis_transaksi: 'LELANG' }, 'http://localhost:3000'), /INVALID_PUBLIC_SITE_URL/);
});

test('recommendations render full addresses, exact prices, WIB dates and clickable URLs without code headings', () => {
  const options = [asset(123), asset(456)];
  const text = renderRecommendations(reply, options, { schedule_priority: 'upcoming' }, now);
  for (const p of options) {
    assert.ok(text.includes(p.full_address));
    assert.ok(text.includes(p.detail_url));
    assert.ok(text.includes(p.price_display.replace(/\s/g, ' ')));
  }
  assert.match(text, /21 Oktober 2026 WIB/);
  assert.match(text, /LT 60 m² · LB 45 m² · SHM/);
  assert.doesNotMatch(text, /Kode|\[\[PROPERTY/);
  assert.equal(text.split('\n\n').length, 3);
  assert.deepEqual(recommendationIds(text), ['123', '456']);
  assert.match(text, /^1\. \*/m);
  assert.match(text, /^2\. \*/m);
  assert.throws(() => renderRecommendations(reply.replace('456', '999'), options, null, now), { code: 'UNSUPPORTED_RECOMMENDATION' });
  assert.throws(() => renderRecommendations(reply.replace('456', '123'), options, null, now), { code: 'UNSUPPORTED_RECOMMENDATION' });
  assert.throws(() => renderRecommendations(reply.replace('Berikut', 'https://evil.example/detail Berikut'), options, null, now), { code: 'UNSUPPORTED_RECOMMENDATION' });
});

test('fallback explains freshness once and missing dates/addresses are never fabricated', () => {
  const options = [asset(123, { tanggal_lelang: new Date('2026-09-01T17:00:00Z') }), asset(456, { tanggal_lelang: null, alamat_lengkap: null })];
  const text = renderRecommendations(reply, options, { schedule_priority: 'needs_confirmation' }, now);
  assert.match(text, /Belum ada jadwal lelang mendatang yang sesuai/);
  assert.match(text, /hasil lelang atau jadwal ulang perlu dikonfirmasi tim/);
  assert.match(text, /2 September 2026 WIB \(sudah lewat\)/);
  assert.match(text, /Alamat rinci belum tercatat/);
  assert.match(text, /Jadwal lelang belum tercatat/);
  assert.doesNotMatch(text, /sudah.*(?:menghubungi|tercatat.*permintaan)|siap dilelang/);
});

test('ordinal selection from link cards re-fetches availability and handles a now-sold unit without stale data', async () => {
  const history = [{ role: 'assistant', content: renderRecommendations(reply, [asset(123), asset(456)], null, now) }], calls = [];
  const catalog = { async resolve(...args) { calls.push(args); return { asset: null, catalog: [], status: 'not_found', source: 'database_listing_publik' }; } };
  const selected = await resolvePropertyContext(catalog, 'yang kedua, alamatnya?', null, history);
  assert.deepEqual(calls[0], ['Kode 456', null]);
  assert.equal(selected.asset, null);
  assert.equal(selected.status, 'not_found');
  assert.deepEqual(recommendationIds('• Kode 123\nhttps://solusindoaset.com/Lelang/rumah-123\n• Kode 456'), ['123', '456']);
});

test('five long addresses and URLs remain complete across bounded messages without dropping cards', () => {
  const options = [123, 456, 789, 987, 654].map((id) => ({ ...asset(id), full_address: `Jalan ${'Manukan '.repeat(130)}Nomor ${id}`, detail_url: `https://solusindoaset.com/Lelang/${'rumah-'.repeat(60)}${id}` }));
  const text = renderRecommendations(`Berikut pilihannya.\n\n${options.map((p) => `[[PROPERTY:${p.id}]]`).join('\n')}\n\nPilihan mana?`, options, null, now);
  const messages = recommendationMessages(text);
  assert.ok(messages.length > 1); assert.ok(messages.every((message) => message.length <= 4000));
  for (const p of options) assert.ok(messages.some((message) => message.includes(p.full_address) && message.includes(p.detail_url)));
  assert.deepEqual(messages.flatMap(recommendationIds), options.map((p) => p.id));
  assert.deepEqual(messages.flatMap((message) => [...message.matchAll(/^(\d+)\. \*/gm)].map((match) => Number(match[1]))), [1, 2, 3, 4, 5]);
  assert.ok(messages.at(-1).endsWith('?'));
});

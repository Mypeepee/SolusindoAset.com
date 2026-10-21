import assert from 'node:assert/strict';
import { generatePropertyReply } from '../../services/property_reply.js';

export const NOW = Date.parse('2026-10-12T16:35:00+07:00');
export const ORIGINAL = {
  id: '114108', name: 'Aset contoh Tandes', location: 'Tandes, Kota Surabaya',
  category: 'RUMAH', transaction_type: 'LELANG', address: { city: 'Surabaya', district: 'Tandes' },
  limit_price: 194000000, specifications: { land_area_m2: 111 },
  auction_at: '2026-05-21T10:00:00+07:00', publication: { status: 'TERSEDIA' },
};
export const OPENING = 'Halo Jason Christopher Liendo 👋\nSaya tertarik lelang dengan properti berikut, apakah masih tersedia?\n🔨 **1 bidang tanah dengan total luas 111 m2 berikut bangunan di Kota Surabaya · LT 111 m²**\n📍 Tandes, Kota Surabaya\n💰 **Rp 194.000.000**\n🔖 Kode: **114108**\nMohon infonya, terima kasih! 🙏';
export const REPORTED = 'saya sedang cari lelang di area tersebut pak, dengan budget maksimal 500 juta, apakah ada yang lain pak selain aset tersebut?';
export const BASE_CRITERIA = { city: 'Surabaya', location: 'Tandes', district: 'Tandes', village: null, category: 'RUMAH',
  max_price: 500000000, min_price: null, min_land_area_m2: null, max_land_area_m2: null, exclude_ids: ['114108'] };
const references = ['di area tersebut', 'di daerah yang sama', 'di kawasan itu', 'di wilayah tadi', 'di lokasi sebelumnya',
  'di kecamatan tersebut', 'di sana', 'disana', 'di situ', 'disitu', 'di sekitar aset tersebut', 'di area aset tadi'];
export const scenarios = [
  { name: 'Percakapan yang dilaporkan', messages: [OPENING, REPORTED, 'bebas'], expected: BASE_CRITERIA },
  ...references.map((phrase) => ({ name: `Rujukan: ${phrase}`, messages: [OPENING, `Ada yang lain ${phrase} pak, budget maksimal 500 juta?`, 'bebas'], expected: BASE_CRITERIA })),
  { name: 'Budget tertulis', messages: [OPENING, 'Ada pilihan lainnya di situ, anggaran lima ratus juta?', 'tidak ada'], expected: BASE_CRITERIA },
  { name: 'Jawaban lokasi singkat', messages: [OPENING, 'di sana pak', 'budget 500 juta, luas tanah bebas'], expected: BASE_CRITERIA },
  { name: 'Kriteria sekaligus', messages: [OPENING, 'Cari lelang rumah lain di area tersebut, budget 500 juta, luas tanah minimal 100 m2'], expected: { ...BASE_CRITERIA, min_land_area_m2: 100 } },
  { name: 'Budget dikoreksi setelah hasil', messages: [OPENING, REPORTED, 'bebas', 'budget saya naik jadi 600 juta'], expected: { ...BASE_CRITERIA, max_price: 600000000 } },
  { name: 'Jenis dikoreksi setelah hasil', messages: [OPENING, REPORTED, 'bebas', 'bukan rumah, saya maunya ruko'], expected: { ...BASE_CRITERIA, category: 'RUKO' } },
  { name: 'Luas dikoreksi setelah hasil', messages: [OPENING, REPORTED, 'bebas', 'luas tanah minimal 100 maksimal 150 m2'], expected: { ...BASE_CRITERIA, min_land_area_m2: 100, max_land_area_m2: 150 } },
  { name: 'Kelurahan baru lebih spesifik', messages: [OPENING, REPORTED, 'bebas', 'Cari lelang di kelurahan Manukan Kulon'], expected: { ...BASE_CRITERIA, village: 'Manukan Kulon' } },
  { name: 'Kecamatan baru mengalahkan rujukan', messages: [OPENING, 'Cari lelang alternatif di area tersebut, tapi pindah ke Rungkut, budget 500 juta', 'kelurahan bebas, luas tanah bebas'], expected: { ...BASE_CRITERIA, location: 'Rungkut', district: 'Rungkut' } },
  { name: 'Kota baru mengalahkan rujukan', messages: [OPENING, 'Cari lelang alternatif di area tersebut, tapi ganti ke seluruh Gresik, budget 500 juta, luas tanah bebas'], expected: { ...BASE_CRITERIA, city: 'Gresik', location: 'Gresik', district: null } },
  { name: 'Hasil kosong tetap menyimpan konteks', empty: true, messages: [OPENING, REPORTED, 'bebas', 'budget jadi 600 juta'], expected: { ...BASE_CRITERIA, max_price: 600000000 } },
  { name: 'Opsi lain tidak mengulang kartu sebelumnya', messages: [OPENING, REPORTED, 'bebas', 'Ada yang lain pak?'], expected: { ...BASE_CRITERIA, exclude_ids: ['114108', '900001', '900002', '900003'] }, emptyResult: true },
  { name: 'Pilih opsi kedua', messages: [OPENING, REPORTED, 'bebas', 'yang kedua, minta detailnya'], expected: BASE_CRITERIA, selectedId: '900002' },
  { name: 'Aset baru mengganti acuan', messages: [OPENING, REPORTED, 'bebas', 'Kode 900004', 'Cari lelang yang lain di daerah yang sama, budget 500 juta, luas tanah bebas'], expected: { ...BASE_CRITERIA, city: 'Sidoarjo', location: 'Waru', district: 'Waru', exclude_ids: ['900004'] }, emptyResult: true },
  { name: 'Rujukan tanpa riwayat', messages: ['Cari lelang rumah di area tersebut, budget 500 juta, luas tanah bebas'], pending: true, noKnownArea: true },
  { name: 'Rujukan dalam pencarian tanpa kode', messages: ['Cari lelang rumah di Tandes, Surabaya, kelurahan bebas, budget 500 juta, luas tanah bebas', 'Cari lelang di daerah yang sama, budget 400 juta'], expected: { ...BASE_CRITERIA, max_price: 400000000, exclude_ids: undefined } },
];

// Fictional inventory, reserved .example URLs, fixed date; never queries a live
// listing or sends a message. Real response routing and card rendering are used.
export function dialogueFixture({ empty = false, original = ORIGINAL } = {}) {
  const reads = [];
  const options = [1, 2, 3].map((n) => ({ ...ORIGINAL, id: `90000${n}`, limit_price: 350000000 + n * 10000000,
    full_address: `Jl. Contoh Simulasi ${n}, Tandes, Surabaya`, price_display: `Rp ${350 + n * 10}.000.000`,
    address: { ...ORIGINAL.address, street: `Jl. Contoh Simulasi ${n}` }, auction_at: '2026-11-20T10:00:00+07:00',
    detail_url: `https://properti.example/Lelang/simulasi-${n}-90000${n}` }));
  const next = { ...ORIGINAL, id: '900004', location: 'Waru, Sidoarjo', address: { city: 'Sidoarjo', district: 'Waru' } };
  const catalog = { async resolve(text, previousId, criteria) {
    reads.push({ text, previousId, criteria });
    const source = 'database_listing_publik';
    if (!criteria) {
      const id = /\b(?:kode)\s*[:* ]*([0-9]+)/i.exec(text)?.[1] || previousId;
      const asset = [original, ...options, next].find((item) => item?.id === id) || null;
      return { asset, catalog: [], status: asset ? 'matched' : 'not_found', source };
    }
    const candidates = empty ? [] : options.filter((item) => !criteria.exclude_ids?.includes(item.id) &&
      item.address.city.toLowerCase() === criteria.city.toLowerCase() &&
      item.address.district.toLowerCase() === criteria.location.toLowerCase() &&
      item.category === criteria.category && item.limit_price <= criteria.max_price &&
      (!criteria.min_land_area_m2 || item.specifications.land_area_m2 >= criteria.min_land_area_m2) &&
      (!criteria.max_land_area_m2 || item.specifications.land_area_m2 <= criteria.max_land_area_m2));
    return { asset: null, catalog: candidates, status: candidates.length ? 'recommendations' : 'not_found', source };
  } };
  const ai = { async generate() { assert.fail('Context and search simulations must not need a model'); } };
  return { catalog, ai, reads, options };
}

export async function simulateDialogue(scenario) {
  const fixture = dialogueFixture(scenario), history = [], transcript = [];
  let previousId = null, final;
  for (const text of scenario.messages) {
    history.push({ role: 'user', content: text });
    final = await generatePropertyReply({ ...fixture, text, history, previousId, now: NOW });
    previousId = final.asset?.id || null;
    assert.ok(final.reply, 'Every conversation turn receives a response');
    assert.doesNotMatch(final.reply, /area \*(?:Tersebut|Itu|Sana|Situ|Tadi|Sama|Ada pilihan)/i);
    history.push({ role: 'assistant', content: final.reply });
    transcript.push({ text, reply: final.reply, status: final.knowledge.status });
  }
  const queries = fixture.reads.filter((call) => call.criteria);
  if (scenario.pending) {
    assert.equal(queries.length, 0);
    assert.equal(final.knowledge.status, 'qualifying');
    if (scenario.noKnownArea) { assert.match(final.reply, /kota atau kabupaten mana/); assert.doesNotMatch(final.reply, /Tandes|Surabaya|Tersebut/); }
  } else {
    assert.ok(queries.length, 'Complete criteria must reach inventory');
    const criteria = queries.at(-1).criteria;
    for (const [key, value] of Object.entries(scenario.expected)) assert.deepEqual(criteria[key], value, key);
    assert.equal(criteria.funds, undefined, 'Budget is not proof of funds');
    assert.doesNotMatch(final.reply, /kelurahan mana|kecamatan mana|kota atau kabupaten mana|Berapa batas anggaran|Jenis properti apa/i);
    if (scenario.selectedId) {
      assert.equal(final.asset.id, scenario.selectedId);
      assert.equal(fixture.reads.at(-1).criteria, undefined);
      assert.match(final.reply, /DETAIL ASET/);
    }
    if (scenario.emptyResult || scenario.empty) assert.equal(final.knowledge.status, 'not_found');
  }
  if (scenario.messages.includes(REPORTED)) {
    const reply = transcript.find((turn) => turn.text === REPORTED).reply;
    for (const value of ['Tandes', 'Surabaya', '500.000.000', '114108']) assert.ok(reply.includes(value), value);
    assert.match(reply, /luas tanah/);
    assert.doesNotMatch(reply, /kota atau kabupaten mana|kelurahan mana/);
  }
  return { name: scenario.name, passed: true, queries: queries.map((q) => q.criteria), transcript };
}

import assert from 'node:assert/strict';
import { buyerContext } from '../../services/buyer_profile.js';
import { generatePropertyReply } from '../../services/property_reply.js';

const opening = ['Cari lelang aset di Kecamatan Menganti, Kabupaten Gresik', 'seluruh Menganti pak budget 400 juta'];
const ready = 'rumah dan toko, luas tanah minimal 100 maksimal 200 m2';
export function understandingScenarios({ count = 500, seed = 20261013 } = {}) {
  const cases = [
    ['asli', ['rumah dan toko pak. tidak ada batasan luasan'], ['RUMAH', 'TOKO'], null, null],
    ['terpisah', ['rumah pak', 'toko juga boleh', 'luas bebas'], ['RUMAH', 'TOKO'], null, null],
    ['tambah', [ready, 'tambahkan gudang juga'], ['RUMAH', 'TOKO', 'GUDANG'], 100, 200],
    ['hapus', [ready, 'toko jangan, rumah saja'], ['RUMAH'], 100, 200],
    ['hapus-satu', [ready, 'hapus toko dari pilihan'], ['RUMAH'], 100, 200],
    ['penolakan', [ready, 'nggak mau toko'], ['RUMAH'], 100, 200],
    ['hapus-semua', [ready, 'hapus rumah dan toko'], [], 100, 200, { pending: true }],
    ['ganti', [ready, 'bukan rumah atau toko, gudang aja'], ['GUDANG'], 100, 200],
    ['budget-koreksi', [ready, 'budget bukan 400 juta, tapi 350 juta'], ['RUMAH', 'TOKO'], 100, 200, { budget: 350000000 }],
    ['budget-shorthand', [ready, 'budgetnya 350jt aja'], ['RUMAH', 'TOKO'], 100, 200, { budget: 350000000 }],
    ['luas-koreksi', [ready, 'luas bukan 100-200 m2, tapi 120-180 m2'], ['RUMAH', 'TOKO'], 120, 180],
    ['luas-dilepas', [ready, 'ukuran tanah gak masalah'], ['RUMAH', 'TOKO'], null, null],
    ['semua-bebas', ['jenis sama luas dua-duanya bebas'], [], null, null],
    ['keduanya-bebas', ['keduanya bebas pak'], [], null, null],
    ['negasi-jenis-bebas', [ready, 'jangan jenis bebas'], ['RUMAH', 'TOKO'], 100, 200],
    ['ulang-kriteria', [ready, 'kriteria tetap seperti tadi'], ['RUMAH', 'TOKO'], 100, 200],
    ['tanya-jenis', [ready, 'apa bedanya rumah dan ruko?'], ['RUMAH', 'TOKO'], 100, 200, { hold: true, reply: 'ruko' }],
    ['tanya-luas', ['rumah pak', 'luas tanah itu apa?'], ['RUMAH'], null, null, { pending: true, hold: true, reply: 'bidang tanah' }],
    ['tanya-batas', [ready, 'kalau luasnya bebas maksudnya apa?'], ['RUMAH', 'TOKO'], 100, 200, { hold: true, reply: 'tanpa batas' }],
    ['jangan-tebak', ['rumah dan toko, luas belum tau'], ['RUMAH', 'TOKO'], null, null, { pending: true }],
    ['luas-ambigu', ['rumah dan toko, 120m2'], ['RUMAH', 'TOKO'], null, null, { pending: true, reply: 'minimal' }],
    ['jawab-arah-luas', ['rumah dan toko, 120m2', 'minimal pak'], ['RUMAH', 'TOKO'], 120, null],
    ['jawab-arah-maks', ['rumah dan toko, 120m2', 'maksimal'], ['RUMAH', 'TOKO'], null, 120],
    ['satu-bebas', ['bebas pak'], [], null, null, { pending: true }],
  ];
  const scenarios = cases.map(([name, messages, categories, min, max, rest]) => ({ name, group: 'dialogue', messages: [...opening, ...messages], categories, min, max, ...rest }));
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
  const pick = (array) => array[Math.floor(random() * array.length)];
  const types = ['rumah dan toko', 'rumah atau toko', 'rmh sm toko', 'rumah maupun toko', 'rumah + toko', 'rumah, toko', 'rumah dan juga toko', 'rumah & toko'];
  const lands = ['tidak ada batasan luasan', 'luas gpp', 'ukuran tanah terserah', 'luasnya bebas', 'luas ga masalah', 'tanpa batas luas tanah', 'luas berapapun boleh', 'luasnya tdk dibatasi', 'nggak ada patokan luas', 'luas besar kecil oke'];
  for (let i = 0; i < count; i++) {
    const type = pick(types), land = pick(lands), prefix = pick(['', 'saya pilih ', 'saya cari ']), suffix = pick([' pak', ' bu', '', ' kak']);
    const separator = pick([', ', '. ', '; ', '\n']);
    let text = random() < 0.5 ? `${prefix}${type}${suffix}${separator}${land}` : `${land}${separator}${prefix}${type}${suffix}`;
    if (random() < 0.15) text = text.toUpperCase();
    scenarios.push({ name: `variasi-${i + 1}`, group: 'random', messages: [...opening, text], categories: ['RUMAH', 'TOKO'], min: null, max: null });
  }
  return scenarios;
}

export async function runUnderstandingScenario(scenario) {
  const history = [], calls = [], transcript = [];
  const catalog = { async resolve(_text, _id, criteria) { calls.push(criteria); return { status: 'not_found', asset: null, catalog: [], source: 'simulation' }; } };
  const ai = { generate() { throw new Error('Unexpected model call'); } };
  let buyer, lastCalls = 0;
  try {
    for (const text of scenario.messages) {
      history.push({ role: 'user', content: text }); lastCalls = calls.length;
      const result = await generatePropertyReply({ text, history, catalog, ai });
      buyer = buyerContext(history, text, null);
      transcript.push({ user: text, reply: result.reply, profile: buyer.profile, missing: buyer.missing, queried: calls.length > lastCalls });
      history.push({ role: 'assistant', content: result.reply });
    }
    const profile = buyer.profile;
    assert.equal(profile.city, 'Kabupaten Gresik', 'city'); assert.equal(profile.location, 'Menganti', 'area');
    assert.equal(profile.district, 'Menganti', 'district'); assert.equal(profile.village, null, 'village');
    assert.equal(profile.max_price, scenario.budget || 400000000, 'budget');
    assert.deepEqual((profile.categories || (profile.category ? [profile.category] : [])).toSorted(), scenario.categories.toSorted(), 'categories');
    assert.equal(profile.min_land_area_m2, scenario.min, 'min land'); assert.equal(profile.max_land_area_m2, scenario.max, 'max land');
    if (scenario.pending || scenario.hold) assert.equal(calls.length, lastCalls, 'must clarify/explain before querying');
    else {
      assert.equal(buyer.stage, 'recommendations', `missing: ${buyer.missing}`); assert.ok(calls.length > lastCalls, 'must search');
      const criteria = calls.at(-1);
      assert.deepEqual((criteria.categories || (criteria.category ? [criteria.category] : [])).toSorted(), scenario.categories.toSorted(), 'query categories');
      assert.equal(criteria.district, profile.district, 'query district'); assert.equal(criteria.city, profile.city, 'query city');
      assert.equal(criteria.max_price, profile.max_price, 'query budget');
      assert.equal(criteria.min_land_area_m2, scenario.min, 'query min land'); assert.equal(criteria.max_land_area_m2, scenario.max, 'query max land');
    }
    if (scenario.reply) assert.ok(transcript.at(-1).reply.toLowerCase().includes(scenario.reply), 'reply must address actual question');
    return { name: scenario.name, group: scenario.group, passed: true, transcript };
  } catch (error) { return { name: scenario.name, group: scenario.group, passed: false, error: error.message, transcript }; }
}

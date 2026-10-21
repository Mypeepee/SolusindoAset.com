import assert from 'node:assert/strict';
import { buyerContext } from '../../services/buyer_profile.js';
import { generatePropertyReply } from '../../services/property_reply.js';

const opening = ['Cari lelang aset di Kecamatan Menganti, Kabupaten Gresik', 'seluruh Menganti pak budget 400 juta'];
const types = [
  ['rumah dan toko', ['RUMAH', 'TOKO']], ['rumah atau toko', ['RUMAH', 'TOKO']],
  ['rmh sama toko', ['RUMAH', 'TOKO']], ['rumah & toko', ['RUMAH', 'TOKO']],
  ['rumah/toko', ['RUMAH', 'TOKO']], ['ruko dan gudang', ['RUKO', 'GUDANG']],
  ['apartemen atau kos', ['APARTEMEN', 'KOS']], ['rumah toko', ['RUKO']],
  ['rumah', ['RUMAH']], ['toko', ['TOKO']], ['gudang', ['GUDANG']],
  ['bukan ruko tapi rumah dan toko', ['RUMAH', 'TOKO']],
];
const areas = [
  ['tidak ada batasan luasan', null, null], ['luas tanah bebas', null, null],
  ['luasnya nggak dibatasi', null, null], ['luasan ga ada batasan', null, null],
  ['gak ada patokan luas', null, null], ['bebas luasnya', null, null],
  ['ukuran tanah terserah', null, null], ['luas berapa aja boleh', null, null],
  ['luasnya tidak ada batas', null, null], ['lt min 100 max 200 m2', 100, 200],
  ['luasnya minimal seratus meter persegi', 100, null], ['luas tanah 100-200 m2', 100, 200],
];
export function languageScenarios({ count = 500, seed = 20261012 } = {}) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
  const pick = (values) => values[Math.floor(random() * values.length)];
  const scenarios = [{ name: 'Laporan asli Menganti', group: 'reported', messages: [...opening, 'rumah dan toko pak. tidak ada batasan luasan'], categories: ['RUMAH', 'TOKO'], min: null, max: null }];
  for (let i = 0; i < count; i++) {
    const [type, categories] = pick(types), [area, min, max] = pick(areas);
    const suffix = pick([' pak', ' bu', '', ' ya', ' kak']);
    const separator = pick([', ', '. ', '; ', '\n', ' ']);
    let text = random() < 0.5 ? `${type}${suffix}${separator}${area}` : `${area}${separator}${type}${suffix}`;
    if (random() < 0.2) text = text.toUpperCase();
    scenarios.push({ name: `Acak-${i + 1}`, group: 'random', messages: [...opening, text], categories, min, max });
  }
  for (const text of ['belum tahu pak', 'bebas pak', 'luas bangunan bebas', 'tidak ada budget', 'luas 120 m2',
    'rumah dan toko pak, luas minimal 200 maksimal 100 m2', 'rumah dan toko pak, luas belum tahu',
    'rumah dan toko pak, luas tidak bebas', 'rumah dan toko pak, luas bebas?',
    'rumah dan toko pak, budget bebas']) {
    scenarios.push({ name: `Perlu klarifikasi: ${text}`, group: 'guard', messages: [...opening, text], pending: true });
  }
  for (const [text, categories] of [
    ['ganti dari rumah dan toko ke gudang', ['GUDANG']],
    ['ganti dari rumah ke toko dan gudang', ['TOKO', 'GUDANG']],
    ['bukan rumah, toko saja', ['TOKO']], ['jenis bebas', []],
  ]) scenarios.push({ name: `Koreksi: ${text}`, group: 'correction', messages: [...opening, 'rumah dan toko, luas tanah minimal 100 m2', text], categories, min: 100, max: null });
  return scenarios;
}

export async function runLanguageScenario(scenario) {
  const history = [], calls = [], transcript = [];
  const catalog = { async resolve(_text, _previousId, criteria) {
    calls.push(criteria); return { status: 'not_found', asset: null, catalog: [], source: 'simulation' };
  } };
  const ai = { generate() { throw new Error('Qualification must not need an AI call'); } };
  let buyer;
  try {
    for (const text of scenario.messages) {
      history.push({ role: 'user', content: text });
      const response = await generatePropertyReply({ text, history, catalog, ai });
      buyer = buyerContext(history, text, null);
      transcript.push({ user: text, reply: response.reply, profile: buyer.profile, missing: buyer.missing });
      history.push({ role: 'assistant', content: response.reply });
    }
    assert.equal(buyer.profile.city, 'Kabupaten Gresik', 'city must persist');
    assert.equal(buyer.profile.district, 'Menganti', 'district must persist');
    assert.equal(buyer.profile.location, 'Menganti', 'area must persist');
    assert.equal(buyer.profile.village, null, 'whole district must persist');
    assert.equal(buyer.profile.max_price, 400000000, 'budget must persist');
    if (scenario.pending) {
      assert.equal(buyer.stage, 'qualifying'); assert.equal(calls.length, 0);
    } else {
      assert.equal(buyer.stage, 'recommendations', `missing ${buyer.missing.join(', ')}`);
      const criteria = calls.at(-1);
      assert.ok(criteria, 'must query catalog');
      assert.deepEqual((criteria.categories || (criteria.category ? [criteria.category] : [])).toSorted(), scenario.categories.toSorted());
      assert.equal(criteria.min_land_area_m2, scenario.min); assert.equal(criteria.max_land_area_m2, scenario.max);
      assert.doesNotMatch(transcript.at(-1).reply, /Jenis properti apa|Apakah Bapak\/Ibu memiliki batas luas/);
    }
    return { name: scenario.name, group: scenario.group, passed: true, transcript, calls };
  } catch (error) {
    return { name: scenario.name, group: scenario.group, passed: false, error: error.message, transcript, calls };
  }
}

export function summarizeLanguageResults(results) {
  const total = results.length, passed = results.filter((r) => r.passed).length;
  // Wilson score interval describes sampling from this synthetic generator,
  // not confidence that arbitrary production conversations will succeed.
  const random = results.filter((r) => r.group === 'random'), n = random.length;
  const p = n ? random.filter((r) => r.passed).length / n : 0, z = 1.959963984540054;
  const center = (p + z * z / (2 * n)) / (1 + z * z / n);
  const margin = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n);
  return { total, passed, failed: total - passed, success_percent: 100 * passed / total,
    random_sample: { n, success_percent: p * 100, wilson_95_percent: n ? [100 * (center - margin), 100 * (center + margin)] : null },
    groups: Object.fromEntries([...new Set(results.map((r) => r.group))].map((group) => {
      const subset = results.filter((r) => r.group === group);
      return [group, { total: subset.length, passed: subset.filter((r) => r.passed).length }];
    })) };
}

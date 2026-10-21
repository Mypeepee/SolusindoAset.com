import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buyerContext } from '../services/buyer_profile.js';
import { generatePropertyReply } from '../services/property_reply.js';

// Exercise actual reply/context logic without AI, external messages, or invented
// property facts. The stub records filters and returns an empty public catalog.
const wholeCity = [
  'pokoknya di gresik pak , budget saya 1m', 'Gresik aja pak 1M', 'intinya Gresik, budget satu miliar',
  'yang penting masih di Gresik, dana 1 miliar', 'kecamatannya terserah asal di Gresik, budget 1m',
  'bebas kecamatan pak, budget 1m', 'dimana aja boleh, dana satu miliar', 'semua Gresik, budget 1m',
  'di mana saja asal Gresik, 1m', 'Gresik mana pun boleh, anggaran 1.000.000.000',
  'lokasinya terserah pak, mentok satu milyar', 'nggak masalah kecamatannya pak, budget 1m',
];
const landAnswers = [
  ['tidak ada', null, null], ['terserah pak', null, null], ['luas tanah berapa aja', null, null],
  ['minimal 120 m2', 120, null], ['luasnya minimal seratus dua puluh meter persegi', 120, null],
  ['minimal 100 m2 maksimal 200 m2', 100, 200],
];
const scenarios = wholeCity.flatMap((scope, i) => landAnswers.map(([land, min, max], j) => ({
  name: `Gresik-${i + 1}-luas-${j + 1}`, messages: ['Cari lelang ruko di Gresik', scope, land],
  expected: { city: 'Gresik', location: 'Gresik', district: null, village: null, category: 'RUKO', max_price: 1e9, min_land_area_m2: min, max_land_area_m2: max },
})));
const waruReplies = ['pokoknya Waru aja pak, budget 600 juta', 'intinya di Waru, budget enam ratus juta',
  'kelurahannya terserah, anggaran 600jt', 'semua kelurahan di Waru pak, budget 600 juta',
  'di mana aja asal masih Waru, dana 600 juta', 'desa bebas pak, budget 600 juta'];
scenarios.push(...waruReplies.map((reply, i) => ({ name: `Waru-${i + 1}`, messages: ['Cari lelang ruko di Kecamatan Waru, Sidoarjo', reply, 'minimal 120 m2'],
  expected: { city: 'Sidoarjo', location: 'Waru', district: 'Waru', village: null, category: 'RUKO', max_price: 600000000, min_land_area_m2: 120 } })));
for (const city of ['Surabaya', 'Kabupaten Sidoarjo', 'Jakarta Selatan', 'Kota Bandung']) scenarios.push({
  name: `Kota-${city}`, messages: [`Cari lelang gudang di ${city}`, `pokoknya ${city} aja pak, budget 2M, luas tanah minimal 200 m2`],
  expected: { city, location: city, district: null, village: null, category: 'GUDANG', max_price: 2e9, min_land_area_m2: 200 },
});
for (const [i, text] of [
  'Cari lelang ruko di seluruh Gresik, budget satu miliar, luas tanah minimal 120 m2',
  'Budget 1m, saya cari lelang ruko di seluruh Gresik, LT minimal 120 m2',
  'LT minimal 120 m2, budget 1M, cari lelang ruko di seluruh Gresik',
  'Cari lelang ruko di Gresik, seluruh kecamatan boleh, budget 1M, luas tanah minimal 120 m2',
].entries()) scenarios.push({ name: `Semua-kriteria-${i + 1}`, messages: [text], expected: { city: 'Gresik', location: 'Gresik', district: null, village: null, category: 'RUKO', max_price: 1e9, min_land_area_m2: 120 } });
scenarios.push(
  { name: 'Jenis-lalu-luas', messages: ['Cari lelang aset di Gresik', wholeCity[0], 'ruko pak', 'tidak ada'], expected: { city: 'Gresik', location: 'Gresik', category: 'RUKO', max_price: 1e9, min_land_area_m2: null } },
  { name: 'Bebas-hanya-satu-pertanyaan', messages: ['Cari lelang aset di seluruh Gresik budget 1M', 'bebas pak', 'terserah pak'], expected: { city: 'Gresik', location: 'Gresik', category: null, max_price: 1e9, min_land_area_m2: null } },
  { name: 'Koreksi-jenis', messages: ['Cari lelang rumah di seluruh Gresik budget 1M luas tanah bebas', 'bukan rumah, saya maunya gudang'], expected: { city: 'Gresik', location: 'Gresik', category: 'GUDANG', max_price: 1e9 } },
  { name: 'Koreksi-budget', messages: ['Cari lelang ruko di seluruh Gresik budget 1M luas tanah bebas', 'naikkan budget jadi satu setengah miliar'], expected: { city: 'Gresik', location: 'Gresik', category: 'RUKO', max_price: 1.5e9 } },
  { name: 'Kota-belum-jelas', messages: ['Cari lelang rumah di Bandung budget 1M luas tanah bebas'], pending: true },
  { name: 'Area-belum-dipilih', messages: ['Cari lelang ruko di Gresik', 'belum tahu pak', 'budget 1M', 'minimal 120 m2'], pending: true },
  { name: 'Luas-tanpa-arah', messages: ['Cari lelang rumah di seluruh Surabaya budget 350 juta', '120 m2'], pending: true },
  { name: 'Batas-luas-terbalik', messages: ['Cari lelang ruko di seluruh Gresik budget 1M', 'minimal 200 m2 maksimal 100 m2'], pending: true },
);

// Category and land are asked together here. A complete answer must update
// both fields even though the land question is second, without replacing area.
const rungkutStart = ['saya ingin mencari lelang aset di daerah rungkut pak', 'pokoknya rungkut pak, budget mentok saya di angka 1 m'];
const combinedAnswers = [
  ['saya mencari JENIS pak, luasnya ya 100 - 120 m lah', 100, 120],
  ['JENIS pak, luasnya 100–120 meter', 100, 120],
  ['cari JENIS dong, luas 100 sampe 120 m2', 100, 120],
  ['luasnya antara 100 dan 120 meter, saya mencari JENIS', 100, 120],
  ['saya cari JENIS, tanahnya minimal 100 maksimal 120 m', 100, 120],
  ['saya mencari JENIS pak, 100-120 m', 100, 120],
  ['JENIS aja, 100 s/d 120', 100, 120],
  ['JENIS, luas tanah seratus sampai seratus dua puluh meter persegi', 100, 120],
  ['luasnya minimal seratus meter persegi, saya cari JENIS pak', 100, null],
  ['saya mencari JENIS, luasnya maksimal 120 m', null, 120],
  ['saya cari JENIS, luasnya persis 110 meter', 110, 110],
  ['JENIS pak, luas tanah bebas', null, null],
  ['luas tanah terserah, JENIS aja pak', null, null],
  ['JENIS, LB 80 m2, luas tanah 100-120 m2', 100, 120],
  ['JENIS, luas bangunannya 80 m, luas tanah 100-120 m', 100, 120],
  ['JENIS, luas tanah 100-120 m2, LB 80 m2', 100, 120],
];
for (const [type, category] of [['rumah', 'RUMAH'], ['ruko', 'RUKO'], ['gudang', 'GUDANG']]) {
  for (const [i, [answer, min, max]] of combinedAnswers.entries()) scenarios.push({
    name: `Rungkut-${type}-gabungan-${i + 1}`, messages: [...rungkutStart, answer.replaceAll('JENIS', type)],
    expected: { city: 'Surabaya', location: 'Rungkut', district: 'Rungkut', village: null, category,
      max_price: 1e9, min_price: null, min_land_area_m2: min, max_land_area_m2: max },
  });
}
for (const [i, answer] of ['saya mencari lelang rumah, luasnya sekitar 100 m', 'saya mencari lelang rumah, luasnya ya 120-100 m',
  'rumah pak, luasnya belum tahu', 'saya mencari lelang rumah, luasnya di angka 100 m', 'rumah, LB 100-120 m'].entries()) {
  scenarios.push({ name: `Rungkut-luas-klarifikasi-${i + 1}`, messages: [...rungkutStart, answer], pending: true,
    expected: { city: 'Surabaya', location: 'Rungkut', district: 'Rungkut', village: null, category: 'RUMAH', max_price: 1e9 } });
}
for (const [i, answer] of ['saya cari lelang rumah di Medokan Ayu, luasnya 100-120 m',
  'luasnya 100-120 m, saya mencari lelang rumah di Medokan Ayu', 'rumah, luasnya 100-120 m di Medokan Ayu'].entries()) scenarios.push({
  name: `Rungkut-kelurahan-baru-${i + 1}`, messages: [...rungkutStart, answer],
  expected: { city: 'Surabaya', location: 'Rungkut', district: 'Rungkut', village: 'Medokan Ayu', category: 'RUMAH',
    max_price: 1e9, min_land_area_m2: 100, max_land_area_m2: 120 },
});
for (const [i, answer] of ['rumah, luasnya 100-120 m, budget 900 juta',
  'budget 900 juta, rumah pak, luasnya 100-120 m', 'luasnya 100-120 m, budget sembilan ratus juta, saya mencari lelang rumah'].entries()) scenarios.push({
  name: `Rungkut-koreksi-budget-${i + 1}`, messages: [...rungkutStart, answer],
  expected: { city: 'Surabaya', location: 'Rungkut', district: 'Rungkut', village: null, category: 'RUMAH',
    max_price: 9e8, min_price: null, min_land_area_m2: 100, max_land_area_m2: 120 },
});

const results = [];
for (const scenario of scenarios) {
  const history = [], calls = [], transcript = [];
  let final;
  const catalog = { async resolve(_text, _id, criteria) { calls.push(criteria); return { asset: null, catalog: [], status: 'not_found', source: 'database_listing_publik' }; } };
  const ai = { generate() { throw new Error('Unexpected model call'); } };
  try {
    for (const text of scenario.messages) {
      history.push({ role: 'user', content: text });
      const result = await generatePropertyReply({ catalog, ai, text, history });
      final = buyerContext(history, text, null);
      history.push({ role: 'assistant', content: result.reply }); transcript.push({ text, reply: result.reply });
      assert.ok(result.reply, 'Every qualification message must receive a response');
      assert.doesNotMatch(result.reply, /untuk dihuni|dihuni sendiri, investasi|dua tujuan/i);
    }
    if (scenario.pending) {
      assert.equal(calls.length, 0, 'Unconfirmed criteria must not query inventory');
      assert.equal(final.stage, 'qualifying');
      for (const [key, expected] of Object.entries(scenario.expected || {})) {
        assert.equal(typeof expected === 'string' ? final.profile[key]?.toLowerCase() : final.profile[key], typeof expected === 'string' ? expected.toLowerCase() : expected, key);
      }
      if (scenario.name.startsWith('Rungkut-')) assert.doesNotMatch(transcript.at(-1).reply, /kelurahan mana|kecamatan mana|kota atau kabupaten mana|Berapa batas anggaran|Jenis properti apa/i);
    } else {
      assert.ok(calls.length, 'Confirmed criteria must query inventory');
      const actual = calls.at(-1);
      for (const [key, expected] of Object.entries(scenario.expected)) {
        assert.equal(typeof expected === 'string' ? actual[key]?.toLowerCase() : actual[key], typeof expected === 'string' ? expected.toLowerCase() : expected, key);
      }
      assert.equal(final.stage, 'recommendations');
      assert.doesNotMatch(transcript.at(-1).reply, /kelurahan mana|kecamatan mana|kota atau kabupaten mana|Berapa batas anggaran|Jenis properti apa/i, 'Do not ask confirmed criteria again');
    }
    results.push({ name: scenario.name, passed: true, criteria: calls.at(-1) || null, transcript });
  } catch (error) { results.push({ name: scenario.name, passed: false, reason: error.message, transcript }); }
}
const failed = results.filter((result) => !result.passed);
const reportPath = '/tmp/kosku-buyer-simulations.json';
await writeFile(reportPath, JSON.stringify({ simulated_inventory: true, scenarios: results.length, passed: results.length - failed.length, results }, null, 2));
console.log(`${results.length - failed.length}/${results.length} simulasi percakapan lulus. Laporan: ${reportPath}`);
for (const result of failed) console.error(`${result.name}: ${result.reason}`);
if (failed.length) process.exitCode = 1;

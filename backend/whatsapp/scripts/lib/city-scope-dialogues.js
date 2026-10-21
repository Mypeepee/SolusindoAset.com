import assert from 'node:assert/strict';
import { buyerContext } from '../../services/buyer_profile.js';
import { generatePropertyReply } from '../../services/property_reply.js';
import { getPropertyKnowledge } from '../../../../src/lib/chatbot/property-knowledge.ts';

export const REPORTED_OPENING = 'selamat siang pak, saya sedang mencari lelang pabrik di mojokerto dengan budget maksimal di 50 miliar pak, apakah ada?';
export const REPORTED_CHOICE = 'pokoknya mojokerto pak, boleh kota, boleh kabupaten';
export const PAIR_NAMES = ['Mojokerto', 'Malang', 'Bandung', 'Bogor', 'Bekasi', 'Pasuruan', 'Probolinggo', 'Kediri',
  'Madiun', 'Blitar', 'Magelang', 'Semarang', 'Tegal', 'Pekalongan', 'Sukabumi', 'Cirebon', 'Tasikmalaya',
  'Serang', 'Tangerang', 'Bima', 'Kupang', 'Jayapura', 'Solok'];
const start = (name) => `Cari lelang pabrik di ${name} budget 50 miliar`;
const end = 'luas tanah bebas';
export const scenarios = [
  { name: 'Percakapan Mojokerto yang dilaporkan', messages: [REPORTED_OPENING, REPORTED_CHOICE, end], city: 'Mojokerto', both: true },
  ...PAIR_NAMES.flatMap((city) => [
    { name: `${city}: keduanya`, messages: [start(city), 'keduanya pak', end], city, both: true },
    { name: `${city}: kedua wilayah sejak awal`, messages: [`Cari lelang pabrik di Kota ${city} dan Kabupaten ${city}, budget 50 miliar, luas tanah bebas, apakah ada?`], city, both: true },
    { name: `${city}: hanya kota`, messages: [start(city), 'kota saja pak', 'seluruh kota, luas tanah bebas'], city: `Kota ${city}` },
    { name: `${city}: hanya kabupaten`, messages: [start(city), 'kabupatennya saja', 'seluruh kabupaten, luas tanah bebas'], city: `Kabupaten ${city}` },
  ]),
  ...['dua-duanya pak', 'dua duanya boleh', 'dua2nya', 'kota maupun kabupaten', 'kota atau kabupaten bebas',
    'kabupaten maupun kota boleh', 'bebas pak', 'terserah pak', 'mana saja boleh', 'Mojokerto mana aja',
    'pokoknya semua Mojokerto', 'kota atau kabupaten nggak masalah', 'boleh kota, boleh kab.',
    'dua-duanya, budget 50 miliar'].map((choice) => ({ name: `Variasi: ${choice}`, messages: [start('Mojokerto'), choice, end], city: 'Mojokerto', both: true })),
  ...['budget 40 miliar', 'luas tanah bebas', 'jenis bebas', 'belum tahu pak', 'belum yakin', 'keduanya?',
    'kota atau kabupaten?', 'apa bedanya kota dan kabupaten?', 'bukan keduanya', 'tidak mau kota maupun kabupaten',
    'Mojokerto pak', 'boleh pak', 'belum mau pilih kota'].map((answer) => ({ name: `Belum memilih: ${answer}`, messages: [start('Mojokerto'), answer], pending: true })),
  { name: 'Budget dikoreksi setelah kedua wilayah dipilih', messages: [start('Mojokerto'), 'keduanya', end, 'budget jadi 40 miliar'], city: 'Mojokerto', both: true, maxPrice: 40e9 },
  { name: 'Jenis dikoreksi setelah pencarian', messages: [start('Mojokerto'), 'keduanya', end, 'bukan pabrik, saya cari lelang gudang'], city: 'Mojokerto', both: true, category: 'GUDANG' },
  { name: 'Nama yang sama tidak membuka klarifikasi ulang', messages: [start('Mojokerto'), 'keduanya', end, 'Cari lelang di Mojokerto saja'], city: 'Mojokerto', both: true },
  { name: 'Rujukan area mempertahankan kedua wilayah', messages: [start('Mojokerto'), 'keduanya', end, 'Ada yang lain di daerah tersebut?'], city: 'Mojokerto', both: true },
  { name: 'Persempit kedua wilayah menjadi kota', messages: [start('Mojokerto'), 'keduanya', end, 'kotanya aja pak'], city: 'Kota Mojokerto' },
  { name: 'Persempit kedua wilayah menjadi kabupaten', messages: [start('Mojokerto'), 'keduanya', end, 'bukan kota, kabupaten saja'], city: 'Kabupaten Mojokerto' },
  { name: 'Penolakan kabupaten dengan bahasa informal', messages: [start('Mojokerto'), 'keduanya', end, 'bukan kabupatennya, kotanya boleh'], city: 'Kota Mojokerto' },
  { name: 'Kecamatan Puri mempersempit ke kabupaten', messages: [start('Mojokerto'), 'keduanya', end, 'di Kecamatan Puri', 'kelurahan bebas'], city: 'Kabupaten Mojokerto', location: 'Puri', district: 'Puri' },
  { name: 'Kecamatan Magersari mempersempit ke kota', messages: [start('Mojokerto'), 'keduanya', end, 'di Kecamatan Magersari', 'kelurahan bebas'], city: 'Kota Mojokerto', location: 'Magersari', district: 'Magersari' },
  { name: 'Nama baru mengganti pilihan sebelumnya', messages: [start('Mojokerto'), 'boleh Kota Malang dan Kabupaten Malang', end], city: 'Malang', both: true },
  { name: 'Bandung Barat tidak digabung dengan Bandung', messages: [start('Bandung'), 'keduanya', end, 'Ganti ke seluruh Kabupaten Bandung Barat'], city: 'Kabupaten Bandung Barat' },
  { name: 'Kecamatan ambigu tidak otomatis digabung', messages: ['Cari lelang pabrik di Kecamatan Taman budget 50 miliar', 'keduanya', end], pending: true },
  { name: 'Nama kota tidak tersedia dalam percakapan baru', messages: ['Cari lelang pabrik, boleh kota dan kabupaten, budget 50 miliar, luas tanah bebas'], pending: true },
];

export function cityFilterValues(query) {
  const clause = query.where.AND.find((item) => item.kota?.in?.length && item.kota.mode === 'insensitive');
  assert.ok(clause, 'Database must restrict the exact city/regency values');
  return clause.kota.in.map((name) => name.trim().toLowerCase());
}

export function fixture() {
  const queries = [], criteria = [];
  const db = { listing: { async findMany(query) { queries.push(query); return []; } } };
  const catalog = { async resolve(text, previousId, filters) {
    assert.ok(filters, 'These dialogues qualify before searching inventory');
    criteria.push(filters);
    const result = await getPropertyKnowledge(db, { text, previousId, criteria: filters });
    return { ...result, catalog: result.candidates };
  } };
  const ai = { generate() { assert.fail('Geographic qualification and search must not depend on AI'); } };
  return { catalog, ai, queries, criteria };
}

export async function simulateCityScope(scenario) {
  const f = fixture(), history = [], transcript = [];
  let buyer;
  for (const text of scenario.messages) {
    history.push({ role: 'user', content: text });
    const result = await generatePropertyReply({ ...f, text, history });
    buyer = buyerContext(history, text, null);
    assert.ok(result.reply);
    transcript.push({ text, reply: result.reply, profile: buyer.profile, scope: buyer.city_scope, missing: buyer.missing });
    history.push({ role: 'assistant', content: result.reply });
  }
  if (scenario.pending) {
    assert.equal(f.queries.length, 0, 'Unresolved choices must not search');
    assert.equal(buyer.stage, 'qualifying'); assert.equal(buyer.city_scope, null);
  } else {
    assert.equal(buyer.stage, 'recommendations'); assert.equal(buyer.region_clarification, null);
    assert.equal(buyer.profile.city, scenario.city); assert.equal(buyer.profile.category, scenario.category || 'PABRIK');
    assert.equal(buyer.profile.location, scenario.location || scenario.city);
    assert.equal(buyer.profile.district, scenario.district || null);
    assert.equal(buyer.profile.max_price, scenario.maxPrice || 50e9);
    assert.ok(f.queries.length);
    const query = f.queries.at(-1), values = cityFilterValues(query);
    assert.equal(query.where.kategori, scenario.category || 'PABRIK'); assert.equal(query.where.status_tayang, 'TERSEDIA');
    assert.ok(JSON.stringify(query.where).includes(`"lte":${scenario.maxPrice || 50e9}`));
    if (scenario.both) {
      assert.deepEqual(new Set(buyer.city_scope.cities), new Set([`Kota ${scenario.city}`, `Kabupaten ${scenario.city}`]));
      assert.ok(values.includes(`kota ${scenario.city}`.toLowerCase()));
      assert.ok(values.includes(`kab. ${scenario.city}`.toLowerCase()));
      assert.ok(transcript.at(-1).reply.includes(`Kota dan Kabupaten ${scenario.city}`));
      assert.ok(!values.includes(`kabupaten ${scenario.city} barat`.toLowerCase()));
    } else {
      assert.equal(buyer.city_scope, null);
      assert.ok(values.includes(scenario.city.toLowerCase()));
      const other = scenario.city.startsWith('Kota ') ? scenario.city.replace(/^Kota /, 'Kabupaten ') : scenario.city.replace(/^Kabupaten /, 'Kota ');
      assert.ok(!values.includes(other.toLowerCase()), `Do not include ${other}`);
    }
    assert.doesNotMatch(transcript.at(-1).reply, /memilih kota atau kabupaten|kawasan atau kecamatan mana|kelurahan mana|Berapa batas anggaran|Jenis properti apa/);
  }
  return { name: scenario.name, passed: true, criteria: f.criteria.at(-1) || null, transcript };
}

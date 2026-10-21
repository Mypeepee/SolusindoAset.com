import assert from 'node:assert/strict';
import { getPropertyKnowledge } from '../../../../src/lib/chatbot/property-knowledge.ts';
import { generatePropertyReply } from '../../services/property_reply.js';
import { recommendationIds } from '../../services/recommendations.js';
import { DatabaseCatalog } from '../../services/property_database.js';

export const NOW = Date.parse('2026-10-12T10:00:00Z');
export const OPENING = 'Cari lelang pabrik di Kota Mojokerto dan Kabupaten Mojokerto, budget maksimal 50 miliar, luas tanah bebas';
export const REPORTED = 'adakah selain ketiga ini';
export const REPORTED_PROPERTY_REQUEST = 'adakah selain property tersebut?';
export const ALTERNATIVE_PHRASES = [REPORTED_PROPERTY_REQUEST, 'adakah selain properti tersebut?', 'adakah selain properties tersebut?',
  'selain property2 tersebut ada lagi?', 'ada selain properti-properti tadi?', 'aset-aset lainnya ada?',
  'coba opsi berikutnya', 'tampilkan 5 berikutnya', 'lihat pilihan selanjutnya', 'lanjut ke daftar berikutnya',
  'lanjut', 'next dong', 'masih ada lagi?', 'ada lagi pak?', 'boleh lihat yang berbeda?',
  'properti lainnya dong', 'carikan property yang lain', 'selain kelima property tersebut ada lagi?',
  'yang tadi kurang cocok, ada opsi lain?', 'jangan yang tadi, carikan yang lain'];
export const REPORTED_FIVE_IDS = ['121815', '121192', '119036', '121455', '118874'];
const reportedLinks = [
  'https://solusindoaset.com/Lelang/rumah-kav-26-b-gununganyar-tambak-gununganyar-surabaya-124966-121815',
  'https://solusindoaset.com/Lelang/ruko-klampisngasem-sukolilo-kota-surabaya-jawa-timur-surabaya-124343-121192',
  'https://solusindoaset.com/Lelang/rumah-puri-mas-ubud-2-f-17-surabaya-122186-119036',
  'https://solusindoaset.com/Lelang/rumah-ploso-baru-selatan-vi-73-ploso-surabaya-124606-121455',
  'https://solusindoaset.com/Lelang/rumah-ploso-tambaksari-kota-surabaya-jawa-timur-surabaya-122024-118874',
];
// The reported public URLs are ID pointers only, never source property facts.
export const reportedFiveHistory = () => [{ role: 'user', content: OPENING }, { role: 'assistant', content:
  `Berikut lima listing dari percakapan sebelumnya.\n\n${reportedLinks.map((url, i) => `${i + 1}\\. **Listing terdahulu ${i + 1}**\n  Lihat detail: [**Buka detail properti ↗**](${url})`).join('\n')}\n\nAda yang menarik?` }];
const legacyLinks = [
  'https://solusindoaset.com/Lelang/pabrik-pemuda-81-ngrame-pungging-mojokerto-jawa-mojokerto-122306-119156',
  'https://solusindoaset.com/Lelang/pabrik-ngrame-pungging-mojokerto-mojokerto-103270-100150',
  'https://solusindoaset.com/Lelang/pabrik-komplek-ngoro-industri-park-c2-02-mojokerto-73966-71800',
];
export const LEGACY_IDS = ['119156', '100150', '71800'];
export const legacyHistory = () => [{ role: 'user', content: OPENING }, { role: 'assistant',
  content: `Berikut pilihan yang masih ditayangkan sebagai **Tersedia**; hasil lelang perlu dikonfirmasi tim.\n\n${legacyLinks.map((url, i) => `• **Pabrik dari daftar sebelumnya ${i + 1}**\n  Lihat detail: [**Buka detail properti ↗**](${url})`).join('\n')}\n\nProperti mana yang ingin Bapak/Ibu bahas lebih lanjut?` }];

// Evaluate the actual bounded Prisma predicates against fictional inventory.
// No network, production database, AI call or outbound WhatsApp is involved.
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((v) => matches(row, v));
    if (key === 'OR') return value.some((v) => matches(row, v));
    const field = row[key];
    if (value == null || typeof value !== 'object') return field === value;
    return Object.entries(value).every(([operator, operand]) => {
      const normalize = (v) => value.mode === 'insensitive' ? String(v ?? '').toLowerCase() : String(v ?? '');
      switch (operator) {
        case 'mode': return true;
        case 'equals': return field != null && normalize(field) === normalize(operand);
        case 'contains': return field != null && normalize(field).includes(normalize(operand));
        case 'startsWith': return field != null && normalize(field).startsWith(normalize(operand));
        case 'some': return (field || []).some((item) => matches(item, operand));
        case 'in': return field != null && operand.some((item) => normalize(item) === normalize(field));
        case 'notIn': return !operand.includes(field);
        case 'not': return field !== operand;
        case 'gt': return field != null && field > operand;
        case 'gte': return field != null && field >= operand;
        case 'lte': return field != null && field <= operand;
        default: throw new Error(`Unsupported simulation predicate: ${operator}`);
      }
    });
  });
}

export function fixture({ count = 12, legacy = false, reportedFive = false, upcoming = false, long = false } = {}) {
  const ids = [...(reportedFive ? REPORTED_FIVE_IDS : legacy ? LEGACY_IDS : []), ...Array.from({ length: count }, (_, i) => String(920001 + i))];
  const rows = ids.map((id, i) => ({ id_property: BigInt(id), slug: `pabrik-simulasi-${i + 1}`, judul: `Pabrik simulasi ${i + 1}`,
    jenis_transaksi: 'LELANG', kategori: 'PABRIK', status_tayang: 'TERSEDIA', bukan_properti: false,
    kota: i % 2 ? 'Kota Mojokerto' : 'Kabupaten Mojokerto', provinsi: 'Jawa Timur',
    alamat_lengkap: `Jl. ${long ? 'Kawasan Contoh '.repeat(33) : 'Contoh Simulasi '}No. ${i + 1}`, luas_tanah: 3000, legalitas: 'SHM',
    harga: 10e9, harga_efektif: 10e9, nilai_limit_lelang: 10e9,
    tanggal_lelang: new Date(NOW + (upcoming ? 7 : -7) * 86400000), tanggal_diupdate: new Date(NOW - i * 1000),
    ...(long ? { slug: `pabrik-${'simulasi-'.repeat(40)}${i + 1}` } : {}) }));
  // These would appear if a subsequent request silently dropped its filters.
  rows.push(...[{ kota: 'Kota Surabaya' }, { kategori: 'RUMAH' }, { nilai_limit_lelang: 60e9 },
    { status_tayang: 'TERJUAL' }, { bukan_properti: true }].map((changes, i) => ({ ...rows[0], id_property: BigInt(930001 + i), ...changes })));
  const queries = [], criteria = [];
  const db = { listing: { async findMany(query) {
    queries.push(query);
    return rows.filter((row) => matches(row, query.where)).slice(0, query.take);
  } }, listingSekitar: { async findUnique() { return null; } }, listingTempat: { async findMany() { return []; } },
    listingSewaDetail: { async findUnique() { return null; } } };
  const catalog = new DatabaseCatalog({ url: 'https://database.example/context', token: 'simulation', timeoutMs: 5000 }, {
    async fetchImpl(_url, request) {
      const input = JSON.parse(request.body);
      if (input.criteria) criteria.push(input.criteria);
      return Response.json(await getPropertyKnowledge(db, input, NOW));
    },
  });
  return { catalog, criteria, queries, ai: { generate() { assert.fail('Recommendation dialogue should not require AI'); } } };
}

export const scenarios = [
  ...ALTERNATIVE_PHRASES.map((text) => ({ name: `Permintaan berikutnya: ${text}`, messages: [OPENING, text], expected: [5, 5] })),
  { name: 'Lima tautan persis laporan dengan kata property', reportedFive: true, messages: [REPORTED_PROPERTY_REQUEST], expected: [5] },
  { name: 'Permintaan property yang sama berturut-turut sampai inventori habis', messages: [OPENING,
    REPORTED_PROPERTY_REQUEST, REPORTED_PROPERTY_REQUEST, REPORTED_PROPERTY_REQUEST], expected: [5, 5, 2, 0] },
  ...[REPORTED, 'adakah selain ketiganya?', 'selain 3 ini ada pak?', 'ada selain ketiga properti tersebut?',
    'ada yang lain pak?', 'yang lain lagi pak', 'cari yang lainnya', 'selain daftar ini',
    'selain semua yang tadi', 'ada selain ini pak?'].map((text) => ({ name: text, legacy: true, messages: [text], expected: [5] })),
  { name: 'Maksimal lima, kemudian lima baru, sisa dua, lalu habis', messages: [OPENING, 'selain kelima ini', 'adakah selain kelimanya?', 'yang lain lagi', REPORTED], expected: [5, 5, 2, 0, 0] },
  { name: 'Hanya dua hasil tersedia', count: 2, messages: [OPENING, 'selain kedua ini'], expected: [2, 0] },
  { name: 'Daftar lama tiga, hanya satu alternatif tersisa', legacy: true, count: 1, messages: [REPORTED], expected: [1] },
  { name: 'Daftar lama tiga, tanpa alternatif', legacy: true, count: 0, messages: [REPORTED], expected: [0] },
  { name: 'Budget baru tetap mengecualikan daftar yang ditolak', messages: [OPENING, 'yang lain lagi', 'budget jadi 40 miliar'], expected: [5, 5, 5], repeatsAllowed: true, maxPrice: 40e9 },
  { name: 'Lelang mendatang juga lima lalu sisa dua', upcoming: true, count: 7, messages: [OPENING, 'selain 5 ini'], expected: [5, 2] },
  { name: 'Lima alamat panjang dikirim lengkap, lalu lima alternatif baru', long: true, messages: [OPENING, REPORTED], expected: [5, 5] },
];

export async function simulateRecommendations(scenario) {
  const f = fixture(scenario), history = scenario.reportedFive ? reportedFiveHistory() : scenario.legacy ? legacyHistory() : [], transcript = [];
  const seen = new Set(scenario.reportedFive ? REPORTED_FIVE_IDS : scenario.legacy ? LEGACY_IDS : []);
  let previousId = null;
  for (const [index, text] of scenario.messages.entries()) {
    history.push({ role: 'user', content: text });
    const result = await generatePropertyReply({ ...f, history, text, previousId, now: NOW });
    previousId = result.asset?.id || null;
    assert.ok(result.reply, text);
    const replies = result.replies || [result.reply], combined = replies.join('\n\n');
    const ids = recommendationIds(combined);
    assert.ok(replies.every((reply) => reply.length <= 4000));
    if (scenario.long) assert.ok(replies.length > 1);
    assert.equal(ids.length, scenario.expected[index], text);
    for (const id of ids) {
      if (!scenario.repeatsAllowed) assert.ok(!seen.has(id), `Repeated listing: ${id}`);
      assert.ok(!id.startsWith('93'), 'Keep location/type/budget/publication filters');
      seen.add(id);
    }
    if (!ids.length) assert.match(result.reply, /[Bb]elum ketemu.*lain/);
    if (ids.length && !scenario.upcoming) assert.match(result.reply, /hasil lelang atau jadwal ulang perlu dikonfirmasi/);
    assert.doesNotMatch(result.reply, /kota atau kabupaten yang mana|kecamatan mana|Budget-nya sampai berapa|Jenis properti apa/);
    history.push(...replies.map((content) => ({ role: 'assistant', content })));
    transcript.push({ text, reply: combined, messages: replies.length, ids, criteria: f.criteria.at(-1) });
  }
  for (const criteria of f.criteria) {
    assert.equal(criteria.city, 'Mojokerto'); assert.equal(criteria.category, 'PABRIK'); assert.equal(criteria.transaction_type, 'LELANG');
    assert.ok([50e9, scenario.maxPrice].includes(criteria.max_price));
  }
  assert.equal(f.criteria.at(-1).max_price, scenario.maxPrice || 50e9);
  assert.ok(f.queries.every((query) => query.take === 5));
  return { name: scenario.name, passed: true, transcript };
}

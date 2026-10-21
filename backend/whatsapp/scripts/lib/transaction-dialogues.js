import assert from 'node:assert/strict';
import { buyerContext } from '../../services/buyer_profile.js';
import { generatePropertyReply } from '../../services/property_reply.js';
import { transactionValues } from '../../services/property_transaction.js';
import { getPropertyKnowledge } from '../../../../src/lib/chatbot/property-knowledge.ts';

export const transactionUtterances = [
  ...['nggak mau lelang', 'gak mau lelang', 'ga mau lelang', 'gk mau lelang', 'tdk ingin lelang', 'ogah lelang',
    'jangan lelang', 'lelang jangan', 'lelang saya nggak mau', 'non lelang aja', 'non-lelang', 'tanpa lelang',
    'bukan lelang', 'jual beli biasa', 'beli normal aja', 'secondary atau primary', 'gamau lelang',
    'nggak mau beli lelang', 'tidak mau beli rumah lelang'].map((text) => [text, ['PRIMARY', 'SECONDARY']]),
  ...['rumah baru', 'rumah yang baru dibangun', 'rumah dari developer', 'rumah dari pengembang', 'primary aja',
    'primer pak', 'baru dibangun', 'belum pernah dihuni', 'nggak mau lelang, dari developer aja',
    'rumah baru dari developer', 'saya ingin rumah yang baru dibangun'].map((text) => [text, ['PRIMARY']]),
  ...['secondary', 'seken aja', 'rumah bekas', 'beli langsung dari pemilik', 'dari owner langsung',
    'secodnary aja', 'seceondary pak', 'second aja', 'bukan lelang, secondary saja'].map((text) => [text, ['SECONDARY']]),
  ...['sewa aja', 'ngontrak aja', 'kontrakan', 'nyewa', 'menyewa rumah', 'nggak mau beli, mau sewa',
    'bukan beli tapi ngontrak', 'nggak jadi beli, maunya ngontrak', 'lelang jangan, sewa aja',
    'bukan primary atau secondary, maunya sewa', 'sewa rumah baru', 'ngontrak rumah yang baru dibangun'].map((text) => [text, ['SEWA']]),
  ...['lelang saja', 'mau lelang', 'lelang boleh', 'lelang nggak masalah', 'nggak keberatan lelang'].map((text) => [text, ['LELANG']]),
];

export function transactionScenarios() {
  const scenarios = [];
  for (const [index, [text, types]] of transactionUtterances.entries()) {
    for (const style of ['followup', 'opening', 'uppercase']) {
      const answer = style === 'uppercase' ? text.toUpperCase() : text;
      const rental = types.includes('SEWA');
      scenarios.push({ name: `${style}-${index + 1}`, types, messages: [
        ...(style === 'opening' ? [`Cari rumah di Surabaya, ${answer}`] : ['selamat siang pak, saya sedang cari aset property di surabaya', answer]),
        `rumah, seluruh Surabaya, budget ${rental ? '30 juta per tahun' : '800 juta'}, luas tanah bebas`,
      ] });
    }
  }
  scenarios.push(
    { name: 'berubah-beli-ke-sewa', types: ['SEWA'], messages: ['Cari rumah primary di seluruh Surabaya, budget 800 juta, luas tanah bebas', 'nggak jadi beli, ngontrak aja', 'budget 30 juta per tahun'] },
    { name: 'tolak-lelang-tetap-setelah-budget', types: ['PRIMARY', 'SECONDARY'], messages: ['Cari rumah di seluruh Surabaya, jangan lelang, budget 800 juta, luas tanah bebas', 'budget jadi 600 juta'] },
    { name: 'tolak-lalu-izinkan-lelang', types: ['LELANG'], messages: ['Cari rumah di seluruh Surabaya, jangan lelang, budget 800 juta, luas tanah bebas', 'saya berubah pikiran, lelang boleh pak'] },
    { name: 'ganti-lelang-ke-developer', types: ['PRIMARY'], messages: ['Cari rumah lelang di seluruh Surabaya, budget 800 juta, luas tanah bebas', 'ganti dari lelang ke rumah developer'] },
  );
  return scenarios;
}

// Fixed synthetic inventory, evaluated against the actual Prisma predicates.
// No database credentials, provider calls, or WhatsApp connections are used.
function matches(row, where) {
  if (where.AND && !(Array.isArray(where.AND) ? where.AND : [where.AND]).every((item) => matches(row, item))) return false;
  if (where.OR && !where.OR.some((item) => matches(row, item))) return false;
  return Object.entries(where).every(([key, value]) => {
    if (['AND', 'OR'].includes(key)) return true;
    if (key === 'sewaDetail') return matches(row.sewaDetail, value.is);
    const actual = row[key];
    if (value == null || typeof value !== 'object' || value instanceof Date) return actual === value;
    return Object.entries(value).every(([operator, expected]) => {
      const a = value.mode === 'insensitive' ? String(actual || '').toLowerCase() : actual;
      const b = value.mode === 'insensitive' ? String(expected).toLowerCase() : expected;
      return operator === 'mode' ? true : operator === 'in' ? expected.includes(actual) : operator === 'notIn' ? !expected.includes(actual) :
        operator === 'not' ? actual !== expected : operator === 'equals' ? a === b : operator === 'contains' ? String(a).includes(b) :
        operator === 'startsWith' ? String(a).startsWith(b) : operator === 'gt' ? actual > expected : operator === 'gte' ? actual >= expected :
        operator === 'lte' ? actual <= expected : false;
    });
  });
}

export async function runTransactionScenario(scenario) {
  const queries = [], history = [], transcript = [];
  const inventory = ['LELANG', 'PRIMARY', 'SECONDARY', 'SEWA'].map((type, index) => ({
    id_property: BigInt(990001 + index), judul: `Rumah simulasi ${type}`, jenis_transaksi: type, kategori: 'RUMAH',
    status_tayang: 'TERSEDIA', bukan_properti: false, kota: 'Surabaya', kecamatan: 'Tandes', kelurahan: 'Manukan Kulon',
    alamat_lengkap: `Jl. Simulasi ${index + 1}`, harga: 500000000, harga_efektif: 500000000, nilai_limit_lelang: 500000000,
    luas_tanah: 120, luas_bangunan: 90, tanggal_lelang: new Date('2099-01-01T00:00:00Z'),
    sewaDetail: { durasi_sewa: 'BULANAN', harga_sewa_bulanan: 3000000, harga_sewa_tahunan: 30000000 },
  }));
  const db = { listing: { async findMany(query) { queries.push(query); return inventory.filter((row) => matches(row, query.where)).slice(0, 5); } },
    listingSekitar: { async findUnique() { return null; } }, listingTempat: { async findMany() { return []; } },
    listingSewaDetail: { async findUnique() { return inventory[3].sewaDetail; } } };
  const catalog = { async resolve(text, previousId, criteria) {
    const result = await getPropertyKnowledge(db, { text, previousId, criteria });
    return { ...result, catalog: result.candidates.map((asset) => ({ ...asset, detail_url: asset.detail_url.replace(/^https:\/\/[^/]+/, 'https://simulation.example') })) };
  } };
  try {
    let buyer;
    for (const text of scenario.messages) {
      const before = queries.length;
      const result = await generatePropertyReply({ text, history, catalog, ai: { generate() { throw new Error('Unexpected external AI'); } } });
      buyer = buyerContext(history, text, null);
      transcript.push({ user: text, reply: result.reply, profile: buyer.profile, missing: buyer.missing, queried: queries.length > before });
      history.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply });
    }
    assert.deepEqual([...transactionValues(buyer.profile)].sort(), [...scenario.types].sort(), 'transaction interpretation');
    assert.equal(buyer.stage, 'recommendations', 'qualification complete');
    assert.ok(queries.length, 'queried database adapter');
    const final = transcript.at(-1).reply;
    for (const [i, type] of ['LELANG', 'PRIMARY', 'SECONDARY', 'SEWA'].entries()) {
      assert.equal(final.includes(`properti-${990001 + i}`), scenario.types.includes(type), `inventory ${type}`);
    }
    return { name: scenario.name, passed: true, transcript };
  } catch (error) { return { name: scenario.name, passed: false, error: error.message, transcript }; }
}

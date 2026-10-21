import assert from 'node:assert/strict';
import { buyerContext } from '../../services/buyer_profile.js';
import { generatePropertyReply } from '../../services/property_reply.js';
import { DatabaseCatalog } from '../../services/property_database.js';
import { recommendationIds } from '../../services/recommendations.js';
import { getPropertyKnowledge, isBuyerCriteria } from '../../../../src/lib/chatbot/property-knowledge.ts';
import { normalNama } from '../../../../src/lib/tempat/normalisasi.ts';

const NOW = Date.parse('2026-10-15T05:00:00Z');
const poi = (kelas, nama, distance, aliases = []) => ({ jarak_meter: distance, tempat: {
  kelas, nama, nama_normal: normalNama(nama), alias: aliases.map((alias_normal) => ({ alias_normal })),
  jangkauan: 'LANDMARK',
} });
const points = (school = 300, hospital = 450) => [poi('SEKOLAH', 'SD Contoh', school),
  poi('RUMAH_SAKIT', 'Rumah Sakit Contoh', hospital, ['rs contoh']), poi('MALL', 'Pakuwon Mall', 600, ['ptc']),
  poi('STASIUN', 'Stasiun Gubeng', 800), poi('PINTU_TOL', 'Gerbang Tol Satelit', 2800),
  poi('KAMPUS', 'Universitas Negeri Surabaya', 3000, ['unesa']), poi('HOTEL', 'Hotel Majapahit', 700)];
export const row = (id, overrides = {}) => ({ id_property: BigInt(id), slug: `rumah-simulasi-${id}`, judul: `Rumah simulasi ${id}`,
  jenis_transaksi: 'SECONDARY', kategori: 'RUMAH', status_tayang: 'TERSEDIA', bukan_properti: false,
  kota: 'Kota Surabaya', kecamatan: 'Tandes', kelurahan: 'Manukan Kulon', provinsi: 'Jawa Timur',
  alamat_lengkap: 'Jalan Contoh Simulasi', harga: 400e6, harga_efektif: 400e6, luas_tanah: 100,
  tanggal_diupdate: new Date(NOW), tempatDekat: points(), ...overrides });

// Evaluate the actual API's Prisma predicates, including nested POI relations.
// Deliberately tempting rows catch lost filters rather than just snapshotting SQL.
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((v) => matches(row, v));
    if (key === 'OR') return value.some((v) => matches(row, v));
    const field = row?.[key];
    if (value == null || typeof value !== 'object') return field === value;
    return Object.entries(value).every(([op, operand]) => {
      const normalize = (v) => value.mode === 'insensitive' ? String(v ?? '').toLowerCase() : String(v ?? '');
      switch (op) {
        case 'mode': return true;
        case 'equals': return field != null && normalize(field) === normalize(operand);
        case 'contains': return field != null && normalize(field).includes(normalize(operand));
        case 'startsWith': return field != null && normalize(field).startsWith(normalize(operand));
        case 'in': return field != null && operand.some((item) => normalize(item) === normalize(field));
        case 'notIn': return !operand.includes(field);
        case 'not': return field !== operand;
        case 'gt': return field != null && field > operand;
        case 'gte': return field != null && field >= operand;
        case 'lte': return field != null && field <= operand;
        case 'some': return (field || []).some((item) => matches(item, operand));
        case 'is': return !!field && matches(field, operand);
        default: return matches(field, value);
      }
    });
  });
}

export function advancedFixture({ inventory: suppliedInventory } = {}) {
  const inventory = suppliedInventory || [row(970001), row(970002, { tempatDekat: points(900, 1100) }),
    row(970003, { kecamatan: 'Rungkut', kelurahan: 'Medokan Ayu' }),
    row(970004, { kecamatan: 'Wiyung', kelurahan: 'Babatan' }),
    row(970005, { kecamatan: 'Genteng' }), row(970006, { kecamatan: 'Kenjeran' }),
    row(970007, { jenis_transaksi: 'LELANG', nilai_limit_lelang: 400e6, tanggal_lelang: new Date('2027-01-01T00:00:00Z') }),
    row(970008, { jenis_transaksi: 'SEWA', kategori: 'KOS', harga: 2e6, harga_efektif: 2e6,
      sewaDetail: { harga_sewa_bulanan: 2e6, harga_sewa_tahunan: 24e6 } }),
    // Same city but no nearby index must never pass a proximity constraint.
    row(970009, { tempatDekat: [] }),
    ...[{ kota: 'Kota Malang', kecamatan: 'Klojen' }, { harga: 600e6, harga_efektif: 600e6 },
      { status_tayang: 'TERJUAL' }, { bukan_properti: true }, { kategori: 'RUKO' }, { luas_tanah: 60 }]
      .map((change, i) => row(971001 + i, change))];
  const queries = [], criteria = [];
  const db = { listing: { async findMany(query) { queries.push(query); return inventory.filter((row) => matches(row, query.where)).slice(0, query.take); } },
    listingSekitar: { async findUnique() { return null; } }, listingTempat: { async findMany() { return []; } },
    listingSewaDetail: { async findUnique({ where }) { return inventory.find((item) => item.id_property === where.id_property)?.sewaDetail || { durasi_sewa: 'BULANAN', harga_sewa_bulanan: 2e6 }; } } };
  const catalog = new DatabaseCatalog({ url: 'https://simulated.invalid/properties', token: 'simulation', timeoutMs: 5000 }, {
    async fetchImpl(_url, request) {
      const input = JSON.parse(request.body);
      if (input.criteria) {
        assert.ok(isBuyerCriteria(input.criteria), 'Complete preferences must validate at the real API boundary');
        criteria.push(input.criteria);
      }
      return Response.json(await getPropertyKnowledge(db, input, NOW));
    },
  });
  const ai = { generate() { assert.fail('Clear requests must work without an AI call'); } };
  return { catalog, ai, queries, criteria, now: NOW };
}

const complete = 'budget 500 juta luas tanah minimal 72 m2';
const opening = `Cari secondary rumah di Surabaya Barat dekat sekolah radius 500 meter ${complete}`;
const directions = { Barat: ['970001'], Timur: ['970003'], Selatan: ['970004'], Pusat: ['970005'], Utara: ['970006'] };
export const scenarios = [
  ...Object.entries(directions).flatMap(([direction, expected]) => ['sekolah', 'rumah sakit', 'RS Contoh'].map((place) => ({
    name: `${direction}: ${place} dengan seluruh kriteria sekaligus`,
    messages: [`Cari secondary rumah di Surabaya ${direction} dekat ${place} radius 500 meter ${complete}`], expected,
  }))),
  ...['dekat', 'deket', 'dkt', 'dket', 'di sekitar'].map((cue) => ({ name: `Bahasa percakapan: ${cue}`,
    messages: [`Cari secondary rumah ${cue} sekolah di Surabaya Barat radius 500 meter ${complete}`], expected: ['970001'] })),
  ...['mall', 'Stasiun Gubeng', 'pintu tol', 'gerbang tol', 'GT Satelit', 'UNESA', 'PTC', 'Hotel Majapahit'].map((place) => ({
    name: `Landmark dan alias: ${place}`, messages: [`Cari secondary rumah dekat ${place} di Surabaya Barat radius 3 km ${complete}`], expected: ['970001', '970002'],
  })),
  { name: 'Kota landmark belum disebut: klarifikasi kota saja', messages: [
    `Cari secondary rumah dekat Stasiun Gubeng radius 1 km ${complete}`, 'Surabaya pak'], expected: ['970001', '970002', '970003', '970004', '970005'] },
  { name: 'Funnel fleksibel menyimpan budget, area, nama, transaksi dan luas', messages: [
    'Cari rumah di Surabaya Barat budget 500 juta', 'Nama saya Budi, secondary saja', 'dekat sekolah radius 500 meter, luas tanah minimal 72 m2'], expected: ['970001'] },
  { name: 'Kriteria lengkap tidak ditanya ulang sesudah koreksi budget', messages: [opening, 'budget jadi 450 juta'], expected: ['970001'], maxPrice: 450e6 },
  { name: 'Koreksi radius mempertahankan budget dan sekolah', messages: [opening, 'radius jadi 1 km'], expected: ['970001', '970002'], radius: 1000 },
  { name: 'Koreksi area mempertahankan landmark', messages: [opening, 'ganti ke Surabaya Selatan'], expected: ['970004'], group: 'selatan' },
  { name: 'Jawaban arah singkat mengikuti kota yang sudah diketahui', messages: [opening, 'timur aja, budget 450 juta'], expected: ['970003'], group: 'timur', maxPrice: 450e6 },
  { name: 'Ganti landmark tidak menghapus wilayah dan batas harga', messages: [opening, 'ganti dekat pintu tol radius 3 km'], expected: ['970001', '970002'] },
  { name: 'Minta alternatif tetap memakai semua filter dan mengecualikan hasil lama', messages: [opening, 'ada yang lain?'], expected: [] },
  { name: 'Tidak ada nama dalam kamus tetap mempertahankan filter', messages: [`Cari secondary rumah dekat RS Nama Belum Terdaftar di Surabaya Barat ${complete}`], expected: [] },
  { name: 'Hasil kosong tidak melonggarkan radius tanpa izin', messages: [opening.replace('500 meter', '100 meter'), 'budget jadi 450 juta'], expected: [] },
  { name: 'Jenis landmark bukan jenis aset', messages: [
    'Cari lelang aset dekat Hotel Majapahit di Surabaya Barat budget 500 juta', 'rumah, luas tanah minimal 72 m2'], expected: ['970007'] },
  { name: 'Sewa kos berdasarkan alias kampus dan anggaran bulanan', messages: [
    'Cari sewa kos dekat UNESA di Surabaya Barat budget 2 juta per bulan luas tanah minimal 72 m2'], expected: ['970008'] },
  { name: 'Ukuran tanah tetap ukuran saat landmark sudah diketahui', messages: [
    'Cari secondary rumah dekat sekolah di Surabaya Barat budget 500 juta radius 500 meter', 'minimal 72 meter'], expected: ['970001'] },
  { name: 'Jarak 1000 meter bukan budget Rp1000', messages: [
    `Cari secondary rumah dekat sekolah di Surabaya Barat maksimal 1000 meter ${complete}`], expected: ['970001', '970002'] },
  { name: 'Radius di luar batas diperjelas tanpa melupakan kebutuhan', messages: [
    `Cari secondary rumah dekat sekolah di Surabaya Barat radius 30 km ${complete}`, 'radius 500 meter'], expected: ['970001'] },
  { name: 'Alias kampus memakai radius kelas kamus yang sama dengan searchbar', messages: [
    `Cari secondary rumah dekat UNESA di Surabaya Barat ${complete}`], expected: ['970001', '970002'] },
  { name: 'Dua fasilitas wajib dipenuhi bersama', messages: [
    `Cari secondary rumah dekat sekolah dan rumah sakit di Surabaya Barat radius 400 meter ${complete}`], expected: [] },
  { name: 'Dua fasilitas dengan kata atau menerima salah satu', messages: [
    `Cari secondary rumah dekat sekolah atau rumah sakit di Surabaya Barat radius 400 meter ${complete}`], expected: ['970001'] },
  { name: 'Penanda dekat berulang tetap menjadi dua fasilitas', messages: [
    `Cari secondary rumah dekat sekolah dan dekat rumah sakit di Surabaya Barat radius 500 meter ${complete}`], expected: ['970001'] },
  { name: 'Koreksi landmark menolak nama lama dan memilih yang baru', messages: [opening,
    'bukan dekat mall, dekat pintu tol radius 3 km'], expected: ['970001', '970002'] },
  { name: 'Kedekatan dilepas hanya atas permintaan customer', messages: [opening,
    'tidak harus dekat sekolah'], expected: ['970001', '970002', '970009'] },
  { name: 'Tambah fasilitas mempertahankan sekolah sebagai syarat', messages: [opening,
    'tambahkan dekat rumah sakit juga'], expected: ['970001'] },
  { name: 'Cakupan barat boleh dipersempit tanpa wajib memilih kelurahan', messages: [opening,
    'di Kecamatan Tandes'], expected: ['970001'] },
  { name: 'Seluruh kota melepaskan pembagian barat tanpa menghapus landmark', messages: [opening,
    'perluas ke seluruh Surabaya'], expected: ['970001', '970003', '970004', '970005', '970006'] },
  { name: 'Singkatan 500m adalah jarak, budget saya 1 m adalah miliar', messages: [
    'Cari secondary rumah dekat sekolah 500m di Surabaya Barat budget saya di angka 1 m luas tanah minimal 72 m2'], expected: ['970001', '971002'], maxPrice: 1e9, radius: 500 },
  { name: 'Funnel kota kemudian kawasan barat menerima beberapa jawaban sekaligus', messages: [
    'Cari lelang aset di Surabaya', 'Surabaya Barat pak', 'rumah, budget 500 juta, luas tanah minimal 72 m2'], expected: ['970007'] },
  { name: 'Nama kota pada penggantian landmark tidak memperluas cakupan barat', messages: [opening,
    'dekat rumah sakit di Surabaya radius 500 meter'], expected: ['970001'] },
];

export async function simulateAdvancedSearch(scenario) {
  const f = advancedFixture(), history = [], transcript = [];
  let buyer, result;
  for (const text of scenario.messages) {
    history.push({ role: 'user', content: text });
    result = await generatePropertyReply({ ...f, text, history });
    buyer = buyerContext(history, text, null);
    assert.ok(result.reply);
    if (buyer.profile.region_group || buyer.profile.nearby && buyer.profile.city) {
      assert.ok(!buyer.missing.includes('village') && !buyer.missing.includes('location'));
      assert.doesNotMatch(result.reply, /kelurahan mana|[Ii]ncar daerah mana|kecamatan mana/i);
    }
    if (buyer.profile.region_group) assert.equal(buyer.profile.location.toLowerCase(), `surabaya ${buyer.profile.region_group}`);
    if (!buyer.missing.includes('max_price')) assert.doesNotMatch(result.reply, /[Bb]udget(?:-nya| sewanya) sampai berapa/);
    if (!buyer.missing.includes('category')) assert.doesNotMatch(result.reply, /Jenis properti apa/);
    transcript.push({ text, reply: result.reply, profile: buyer.profile, missing: buyer.missing,
      result_ids: recommendationIds([...(result.replies || [result.reply])].join('\n')) });
    for (const reply of result.replies || [result.reply]) history.push({ role: 'assistant', content: reply });
  }
  assert.equal(buyer.stage, 'recommendations');
  assert.deepEqual(transcript.at(-1).result_ids, scenario.expected);
  assert.ok(f.queries.length, 'Qualified requests must reach the actual public property query');
  if (scenario.maxPrice) assert.equal(f.criteria.at(-1).max_price, scenario.maxPrice);
  if (scenario.radius) assert.equal(f.criteria.at(-1).nearby.radius_m, scenario.radius);
  if (scenario.group) assert.equal(f.criteria.at(-1).region_group, scenario.group);
  return { name: scenario.name, passed: true, criteria: f.criteria.at(-1), transcript };
}

import assert from 'node:assert/strict';
import { advancedFixture, row } from './advanced-search-dialogues.js';
import { generatePropertyReply } from '../../services/property_reply.js';
import { recommendationIds } from '../../services/recommendations.js';

export const REPORTED_SELECTION = 'boleh lihat yang nomor 5?';
export const REPORTED_ALTERNATIVE = 'hmmm, adakah yang lain?';
export const REPORTED_IDS = ['118779', '116682', '118525', '117200', '116568'];
export const OPENING = 'Nama saya Budi, cari lelang rumah di Surabaya Barat budget maksimal 1,5 miliar luas tanah bebas';
export const NOW = Date.parse('2026-10-15T10:46:00Z');

export function detailFixture({ transaction = 'LELANG', category = 'RUMAH', empty = false } = {}) {
  const ids = [...REPORTED_IDS, ...Array.from({ length: empty ? 0 : 7 }, (_, i) => String(980001 + i))];
  const rows = ids.map((id, i) => row(id, { jenis_transaksi: transaction, kategori: category,
    nilai_limit_lelang: transaction === 'LELANG' ? [550e6, 1500e6, 150e6, 300e6, 655e6][i] || 500e6 : null,
    harga: transaction === 'SEWA' ? 20e6 : 500e6, harga_efektif: transaction === 'SEWA' ? 20e6 : 500e6,
    kecamatan: i === 4 ? 'Pakal' : i >= 5 ? 'Sukomanunggal' : 'Tandes',
    kelurahan: i === 4 ? 'Benowo' : 'Manukan Kulon',
    alamat_lengkap: i === 4 ? 'Perumahan Green Ambasador No. 17' : `Jalan Simulasi Nomor ${i + 1}`,
    luas_tanah: [93, 264, 107, 100, 112][i] || 120,
    sewaDetail: { harga_sewa_tahunan: 20e6, harga_sewa_bulanan: 2e6 },
    tanggal_lelang: transaction === 'LELANG' ? new Date(NOW - 7 * 86400000) : null,
  }));
  // These must remain excluded when the client returns from a detail view.
  const noise = [{ kota: 'Kota Malang', kecamatan: 'Klojen' }, { kecamatan: 'Wiyung' },
    { kecamatan: 'Rungkut' }, { kategori: 'GUDANG' }, { harga: 2e9, harga_efektif: 2e9, nilai_limit_lelang: 2e9 },
    { status_tayang: 'TERJUAL' }, { bukan_properti: true }].map((changes, i) => row(981001 + i, {
      ...rows[0], id_property: BigInt(981001 + i), ...changes,
    }));
  return { ...advancedFixture({ inventory: [...rows, ...noise] }), now: NOW };
}

export const scenarios = [
  { name: 'Laporan persis: daftar → nomor 5 → adakah yang lain', messages: [OPENING, REPORTED_SELECTION, REPORTED_ALTERNATIVE] },
  ...['adakah selain property tersebut?', 'ada yang lain?', 'carikan pilihan lainnya', 'lihat opsi berikutnya',
    'yang lain dong', 'lanjut', 'masih ada lagi pak?'].map((text) => ({ name: `Permintaan setelah detail: ${text}`, messages: [OPENING, REPORTED_SELECTION, text] })),
  ...['yang pertama', 'nomor 2', '3', 'boleh lihat yang nomor 4?', REPORTED_SELECTION].map((choice) => ({
    name: `Pilihan sebelum mencari lagi: ${choice}`, messages: [OPENING, choice, REPORTED_ALTERNATIVE] })),
  { name: 'Alamat yang disalin tidak mempersempit wilayah pencarian', messages: [OPENING,
    'Boleh detail Perumahan Green Ambasador No. 17?', REPORTED_ALTERNATIVE] },
  { name: 'Tautan rekomendasi tidak membuat pencarian baru', messages: [OPENING,
    'https://solusindoaset.com/Lelang/rumah-simulasi-116568-116568', REPORTED_ALTERNATIVE] },
  { name: 'Kode aset dari daftar tetap terhubung ke pencarian', messages: [OPENING, 'Kode 116568', REPORTED_ALTERNATIVE] },
  { name: 'Pertanyaan biaya di antara detail dan alternatif', messages: [OPENING, REPORTED_SELECTION,
    'Harga itu sudah all in?', REPORTED_ALTERNATIVE] },
  { name: 'Budget dikoreksi setelah detail tanpa pertanyaan berulang', messages: [OPENING, REPORTED_SELECTION,
    'Ada yang lain, budget jadi 1 miliar'], maxPrice: 1e9 },
  { name: 'Batas luas sebelumnya dipertahankan', messages: [OPENING.replace('luas tanah bebas', 'luas tanah minimal 90 maksimal 300 m2'),
    REPORTED_SELECTION, REPORTED_ALTERNATIVE], minLand: 90, maxLand: 300 },
  { name: 'Sekolah dan radius tetap menjadi syarat setelah detail', messages: [OPENING.replace('di Surabaya Barat',
    'dekat sekolah radius 500 meter di Surabaya Barat'), REPORTED_SELECTION, REPORTED_ALTERNATIVE], nearby: { query: 'sekolah', radius_m: 500 } },
  { name: 'Pilihan primary tetap primary', transaction: 'PRIMARY', messages: [OPENING.replace('lelang', 'primary'), REPORTED_SELECTION, REPORTED_ALTERNATIVE] },
  { name: 'Pilihan secondary tetap secondary', transaction: 'SECONDARY', messages: [OPENING.replace('lelang', 'secondary'), REPORTED_SELECTION, REPORTED_ALTERNATIVE] },
  { name: 'Sewa mempertahankan budget dan periode tahunan', transaction: 'SEWA', messages: [
    'Cari sewa rumah di Surabaya Barat budget 25 juta per tahun luas tanah bebas', REPORTED_SELECTION, REPORTED_ALTERNATIVE], maxPrice: 25e6 },
  { name: 'Jenis ruko tetap ruko', category: 'RUKO', messages: [OPENING.replace('rumah', 'ruko'), REPORTED_SELECTION, REPORTED_ALTERNATIVE] },
  { name: 'Lima pilihan habis dijelaskan tanpa meminta budget dan luas lagi', empty: true, messages: [OPENING, REPORTED_SELECTION, REPORTED_ALTERNATIVE] },
  { name: 'Memilih hasil kedua lalu mencari lagi tidak melupakan kebutuhan', messages: [OPENING, REPORTED_SELECTION,
    REPORTED_ALTERNATIVE, 'boleh lihat yang nomor 2?', REPORTED_ALTERNATIVE] },
];

export async function simulateDetailAlternatives(scenario) {
  const f = detailFixture(scenario), history = [], transcript = [];
  let previousId = null, lastBatch = [], shown = new Set();
  for (const [index, text] of scenario.messages.entries()) {
    history.push({ role: 'user', content: text });
    const result = await generatePropertyReply({ ...f, text, history, previousId });
    const replies = result.replies || [result.reply], reply = replies.join('\n\n');
    const ids = result.knowledge.status === 'recommendations' ? recommendationIds(reply) : [];
    assert.ok(reply);
    if (ids.length) {
      assert.ok(ids.every((id) => !shown.has(id)), `Repeated recommendation: ${ids}`);
      ids.forEach((id) => shown.add(id)); lastBatch = ids;
    }
    if (reply.includes('DETAIL ASET')) {
      assert.ok(result.asset && lastBatch.includes(result.asset.id), 'Only a property from the last batch may be opened');
    }
    if (index === scenario.messages.length - 1) {
      assert.equal(result.knowledge.status, scenario.empty ? 'not_found' : 'recommendations');
      if (!scenario.empty) assert.ok(ids.length);
      assert.doesNotMatch(reply, /Budget(?:-nya| sewanya) sampai berapa|luas tanah minimal atau maksimal|kelurahan mana|kecamatan mana|Jenis properti apa/i);
    }
    transcript.push({ text, reply, status: result.knowledge.status, selected_id: result.asset?.id || null,
      result_ids: ids, criteria: f.criteria.at(-1) });
    history.push(...replies.map((content) => ({ role: 'assistant', content })));
    previousId = result.asset?.id || null;
  }
  const criteria = f.criteria.at(-1);
  assert.equal(criteria.city, 'Surabaya'); assert.equal(criteria.region_group, 'barat');
  assert.equal(criteria.location, 'Surabaya Barat'); assert.equal(criteria.district, null); assert.equal(criteria.village, null);
  assert.equal(criteria.transaction_type, scenario.transaction || 'LELANG');
  assert.equal(criteria.category, scenario.category || 'RUMAH');
  assert.equal(criteria.max_price, scenario.maxPrice || 1500e6);
  assert.equal(criteria.min_land_area_m2, scenario.minLand || null); assert.equal(criteria.max_land_area_m2, scenario.maxLand || null);
  if (scenario.nearby) assert.deepEqual(criteria.nearby, scenario.nearby);
  if (scenario.transaction === 'SEWA') assert.equal(criteria.rental_period, 'TAHUNAN');
  assert.ok(REPORTED_IDS.every((id) => criteria.exclude_ids.includes(id)));
  return { name: scenario.name, passed: true, transcript };
}

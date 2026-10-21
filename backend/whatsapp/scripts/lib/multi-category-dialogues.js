import { runUnderstandingScenario } from './understanding-dialogues.js';

const opening = ['Cari lelang aset di Kecamatan Menganti, Kabupaten Gresik', 'seluruh Menganti pak budget 400 juta'];
const selected = 'gudang, pabrik, tanah, atau ruko, luas tanah minimal 100 maksimal 200 m2';
const four = ['GUDANG', 'PABRIK', 'TANAH', 'RUKO'];
const types = [['RUMAH', 'rumah'], ['RUKO', 'ruko'], ['GUDANG', 'gudang'], ['TANAH', 'tanah'],
  ['APARTEMEN', 'apartemen'], ['TOKO', 'toko'], ['PABRIK', 'pabrik'], ['KOS', 'kos'], ['HOTEL_DAN_VILLA', 'hotel/vila']];
const separators = [', ', ' atau ', ' dan ', '/', ' & ', ' + ', ' maupun ', '\n'];
function permutations(values) {
  if (!values.length) return [[]];
  return values.flatMap((value, i) => permutations(values.filter((_, j) => j !== i)).map((rest) => [value, ...rest]));
}

// Enumerated coverage, not an estimate of real customers' response probabilities.
export function multiCategoryScenarios() {
  const cases = [
    ['empat-jenis', ['gudang, pabrik, tanah, atau ruko. tidak ada batasan luasan'], four, null, null],
    ['jenis-lalu-luas', ['gudang, pabrik, tanah, atau ruko', 'luas bebas'], four, null, null],
    ['luas-belum-tahu', ['gudang, pabrik, tanah, atau ruko, luas belum tahu'], four, null, null, { pending: true }],
    ['tambah-dua', ['gudang dan pabrik, luas tanah bebas', 'tambahkan tanah, ruko'], four, null, null],
    ['tambah-ke-empat', [selected, 'rumah juga boleh'], [...four, 'RUMAH'], 100, 200],
    ['tambah-duplikat', [selected, 'tambahkan gudang, pabrik'], four, 100, 200],
    ['hapus-daftar', [selected, 'hapus gudang, pabrik, tanah'], ['RUKO'], 100, 200],
    ['hapus-dua', [selected, 'nggak mau gudang dan pabrik'], ['TANAH', 'RUKO'], 100, 200],
    ['hapus-baris', [selected, 'coret gudang\npabrik\ntanah'], ['RUKO'], 100, 200],
    ['hapus-semua', [selected, 'hapus gudang, pabrik, tanah, ruko'], [], 100, 200, { pending: true }],
    ['pulihkan-setelah-hapus', [selected, 'hapus gudang, pabrik, tanah, ruko', 'rumah dan toko'], ['RUMAH', 'TOKO'], 100, 200],
    ['jenis-bebas', [selected, 'jenis bebas'], [], 100, 200],
    ['ganti-daftar', [selected, 'ganti dari gudang, pabrik, tanah, ruko ke rumah dan toko'], ['RUMAH', 'TOKO'], 100, 200],
    ['ganti-dengan', [selected, 'ganti pilihan gudang dan pabrik dengan tanah atau ruko'], ['TANAH', 'RUKO'], 100, 200],
    ['pilih-ulang', [selected, 'gudang dan juga pabrik'], ['GUDANG', 'PABRIK'], 100, 200],
    ['satu-saja', [selected, 'ruko saja'], ['RUKO'], 100, 200],
    ['hapus-tambah', [selected, 'hapus gudang dan pabrik lalu tambahkan rumah'], ['TANAH', 'RUKO', 'RUMAH'], 100, 200],
    ['tambah-hapus', [selected, 'tambahkan rumah dan toko, hapus tanah dan ruko'], ['GUDANG', 'PABRIK', 'RUMAH', 'TOKO'], 100, 200],
    ['hapus-pulihkan', [selected, 'hapus gudang, tambahkan gudang'], four, 100, 200],
    ['tambah-lalu-hapus', [selected, 'tambahkan rumah lalu hapus rumah'], four, 100, 200],
    ['penolakan-pilih', [selected, 'bukan gudang, pabrik, tanah, ruko saja'], ['RUKO'], 100, 200],
    ['negasi-belakang', [selected, 'pabrik jangan, gudang dan tanah saja'], ['GUDANG', 'TANAH'], 100, 200],
    ['koreksi-maunya', [selected, 'bukan gudang, pabrik, tanah, saya maunya ruko'], ['RUKO'], 100, 200],
    ['budget-tetap-empat', [selected, 'budget jadi 350 juta'], four, 100, 200, { budget: 350000000 }],
    ['luas-tetap-empat', [selected, 'luas tanah bebas'], four, null, null],
    ['tanah-bukan-ukuran', ['gudang dan pabrik, luas tanah minimal 100 maksimal 200 m2'], ['GUDANG', 'PABRIK'], 100, 200],
    ['rumah-toko-gabungan', ['rumah toko, gudang, pabrik, tanah, luas bebas'], four, null, null],
    ['jangan-ambil-opsi-pertanyaan', ['belum tahu jenisnya pak, luas bebas'], [], null, null, { pending: true }],
  ];
  const scenarios = cases.map(([name, messages, categories, min, max, rest]) => ({ name, group: 'edits', messages: [...opening, ...messages], categories, min, max, ...rest }));
  scenarios.push({ name: 'semua-dalam-pesan-awal', group: 'opening', messages: [
    'Cari lelang gudang, pabrik, tanah, atau ruko di Kecamatan Menganti, Kabupaten Gresik, kelurahan bebas, budget 400 juta, luas tanah bebas',
  ], categories: four, min: null, max: null });
  // Every selection of 2–9 supported categories, not just the reported four.
  for (let mask = 1; mask < 2 ** types.length; mask++) {
    const chosen = types.filter((_, i) => mask & 2 ** i);
    if (chosen.length < 2) continue;
    scenarios.push({ name: `kombinasi-${mask}`, group: 'all-subsets', messages: [...opening,
      `${chosen.map(([, label]) => label).join(separators[mask % separators.length])}; luas tanah bebas`],
    categories: chosen.map(([category]) => category), min: null, max: null });
  }
  // Permutation and delimiter coverage prevents first/last-member shortcuts.
  for (const order of permutations(four)) {
    const labels = order.map((value) => value.toLowerCase());
    for (const [i, separator] of separators.entries()) scenarios.push({
      name: `urutan-${labels.join('-')}-${i}`, group: 'four-type-lists', messages: [...opening, `${labels.join(separator)}. luas bebas`],
      categories: four, min: null, max: null,
    });
    scenarios.push({ name: `hapus-${labels.join('-')}`, group: 'removal-lists', messages: [...opening, selected, `hapus ${labels.slice(0, 3).join(', ')}`],
      categories: [order[3]], min: 100, max: 200 });
  }
  return scenarios;
}

export const runMultiCategoryScenario = runUnderstandingScenario;

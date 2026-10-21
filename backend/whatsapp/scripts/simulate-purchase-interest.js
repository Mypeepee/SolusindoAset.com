import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SERIOUS_REPORTED, purchaseInterestScenarios, simulatePurchaseInterest } from './lib/purchase-interest-dialogues.js';

const results = [];
for (const scenario of purchaseInterestScenarios()) results.push(await simulatePurchaseInterest(scenario));
const journey = await simulatePurchaseInterest({ continueJourney: true });
results.push(journey);
const seriousJourney = await simulatePurchaseInterest({ example: 'pacarkembang', text: SERIOUS_REPORTED, continueJourney: true });
results.push(seriousJourney, await simulatePurchaseInterest({ example: 'pacarkembang', text: SERIOUS_REPORTED, memory: 'truncated', continueJourney: true }));
for (const variant of [{ future: true }, { verdict: 'available' }, { verdict: 'sold' }]) {
  results.push(await simulatePurchaseInterest(variant));
  results.push(await simulatePurchaseInterest({ ...variant, example: 'pacarkembang', text: SERIOUS_REPORTED }));
}
for (const text of [SERIOUS_REPORTED, 'sy serius pak', 'saya sudah mantap', 'saya siap lanjut']) {
  results.push(await simulatePurchaseInterest({ example: 'pacarkembang', text, after: 'details' }));
}
const summary = { total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length };
const report = '/private/tmp/kosku-purchase-interest.json';
await writeFile(report, JSON.stringify({ scope: 'Synthetic catalog, temporary SQLite, mocked WhatsApp, no real stock verification or outbound messages.', summary, results }, null, 2));
const transcript = fileURLToPath(new URL('../docs/simulasi-interest-setelah-biaya.md', import.meta.url));
await writeFile(transcript, ['# Simulasi minat setelah rincian biaya', '',
  'Katalog dan WhatsApp tiruan, SQLite sementara. Contoh Sumberpasir dan Pacarkembang mengikuti chat klien; ID yang tidak diberikan dan URL Tambaksari memakai data sintetis. Tidak memeriksa stok nyata atau mengirim pesan.', '',
  `${summary.passed}/${summary.total} skenario berhasil, termasuk variasi minat, riwayat yang dipangkas, jadwal mendatang, dan hasil konfirmasi operator dalam simulasi.`, '',
  ...journey.transcript.flatMap((turn, index) => [`## Giliran ${index + 1}`, '', `Klien: ${turn.user}`, '', `Bot:\n\n${turn.bot}`, '']),
  `Validasi: aset=${journey.selected_id}, pencarian=${journey.searches}, topik_akhir=${journey.topic}, fase=${journey.phase}, stok=${journey.stock_status}, lulus=${journey.passed}.`, '',
].join('\n'));
const seriousTranscript = fileURLToPath(new URL('../docs/simulasi-klien-serius.md', import.meta.url));
await writeFile(seriousTranscript, ['# Simulasi klien serius setelah rincian biaya', '',
  'Reproduksi chat lampiran: pilih nomor 4, kode 121037, Pacarkembang, Tambaksari, Surabaya; harga limit Rp350 juta, LT200 m², legalitas LAINNYA. Katalog/WhatsApp tiruan dan SQLite sementara. Semua URL Tambaksari serta empat ID lainnya sintetis karena tidak disertakan pada lampiran. Tidak ada pengecekan stok nyata atau pesan keluar.', '',
  `${summary.passed}/${summary.total} simulasi percakapan berhasil. Variasi mencakup minat/serius dengan sapaan, tanda baca, singkatan, riwayat dipangkas, setelah detail atau biaya, dan hasil verifikasi operator tiruan.`, '',
  'Ucapan serius memulai persiapan pembelian untuk aset yang tersimpan: KTP, cover buku tabungan, nominal tanda jadi, dan draf MOU. Penutupnya mengundang pertanyaan tentang draf MOU. Jawaban singkat “baik” atau “boleh” tetap membuka diskusi, tanpa menyatakan dokumen siap, persetujuan MOU, atau pembayaran. Jadwal yang lewat tetap menunggu konfirmasi stok; pernyataan kesiapan berkas yang eksplisit membawa sesi ke tim.', '',
  ...seriousJourney.transcript.flatMap((turn, index) => [`## Giliran ${index + 1}`, '', `Klien: ${turn.user}`, '', `Bot:\n\n${turn.bot}`, '']),
  `Validasi: aset=${seriousJourney.selected_id}, pencarian=${seriousJourney.searches}, topik_akhir=${seriousJourney.topic}, fase=${seriousJourney.phase}, stok=${seriousJourney.stock_status}, lulus=${seriousJourney.passed}.`, '',
].join('\n'));
console.log(JSON.stringify({ ...summary, report, transcript, seriousTranscript }));
for (const failure of results.filter((item) => !item.passed)) console.log(JSON.stringify({ name: failure.name, error: failure.error }));
if (summary.failed) process.exitCode = 1;

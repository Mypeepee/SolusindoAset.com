import { writeFile } from 'node:fs/promises';
import { scenarios, simulateRecommendations } from './lib/recommendation-dialogues.js';

const results = [];
for (const scenario of scenarios) {
  try { results.push(await simulateRecommendations(scenario)); }
  catch (error) { results.push({ name: scenario.name, passed: false, reason: error.message }); }
}
const failed = results.filter((result) => !result.passed);
const report = { simulated_inventory: true, scenarios: results.length, passed: results.length - failed.length, results };
const path = '/tmp/kosku-recommendation-simulations';
await writeFile(`${path}.json`, JSON.stringify(report, null, 2));
await writeFile(`${path}.md`, ['# Simulasi pilihan properti berikutnya', '',
  'Inventori simulasi. Tautan daftar lama dipakai hanya untuk menguji pembacaan ID. Tidak mengecek ketersediaan asli atau mengirim WhatsApp.', '',
  `${report.passed}/${report.scenarios} skenario lulus.`, '',
  ...results.flatMap((result) => [`## ${result.name} — ${result.passed ? 'LULUS' : 'GAGAL'}`, '',
    ...(result.transcript || []).flatMap((turn) => [`**Pengguna:** ${turn.text}`, '', `**Bot:** ${turn.reply}`, '']),
    ...(result.reason ? [result.reason, ''] : [])]),
].join('\n'));
console.log(`${report.passed}/${report.scenarios} simulasi rekomendasi lulus. Laporan: ${path}.md`);
for (const result of failed) console.error(`${result.name}: ${result.reason}`);
if (failed.length) process.exitCode = 1;

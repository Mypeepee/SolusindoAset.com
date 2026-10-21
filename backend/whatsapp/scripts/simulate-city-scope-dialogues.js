import { writeFile } from 'node:fs/promises';
import { scenarios, simulateCityScope } from './lib/city-scope-dialogues.js';

const results = [];
for (const scenario of scenarios) {
  try { results.push(await simulateCityScope(scenario)); }
  catch (error) { results.push({ name: scenario.name, passed: false, reason: error.message }); }
}
const failed = results.filter((result) => !result.passed);
const report = { simulated_inventory: true, scenarios: results.length, passed: results.length - failed.length, results };
const path = '/tmp/kosku-city-scope-simulations';
await writeFile(`${path}.json`, JSON.stringify(report, null, 2));
await writeFile(`${path}.md`, ['# Simulasi pilihan kota dan kabupaten', '',
  'Memakai referensi wilayah lokal dan query database sebenarnya dengan inventori tiruan kosong. Tidak mengirim WhatsApp atau memanggil AI.', '',
  `${report.passed}/${report.scenarios} skenario lulus.`, '',
  ...results.flatMap((result) => [`## ${result.name} — ${result.passed ? 'LULUS' : 'GAGAL'}`, '',
    ...(result.transcript || []).flatMap((turn) => [`**Pengguna:** ${turn.text}`, '', `**Bot:** ${turn.reply}`, '']),
    ...(result.reason ? [result.reason, ''] : [])]),
].join('\n'));
console.log(`${report.passed}/${report.scenarios} simulasi kota/kabupaten lulus. Laporan: ${path}.md`);
for (const result of failed) console.error(`${result.name}: ${result.reason}`);
if (failed.length) process.exitCode = 1;

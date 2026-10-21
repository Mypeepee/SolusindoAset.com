import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { singleSelectionScenarios, simulateSingleSelection, REPORTED } from './lib/single-recommendation-dialogues.js';

const results = [];
for (const scenario of singleSelectionScenarios()) results.push(await simulateSingleSelection(scenario));
const journey = await simulateSingleSelection({ text: REPORTED, format: 'html', closing: true });
results.push(journey);
const summary = { total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length };
const report = '/private/tmp/kosku-single-recommendation.json';
await writeFile(report, JSON.stringify({ scope: 'Controlled catalog, mock WhatsApp, temporary SQLite, no live stock or outbound messages.', summary, results }, null, 2));
const document = resolve(fileURLToPath(new URL('../docs/simulasi-single-asset.md', import.meta.url)));
await writeFile(document, ['# Simulasi pemilihan satu aset', '',
  'Data simulasi mengikuti contoh Sumberpasir. Tidak membaca stok sebenarnya, mengirim WhatsApp, atau menghubungi stoker.', '',
  `${summary.passed}/${summary.total} skenario berhasil, mencakup rujukan sehari-hari, jawaban pendek, Markdown dan spasi HTML.`, '',
  ...journey.transcript.flatMap((turn, index) => [`## Giliran ${index + 1}`, '', `Klien: ${turn.user}`, '', `Bot:\n\n${turn.bot}`, '']),
  `Validasi: aset=${journey.selected_id}, pencarian=${journey.searches}, pembacaan_detail=${journey.detail_reads}, lulus=${journey.passed}.`, '',
].join('\n'));
console.log(JSON.stringify({ ...summary, report, transcript: document }));
for (const failure of results.filter((item) => !item.passed)) console.log(JSON.stringify({ name: failure.name, error: failure.error }));
if (summary.failed) process.exitCode = 1;

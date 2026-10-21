import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { selectionLanguageScenarios, simulateSelectionLanguage } from './lib/selection-language-dialogues.js';
import { politeSelectionScenarios, simulatePoliteSelection } from './lib/polite-selection-dialogues.js';
const results = [];
for (const scenario of selectionLanguageScenarios()) results.push(await simulateSelectionLanguage(scenario));
for (const scenario of politeSelectionScenarios()) results.push(await simulatePoliteSelection(scenario));
const journey = await simulatePoliteSelection({ journey: true });
results.push(journey);
const summary = { total: results.length, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length };
const report = '/private/tmp/kosku-selection-language.json';
await writeFile(report, JSON.stringify({ scope: 'Offline numbered property selections with mock catalog and WhatsApp; temporary SQLite, no live inventory or outbound messages.', summary, results }, null, 2));
const transcript = fileURLToPath(new URL('../docs/simulasi-pilihan-nomor.md', import.meta.url));
await writeFile(transcript, ['# Simulasi gaya bahasa pemilihan nomor', '',
  'Data simulasi mengikuti lima kartu Menganti yang dilaporkan. WhatsApp dan katalog tiruan, SQLite sementara; tidak mengirim pesan sungguhan atau memeriksa stok nyata.', '',
  `${summary.passed}/${summary.total} skenario berhasil: variasi sapaan, posisi kata, angka/kata bilangan, pertanyaan sopan, singkatan, Markdown, spasi HTML, daftar terpecah dan riwayat yang dipangkas.`, '',
  ...journey.transcript.flatMap((turn, index) => [`## Giliran ${index + 1}`, '', `Klien: ${turn.user}`, '', `Bot:\n\n${turn.bot}`, '']),
  `Validasi: aset=${journey.selected_id}, pencarian=${journey.searches}, lulus=${journey.passed}.`, '',
].join('\n'));
console.log(JSON.stringify({ ...summary, report, transcript }));
for (const result of results.filter((r) => !r.passed).slice(0, 12)) console.log(JSON.stringify(result));
if (summary.failed) process.exitCode = 1;

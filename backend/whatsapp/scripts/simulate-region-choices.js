import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { regionChoiceScenarios, simulateRegionChoice } from './lib/region-choice-dialogues.js';

const results = [];
for (const scenario of regionChoiceScenarios()) results.push(await simulateRegionChoice(scenario));
const reported = results[0];
results.push(await simulateRegionChoice({ complete: true }));
const summary = { total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length };
const report = '/private/tmp/kosku-region-choices.json';
await writeFile(report, JSON.stringify({ scope: 'Local administrative snapshot, mocked catalog and WhatsApp; no live inventory or outbound messages.', summary, results }, null, 2));
const transcript = fileURLToPath(new URL('../docs/simulasi-pilihan-pakis.md', import.meta.url));
await writeFile(transcript, ['# Simulasi memilih Pakis dari konteks percakapan', '',
  'Menggunakan referensi wilayah lokal, WhatsApp tiruan dan katalog simulasi; tidak mengirim pesan sungguhan atau memeriksa stok nyata.', '',
  `${summary.passed}/${summary.total} skenario berhasil, termasuk variasi nama daerah/provinsi dan riwayat chat yang dipangkas.`, '',
  ...reported.transcript.flatMap((turn, index) => [`## Giliran ${index + 1}`, '', `Klien: ${turn.user}`, '', `Bot:\n\n${turn.bot}`, '']),
  `Validasi: kecamatan=${reported.profile?.district}, kabupaten=${reported.profile?.city}, provinsi=${reported.profile?.province}, lulus=${reported.passed}.`, '',
].join('\n'));
console.log(JSON.stringify({ ...summary, report, transcript }));
for (const failure of results.filter((item) => !item.passed)) console.log(JSON.stringify({ name: failure.name, error: failure.error }));
if (summary.failed) process.exitCode = 1;

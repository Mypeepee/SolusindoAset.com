import { writeFile } from 'node:fs/promises';
import { simulateAddressedIntroductions } from './lib/addressed-introduction-dialogues.js';

const results = await simulateAddressedIntroductions();
const report = '/private/tmp/kosku-addressed-introductions.json';
const summary = { total: results.length, passed: results.filter((item) => item.passed).length,
  failed: results.filter((item) => !item.passed).length, turns: results.reduce((total, item) => total + item.transcript.length, 0) };
await writeFile(report, JSON.stringify({ scope: 'Actual WhatsApp processor; synthetic contacts, catalog and transport. No real messages or database writes.', summary, results }, null, 2));
console.log(JSON.stringify({ ...summary, report }, null, 2));
for (const item of results.filter((item) => !item.passed).slice(0, 10)) console.log(`${item.text}: ${item.error}`);
if (summary.failed) process.exitCode = 1;

import { writeFile } from 'node:fs/promises';
import { simulatePropertyScope } from './lib/property-scope-dialogues.js';

const results = await simulatePropertyScope();
const summary = { total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length,
  turns: results.reduce((total, item) => total + item.transcript.length, 0) };
const report = '/private/tmp/kosku-property-scope.json';
await writeFile(report, JSON.stringify({ scope: 'Actual WhatsApp processor, synthetic catalog/AI/transport; no messages sent to real contacts.', summary, results }, null, 2));
console.log(JSON.stringify({ ...summary, report }, null, 2));
for (const result of results.filter((item) => !item.passed)) console.log(`${result.name}: ${result.error}`);
if (summary.failed) process.exitCode = 1;

import { writeFile } from 'node:fs/promises';
import { customerLanguageScenarios, simulateCustomerLanguage } from './lib/customer-language-dialogues.js';
const results = [];
for (const scenario of customerLanguageScenarios()) results.push(await simulateCustomerLanguage(scenario));
const summary = { total: results.length, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length,
  turns: results.reduce((sum, r) => sum + r.transcript.length, 0) };
const report = '/private/tmp/kosku-customer-language.json';
await writeFile(report, JSON.stringify({ scope: 'Synthetic customers through the live message processor with mock inventory and WhatsApp. No external AI, database writes, or real messages.', summary, results }, null, 2));
console.log(JSON.stringify({ ...summary, report }));
for (const result of results.filter((r) => !r.passed).slice(0, 12)) console.log(JSON.stringify({ name: result.name, error: result.error, last: result.transcript.at(-1) }));
if (summary.failed) process.exitCode = 1;

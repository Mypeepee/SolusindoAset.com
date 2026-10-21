import { writeFile } from 'node:fs/promises';
import { introductionOriginScenarios, simulateIntroductionOrigin } from './lib/introduction-origin-dialogues.js';
const results = [];
for (const scenario of introductionOriginScenarios()) results.push(await simulateIntroductionOrigin(scenario));
const summary = { total: results.length, passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length, turns: results.reduce((n, r) => n + r.turns, 0) };
const report = '/private/tmp/kosku-introduction-origins.json';
await writeFile(report, JSON.stringify({ scope: 'Actual message processor and search API validation; synthetic catalog, WhatsApp and CRM.', summary, results }, null, 2));
console.log(JSON.stringify({ ...summary, report }, null, 2));
for (const result of results.filter((r) => !r.passed).slice(0, 15)) console.log(`${result.name}: ${result.error}`);
if (summary.failed) process.exitCode = 1;

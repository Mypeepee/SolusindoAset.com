import { writeFile } from 'node:fs/promises';
import { transactionExclusionScenarios, simulateTransactionExclusion } from './lib/transaction-exclusion-dialogues.js';
const results = [];
for (const scenario of transactionExclusionScenarios()) results.push(await simulateTransactionExclusion(scenario));
const summary = { total: results.length, passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length, turns: results.reduce((n, r) => n + r.turns, 0) };
const report = '/private/tmp/kosku-transaction-exclusions.json';
await writeFile(report, JSON.stringify({ scope: 'Actual processor, property API validation and Prisma predicates; synthetic inventory, WhatsApp and CRM.', summary, results }, null, 2));
console.log(JSON.stringify({ ...summary, report }, null, 2));
for (const r of results.filter((r) => !r.passed).slice(0, 20)) console.log(`${r.name}: ${r.error}`);
if (summary.failed) process.exitCode = 1;

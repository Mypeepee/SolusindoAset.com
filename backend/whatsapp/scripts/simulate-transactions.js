import { writeFile } from 'node:fs/promises';
import { transactionScenarios, runTransactionScenario } from './lib/transaction-dialogues.js';
const results = [];
for (const scenario of transactionScenarios()) results.push(await runTransactionScenario(scenario));
const summary = { total: results.length, passed: results.filter((result) => result.passed).length, failed: results.filter((result) => !result.passed).length };
await writeFile('/tmp/kosku-transaction-simulations.json', JSON.stringify({ scope: 'Offline synthetic inventory, actual reply and Prisma filters; no live DB, AI or WhatsApp.', summary, results }, null, 2));
await writeFile('/tmp/kosku-transaction-simulations.md', '# Simulasi pilihan transaksi\n\nInventori sintetis. Tidak mengirim WhatsApp atau memakai AI/database live.\n\n' +
  results.map((result) => `## ${result.name} — ${result.passed ? 'LULUS' : result.error}\n\n${result.transcript.map((turn) => `**User:** ${turn.user}\n\n**Bot:** ${turn.reply}\n\nFilter: ${JSON.stringify(turn.profile)}\n`).join('\n')}`).join('\n'));
console.log(JSON.stringify({ ...summary, report: '/tmp/kosku-transaction-simulations.md' }, null, 2));
for (const result of results.filter((item) => !item.passed).slice(0, 25)) console.log(result.name, result.error);
if (summary.failed) process.exitCode = 1;

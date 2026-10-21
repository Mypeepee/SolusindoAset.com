import { writeFile } from 'node:fs/promises';
import { conversationStyleScenarios, simulateConversationStyle } from './lib/conversation-style-dialogues.js';
const results = [];
for (const scenario of conversationStyleScenarios()) results.push(await simulateConversationStyle(scenario));
const summary = { total: results.length, passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length, turns: results.reduce((n, r) => n + r.turns, 0) };
const report = '/private/tmp/kosku-conversation-styles.json';
await writeFile(report, JSON.stringify({ scope: 'Real message processor, memory and property API validation; synthetic catalog/CRM/WhatsApp; no external messages or AI.', summary, results }, null, 2));
const examples = results.filter((r) => !r.passed || ['budget dulu / bebas sih', 'transaksi dulu / apa aja boleh',
  'koreksi pilihan / bebas sih, tapi jangan lelang', 'satuan dan periode sekaligus / juta per tahun pak'].includes(r.name));
await writeFile('/private/tmp/kosku-conversation-styles.md', '# Simulasi gaya bahasa percakapan\n\n' + JSON.stringify(summary) + '\n\n' + examples.map((r) =>
  `## ${r.name} — ${r.passed ? 'LULUS' : r.error}\n\n${r.transcript.map((turn) => `**User:** ${turn.user}\n\n**Bot:** ${turn.reply}\n`).join('\n')}`).join('\n'));
console.log(JSON.stringify({ ...summary, report }, null, 2));
for (const r of results.filter((r) => !r.passed).slice(0, 25)) console.log(`${r.name}: ${r.error}`);
if (summary.failed) process.exitCode = 1;

import { writeFile } from 'node:fs/promises';
import { scenarios, simulateDetailAlternatives } from './lib/detail-alternatives-dialogues.js';

const results = [];
for (const scenario of scenarios) {
  try { results.push(await simulateDetailAlternatives(scenario)); }
  catch (error) { results.push({ name: scenario.name, passed: false, reason: error.message }); }
}
const failed = results.filter((r) => !r.passed);
const report = { simulated_inventory: true, scenarios: results.length, passed: results.length - failed.length, results };
const path = '/tmp/kosku-detail-alternatives-simulations';
await writeFile(`${path}.json`, JSON.stringify(report, null, 2));
await writeFile(`${path}.md`, ['# Simulasi daftar → detail → cari pilihan lain', '',
  'Inventori tiruan dengan parser, balasan, connector, validasi API dan query Prisma asli. Tanpa AI atau pengiriman WhatsApp.', '',
  `${report.passed}/${report.scenarios} skenario lulus.`, '', ...results.flatMap((r) => [
    `## ${r.name} — ${r.passed ? 'LULUS' : 'GAGAL'}`, '', ...(r.transcript || []).flatMap((turn) => [
      `**Customer:** ${turn.text}`, '', `**Chatbot:** ${turn.reply}`, '',
    ]), ...(r.reason ? [r.reason, ''] : []),
  ])].join('\n'));
console.log(`${report.passed}/${report.scenarios} simulasi detail-ke-alternatif lulus. Laporan: ${path}.md`);
for (const r of failed) console.error(`${r.name}: ${r.reason}`);
if (failed.length) process.exitCode = 1;

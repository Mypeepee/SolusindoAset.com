import { writeFile } from 'node:fs/promises';
import { scenarios, simulateAdvancedSearch } from './lib/advanced-search-dialogues.js';

const results = [];
for (const scenario of scenarios) {
  try { results.push(await simulateAdvancedSearch(scenario)); }
  catch (error) { results.push({ name: scenario.name, passed: false, reason: error.message }); }
}
const failed = results.filter((r) => !r.passed);
const report = { simulated_inventory: true, scenarios: results.length, passed: results.length - failed.length, results };
const path = '/tmp/kosku-advanced-chat-simulations';
await writeFile(`${path}.json`, JSON.stringify(report, null, 2));
await writeFile(`${path}.md`, ['# Simulasi pencarian chatbot berdasarkan wilayah dan landmark', '',
  'Inventori tiruan; memakai parser, funnel, DatabaseCatalog, validasi API dan filter Prisma asli. Tidak memanggil AI, peta eksternal, atau mengirim WhatsApp.', '',
  `${report.passed}/${report.scenarios} skenario lulus.`, '', ...results.flatMap((r) => [
    `## ${r.name} — ${r.passed ? 'LULUS' : 'GAGAL'}`, '', ...(r.transcript || []).flatMap((turn) => [
      `**Customer:** ${turn.text}`, '', `**Chatbot:** ${turn.reply}`, '', `Hasil simulasi: ${turn.result_ids.join(', ') || 'belum ada'}`, '',
    ]), ...(r.reason ? [r.reason, ''] : []),
  ])].join('\n'));
console.log(`${report.passed}/${report.scenarios} simulasi lulus. Laporan: ${path}.md`);
for (const r of failed) console.error(`${r.name}: ${r.reason}`);
if (failed.length) process.exitCode = 1;

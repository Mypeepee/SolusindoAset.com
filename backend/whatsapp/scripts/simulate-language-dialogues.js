import { writeFile } from 'node:fs/promises';
import { languageScenarios, runLanguageScenario, summarizeLanguageResults } from './lib/language-dialogues.js';

const baseline = process.argv.includes('--baseline'), seed = 20261012;
const results = [];
for (const scenario of languageScenarios({ seed })) results.push(await runLanguageScenario(scenario));
const summary = summarizeLanguageResults(results);
const path = `/tmp/kosku-language-${baseline ? 'baseline' : 'simulations'}.json`;
await writeFile(path, JSON.stringify({ seed, scope: 'Synthetic offline dialogues; empty inventory, no AI or WhatsApp sends. Not a production accuracy estimate.', summary, results }, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, report: path }, null, 2));
if (summary.failed) {
  console.log(results.filter((r) => !r.passed).slice(0, 8).map((r) => `${r.name}: ${r.error}`).join('\n'));
  if (!baseline) process.exitCode = 1;
}

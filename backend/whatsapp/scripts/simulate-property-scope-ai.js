// Explicit live-provider evaluation. No database or WhatsApp transport is used.
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { serviceDirectory, loadConfig } from '../config.js';
import { createAiController } from '../services/ai_controller.js';

dotenv.config({ path: resolve(serviceDirectory, '.env'), quiet: true });
const config = loadConfig().llm;
const ai = createAiController(config);
const samples = [
  ['Golek omah kanggo keluarga pak', 'property_search'],
  ['Mas tulung golekkno omah sing cocok kanggo anak bojo', 'property_search'],
  ['Need a small warehouse around Gresik, could you help?', 'property_search'],
  ['Sy lg nyri tmpat tnggal utk kluarga', 'property_search'],
  ['Boleh bantu saya punya tempat menetap bersama anak istri?', 'property_search'],
  ['Butuh bangunan buat nyimpen stok dagangan', 'property_search'],
  ['Bisa bantu perpanjang lisensi tahunan tim?', 'other'],
  ['Mas file kemarin udah ditandatangani pimpinan belum?', 'other'],
  ['Maaf aku mau koordinasi pengiriman barang buat besok', 'other'],
  ['Need a rental car for a business trip', 'other'],
  ['yang itu masih kosong nggak?', 'property', true],
  ['Mas tanggal presentasine dipindah Senen wae yo', 'other', true],
];
const report = '/private/tmp/kosku-property-scope-ai.json';
const previous = process.argv.includes('--retry-failed') ? JSON.parse(await readFile(report, 'utf8')) : null;
const results = previous ? previous.results.filter((item) => item.passed) : [];
for (const [text, expected, hasContext = false] of samples) {
  if (results.some((item) => item.text === text && item.passed)) continue;
  try {
    const scope = await ai.classifyPropertyScope({ text, hasContext, history: hasContext
      ? [{ role: 'user', content: 'Kode 121791' }, { role: 'assistant', content: 'Rumah kode 121791 berada di Benowo, Surabaya. Ada bagian lain dari rumah ini yang ingin ditanyakan?' }] : [] });
    results.push({ text, expected, scope, passed: scope === expected });
  } catch (error) { results.push({ text, expected, passed: false, error: error.code || error.name }); }
  console.log(JSON.stringify(results.at(-1)));
}
const summary = { provider: config.provider, model: config.model, total: results.length, passed: results.filter((item) => item.passed).length,
  unavailable: results.filter((item) => item.error).length };
await writeFile(report, JSON.stringify({ scope: 'Live model classification of synthetic messages only; no WhatsApp or database access. These samples are not a production accuracy estimate.', summary, results }, null, 2));
console.log(JSON.stringify({ ...summary, report }, null, 2));
if (summary.passed !== summary.total) process.exitCode = 1;

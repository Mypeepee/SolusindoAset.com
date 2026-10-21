// Explicit, opt-in provider evaluation. Never imports the WhatsApp transport,
// connects to the database, or sends external messages.
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { serviceDirectory, loadConfig } from '../config.js';
import { createAiController } from '../services/ai_controller.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { buyerContext } from '../services/buyer_profile.js';

dotenv.config({ path: resolve(serviceDirectory, '.env'), quiet: true });
const config = loadConfig().llm, ai = createAiController(config);
const samples = [
  ['Buat tempat tinggal ataupun buka warung pak, soal ukuran jangan dipikirin', ['RUMAH', 'TOKO']],
  ['Buat dihuni keluarga saja, ukuran tidak jadi syarat.', ['RUMAH']],
  ['Bangunan untuk menyimpan stok dagangan, besar kecil lahannya boleh.', ['GUDANG']],
  ['Tempat berdagang aja pak, ukuran lahan berapa pun boleh.', ['TOKO']],
  ['Bangunan kamar-kamar untuk indekos, besar kecil tanah tidak masalah.', ['KOS']],
];
const results = [];
for (const [sample, expected] of samples) {
  const history = [], transcript = [], events = [], calls = [];
  const catalog = { async resolve(_text, _id, criteria) { calls.push(criteria); return { status: 'not_found', asset: null, catalog: [], source: 'simulation' }; } };
  const wrappedAi = { ...ai, async interpretBuyer(input) {
    try { const result = await ai.interpretBuyer(input); events.push({ status: result ? 'proposed' : 'no_valid_proposal', generation: result?.generation }); return result; }
    catch (error) { events.push({ status: 'unavailable', code: error.code || 'UNAVAILABLE' }); throw error; }
  } };
  let buyer;
  const send = async (text) => {
    history.push({ role: 'user', content: text });
    const result = await generatePropertyReply({ text, history, catalog, ai: wrappedAi });
    buyer = buyerContext(history, text, null);
    transcript.push({ user: text, reply: result.reply, profile: buyer.profile, status: result.knowledge.status });
    history.push({ role: 'assistant', content: result.reply });
    return result;
  };
  try {
    for (const text of ['Cari lelang aset di Kecamatan Menganti, Kabupaten Gresik', 'seluruh Menganti pak budget 400 juta', sample]) await send(text);
    const queriedBeforeConfirmation = calls.length > 0;
    if (transcript.at(-1).reply.startsWith('Apakah maksud Bapak/Ibu: ')) await send('iya betul pak');
    const profile = buyer.profile;
    const actual = profile.categories || (profile.category ? [profile.category] : []);
    const proposed = events.some((event) => event.status === 'proposed');
    const passed = (!proposed || !queriedBeforeConfirmation) && buyer.stage === 'recommendations' && calls.length === 1 &&
      JSON.stringify(actual.toSorted()) === JSON.stringify(expected.toSorted()) && profile.max_price === 400000000 &&
      profile.location === 'Menganti' && profile.district === 'Menganti' && profile.city === 'Kabupaten Gresik' &&
      profile.min_land_area_m2 === null && profile.max_land_area_m2 === null;
    results.push({ sample, expected, actual, passed, queriedBeforeConfirmation, events, transcript });
  } catch (error) { results.push({ sample, expected, passed: false, error: error.code || error.name, events, transcript }); }
  console.log(JSON.stringify({ sample, passed: results.at(-1).passed, events }));
}
const summary = { provider: config.provider, model: config.model, total: results.length, passed: results.filter((r) => r.passed).length,
  unavailable: results.filter((r) => r.events.some((event) => event.status === 'unavailable')).length };
const path = '/tmp/kosku-understanding-ai.json';
await writeFile(path, JSON.stringify({ scope: 'Five live-provider samples, simulated inventory, no WhatsApp or database access. Not a production accuracy estimate.', summary, results }, null, 2));
console.log(JSON.stringify({ ...summary, report: path }, null, 2));
if (summary.passed !== summary.total) process.exitCode = 1;

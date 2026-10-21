import test from 'node:test';
import assert from 'node:assert/strict';
import { buyerContext } from '../services/buyer_profile.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { createAiController } from '../services/ai_controller.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { ConversationControl } from '../state/conversation_control.js';
import { getPropertyKnowledge, isBuyerCriteria } from '../../../src/lib/chatbot/property-knowledge.ts';
import { SMART_SEARCH_SCHEMA, SMART_SEARCH_PROMPT, createSmartSearchParser, validateSmartSearch, localDiscovery } from '../services/smart_search_parser.js';

const NOW = Date.parse('2026-10-20T18:14:34+07:00');
const PHONE = '6281234567890';
const bubbles = [
  'berapa lama aman ditempati? dan minimal siap dana brp setelah bayar lunas lelang e',
  'lelang dibawah 1m', 'itc/atom sampai ke stikom/merr',
  'prefer manyar/ngagel/pucang ga mau ijo\nnol jalan 2arah aspal. hitung tanah luas min 80',
];
const combined = bubbles.join('\n');
const source = 'database_listing_publik';
function fixture(ai = { generate() { assert.fail('Search must not need answer generation'); } }) {
  const history = [], lookups = [];
  const catalog = { async resolve(text, previousId, criteria) { lookups.push(criteria); return { status: 'not_found', source, asset: null, catalog: [] }; } };
  let state = { is_bot_active: true };
  return { history, lookups, catalog, async send(text) {
    history.push({ role: 'user', content: text, seq: history.length + 1 });
    const result = await generatePropertyReply({ catalog, ai, text, history, policyState: state, now: NOW });
    if (result.buyer_state) state.buyer_state = result.buyer_state;
    state.client_identity = { name: 'Koko', salutation: null, asked: true, declined: false };
    if (result.reply) history.push({ role: 'assistant', content: result.reply, seq: history.length + 1 });
    return result;
  } };
}
function assertCriteria(p) {
  assert.equal(p.transaction_type, 'LELANG'); assert.equal(p.category, 'RUKO');
  assert.equal(p.max_price, 1_000_000_000); assert.equal(p.min_land_area_m2, 80);
  assert.deepEqual(p.locations, ['Manyar', 'Ngagel', 'Pucang']);
  assert.deepEqual(p.route_landmarks, ['ITC', 'Pasar Atom', 'Stikom', 'MERR']);
  assert.deepEqual(p.certificate_types, ['SHM', 'HGB']);
  assert.match(p.special_requirements, /nol jalan.*2arah aspal.*hitung tanah/i);
  assert.notEqual(p.location?.toLowerCase(), 'ok');
  assert.equal(isBuyerCriteria(p), true);
}

test('Koko transcript: combined query answers both questions, preserves all filters, and asks only the missing type', async () => {
  const f = fixture(); await f.send('Sore'); await f.send('Koko');
  const first = await f.send(combined);
  assert.match(first.reply, /kondisi penghuni/); assert.match(first.reply, /bea lelang/);
  assert.match(first.reply, /Koko/); assert.match(first.reply, /1\.000\.000\.000/);
  assert.doesNotMatch(first.reply, /Incar daerah mana|kota atau kabupaten mana|Budget-nya sampai berapa|100%|berapa hari/i);
  assert.equal(f.lookups.length, 0, 'type is genuinely unknown, rather than guessed from hitung tanah');
  await f.send('Ruko'); assertCriteria(f.lookups.at(-1));
  for (const text of ['itc/atom sampai ke stikom/merr', bubbles[3].replace('80', ''), 'Ok', 'Carikan']) {
    const result = await f.send(text); assertCriteria(f.lookups.at(-1));
    assert.doesNotMatch(result.reply, /Incar daerah mana|Boleh tahu saya ngobrol|di Ok\b/i);
  }
});

test('rapid WhatsApp bubbles are merged before the final delayed reply and earlier questions are answered', async () => {
  const config = { transport: 'baileys', replyDelayMs: 1, maxSessions: 20, maxPending: 30, maxPendingPerPhone: 20, maxDedup: 100, sessionTtlMs: 86400000 };
  const store = new MemoryStore(config, () => NOW), sent = [], filters = [];
  const processor = new MessageProcessor({ config, store, now: () => NOW, sleep: async () => {}, logger: { error() {} },
    whatsapp: { async sendText(to, text) { sent.push(text); return `out-${sent.length}`; } },
    catalog: { async resolve(text, id, criteria) { filters.push(criteria); return { status: 'not_found', source, catalog: [], asset: null }; } },
    ai: { generate() { assert.fail('No model needed for known expressions'); } } });
  processor.acceptBatch([...bubbles, 'Ruko'].map((text, i) => ({ id: `burst-${i}`, from: PHONE, timestamp: NOW, type: 'text', text })));
  await processor.drain(); assert.equal(sent.length, 1); assertCriteria(filters.at(-1));
  assert.match(sent[0], /kondisi penghuni/); assert.match(sent[0], /bea lelang/);
  assert.equal(store.get(PHONE).is_bot_active, true);
});

test('structured search memory survives history trimming and short acknowledgements', async () => {
  const initial = buyerContext([], `Cari ruko ${combined}`, null);
  assertCriteria(initial.profile);
  for (const text of ['Ok', 'sip', 'baik ko', 'Carikan']) {
    const buyer = buyerContext([], text, null, { continuation: initial.continuation });
    assertCriteria(buyer.profile); assert.deepEqual(buyer.missing, []);
  }
});

test('structured search survives a backend restart, stays tenant-scoped and still accepts new turns', async (t) => {
  let time = NOW;
  const controls = new ConversationControl(':memory:', () => time); t.after(() => controls.close());
  const config = { transport: 'baileys', maxSessions: 20, maxPending: 30, maxPendingPerPhone: 20, maxDedup: 100, sessionTtlMs: 86400000 };
  const control = controls.forTenant('AG1'), first = new MemoryStore(config, () => time, control);
  const sent = [], filters = [];
  const build = (store) => new MessageProcessor({ config, store, now: () => time,
    whatsapp: { async sendText(to, text) { sent.push(text); return `out-${sent.length}`; } },
    catalog: { async resolve(text, id, criteria) { filters.push(criteria); return { status: 'not_found', source, catalog: [], asset: null }; } },
    ai: { generate() { assert.fail('offline search'); } }, logger: { error() {} } });
  const original = build(first);
  original.acceptBatch([{ id: 'before-restart', from: PHONE, timestamp: time, type: 'text', text: `Cari ruko ${combined}` }]);
  await original.drain(); assertCriteria(filters.at(-1));
  const second = new MemoryStore(config, () => time, control), restored = second.create(PHONE);
  assert.equal(restored.history.length, 0); assertCriteria(restored.buyer_state.profile);
  assert.equal(controls.forTenant('AG2').getSearch(PHONE), null);
  const restarted = build(second);
  restarted.acceptBatch([{ id: 'after-restart', from: PHONE, timestamp: time, type: 'text', text: 'budget maksimal 900 juta' }]);
  await restarted.drain(); assert.equal(filters.at(-1).max_price, 900_000_000);
  assert.equal(filters.at(-1).category, 'RUKO'); assert.deepEqual(filters.at(-1).locations, ['Manyar', 'Ngagel', 'Pucang']);
  time += 46 * 60000;
  assert.equal(new MemoryStore(config, () => time, control).create(PHONE).buyer_state, null);
});

test('edits add/remove areas without dropping unrelated filters; removing the last area asks again', async () => {
  const f = fixture(); await f.send(`Cari ruko ${combined}`);
  await f.send('hapus Manyar'); assert.deepEqual(f.lookups.at(-1).locations, ['Ngagel', 'Pucang']);
  await f.send('tambahkan Manyar'); assert.deepEqual(f.lookups.at(-1).locations, ['Ngagel', 'Pucang', 'Manyar']);
  assert.equal(f.lookups.at(-1).category, 'RUKO'); assert.equal(f.lookups.at(-1).max_price, 1e9);
  const b = buyerContext([], 'Cari ruko lelang di Surabaya prefer Darmo/Keputih, budget 1m, luas tanah min 80', null);
  const last = buyerContext([], 'hapus Darmo/Keputih', null, { continuation: b.continuation });
  assert.ok(last.missing.includes('location')); assert.equal(last.profile.max_price, 1e9);
});

for (const areas of ['Manyar/Ngagel/Pucang', 'Manyar, Ngagel, Pucang', 'Manyar atau Ngagel atau Pucang']) {
  test(`multi-area alternatives: ${areas}`, () => {
    const buyer = buyerContext([], `Cari ruko lelang di Surabaya, prefer ${areas}, budget 1 miliar, luas tanah min 80`, null);
    assert.deepEqual(buyer.profile.locations, ['Manyar', 'Ngagel', 'Pucang']);
    assert.equal(buyer.profile.category, 'RUKO'); assert.ok(!buyer.missing.includes('location'));
  });
}

test('multi-city arrays do not silently narrow to the first city', async () => {
  const f = fixture();
  const r = await f.send('Cari ruko lelang di Surabaya, Sidoarjo, Gresik. Budget 1 miliar, luas tanah min 80');
  const criteria = f.lookups.at(-1);
  assert.deepEqual(criteria.cities.map((v) => v.toLowerCase()), ['surabaya', 'sidoarjo', 'gresik']);
  assert.equal(criteria.city, null); assert.equal(isBuyerCriteria(criteria), true);
  assert.doesNotMatch(r.reply, /Incar daerah mana|kota atau kabupaten mana/);
});

test('property category arrays remain distinct from land valuation and measurements', () => {
  const b = buyerContext([], 'Cari ruko atau tanah lelang di Surabaya, prefer Manyar/Ngagel/Pucang. Budget 1 miliar, hitung tanah, luas tanah min 80', null);
  assert.deepEqual(b.profile.categories, ['RUKO', 'TANAH']);
  const next = buyerContext([], 'hitung tanah luas min 100', null, { continuation: b.continuation });
  assert.deepEqual(next.profile.categories, ['RUKO', 'TANAH']); assert.equal(next.profile.min_land_area_m2, 100);
});

test('database uses one OR for areas while AND-enforcing budget, land, city and certificate data', async () => {
  const b = buyerContext([], `Cari ruko ${combined}`, null), queries = [];
  await getPropertyKnowledge({ listing: { async findMany(query) { queries.push(query); return []; } } }, { text: combined, criteria: b.profile }, NOW);
  const where = queries[0].where;
  assert.equal(where.kategori, 'RUKO'); assert.deepEqual(where.legalitas, { in: ['SHM', 'HGB'] });
  assert.equal(where.luas_tanah.gte, 80); assert.equal(where.jenis_transaksi, 'LELANG');
  const areas = where.AND.find((clause) => clause.OR?.length === 3 && clause.OR.every((v) => v.OR));
  assert.ok(areas); assert.match(JSON.stringify(areas.OR[0]), /Manyar/);
  assert.match(JSON.stringify(areas.OR[1]), /Ngagel/); assert.match(JSON.stringify(areas.OR[2]), /Pucang/);
  assert.match(JSON.stringify(where), /1000000000/); assert.match(JSON.stringify(where), /Surabaya/);
  assert.doesNotMatch(JSON.stringify(where), /hitung tanah|nol jalan|Bukan Surat Ijo/);
  for (const query of queries) assert.equal(query.select.deskripsi, undefined);
});

test('malformed multi-parameter criteria fail before any database lookup', async () => {
  const valid = buyerContext([], `Cari ruko ${combined}`, null).profile;
  for (const patch of [{ locations: 'Manyar' }, { cities: ['Ok', 'Surabaya', 'Surabaya'] }, { certificate_types: ['SURAT_IJO'] }, { locations: Array(11).fill('Manyar') }, { special_requirements: 'x'.repeat(601) }, { $where: 'DROP TABLE listing' }]) {
    await assert.rejects(getPropertyKnowledge({ listing: { findMany() { assert.fail('validation must precede database'); } } }, { text: combined, criteria: { ...valid, ...patch } }), /INVALID_BUYER_CRITERIA/);
  }
});

const emptyOutput = () => ({ jenis_properti: [], budget_maksimal: null, lokasi_diminati: [], patokan_area_atau_rute: [], syarat_legalitas: [], spesifikasi_khusus: '', kota_kabupaten: [], luas_tanah_minimal: null, luas_tanah_maksimal: null, operasi_lokasi: 'keep', bukti: Object.fromEntries(Object.keys(SMART_SEARCH_SCHEMA.properties.bukti.properties).map((k) => [k, ''])) });

for (const provider of ['openai', 'gemini']) {
  test(`${provider} structured extraction sends full retained history plus memory and uses the strict schema`, async () => {
    const text = 'prefer Darmo/Keputih, nol jalan', history = Array.from({ length: 16 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `turn-${i}` }));
    let body;
    const output = { ...emptyOutput(), lokasi_diminati: ['Darmo', 'Keputih'], operasi_lokasi: 'replace' };
    output.bukti.lokasi_diminati = 'Darmo/Keputih';
    const parse = createSmartSearchParser({ provider, model: 'test', apiKey: 'test-only', timeoutMs: 1000 }, { fetchImpl: async (url, options) => {
      body = JSON.parse(options.body);
      return Response.json(provider === 'openai' ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] } : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] });
    } });
    const result = await parse({ text, history, buyer: { profile: { category: 'RUKO', max_price: 1e9 } } });
    assert.deepEqual(result.patch.locations, ['Darmo', 'Keputih']);
    const serialized = JSON.stringify(body);
    assert.match(serialized, /turn-0/); assert.match(serialized, /turn-15/); assert.match(serialized, /RINGKASAN_KRITERIA/);
    assert.match(serialized, /smart_property_search|responseJsonSchema/);
    if (provider === 'openai') { assert.equal(body.text.format.strict, true); assert.equal(body.store, false); }
  });
}

test('hallucinated or assistant-only evidence cannot change search filters', () => {
  const output = { ...emptyOutput(), lokasi_diminati: ['Jakarta'], operasi_lokasi: 'replace', budget_maksimal: 5e9 };
  output.bukti.lokasi_diminati = 'prefer Manyar'; output.bukti.budget_maksimal = 'budget 1m';
  assert.deepEqual(validateSmartSearch(output, 'prefer Manyar, budget 1m'), {});
  output.lokasi_diminati = ['Ok']; output.bukti.lokasi_diminati = 'Ok';
  assert.equal(validateSmartSearch(output, 'Ok').locations, undefined);
  assert.equal(validateSmartSearch({ ...output, sql: 'SELECT *' }, 'Ok'), null);
});

test('model outage keeps locally extracted filters and never restarts greetings', async () => {
  const f = fixture({ parseSearch() { throw new Error('quota'); }, generate() { assert.fail('local search must continue'); } });
  await f.send(`Cari ruko ${combined}`); assertCriteria(f.lookups.at(-1));
  const result = await f.send('Ok'); assertCriteria(f.lookups.at(-1));
  assert.doesNotMatch(result.reply, /Halo, saya asisten|Incar daerah mana/);
});

test('local ambiguity and existing single-area qualification remain intact', () => {
  assert.deepEqual(localDiscovery('Cari ruko di Surabaya, budget 1m'), {});
  assert.equal(buyerContext([], 'Cari ruko lelang di Surabaya, budget 1m, luas min 80', null).missing.includes('location'), true);
  assert.equal(localDiscovery('Manyar').cities, undefined);
  assert.match(SMART_SEARCH_PROMPT, /BUKAN jenis TANAH/);
});

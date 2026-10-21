import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { cleanNearbyQuery, nearbyQueryParts, searchScopeTurn } from '../services/search_scope.js';
import { advancedFixture, row } from '../scripts/lib/advanced-search-dialogues.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { recommendationIds } from '../services/recommendations.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { ClientOutbox } from '../state/client_outbox.js';
import { createSandboxRouter } from '../routes/sandbox.js';

const cases = [
  ['hmmm, ada yang dekat dengan sekolah kah pak?', 'sekolah'],
  ['Ada yang dekat sekolahkah pak?', 'sekolah'],
  ['dekat sekolah-kah bu?', 'sekolah'],
  ['dekat sekolah kah ya pak?', 'sekolah'],
  ['dekat sekolah nggak ya pak?', 'sekolah'],
  ['deket sekolah gak sih kak?', 'sekolah'],
  ['dekat sekolah bisa nggak pak?', 'sekolah'],
  ['dekat sekolah boleh gak mbak?', 'sekolah'],
  ['dekat sekolah ada nggak pak?', 'sekolah'],
  ['dekat sekolah adakah pak?', 'sekolah'],
  ['dekat sekolah bisakah pak?', 'sekolah'],
  ['dekat sekolah bolehkah bu?', 'sekolah'],
  ['dekat rumah sakitkah bu?', 'rumah sakit'],
  ['dekat rumah sakit kah mbak?', 'rumah sakit'],
  ['dekat RSUD-kah pak?', 'RSUD'],
  ['dekat mallkah kak?', 'mall'],
  ['dekat pintu tolkah pak?', 'pintu tol'],
  ['dekat Stasiun Gubeng dong mas?', 'Stasiun Gubeng'],
  ['dekat Pakuwon Mall bisa nggak bu?', 'Pakuwon Mall'],
  ['dekat SD Harapan Ibu bisa gak pak?', 'SD Harapan Ibu'],
  ['dekat SD Harapan Ibu kah bu?', 'SD Harapan Ibu'],
  ['dekat SD Harapan Ibu pak?', 'SD Harapan Ibu'],
  ['dekat SD Harapan Ibu', 'SD Harapan Ibu'],
  ['dekat Masjid Al Barokah kah pak?', 'Masjid Al Barokah'],
  ['dekat Klinik Berkah dong kak?', 'Klinik Berkah'],
  ['dekat RS Ibu dan Anak Berkah kah bu?', 'RS Ibu dan Anak Berkah'],
  ['dekat sekolah kah pak dan rumah sakit juga bu?', 'sekolah dan rumah sakit'],
  ['dekat sekolah dan dekat rumah sakit kah pak?', 'sekolah dan rumah sakit'],
  ['dekat sekolah atau rumah sakitkah bu?', 'sekolah atau rumah sakit'],
];
for (const [text, expected] of cases) test(`landmark conversational language: ${text}`, () => {
  const scope = searchScopeTurn(text);
  assert.equal(scope.nearby?.query, expected);
  assert.equal(cleanNearbyQuery(expected), expected, 'Normalizing twice must not corrupt a real place name');
});

test('compound requirements preserve AND/OR while discourse words are removed per operand', () => {
  assert.deepEqual(nearbyQueryParts('sekolah kah pak dan rumah sakitkah bu atau mall dong kak'), [['sekolah', 'rumah sakit'], ['mall']]);
  assert.deepEqual(nearbyQueryParts('RS Ibu dan Anak Berkah kah pak'), [['RS Ibu dan Anak Berkah']]);
  assert.equal(cleanNearbyQuery('Klinik Ada'), 'Klinik Ada');
});

test('rephrasing the same landmark keeps an explicit radius instead of widening the search', () => {
  const nearby = { query: 'sekolah', radius_m: 500 };
  for (const text of ['dekat sekolahkah pak?', 'hmmm, ada yang dekat dengan sekolah kah pak?']) {
    assert.deepEqual(searchScopeTurn(text, { nearby }).nearby, nearby);
  }
});

const opening = 'Nama saya Budi, cari rumah lelang di Surabaya Utara budget maksimal 200 juta luas tanah bebas';
const reported = 'hmmm, ada yang dekat dengan sekolah kah pak?';
const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const poi = (kelas, nama, distance) => ({ jarak_meter: distance, tempat: { kelas, nama, nama_normal: nama.toLowerCase(), alias: [], jangkauan: 'HARIAN' } });
function fixture() {
  // All five public-style cards are returned first. Only the first two meet
  // the school requirement. Tempting rows catch lost price/area/type filters.
  const north = { jenis_transaksi: 'LELANG', nilai_limit_lelang: 180e6, harga_efektif: 180e6, harga: null,
    kecamatan: 'Kenjeran', tanggal_lelang: new Date('2026-10-08T00:00:00Z') };
  return advancedFixture({ inventory: [
    row(980001, { ...north, tempatDekat: [poi('SEKOLAH', 'SD Harapan Ibu', 100), poi('RUMAH_SAKIT', 'RS Contoh', 250)] }),
    row(980002, { ...north, tempatDekat: [poi('SEKOLAH', 'SD Contoh', 800)] }),
    row(980003, { ...north, tempatDekat: [poi('SEKOLAH', 'SD Contoh', 5300)] }),
    row(980004, { ...north, tempatDekat: [poi('RUMAH_SAKIT', 'RS Contoh', 200)] }),
    row(980005, { ...north, tempatDekat: [] }),
    row(980006, { ...north, kecamatan: 'Tandes', tempatDekat: [poi('SEKOLAH', 'SD Contoh', 100)] }),
    row(980007, { ...north, nilai_limit_lelang: 200000001, harga_efektif: 200000001, tempatDekat: [poi('SEKOLAH', 'SD Contoh', 100)] }),
    row(980008, { ...north, kategori: 'RUKO', tempatDekat: [poi('SEKOLAH', 'SD Contoh', 100)] }),
  ] });
}
function expectSchoolResult(f, reply) {
  assert.deepEqual(recommendationIds(reply), ['980001', '980002']);
  const criteria = f.criteria.at(-1);
  assert.equal(criteria.nearby.query, 'sekolah'); assert.equal(criteria.region_group, 'utara');
  assert.equal(criteria.max_price, 200000000); assert.equal(criteria.category, 'RUMAH'); assert.equal(criteria.transaction_type, 'LELANG');
  assert.doesNotMatch(reply, /sekolah kah|sekolahkah|[Bb]udget(?:-nya)? sampai berapa|[Kk]elurahan mana|[Ii]ncar daerah mana/);
}

test('reported dialogue filters actual POI relations instead of treating sekolah kah as a proper name', async () => {
  const f = fixture(), history = [];
  for (const text of [opening, reported]) {
    history.push({ role: 'user', content: text });
    const response = await generatePropertyReply({ ...f, text, history });
    const reply = (response.replies || [response.reply]).join('\n');
    if (text === reported) expectSchoolResult(f, reply);
    else assert.equal(recommendationIds(reply).length, 5);
    history.push({ role: 'assistant', content: reply });
  }
});

test('WhatsApp dialogue preserves criteria and stores the cleaned landmark in the CRM queue', async (t) => {
  const f = fixture(), store = new MemoryStore(config, () => f.now), sent = [], saved = [];
  const clients = new ClientOutbox(':memory:', { url: 'https://simulated.invalid/clients', token: 'fake', timeoutMs: 1000 }, {
    now: () => f.now, logger: { error(e) { assert.fail(JSON.stringify(e)); } }, fetchImpl: async (_url, options) => {
      saved.push(JSON.parse(options.body)); return Response.json({ id_klien: 'KL00001', id_agent: 'AG108', status: 'updated' });
    },
  });
  t.after(() => clients.close());
  const processor = new MessageProcessor({ ...f, config, store, clients, now: () => f.now,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'mock'; } }, logger: { error(e) { assert.fail(JSON.stringify(e)); } } });
  for (const text of [opening, reported]) {
    processor.acceptBatch([{ id: randomUUID(), from: '6280000000001', text, type: 'text', timestamp: f.now }]);
    await processor.drain(); await clients.flush();
  }
  expectSchoolResult(f, sent.at(-1));
  assert.equal(saved.at(-1).criteria.nearby.query, 'sekolah'); assert.equal(saved.at(-1).criteria.max_price, 200000000);
});

test('Playground follows school → radius → named school → compound facilities without repeating the funnel', async (t) => {
  const f = fixture(), app = express(), token = 'x'.repeat(40), conversationId = randomUUID();
  app.use('/sandbox', createSandboxRouter({ ...f, now: () => f.now, config: { ...config, adminToken: token } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const post = async (text) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [{ role: 'user', content: text }] }) });
    assert.equal(response.status, 200);
    const result = await response.json(); return (result.replies || [result.reply]).join('\n');
  };
  await post(opening); expectSchoolResult(f, await post(reported));
  const radius = await post('radius 500 meter saja pak');
  assert.deepEqual(recommendationIds(radius), ['980001']); assert.equal(f.criteria.at(-1).nearby.radius_m, 500);
  assert.doesNotMatch(radius, /Budget-nya sampai berapa|kelurahan mana/);
  const named = await post('ganti dekat SD Harapan Ibu bisa nggak pak?');
  assert.equal(f.criteria.at(-1).nearby.query, 'SD Harapan Ibu'); assert.deepEqual(recommendationIds(named), ['980001']);
  const compound = await post('ganti dekat sekolah dan rumah sakit kah pak?');
  assert.equal(f.criteria.at(-1).nearby.query, 'sekolah dan rumah sakit'); assert.deepEqual(recommendationIds(compound), ['980001']);
  assert.equal(f.criteria.at(-1).region_group, 'utara'); assert.equal(f.criteria.at(-1).max_price, 200000000);
});

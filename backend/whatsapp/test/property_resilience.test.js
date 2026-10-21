import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseCatalog } from '../services/property_database.js';
import { loadConfig } from '../config.js';
import { getPropertyKnowledge } from '../../../src/lib/chatbot/property-knowledge.ts';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { HANDOVER_MESSAGE } from '../services/ai_controller.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { advancedFixture } from '../scripts/lib/advanced-search-dialogues.js';
import { recommendationIds } from '../services/recommendations.js';

const connection = { url: 'https://properties.example/api/internal/chatbot/properties', token: 'test-token', timeoutMs: 1000 };
const context = { source: 'database_listing_publik', status: 'matched', asset: { id: '812345' }, candidates: [] };
const success = () => Response.json(context);
const noDelay = async () => {};
const timeout = () => new DOMException('Private upstream details', 'TimeoutError');

test('a stalled property request is aborted and the retry returns fresh data', async () => {
  let calls = 0, aborted = false;
  const catalog = new DatabaseCatalog({ ...connection, timeoutMs: 15 }, { sleep: noDelay,
    fetchImpl: async (_url, { signal }) => {
      if (++calls > 1) return success();
      return new Promise((_, reject) => {
        const guard = setTimeout(() => reject(new Error('request was never aborted')), 1000);
        signal.addEventListener('abort', () => { clearTimeout(guard); aborted = true; reject(signal.reason); }, { once: true });
      });
    } });
  assert.equal((await catalog.resolve('kode 812345')).asset.id, '812345');
  assert.equal(calls, 2); assert.equal(aborted, true);
});

test('a timeout while reading the response body is also retried', async () => {
  let calls = 0;
  const catalog = new DatabaseCatalog(connection, { sleep: noDelay, fetchImpl: async () => {
    if (++calls === 1) return { ok: true, json: async () => { throw timeout(); } };
    return success();
  } });
  assert.equal((await catalog.resolve('kode 812345')).asset.id, '812345');
  assert.equal(calls, 2);
});

for (const status of [408, 429, 500, 502, 503, 504]) {
  test(`property HTTP ${status} recovers without changing the authenticated search`, async () => {
    const requests = [];
    const catalog = new DatabaseCatalog(connection, { sleep: noDelay, fetchImpl: async (url, request) => {
      requests.push({ url, headers: request.headers, body: request.body, redirect: request.redirect });
      return requests.length === 1 ? Response.json({ error: 'temporary' }, { status }) : success();
    } });
    const criteria = { location: 'Surabaya Timur', city: 'Surabaya', region_group: 'timur', max_price: 300000000 };
    assert.equal((await catalog.resolve('bebas', null, criteria)).asset.id, '812345');
    assert.equal(requests.length, 2); assert.deepEqual(requests[0], requests[1]);
    assert.equal(requests[0].headers.Authorization, `Bearer ${connection.token}`);
    assert.deepEqual(JSON.parse(requests[0].body).criteria, criteria);
    assert.equal(requests[0].redirect, 'error');
  });
}

test('connection failures recover, but repeated failures stop after three attempts with backoff', async () => {
  let calls = 0;
  const delays = [];
  const catalog = new DatabaseCatalog(connection, { sleep: async (ms) => { delays.push(ms); }, fetchImpl: async () => {
    calls += 1; throw new TypeError('Private connection string');
  } });
  await assert.rejects(catalog.resolve('kode 812345'), { code: 'UPSTREAM_UNAVAILABLE' });
  assert.equal(calls, 3); assert.deepEqual(delays, [250, 500]);
});

for (const status of [400, 401, 403, 404, 422]) {
  test(`property HTTP ${status} is not retried`, async () => {
    let calls = 0;
    const catalog = new DatabaseCatalog(connection, { sleep: () => assert.fail('must not back off'), fetchImpl: async () => {
      calls += 1; return Response.json({ error: 'permanent' }, { status });
    } });
    await assert.rejects(catalog.resolve('test'), { code: 'UPSTREAM_HTTP_ERROR', status });
    assert.equal(calls, 1);
  });
}

test('invalid successful responses fail immediately without retry or fallback data', async () => {
  let calls = 0;
  const catalog = new DatabaseCatalog(connection, { sleep: () => assert.fail('must not back off'), fetchImpl: async () => {
    calls += 1; return Response.json({ ...context, source: 'invalid_source' });
  } });
  await assert.rejects(catalog.resolve('test'), { code: 'INVALID_PROPERTY_CONTEXT' });
  assert.equal(calls, 1);
});

test('the total deadline includes backoff and stops attempts when its budget is exhausted', async () => {
  let clock = 0, calls = 0;
  const delays = [];
  const catalog = new DatabaseCatalog({ ...connection, totalTimeoutMs: 1000 }, {
    now: () => clock, sleep: async (ms) => { delays.push(ms); clock += ms; },
    fetchImpl: async () => { calls += 1; clock += 600; throw timeout(); },
  });
  await assert.rejects(catalog.resolve('test'), { code: 'UPSTREAM_TIMEOUT' });
  assert.equal(calls, 2); assert.deepEqual(delays, [250]);
});

test('a request cancelled before lookup never reaches the property API', async () => {
  const controller = new AbortController(); controller.abort();
  const catalog = new DatabaseCatalog(connection, { fetchImpl: () => assert.fail('cancelled request must not run') });
  await assert.rejects(catalog.resolve('test', null, null, { signal: controller.signal }), { code: 'REQUEST_CANCELLED' });
});

test('cancellation during retry backoff stops the next attempt immediately', async () => {
  let calls = 0, ready;
  const backingOff = new Promise((resolve) => { ready = resolve; });
  const controller = new AbortController();
  const catalog = new DatabaseCatalog(connection, { fetchImpl: async () => { calls += 1; throw timeout(); },
    sleep: async (_ms, _value, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true }); ready();
    }) });
  const result = catalog.resolve('test', null, null, { signal: controller.signal });
  await backingOff; controller.abort();
  await assert.rejects(result, { code: 'REQUEST_CANCELLED' }); assert.equal(calls, 1);
});

test('startup warmup compiles the endpoint without querying listings', async () => {
  const catalog = new DatabaseCatalog(connection, { fetchImpl: async (_url, request) => {
    const input = JSON.parse(request.body); assert.deepEqual(input, { text: '', previousId: null });
    return Response.json(await getPropertyKnowledge({ listing: { findMany() { assert.fail('warmup must not query listings'); } } }, input));
  } });
  assert.equal((await catalog.warmup()).status, 'needs_property');
});

test('property defaults allow three 20-second attempts within a 65-second budget', () => {
  const env = { ADMIN_API_TOKEN: 'a'.repeat(32), PROPERTY_API_URL: connection.url, CHATBOT_PROPERTY_TOKEN: 'p'.repeat(32), LLM_MODEL: 'test-model', OPENAI_API_KEY: 'test-key' };
  assert.deepEqual(loadConfig(env).propertyDatabase, { url: connection.url, token: env.CHATBOT_PROPERTY_TOKEN, timeoutMs: 20000, maxAttempts: 3, totalTimeoutMs: 65000 });
  assert.equal(loadConfig({ ...env, PROPERTY_TIMEOUT_MS: '60000' }).propertyDatabase.timeoutMs, 60000);
  assert.throws(() => loadConfig({ ...env, PROPERTY_TIMEOUT_MS: '60001' }), /PROPERTY_TIMEOUT_MS/);
});

test('optimized regional filters preserve case, spelling, budget and property restrictions', async () => {
  const row = (id, fields = {}) => ({ id_property: BigInt(id), slug: 'rumah-uji', judul: 'Rumah uji',
    kota: 'KOTA SURABAYA', kecamatan: 'RUNGKUT ', kategori: 'RUMAH', jenis_transaksi: 'LELANG',
    status_tayang: 'TERSEDIA', bukan_properti: false, harga: 250e6, harga_efektif: 250e6,
    nilai_limit_lelang: 250e6, tanggal_lelang: new Date('2027-01-01'), ...fields });
  const f = advancedFixture({ inventory: [row(1), row(2, { kecamatan: 'Kec. GunungAnyar' }),
    row(3, { kecamatan: 'Tandes' }), row(4, { kota: 'Kota Malang' }), row(5, { harga: 400e6, nilai_limit_lelang: 400e6 }),
    row(6, { kategori: 'TANAH' }), row(7, { status_tayang: 'TERJUAL' }), row(8, { bukan_properti: true })] });
  const text = 'Cari lelang rumah di Surabaya Timur budget 300 juta luas tanah bebas';
  const result = await generatePropertyReply({ ...f, text, history: [{ role: 'user', content: text }] });
  assert.deepEqual(recommendationIds(result.reply).sort(), ['1', '2']);
});

const NOW = Date.parse('2026-10-21T00:00:00+07:00'), PHONE = '628123456789';
const processorConfig = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const message = (id, text) => ({ id, text, from: PHONE, timestamp: NOW, type: 'text' });

test('Feli completes the exact reported conversation despite a first-lookup timeout', async () => {
  const requests = [], sent = [], errors = [];
  const property = { id_property: 812345n, slug: 'rumah-rungkut', judul: 'Rumah Rungkut', jenis_transaksi: 'LELANG', kategori: 'RUMAH',
    kota: 'Kota Surabaya', kecamatan: 'Rungkut', nilai_limit_lelang: 250e6, harga: 250e6, tanggal_lelang: new Date(NOW + 86400000) };
  const db = { listing: { findMany: async () => [property] }, listingSekitar: { findUnique: async () => null }, listingTempat: { findMany: async () => [] } };
  const catalog = new DatabaseCatalog(connection, { sleep: noDelay, fetchImpl: async (_url, request) => {
    const input = JSON.parse(request.body); requests.push(input);
    if (requests.length === 1) throw timeout();
    return Response.json(await getPropertyKnowledge(db, input, NOW));
  } });
  const store = new MemoryStore(processorConfig, () => NOW);
  const processor = new MessageProcessor({ config: processorConfig, store, catalog, now: () => NOW,
    ai: { generate() { assert.fail('clear search must not need AI'); } },
    whatsapp: { async sendText(_phone, text) { sent.push(text); return `sent-${sent.length}`; } },
    logger: { error(error) { errors.push(error); } } });
  const turns = ['halo', 'feli, saya mau cari rumah', 'lelang', 'surabaya', 'surabaya timur', '300 juta', 'bebas'];
  for (const [i, text] of turns.entries()) {
    processor.acceptBatch([message(`feli-${i}`, text)]); await processor.drain();
    if (i < turns.length - 1) assert.equal(requests.length, 0);
  }
  assert.equal(requests.length, 2); assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[1].criteria.region_group, 'timur'); assert.equal(requests[1].criteria.max_price, 300e6);
  assert.equal(requests[1].criteria.category, 'RUMAH'); assert.equal(requests[1].criteria.transaction_type, 'LELANG');
  assert.equal(requests[1].criteria.min_land_area_m2, null); assert.equal(requests[1].criteria.max_land_area_m2, null);
  assert.match(sent.at(-1), /rumah-rungkut-812345/); assert.match(sent.at(-1), /250\.000\.000/);
  assert.doesNotMatch(sent.join('\n'), /belum dapat diakses|sedang terkendala/); assert.deepEqual(errors, []);
  assert.equal(processor.propertyLookups.size, 0);
});

test('CS handover cancels an in-flight property lookup without waiting for its retry budget', async () => {
  let ready, calls = 0;
  const started = new Promise((resolve) => { ready = resolve; });
  const catalog = new DatabaseCatalog(connection, { sleep: noDelay, fetchImpl: async (_url, { signal }) => {
    calls += 1;
    return new Promise((_resolve, reject) => { signal.addEventListener('abort', () => reject(signal.reason), { once: true }); ready(); });
  } });
  const sent = [], errors = [], store = new MemoryStore(processorConfig, () => NOW);
  const processor = new MessageProcessor({ config: processorConfig, store, catalog, now: () => NOW,
    ai: { generate() { assert.fail('cancelled lookup must not generate facts'); } },
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'sent'; } }, logger: { error(error) { errors.push(error); } } });
  processor.acceptBatch([message('lookup', 'kode 812345')]); await started;
  processor.acceptBatch([message('handover', 'hubungkan CS')]); await processor.drain();
  assert.equal(calls, 1); assert.deepEqual(sent, [HANDOVER_MESSAGE]); assert.deepEqual(errors, []);
  assert.equal(store.get(PHONE).is_bot_active, false); assert.equal(processor.propertyLookups.size, 0);
});

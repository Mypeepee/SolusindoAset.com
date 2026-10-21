// No real WhatsApp sends, credentials or database writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const ts = require('typescript');
const { Prisma } = require('@prisma/client');
const { NextRequest } = require('next/server');
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = resolve(__dirname, '..', file); if (!/\.[cm]?[jt]sx?$/.test(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) { const path = resolve(dirname(file), name); return path.includes('/backend/') ? require(path) : load(path); }
      return require(name);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
const load = loader({ '@/lib/tempat/cari': { bacaTempatTerpilih: async () => null } });
const { newPropertyRecommendations: run, validRecommendationRequest } = load('src/lib/chatbot/new-property-recommendations.ts');
const { clientPreferenceRows, preferenceFingerprint } = load('src/lib/chatbot/client-preferences.ts');
const NOW = Date.parse('2026-10-20T10:00:00+07:00'), SECRET = 's'.repeat(32);
const decimal = v => new Prisma.Decimal(v);
const criteria = { location: 'Surabaya', city: 'Surabaya', category: 'TANAH', transaction_type: 'LELANG', max_price: 1000000000, min_land_area_m2: 100 };
function listing(id, fields = {}) { return { id_property: BigInt(id), slug: 'tanah-surabaya', judul: 'Tanah di Surabaya', kategori: 'TANAH', jenis_transaksi: 'LELANG',
  status_tayang: 'TERSEDIA', bukan_properti: false, ada_bangunan: false, legalitas: 'SHM', kota: 'Kota Surabaya', provinsi: 'Jawa Timur', kecamatan: 'Tandes', kelurahan: 'Manukan Wetan',
  alamat_lengkap: 'Jalan Manukan', luas_tanah: decimal(100), luas_bangunan: null, harga: decimal(900000000), harga_promo: null, harga_efektif: decimal(900000000),
  nilai_limit_lelang: decimal(900000000), tanggal_lelang: new Date(NOW + 86400000), tempatDekat: [], gambar: null, kamar_tidur: null, is_hot_deal: false, tanggal_dibuat: new Date(NOW), ...fields }; }
async function fixture() {
  const p = (await clientPreferenceRows({}, criteria))[0];
  const client = { id_klien: 'KL00001', nama: 'Rina', nomor_whatsapp: '081234567890', id_agent: 'AG108', id_properti_asal: null, status: 'lead_baru',
    chatbot_kriteria: criteria, chatbot_preferensi_meta: null };
  let preferences = [{ ...p, id_klien: client.id_klien, id_preferensi: 1n, klien: client }], stock = [listing(101)], sent = [], dismissed = [];
  const receipts = new Map(), reads = [];
  const db = {
    agent: { findUnique: async () => ({ status_keanggotaan: 'AKTIF', pengguna: { status_akun: 'AKTIF', nama_lengkap: 'Jason Christopher Liendo' } }) },
    listing: { findFirst: async () => ({ id_property: 100n }), findMany: async query => {
      reads.push(query); const f = query.where.id_property;
      return stock.filter(l => f?.in ? f.in.includes(l.id_property) : !f?.gt || l.id_property > f.gt);
    } },
    preferensiKlien: { findMany: async query => preferences.filter(p => {
      const f = query.where.id_preferensi;
      return (!f || (f.in ? f.in.includes(p.id_preferensi) : p.id_preferensi > f.gt)) &&
        (!query.where.id_klien || (typeof query.where.id_klien === 'string' ? p.id_klien === query.where.id_klien : query.where.id_klien.in.includes(p.id_klien))) &&
        (!query.where.klien || client.status !== 'closing' && client.status !== 'lost_iseng' && client.id_agent === query.where.klien.id_agent);
    }) },
    klien: { findFirst: async query => client.id_agent === query.where.id_agent && (!query.where.status || !query.where.status.notIn.includes(client.status)) ? client : null,
      findMany: async query => client.id_agent === query.where.id_agent && client.id_klien > query.where.id_klien.gt && !query.where.status.notIn.includes(client.status) ? [client] : [] },
    kirimanRekomendasi: { findMany: async () => sent, createMany: async ({ data }) => { for (const r of data) receipts.set(`${r.id_klien}:${r.id_property}`, r); return { count: data.length }; } },
    rekomendasiDisingkirkan: { findMany: async () => dismissed },
  };
  return { db, client, preferences, receipts, reads, stock(v) { stock = v; }, sent(v) { sent = v; }, dismissed(v) { dismissed = v; }, prefs(v) { preferences = v; } };
}
const call = (db, action, more = {}) => run(db, { agent_id: 'AG108', action, ...more }, SECRET, NOW);

test('matches the exact tanah/Surabaya/1B/100m2 request, excluding wrong type, city, price, size, unavailable and expired auctions', async () => {
  const f = await fixture(); f.stock([
    listing(101), listing(102, { kategori: 'RUMAH', ada_bangunan: true }), listing(103, { kota: 'Sidoarjo' }),
    listing(104, { harga_efektif: decimal(1000000001) }), listing(105, { luas_tanah: decimal(99) }),
    listing(106, { status_tayang: 'TERJUAL' }), listing(107, { tanggal_lelang: new Date('2026-04-20T03:00:00Z') }),
    listing(108, { tanggal_lelang: null }), listing(109, { bukan_properti: true }), listing(110, { jenis_transaksi: 'SEWA' }),
  ]);
  const scan = await call(f.db, 'scan', { cursor: '100' });
  assert.deepEqual(scan.candidates.map(c => c.property_id), ['101']); assert.equal(scan.cursor, '110');
});

test('already sent, dismissed and client-owned properties do not trigger a new recommendation', async () => {
  const f = await fixture(); f.stock([listing(101), listing(102), listing(103)]);
  f.sent([{ id_klien: 'KL00001', id_property: 101n }]); f.dismissed([{ id_klien: 'KL00001', id_property: 102n }]); f.client.id_properti_asal = 103n;
  assert.deepEqual((await call(f.db, 'scan', { cursor: '100' })).candidates, []);
});

test('the final send check also excludes a delivered asset after the client changes preferences', async () => {
  const f = await fixture();
  f.sent([{ id_klien: 'KL00001', id_property: 101n }]);
  f.preferences[0].budget_max = decimal(1500000000);
  f.preferences[0].luas_min = decimal(80);
  const result = await call(f.db, 'prepare', { client_id: 'KL00001', property_ids: ['101'] });
  assert.deepEqual(result, { skipped: true });
});

test('prepare rechecks latest preferences and stock and formats a personalized message with sender URLs and truthful auction price', async () => {
  const f = await fixture();
  const draft = await call(f.db, 'prepare', { client_id: 'KL00001', property_ids: ['101'] });
  assert.equal(draft.phone, '6281234567890'); assert.match(draft.text, /Halo Rina/); assert.match(draft.text, /1 tanah yang sepertinya cocok/);
  assert.match(draft.text, /LT 100 m²/); assert.match(draft.text, /harga limit lelang/); assert.match(draft.text, /\/AG108/);
  assert.match(draft.text, /Jason Christopher Liendo/); assert.ok(draft.text.length < 4096);
  f.preferences[0].budget_max = decimal(500000000);
  assert.equal((await call(f.db, 'prepare', { client_id: 'KL00001', property_ids: ['101'] })).skipped, true);
});

test('four matched assets fit a real message, retain the saved search, and acknowledge all four exactly once', async () => {
  const f = await fixture();
  const ids = ['101', '102', '103', '104'];
  f.stock(ids.map((id, index) => listing(id, { luas_tanah: decimal(100 + index * 10), slug: 'a'.repeat(300),
    judul: 'Tanah '.repeat(42), kota: 'Kota Surabaya', kecamatan: 'Tandes'.repeat(45) })));
  const draft = await call(f.db, 'prepare', { client_id: 'KL00001', property_ids: ids });
  assert.equal(draft.property_ids.length, 4); assert.match(draft.text, /^Halo Rina, saya ada 4 tanah yang sepertinya cocok/);
  assert.match(draft.text, /\n4\. \*/); assert.ok(draft.text.length <= 4096);
  assert.equal(draft.search_criteria.max_price, 1000000000); assert.equal(draft.search_criteria.min_land_area_m2, 100);
  assert.equal(draft.search_criteria.city, 'Surabaya'); assert.equal(draft.search_criteria.category, 'TANAH');
  await call(f.db, 'acknowledge', { receipt: draft.receipt }); await call(f.db, 'acknowledge', { receipt: draft.receipt });
  assert.equal(f.receipts.size, 4);
});

test('acknowledgement preserves the signed offered price despite later changes and rejects forged receipts', async () => {
  const f = await fixture(); const draft = await call(f.db, 'prepare', { client_id: 'KL00001', property_ids: ['101'] });
  f.stock([listing(101, { harga_efektif: decimal(950000000) })]);
  await call(f.db, 'acknowledge', { receipt: draft.receipt }); await call(f.db, 'acknowledge', { receipt: draft.receipt });
  assert.equal(f.receipts.size, 1); assert.equal(f.receipts.get('KL00001:101').harga_saat_kirim, 900000000);
  await assert.rejects(() => call(f.db, 'acknowledge', { receipt: draft.receipt.replace(/^./, 'x') }), /INVALID_RECEIPT/);
});

test('completed/lost clients, missing preferences and a different sending agent never receive the draft', async () => {
  const f = await fixture(); f.client.status = 'closing';
  assert.equal((await call(f.db, 'prepare', { client_id: 'KL00001', property_ids: ['101'] })).skipped, true);
  f.client.status = 'lead_baru'; f.client.id_agent = 'AG999';
  assert.equal((await call(f.db, 'prepare', { client_id: 'KL00001', property_ids: ['101'] })).skipped, true);
  f.client.id_agent = 'AG108'; f.prefs([]); assert.deepEqual((await call(f.db, 'scan', { cursor: '100' })).candidates, []);
});

test('multi-area and non-Surat-Ijo restrictions survive preference synchronization', async () => {
  const rows = await clientPreferenceRows({}, { ...criteria, category: 'RUKO', locations: ['Manyar', 'Ngagel', 'Pucang'], certificate_types: ['SHM', 'HGB'] });
  assert.equal(rows.length, 6); assert.deepEqual([...new Set(rows.map(p => p.lokasi_dicari))], ['Manyar', 'Ngagel', 'Pucang']);
  assert.deepEqual([...new Set(rows.map(p => p.legalitas))], ['SHM', 'HGB']);
  assert.ok(rows.every(p => p.luas_min === 100 && p.budget_max === 1000000000));
});

test('unverifiable special requirements hold automated sends while independent manual preferences remain eligible', async () => {
  const f = await fixture(), p = f.preferences[0];
  f.client.chatbot_kriteria = { ...criteria, special_requirements: 'Nol jalan dua arah aspal' };
  f.client.chatbot_preferensi_meta = { rows: [{ id: '1', fingerprint: preferenceFingerprint(p) }] };
  assert.deepEqual((await call(f.db, 'scan', { cursor: '100' })).candidates, []);
  p.budget_max = 999000000; // Agent edited this preference independently.
  assert.equal((await call(f.db, 'scan', { cursor: '100' })).candidates.length, 1);
});

test('bootstrap returns only the baseline and malformed/cross-scope payloads fail validation', async () => {
  const f = await fixture(); assert.deepEqual(await call(f.db, 'initialize'), { cursor: '100' }); assert.equal(f.reads.length, 0);
  for (const bad of [ { action: 'scan', cursor: '-1' }, { action: 'prepare', client_id: 'KL1', property_ids: ['101', '101'] },
    { action: 'initialize', phone: '628123' }, { action: '__proto__' } ]) {
    assert.equal(validRecommendationRequest({ agent_id: 'AG108', ...bad }), false);
  }
});

test('morning matching searches pre-existing stock for saved preferences without a new property insert', async () => {
  const f = await fixture(); f.stock([listing(90)]);
  const result = await call(f.db, 'daily', { after_client: '' });
  assert.deepEqual(result.candidates, [{ client_id: 'KL00001', property_id: '90' }]);
  assert.equal(result.checked, 1); assert.equal(result.matched, 1); assert.equal(result.more, false); assert.equal(result.after_client, 'KL00001');
  const query = f.reads[0]; assert.ok(query.where.AND, 'all SQL preference gates remain combined with the future-auction condition');
  assert.deepEqual((await call(f.db, 'daily', { after_client: 'KL00001' })).candidates, []);
});

test('morning matching excludes stale auctions, delivered/dismissed assets and wrong budgets or types', async () => {
  const f = await fixture();
  f.stock([listing(90, { tanggal_lelang: new Date('2026-04-20T03:00:00Z') }), listing(91), listing(92), listing(93, { harga_efektif: decimal(1000000001) }), listing(94, { kategori: 'RUMAH', ada_bangunan: true })]);
  f.sent([{ id_klien: 'KL00001', id_property: 91n }]); f.dismissed([{ id_klien: 'KL00001', id_property: 92n }]);
  const result = await call(f.db, 'daily', { after_client: '' }); assert.deepEqual(result.candidates, []); assert.equal(result.matched, 0);
  assert.equal(validRecommendationRequest({ agent_id: 'AG108', action: 'daily', after_client: '', phone: '628123' }), false);
  assert.equal(validRecommendationRequest({ agent_id: 'AG108', action: 'daily', after_client: 'AG999' }), false);
});

test('fractional rupiah listing prices remain eligible and are rounded only in the offered snapshot', async () => {
  const f = await fixture(); f.stock([listing(90, { harga_efektif: decimal(299999999.99) })]);
  const morning = await call(f.db, 'daily', { after_client: '' }); assert.equal(morning.candidates.length, 1);
  const draft = await call(f.db, 'prepare', { client_id: 'KL00001', property_ids: ['90'] });
  const receipt = JSON.parse(Buffer.from(draft.receipt.split('.')[0], 'base64url')); assert.equal(receipt.assets[0].price, 300000000);
  f.preferences[0].budget_max = decimal(299999999); assert.equal((await call(f.db, 'prepare', { client_id: 'KL00001', property_ids: ['90'] })).skipped, true);
});

test('scan, daily and final prepare apply the same one-month auction cutoff and label past dates honestly', async () => {
  const f = await fixture();
  f.stock([listing(101, { tanggal_lelang: new Date('2026-09-20T00:00:00+07:00') }),
    listing(102, { tanggal_lelang: new Date('2026-09-19T23:59:59+07:00'), tanggal_dibuat: new Date(NOW) }),
    listing(103, { tanggal_lelang: new Date('2026-04-20T03:00:00Z') })]);
  assert.deepEqual((await call(f.db, 'scan', { cursor: '100' })).candidates.map(c => c.property_id), ['101']);
  assert.deepEqual((await call(f.db, 'daily', { after_client: '' })).candidates.map(c => c.property_id), ['101']);
  const draft = await call(f.db, 'prepare', { client_id: 'KL00001', property_ids: ['101', '102', '103'] });
  assert.deepEqual(draft.property_ids, ['101']); assert.match(draft.text, /20 September 2026.*jadwal sudah lewat/);
  assert.match(draft.text, /ketersediaan dan jadwal ulang masih perlu dikonfirmasi/);
  const tomorrow = await run(f.db, { agent_id: 'AG108', action: 'prepare', client_id: 'KL00001', property_ids: ['101'] }, SECRET, NOW + 86400000);
  assert.equal(tomorrow.skipped, true, 'a queued recommendation is rechecked when the cutoff advances');
});

test('internal endpoint requires the dedicated token and rejects browser-selected extra fields before any DB access', async () => {
  const old = process.env.CHATBOT_CLIENT_TOKEN; process.env.CHATBOT_CLIENT_TOKEN = SECRET; let calls = 0;
  const route = loader({ '@/lib/prisma': {}, '@/lib/chatbot/server-access': { readChatbotBody: async r => r.json() },
    '@/lib/chatbot/new-property-recommendations': { validRecommendationRequest, newPropertyRecommendations: async () => { calls++; return { cursor: '100' }; } } })('src/app/api/internal/chatbot/recommendations/route.ts');
  const req = (token, data) => new NextRequest('http://localhost/api/internal/chatbot/recommendations', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  try {
    assert.equal((await route.POST(req('bad', { agent_id: 'AG108', action: 'initialize' }))).status, 401);
    assert.equal((await route.POST(req(SECRET, { agent_id: 'AG108', action: 'initialize', phone: '628123' }))).status, 400);
    assert.equal(calls, 0); assert.equal((await route.POST(req(SECRET, { agent_id: 'AG108', action: 'initialize' }))).status, 200); assert.equal(calls, 1);
  } finally { if (old === undefined) delete process.env.CHATBOT_CLIENT_TOKEN; else process.env.CHATBOT_CLIENT_TOKEN = old; }
});

test('dashboard proxy rejects cross-origin changes and custom agent/recipient overrides and only exposes allowlisted status', async () => {
  const oldFetch = global.fetch, calls = [];
  const { recommendationStatus, recommendationMutation } = load('src/lib/chatbot/recommendation-status.ts');
  const headers = { 'Cache-Control': 'no-store' };
  const route = loader({ '@/lib/chatbot/server-access': { CHATBOT_HEADERS: headers, chatbotError: (error, status) => Response.json({ error }, { status }),
    readChatbotBody: r => r.json(), resolveChatbotAgent: async () => ({ agentId: 'AG108', base: 'http://backend.invalid', token: 'server-only' }) },
    '@/lib/chatbot/recommendation-status': { recommendationStatus, recommendationMutation } })('src/app/api/dashboard/chatbot/recommendations/route.ts');
  const status = { configured: true, enabled: true, pending: 1, delivered: 3, uncertain: 0, awaiting_ack: 0,
    initialized_at: NOW, last_scan_at: NOW, last_sent_at: NOW, last_error: null, max_per_message: 4, interval_hours: 24, hours: '08.00–20.00 WIB', needs_review: [] };
  global.fetch = async (url, options) => { calls.push({ url, options }); return Response.json({ ...status, private_payload: 'never expose', cursor: 'secret-cursor' }); };
  const req = (body, origin = 'http://localhost') => new NextRequest('http://localhost/api/dashboard/chatbot/recommendations', { method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await route.PATCH(req({ enabled: true }, 'https://evil.invalid'))).status, 403);
    assert.equal((await route.PATCH(req({ enabled: true, agent_id: 'AG999' }))).status, 400);
    assert.equal((await route.PATCH(req({ enabled: true, phone: '628123' }))).status, 400); assert.equal(calls.length, 0);
    const response = await route.PATCH(req({ enabled: false })), body = await response.json();
    assert.equal(response.status, 200); assert.equal(calls[0].url, 'http://backend.invalid/agents/AG108/admin/recommendations');
    assert.deepEqual(JSON.parse(calls[0].options.body), { enabled: false }); assert.doesNotMatch(JSON.stringify(body), /private_payload|secret-cursor|server-only/);
  } finally { global.fetch = oldFetch; }
});

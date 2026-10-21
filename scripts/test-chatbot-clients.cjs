// Node 24; no network, credentials, or real database writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const { isClientCapture } = require('../src/lib/chatbot/client-capture.ts');

function loader(overrides) {
  const cache = new Map();
  const load = (file) => {
    file = resolve(__dirname, '..', file);
    if (!/\.[cm]?[jt]sx?$/.test(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const localRequire = (name) => {
      if (name in overrides) return overrides[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) {
        const path = resolve(dirname(file), name);
        return path.includes('/backend/') ? require(path) : load(path);
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  };
  return load;
}
const criteria = { location: 'Surabaya Barat', city: 'Surabaya', region_group: 'barat', max_price: 500000000, category: 'RUMAH', min_land_area_m2: 150, transaction_type: 'LELANG' };
const capture = () => ({ phone: '6280000000001', name: 'Rina', criteria, captured_at: Date.now() });

for (const [label, change] of [
  ['agent override', { id_agent: 'AG999' }], ['local phone', { phone: '081234567890' }], ['LID', { phone: 'lid:999999999' }],
  ['future timestamp', { captured_at: Date.now() + 3600000 }], ['missing budget', { criteria: { ...criteria, max_price: null } }],
  ['missing transaction', { criteria: { ...criteria, transaction_type: null } }],
  ['malicious scope', { criteria: { ...criteria, region_group: '__proto__' } }],
  ['invalid radius', { criteria: { ...criteria, nearby: { query: 'pintu tol', radius_m: 9999999 } } }],
]) test(`client endpoint validator rejects ${label}`, () => assert.equal(isClientCapture({ ...capture(), ...change }), false));
test('client endpoint accepts multi-type, flexible land and compound landmarks', () => {
  assert.equal(isClientCapture(capture()), true);
  assert.equal(isClientCapture({ ...capture(), name: null, criteria: { ...criteria, category: null, categories: ['RUMAH', 'RUKO'], min_land_area_m2: null, nearby: { query: 'sekolah dan pintu tol', radius_m: 1000 } } }), true);
});

function authFixture(agent, session = { user: { id: 'owner-user', jabatan: 'OWNER' } }) {
  const load = loader({ 'next-auth': { getServerSession: async () => session },
    '@/app/api/auth/[...nextauth]/authOptions': { authOptions: {} },
    '@/lib/prisma': { __esModule: true, default: { agent: { findUnique: async () => agent } } } });
  return { load, access: load('src/lib/chatbot/server-access.ts') };
}
const activeOwner = { id_agent: 'AG999', jabatan: 'OWNER', status_keanggotaan: 'AKTIF', pengguna: { peran: 'AGENT', status_akun: 'AKTIF' } };
for (const role of ['AGENT', 'ADMIN', 'PRINCIPAL', 'TEAMLEADER', 'STOKER']) test(`fresh DB role ${role} denies chatbot APIs despite stale Owner session`, async () => {
  const { load, access } = authFixture({ ...activeOwner, jabatan: role });
  assert.equal((await access.resolveChatbotOwner()).status, 403);
  for (const route of ['whatsapp', 'checks', 'playground', 'clients', 'conversations']) {
    const api = load(`src/app/api/dashboard/chatbot/${route}/route.ts`);
    assert.equal((await api.GET(new NextRequest('http://localhost:3000/api/dashboard/chatbot/' + route))).status, 403);
  }
});
for (const [label, agent, session] of [
  ['unauthenticated', activeOwner, null], ['not an agent', null, undefined],
  ['inactive membership', { ...activeOwner, status_keanggotaan: 'NONAKTIF' }, undefined],
  ['disabled account', { ...activeOwner, pengguna: { peran: 'AGENT', status_akun: 'NONAKTIF' } }, undefined],
]) test(`chatbot access rejects ${label}`, async () => {
  const { access } = authFixture(agent, session);
  assert.equal((await access.resolveChatbotOwner()).status, label === 'unauthenticated' ? 401 : 403);
});
test('active Owner manages AG108 integration regardless of their own agent ID', async () => {
  const oldBase = process.env.WHATSAPP_BACKEND_URL, oldToken = process.env.WHATSAPP_BACKEND_TOKEN;
  process.env.WHATSAPP_BACKEND_URL = 'http://127.0.0.1:3100'; process.env.WHATSAPP_BACKEND_TOKEN = 'a'.repeat(32);
  try {
    const { access } = authFixture(activeOwner);
    assert.equal((await access.resolveChatbotOwner()).status, 200);
    assert.equal((await access.resolveChatbotAgent()).agentId, 'AG108');
  } finally {
    if (oldBase === undefined) delete process.env.WHATSAPP_BACKEND_URL; else process.env.WHATSAPP_BACKEND_URL = oldBase;
    if (oldToken === undefined) delete process.env.WHATSAPP_BACKEND_TOKEN; else process.env.WHATSAPP_BACKEND_TOKEN = oldToken;
  }
});

test('internal client route enforces separate token and bounded payload before calling persistence', async () => {
  const old = process.env.CHATBOT_CLIENT_TOKEN; process.env.CHATBOT_CLIENT_TOKEN = 'c'.repeat(32);
  const saved = [];
  const { load } = authFixture(activeOwner);
  const realCapture = require('../src/lib/chatbot/client-capture.ts');
  const isolated = loader({ '@/lib/prisma': { __esModule: true, default: {} },
    '@/lib/chatbot/client-capture': { ...realCapture, captureClient: async (_db, data) => { saved.push(data); return { id_klien: 'KL00001', id_agent: 'AG108', status: 'created' }; } },
    '@/lib/chatbot/server-access': load('src/lib/chatbot/server-access.ts') });
  const { POST } = isolated('src/app/api/internal/chatbot/clients/route.ts');
  const request = (data, token = process.env.CHATBOT_CLIENT_TOKEN) => new NextRequest('http://localhost:3000/api/internal/chatbot/clients', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  try {
    assert.equal((await POST(request(capture(), 'a'.repeat(32)))).status, 401);
    assert.equal((await POST(request({ ...capture(), id_agent: 'AG999' }))).status, 400);
    assert.equal((await POST(request({ ...capture(), name: 'x'.repeat(13000) }))).status, 413);
    assert.equal(saved.length, 0);
    assert.equal((await POST(request(capture()))).status, 200); assert.equal(saved.length, 1);
  } finally { if (old === undefined) delete process.env.CHATBOT_CLIENT_TOKEN; else process.env.CHATBOT_CLIENT_TOKEN = old; }
});

const { clientProbe, clientBackendStatus, clientCaptureStatus } = require('../src/lib/chatbot/client-status.ts');
const probePassed = () => ({ status: 'passed', id_agent: 'AG108', checked_at: Date.now(), checks: { write: true, read: true, update: true, deduplication: true, cleanup: true } });
const backendStatus = () => ({ configured: true, pending: 1, retrying: 1, last_saved_at: null, probe: probePassed() });
test('telemetry validates evidence and cannot convert an incomplete check to a passed badge', () => {
  assert.ok(clientProbe(probePassed())); assert.equal(clientProbe({ ...probePassed(), checks: { ...probePassed().checks, cleanup: false } }), null);
  assert.equal(clientBackendStatus({ ...backendStatus(), pending: -1 }), null);
  assert.equal(clientBackendStatus({ ...backendStatus(), retrying: 2 }), null);
  assert.equal(clientCaptureStatus({ backend: null, crm: { available: false, count: 0, last: null }, can_open_crm: true }), null);
  assert.ok(clientCaptureStatus({ backend: null, crm: { available: false, count: null, last: null }, can_open_crm: true }));
});

test('Owner client status reads actual CRM records and exposes only masked contact and aggregate queue data', async () => {
  const oldFetch = global.fetch;
  global.fetch = async () => Response.json({ ...backendStatus(), payload: 'private backend data' });
  const row = { id_klien: 'KL00001', nama: 'Klien', chatbot_nomor_whatsapp: '6280000000001', chatbot_terakhir_pada: new Date() };
  const load = loader({ '@/lib/chatbot/server-access': { CHATBOT_HEADERS: {}, resolveChatbotAgent: async () => ({ token: 'secret', base: 'http://localhost:3100', agentId: 'AG108', ownerId: 'AG108' }) },
    '@/lib/prisma': { __esModule: true, default: { klien: { count: async () => 2, findFirst: async () => row }, $transaction: (works) => Promise.all(works) } } });
  try {
    const response = await load('src/app/api/dashboard/chatbot/clients/route.ts').GET(), body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.crm.count, 2); assert.equal(body.backend.pending, 1); assert.ok(clientCaptureStatus(body));
    assert.doesNotMatch(JSON.stringify(body), /6280000000001|private backend|secret/); assert.equal(body.can_open_crm, true);
  } finally { global.fetch = oldFetch; }
});

test('Owner diagnostic proxy rejects cross-origin and custom clients and forwards only the fixed check', async () => {
  const oldFetch = global.fetch; let calls = 0, mode = 'success';
  const { load: authLoad } = authFixture(activeOwner);
  const helpers = authLoad('src/lib/chatbot/server-access.ts');
  const load = loader({ '@/lib/chatbot/server-access': { ...helpers, resolveChatbotAgent: async () => ({ token: 'secret', base: 'http://localhost:3100', agentId: 'AG108', ownerId: 'AG108' }) }, '@/lib/prisma': {} });
  global.fetch = async (url, options) => {
    calls++; assert.equal(url, 'http://localhost:3100/agents/AG108/admin/client-capture/check'); assert.equal(options.body, '{}');
    return mode === 'rate' ? new Response(null, { status: 429 }) : Response.json({ ...probePassed(), secret: 'never returned' });
  };
  const request = (body, origin = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/dashboard/chatbot/clients', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const { POST } = load('src/app/api/dashboard/chatbot/clients/route.ts');
    assert.equal((await POST(request({}, 'https://attacker.invalid'))).status, 403);
    assert.equal((await POST(request({ phone: '6280000000001' }))).status, 400); assert.equal(calls, 0);
    const response = await POST(request({})); assert.equal(response.status, 200); assert.doesNotMatch(JSON.stringify(await response.json()), /never returned|secret/);
    mode = 'rate'; assert.equal((await POST(request({}))).status, 429);
  } finally { global.fetch = oldFetch; }
});

test('internal database check authenticates with write token, rejects caller fixtures and sanitizes failures', async () => {
  const old = process.env.CHATBOT_CLIENT_TOKEN; process.env.CHATBOT_CLIENT_TOKEN = 'c'.repeat(32);
  let calls = 0, fail = false;
  const { load: authLoad } = authFixture(activeOwner);
  const load = loader({ '@/lib/prisma': {}, '@/lib/chatbot/server-access': authLoad('src/lib/chatbot/server-access.ts'),
    '@/lib/chatbot/client-diagnostics': { checkClientDatabase: async () => { calls++; if (fail) throw new Error('private db connection string'); return probePassed(); } } });
  const request = (body, token = process.env.CHATBOT_CLIENT_TOKEN) => new NextRequest('http://localhost:3000/api/internal/chatbot/clients/check', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const { POST } = load('src/app/api/internal/chatbot/clients/check/route.ts');
    assert.equal((await POST(request({}, 'a'.repeat(32)))).status, 401);
    assert.equal((await POST(request({ phone: '6280000000001' }))).status, 400); assert.equal(calls, 0);
    assert.equal((await POST(request({}))).status, 200); fail = true;
    const response = await POST(request({})); assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(await response.json()), /private db|connection string/);
  } finally { if (old === undefined) delete process.env.CHATBOT_CLIENT_TOKEN; else process.env.CHATBOT_CLIENT_TOKEN = old; }
});

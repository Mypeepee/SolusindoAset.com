// Exercise the real Next.js BFF without credentials, a database, or a live WhatsApp session.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');

const request = (body, headers = {}) => new NextRequest('http://localhost:3000/api/dashboard/chatbot/whatsapp', {
  method: 'POST', headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
function route(access = { agentId: 'AG108', base: 'http://backend.invalid', token: 'test-only' }) {
  const code = ts.transpileModule(readFileSync(resolve(__dirname, '../src/app/api/dashboard/chatbot/whatsapp/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => name === '@/lib/chatbot/server-access'
    ? { resolveChatbotAgent: async () => access } : require(name), module, module.exports);
  return module.exports;
}

test('disconnect rejects unauthenticated and cross-origin requests before contacting WhatsApp', async () => {
  assert.equal((await route(NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })).POST(request({ action: 'disconnect' }))).status, 401);
  assert.equal((await route().POST(request({ action: 'disconnect' }, { origin: 'https://untrusted.invalid' }))).status, 403);
  assert.equal((await route().POST(request({ action: 'disconnect' }, { 'sec-fetch-site': 'cross-site' }))).status, 403);
});

test('disconnect uses the server-selected agent and never forwards a browser-selected phone or token', async () => {
  const original = global.fetch; let call;
  global.fetch = async (url, options) => { call = { url, options }; return Response.json({ status: 'logged_out', private: 'hidden' }); };
  try {
    const response = await route().POST(request({ action: 'disconnect', agentId: 'AG999', phone: '6280000000000', token: 'untrusted' }));
    assert.equal(response.status, 202);
    assert.equal(call.url, 'http://backend.invalid/agents/AG108/admin/whatsapp/disconnect');
    assert.equal(call.options.body, '{}');
    assert.equal(call.options.headers.Authorization, 'Bearer test-only');
    assert.equal(call.options.redirect, 'error');
    assert.deepEqual(await response.json(), { ok: true });
    assert.match(response.headers.get('cache-control'), /no-store/);
  } finally { global.fetch = original; }
});

test('busy and failed disconnects never return success or expose private backend errors', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => Response.json({ error: 'CONVERSATION_BUSY' }, { status: 409 });
    const busy = await route().POST(request({ action: 'disconnect' }));
    assert.equal(busy.status, 409);
    assert.deepEqual(await busy.json(), { error: 'CONVERSATION_BUSY' });
    global.fetch = async () => { throw new Error('private transport details'); };
    const failed = await route().POST(request({ action: 'disconnect' }));
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), { error: 'SERVICE_UNAVAILABLE' });
  } finally { global.fetch = original; }
});

test('bot readiness preserves true, false, and unknown without trusting truthy strings', async () => {
  const original = global.fetch;
  try {
    for (const [value, expected] of [[true, true], [false, false], [null, null], [undefined, null], ['true', null]]) {
      global.fetch = async () => Response.json({ status: 'stopped', connected: false, bot_accepting: value, private: 'hidden' });
      const response = await route().GET(new NextRequest('http://localhost:3000/api/dashboard/chatbot/whatsapp'));
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.bot_accepting, expected);
      assert.equal(data.private, undefined);
      assert.match(response.headers.get('cache-control'), /no-store/);
    }
  } finally { global.fetch = original; }
});

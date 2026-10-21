const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(resolve(__dirname, '..', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module, module.exports);
  return module.exports;
}
const endpoint = 'http://localhost:3000/api/dashboard/chatbot/conversations';
const route = () => load('src/app/api/dashboard/chatbot/conversations/route.ts', {
  '@/lib/chatbot/server-access': { resolveChatbotAgent: async () => ({ agentId: 'AG108', base: 'http://backend.invalid', token: 'server-only' }) },
});

test('conversation proxy preserves why/when a bot is paused and the pending reply while excluding backend-only data', async () => {
  const original = global.fetch;
  global.fetch = async () => Response.json({ total: 1, attention: 1, manual_pause_seconds: 300, server_now: 1792500903000, bot_control_phone: '6282266100102',
    items: [{ contact: '6281234567890', is_bot_active: false, updated_at: 1792500903000, reason: 'manual_cs', resume_at: 1792501203000,
      pending_reply: true, reply_state: 'manual_temporary', blocked_reason: null, history: ['PRIVATE_MESSAGE'], secret: 'PRIVATE_TOKEN' }] });
  try {
    const response = await route().GET(new NextRequest(endpoint)); const data = await response.json();
    assert.equal(response.status, 200); assert.equal(data.manual_pause_seconds, 300);
    assert.equal(data.bot_control_phone, '6282266100102');
    assert.equal(data.items[0].resume_at, 1792501203000); assert.equal(data.items[0].pending_reply, true);
    assert.equal(data.items[0].reason, 'manual_cs'); assert.equal(data.items[0].reply_state, 'manual_temporary');
    assert.doesNotMatch(JSON.stringify(data), /PRIVATE_MESSAGE|PRIVATE_TOKEN/);
  } finally { global.fetch = original; }
});

test('control contacts retain their excluded status through the dashboard proxy', async () => {
  const original = global.fetch;
  global.fetch = async () => Response.json({ total: 1, attention: 0, items: [
    { contact: '6282266100102', is_bot_active: false, updated_at: 1792500903000, blocked_reason: 'bot_control_contact', reply_state: 'excluded' },
  ] });
  try {
    const response = await route().GET(new NextRequest(endpoint)), data = await response.json();
    assert.equal(data.attention, 0); assert.equal(data.items[0].blocked_reason, 'bot_control_contact');
    assert.equal(data.items[0].reply_state, 'excluded');
  } finally { global.fetch = original; }
});

test('activation targets only the logged-in agent and gives excluded contacts an understandable error', async () => {
  const original = global.fetch; let call;
  global.fetch = async (url, options) => { call = { url, options }; return Response.json({ error: 'BOT_CONTACT_EXCLUDED' }, { status: 409 }); };
  try {
    const response = await route().PATCH(new NextRequest(endpoint, { method: 'PATCH', headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact: '6281234567890', is_bot_active: true }) }));
    assert.equal(response.status, 409); assert.deepEqual(await response.json(), { error: 'BOT_CONTACT_EXCLUDED' });
    assert.equal(call.url, 'http://backend.invalid/agents/AG108/admin/conversations/6281234567890/bot');
    assert.deepEqual(JSON.parse(call.options.body), { is_bot_active: true });
    assert.equal(call.options.headers.Authorization, 'Bearer server-only');
  } finally { global.fetch = original; }
});

test('dashboard renders the resume time and pending message instead of an unexplained permanent pause', () => {
  const Component = load('src/app/dashboard/chatbot-integration/components/ConversationControls.tsx', { './integration-ui': { secondaryButton: 'button' } }).default;
  const controller = { data: { total: 2, attention: 1, manual_pause_seconds: 300, items: [
    { contact: '6281234567890', is_bot_active: false, updated_at: 1792500903000, reason: 'manual_cs', resume_at: 1792501203000, pending_reply: true, reply_state: 'manual_temporary' },
    { contact: '6280000000000', is_bot_active: false, updated_at: 1792500903000, blocked_reason: 'internal_stock_contact' },
  ] }, loading: false, refreshing: false, error: '', busy: null, refresh() {}, toggle() {} };
  const html = renderToStaticMarkup(React.createElement(Component, { controller }));
  assert.match(html, /Jeda balasan manual/); assert.match(html, /kembali aktif/); assert.match(html, /Aktifkan &amp; lanjutkan/);
  assert.match(html, /pesan klien tidak memperpanjang jeda/); assert.match(html, /#boton nomor_klien/);
  assert.match(html, /#botoff nomor_klien/); assert.match(html, /6282266100102/); assert.match(html, /Konfirmasi masuk ke chat kontrol/);
  assert.doesNotMatch(html, /6280000000000/);
});

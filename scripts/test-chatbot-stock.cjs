// Real BFF and message renderer, with isolated authentication/transport.
// --browser also checks the rendered emoji fonts in desktop/mobile Chromium.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, dirname, extname } = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { NextRequest, NextResponse } = require('next/server');

function loader(overrides = {}) {
  const cache = new Map();
  function load(path) {
    path = resolve(__dirname, '..', path);
    if (!extname(path)) path += existsSync(path + '.tsx') ? '.tsx' : '.ts';
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} }; cache.set(path, module);
    let source = readFileSync(path, 'utf8');
    if (path.endsWith('/BotPlayground.tsx')) source += '\nexport { MessageText };';
    const code = ts.transpileModule(source, { fileName: path, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const localRequire = (name) => {
      if (name in overrides) return overrides[name];
      if (name.endsWith('.css')) return { emoji: 'emoji' };
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(resolve(dirname(path), name));
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}

const accessFile = 'src/lib/chatbot/server-access.ts';
const realAccess = loader({ 'server-only': {}, 'next-auth': {}, '@/app/api/auth/[...nextauth]/authOptions': {}, '@/lib/prisma': {},
  '../../../backend/whatsapp/services/client_capture.js': { CHATBOT_AGENT_ID: 'AG108' } })(accessFile);
const id = '33333333-3333-4333-8333-333333333333';
const request = (body, headers = {}, method = 'POST') => new NextRequest('http://localhost:3000/api/dashboard/chatbot/checks', {
  method, headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

function route(access = { agentId: 'AG108', ownerId: 'AG1', base: 'http://127.0.0.1:3100', token: 'secret' }) {
  return loader({ '@/lib/chatbot/server-access': { ...realAccess, resolveChatbotAgent: async () => access } })('src/app/api/dashboard/chatbot/checks/route.ts');
}

test('stock retry BFF enforces authentication and request origin before contacting WhatsApp', async () => {
  assert.equal((await route(NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })).POST(request({ id }))).status, 401);
  assert.equal((await route().POST(request({ id }, { origin: 'https://attacker.example' }))).status, 403);
  assert.equal((await route().POST(request({ id }, { 'sec-fetch-site': 'cross-site' }))).status, 403);
});

test('stock retry BFF rejects recipient/agent overrides, malformed IDs and oversized bodies', async () => {
  for (const body of [{ id, recipient: '6280000000' }, { id, agentId: 'AG999' }, { id: 'bad/id' }, [], null]) {
    assert.equal((await route().POST(request(body))).status, 400);
  }
  assert.equal((await route().POST(request({ id, extra: 'a'.repeat(2000) }))).status, 413);
});

test('stock retry BFF uses the server-selected integration and keeps delivery state private', async () => {
  const original = global.fetch; let call;
  global.fetch = async (url, options) => { call = { url, options }; return Response.json({ id, status: 'pending', internal: 'private' }); };
  try {
    const response = await route().POST(request({ id }));
    assert.equal(call.url, `http://127.0.0.1:3100/agents/AG108/admin/asset-checks/${id}/retry`);
    assert.equal(call.options.body, '{}'); assert.equal(call.options.redirect, 'error');
    assert.deepEqual(await response.json(), { id, status: 'pending' });
    assert.match(response.headers.get('cache-control'), /no-store/);
    global.fetch = async () => Response.json({ error: 'NOTIFICATION_NOT_RETRYABLE' }, { status: 409 });
    assert.equal((await route().POST(request({ id }))).status, 409);
  } finally { global.fetch = original; }
});

test('stock completion requires a verdict source and rejects cross-origin or browser-selected tenants', async () => {
  assert.equal((await route().PATCH(request({ id, status: 'completed', result: 'available' }, {}, 'PATCH'))).status, 400);
  assert.equal((await route().PATCH(request({ id, status: 'completed', result: 'sold', reference: ' ' }, {}, 'PATCH'))).status, 400);
  assert.equal((await route().PATCH(request({ id, status: 'completed', result: 'available', reference: 'stoker', agentId: 'AG999' }, {}, 'PATCH'))).status, 400);
  assert.equal((await route().PATCH(request({ id, status: 'completed' }, { origin: 'https://attacker.example' }, 'PATCH'))).status, 403);
});

test('stock completion forwards a sourced result only to the authenticated integration', async () => {
  const original = global.fetch; let call;
  global.fetch = async (url, options) => { call = { url, options }; return Response.json({ id, status: 'completed', private: 'hidden' }); };
  try {
    const response = await route().PATCH(request({ id, status: 'completed', result: 'available', reference: ' stoker reply ' }, {}, 'PATCH'));
    assert.equal(response.status, 200);
    assert.equal(call.url, `http://127.0.0.1:3100/agents/AG108/admin/asset-checks/${id}`);
    assert.deepEqual(JSON.parse(call.options.body), { status: 'completed', result: 'available', reference: 'stoker reply' });
    assert.deepEqual(await response.json(), { id, status: 'completed' });
    assert.match(response.headers.get('cache-control'), /no-store/);
  } finally { global.fetch = original; }
});

test('actual message renderer preserves emoji in bold and normal text, escapes HTML, and keeps property links safe', () => {
  const { MessageText } = loader()('src/app/dashboard/chatbot-playground/components/BotPlayground.tsx');
  const html = renderToStaticMarkup(React.createElement(MessageText, { text: '📋 *Konfirmasi 👋🏽*\n👨‍👩‍👧‍👦 🇮🇩 1️⃣ ❤️ <script>alert(1)</script> https://solusindoaset.com/Lelang/properti-169816' }));
  assert.equal((html.match(/class="emoji"/g) || []).length, 6);
  assert.match(html, /<strong[^>]*>Konfirmasi <span class="emoji">👋🏽<\/span><\/strong>/);
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('manual stock link preserves all SOP emoji and line breaks through the WhatsApp query string', () => {
  const { buildWhatsAppUrl } = loader()('src/lib/whatsapp.ts');
  const body = '🔍 *Konfirmasi Stok Properti*\n\n🆔 *ID:* 169816\n📍 Surabaya\n📅 19 Oktober 2026\n❓ *TERSEDIA* / *TERJUAL* 🙏\n🔗 https://solusindoaset.com/Lelang/properti-169816';
  const url = new URL(buildWhatsAppUrl('+62 822-6610-0102', body));
  assert.equal(url.hostname, 'api.whatsapp.com');
  assert.equal(url.searchParams.get('phone'), '6282266100102');
  assert.equal(url.searchParams.get('text'), body);
});

if (process.argv.includes('--browser')) test('desktop and mobile browser render actual message emoji with a native color emoji font', async () => {
  const puppeteer = require('puppeteer');
  const { MessageText } = loader()('src/app/dashboard/chatbot-playground/components/BotPlayground.tsx');
  const message = renderToStaticMarkup(React.createElement(MessageText, { text: '🔍 *Konfirmasi Stok Properti*\n\n🆔 *ID:* 169816\n📍 *Lokasi:* Jl. Petemon Kuburan No. 59, Surabaya\n📅 *Tanggal Lelang:* 19 Oktober 2026\n\n❓ Apakah aset ini masih *TERSEDIA* atau sudah *TERJUAL*?\n\nMohon konfirmasi segera. 🙏\n\n🔗 https://solusindoaset.com/Lelang/properti-169816\n\n👋🏽 👨‍👩‍👧‍👦 🇮🇩 1️⃣ ❤️' }));
  const css = readFileSync(resolve(__dirname, '../src/app/dashboard/chatbot-playground/components/emoji.module.css'), 'utf8');
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      await page.setContent(`<style>${css}body{background:#edf3ef;font:16px Arial;padding:24px}article{max-width:620px;white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:24px;border-radius:16px;line-height:1.8}</style><article>${message}</article>`);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.$$eval('.emoji', (elements) => elements.filter((element) => element.getBoundingClientRect().width > 0).length), 12);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const cdp = await page.createCDPSession(); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.emoji' });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      assert.ok(fonts.some((font) => /Emoji/i.test(font.familyName)), JSON.stringify(fonts));
      console.log(`Verified ${width}px: ${fonts.map((font) => font.familyName).join(', ')}`);
      await page.screenshot({ path: `/tmp/kosku-chatbot-emoji-${width}.png`, fullPage: true });
      await cdp.detach();
    }
  } finally { await browser.close(); }
});

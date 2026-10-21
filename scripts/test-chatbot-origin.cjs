const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
require('./register-typescript.cjs');
const originHelper = require('../src/lib/chatbot/request-origin.ts');
const access = { agentId: 'AG108', base: 'http://backend.invalid', token: 'test-only' };

function route(name) {
  const filename = path.resolve(__dirname, `../src/app/api/dashboard/chatbot/${name}/route.ts`);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const dependencies = {
    '@/lib/chatbot/request-origin': originHelper,
    '@/lib/chatbot/asset-checks': {},
    '@/lib/chatbot/server-access': {
      resolveChatbotAgent: async () => access,
      readChatbotBody: (request) => request.json(),
      chatbotError: (error, status) => NextResponse.json({ error }, { status }),
      CHATBOT_HEADERS: {},
    },
  };
  new Function('require', 'module', 'exports', source)(
    (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module, module.exports,
  );
  return module.exports;
}

const endpoints = [['whatsapp', 'POST'], ['checks', 'POST'], ['checks', 'PATCH'], ['conversations', 'PATCH']];
for (const [name, method] of endpoints) {
  test(`${name} ${method} accepts the public HTTPS Host behind the tunnel`, async () => {
    const request = new NextRequest(`https://localhost:3000/api/dashboard/chatbot/${name}`, {
      method, headers: { host: 'solusindoaset.com', origin: 'https://solusindoaset.com',
        'content-type': 'application/json', 'sec-fetch-site': 'same-origin' }, body: '{}',
    });
    const response = await route(name)[method](request);
    assert.equal(response.status, 400, 'A valid origin must reach payload validation.');
  });
  test(`${name} ${method} accepts the browser's 127.0.0.1 Host`, async () => {
    const request = new NextRequest(`http://localhost:3000/api/dashboard/chatbot/${name}`, {
      method, headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000',
        'content-type': 'application/json' }, body: '{}',
    });
    assert.equal((await route(name)[method](request)).status, 400);
  });
  test(`${name} ${method} rejects foreign origins, forged forwarding, missing origin and cross-site fetches`, async () => {
    for (const extra of [
      { origin: 'https://untrusted.invalid' },
      { origin: 'https://untrusted.invalid', 'x-forwarded-host': 'untrusted.invalid' },
      { origin: 'https://solusindoaset.com', 'sec-fetch-site': 'cross-site' },
      { origin: 'http://solusindoaset.com' },
      {},
    ]) {
      const request = new NextRequest(`https://localhost:3000/api/dashboard/chatbot/${name}`, {
        method, headers: { host: 'solusindoaset.com', 'content-type': 'application/json', ...extra }, body: '{}',
      });
      assert.equal((await route(name)[method](request)).status, 403);
    }
  });
}

test('pairing code uses the authenticated server connection behind the public Host', async () => {
  const original = global.fetch;
  let forwarded;
  global.fetch = async (url, options) => { forwarded = { url, options }; return Response.json({ status: 'awaiting_code' }); };
  try {
    const request = new NextRequest('https://localhost:3000/api/dashboard/chatbot/whatsapp', {
      method: 'POST', headers: { host: 'solusindoaset.com', origin: 'https://solusindoaset.com',
        'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ action: 'pairing_code', phone: '6281234567890' }),
    });
    assert.equal((await route('whatsapp').POST(request)).status, 202);
    assert.equal(forwarded.url, 'http://backend.invalid/agents/AG108/admin/whatsapp/pairing-code');
    assert.equal(forwarded.options.headers.Authorization, 'Bearer test-only');
    assert.deepEqual(JSON.parse(forwarded.options.body), { phone: '6281234567890' });
  } finally { global.fetch = original; }
});

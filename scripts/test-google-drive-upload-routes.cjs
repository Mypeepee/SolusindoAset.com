const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');

function context(options = {}) {
  const uploaded = [], deleted = [], updates = [];
  const drive = {
    upload: async input => {
      if (options.failAt === uploaded.length + 1) throw Error('QA upload failure');
      uploaded.push(input);
      return { fileId: `qa-file-${uploaded.length}`, url: `https://drive.google.com/thumbnail?id=qa-file-${uploaded.length}`, accountId: 'secondary' };
    },
    deleteFile: async id => { deleted.push(id); },
    getFileInfo: async () => ({}),
  };
  const db = {
    pengguna: { findUnique: async () => ({ id_pengguna: 'USER-QA', nama_lengkap: 'Pengguna QA', nomor_telepon: '081234567890' }) },
    agent: {
      findUnique: async () => ({ id_agent: 'AG-QA', foto_ktp_url: 'old-ktp', foto_npwp_url: null, foto_profil_url: null }),
      update: async args => { updates.push(args); return { id_agent: 'AG-QA', ...args.data }; },
      upsert: async args => { updates.push(args); return { id_agent: 'AG-QA', ...args.create }; },
    },
  };
  const overrides = {
    'server-only': {},
    'next-auth': { getServerSession: async () => options.anonymous ? null : { user: { id: 'USER-QA', name: 'Pengguna QA', agentId: options.notAgent ? null : 'AG-QA' } } },
    '@/app/api/auth/[...nextauth]/authOptions': { authOptions: {} },
    '@/lib/server/googleDrive': { googleDrive: drive },
    '@/lib/prisma': { __esModule: true, default: db, prisma: db },
    '@/lib/notifications': { notifyNewAgentRegistration: async () => {} },
  };
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const local = createRequire(filename);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const requireSafe = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.includes('authOptions')) return { authOptions: {} };
      if (name.startsWith('@/')) {
        const target = path.resolve('src', name.slice(2));
        return name.endsWith('.mjs') ? local(target) : load(target + '.ts');
      }
      return local(name);
    };
    new Function('require', 'module', 'exports', compiled)(requireSafe, module, module.exports);
    return module.exports;
  }
  return { load, uploaded, deleted, updates };
}

const json = body => new Request('http://localhost/api/qa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const file = () => new File([Buffer.from('QA image data')], 'qa.png', { type: 'image/png' });
const multipart = body => new Request('http://localhost/api/qa', { method: 'POST', body });

test('property photo order and cover remain correct across shared upload results', async () => {
  const ctx = context();
  const { GoogleDriveService } = ctx.load('src/lib/services/google-drive.service.ts');
  const urls = await new GoogleDriveService().uploadPropertyImages([1, 2, 3].map(i => ({ name: `image${i}.png`, buffer: Buffer.from('qa'), mimeType: 'image/png' })), 'Kota QA', 'Alamat QA', 2);
  assert.deepEqual(urls.map(url => new URL(url).searchParams.get('id')), ['qa-file-3', 'qa-file-1', 'qa-file-2']);
  assert.ok(ctx.uploaded.every(input => input.purpose === 'properties' && input.folders.join('/') === 'Kota QA/Alamat QA' && input.publicRead));
});

test('partially uploaded property batches remove only their own newly-created files', async () => {
  const ctx = context({ failAt: 2 });
  const { GoogleDriveService } = ctx.load('src/lib/services/google-drive.service.ts');
  await assert.rejects(() => new GoogleDriveService().uploadPropertyImages([1, 2].map(i => ({ name: `qa${i}`, buffer: Buffer.from('qa'), mimeType: 'image/png' })), 'Kota', 'Alamat'));
  assert.deepEqual(ctx.deleted, ['qa-file-1']);
});

test('property upload API requires the same authenticated agent as listing creation', async () => {
  for (const [options, expected] of [[{ anonymous: true }, 401], [{ notAgent: true }, 403]]) {
    const ctx = context(options);
    assert.equal((await ctx.load('src/app/api/upload/images/route.ts').POST(multipart(new FormData()))).status, expected);
    assert.equal(ctx.uploaded.length, 0);
  }
  const ctx = context(); const form = new FormData();
  form.set('kota', 'Kota QA'); form.set('alamat', 'Alamat QA'); form.set('images[0]', file());
  const response = await ctx.load('src/app/api/upload/images/route.ts').POST(multipart(form));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).imageUrls.length, 1);
});

test('KTP closing and all profile documents use account-aware upload and keep file IDs', async () => {
  const ctx = context(); const form = new FormData(); form.set('file', file()); form.set('nama_klien', 'Klien QA');
  const closing = await ctx.load('src/app/api/closing/upload-ktp/route.ts').POST(multipart(form));
  assert.equal(closing.status, 200);
  assert.deepEqual(ctx.uploaded[0].folders, ['KTP Klien']);
  for (const [endpoint, body, column] of [
    ['ktp', { cropped_image: 'data:image/png;base64,UVFBUUE=' }, 'foto_ktp_url'],
    ['npwp', { cropped_image_npwp: 'data:image/png;base64,UVFBUUE=', nomor_npwp: 'QA' }, 'foto_npwp_url'],
    ['photo', { cropped_profile_image: 'data:image/png;base64,UVFBUUE=' }, 'foto_profil_url'],
  ]) {
    const ctx = context();
    const response = await ctx.load(`src/app/api/profile/${endpoint}/route.ts`).POST(json(body));
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(ctx.uploaded[0].purpose, 'agents');
    assert.equal(ctx.uploaded[0].mimeType, 'image/png');
    assert.equal(ctx.updates[0].data[column], 'qa-file-1');
  }
});

test('registration can upload only for the signed-in user and persists pool IDs', async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ id_pengguna: 'USER-QA', nama_lengkap: 'Pengguna QA', email: 'qa@example.test', kota_area: 'Kota QA', nama_kantor: 'Kantor QA', nomor_whatsapp: '081234567890' })) form.set(key, value);
  form.set('foto_ktp', file()); form.set('foto_profil', file());
  const ctx = context();
  const response = await ctx.load('src/app/api/agent/daftar-agent/route.ts').POST(multipart(form));
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(ctx.uploaded.length, 2);
  assert.ok(ctx.uploaded.every(input => input.purpose === 'agents'));
  assert.equal(ctx.updates[0].create.foto_ktp_url, 'qa-file-1');
  assert.equal(ctx.updates[0].create.foto_profil_url, 'qa-file-2');
  assert.deepEqual(ctx.deleted, ['old-ktp']);
  form.set('id_pengguna', 'OTHER-USER');
  const denied = context();
  assert.equal((await denied.load('src/app/api/agent/daftar-agent/route.ts').POST(multipart(form))).status, 403);
  assert.equal(denied.uploaded.length, 0);
});

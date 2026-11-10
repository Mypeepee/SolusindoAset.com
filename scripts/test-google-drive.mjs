import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDrivePool, environmentDriveAccounts, DriveUploadError } from '../src/lib/server/googleDrivePool.mjs';

const env = { GOOGLE_DRIVE_CLIENT_ID: 'client-qa', GOOGLE_DRIVE_CLIENT_SECRET: 'secret-qa', GOOGLE_DRIVE_REFRESH_TOKEN: 'token-1', GOOGLE_DRIVE_2_REFRESH_TOKEN: 'token-2', GOOGLE_DRIVE_FOLDER: 'primary-properties', GDRIVE_PARENT_FOLDER_ID: 'primary-agents' };
const input = { buffer: Buffer.from('QA image bytes'), name: "Rumah O'Connor.png", mimeType: 'image/png', purpose: 'properties', folders: ["Kota O'Connor", 'Alamat QA'], publicRead: true };

function scenario(options = {}) {
  const calls = [], created = [];
  let next = 0;
  const fetchImpl = async (raw, init) => {
    const url = new URL(raw);
    if (url.hostname === 'oauth2.googleapis.com') {
      const token = new URLSearchParams(init.body).get('refresh_token');
      calls.push({ op: 'token', account: token });
      return Response.json({ access_token: token === 'token-1' ? 'access-1' : 'access-2', expires_in: 3600 });
    }
    const account = init.headers.Authorization === 'Bearer access-1' ? 'primary' : 'secondary';
    const body = typeof init.body === 'string' ? init.body : null;
    calls.push({ account, op: init.method || 'GET', path: url.pathname, body, query: url.search });
    if (url.pathname.endsWith('/about')) {
      const full = options.full?.includes(account);
      return Response.json({ user: { emailAddress: account + '@example.test' }, storageQuota: options.unlimited ? { usage: '1000' } : { usage: full ? '1000' : '10', limit: '1000' } });
    }
    if (url.pathname.startsWith('/upload/')) {
      if (options.network && account === 'primary') throw new TypeError('QA offline');
      if (options.uploadError && account === 'primary') return Response.json({ error: { errors: [{ reason: options.uploadError }] } }, { status: 403 });
      const content = Buffer.from(init.body).toString();
      created.push({ account, content });
      return Response.json({ id: `${account}-file-${++next}` });
    }
    if (url.pathname.includes('/permissions')) {
      if (options.sharingError) return Response.json({ error: { errors: [{ reason: 'insufficientFilePermissions' }] } }, { status: 403 });
      return Response.json({ id: 'public-permission' });
    }
    if (init.method === 'DELETE') {
      if (options.deletePrimaryMissing && account === 'primary') return Response.json({ error: { errors: [{ reason: 'insufficientFilePermissions' }] } }, { status: 403 });
      return new Response(null, { status: 204 });
    }
    if (init.method === 'POST') return Response.json({ id: `${account}-folder-${++next}` });
    return Response.json({ files: [] });
  };
  const pool = createDrivePool({ accounts: async () => environmentDriveAccounts(env), fetchImpl,
    sharedCache: { tokens: new Map(), folders: new Map(), quota: new Map() } });
  return { pool, calls, created };
}

test('environment configuration retains account 1 roots and isolates account 2', () => {
  const accounts = environmentDriveAccounts(env);
  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].roots.properties, 'primary-properties');
  assert.equal(accounts[0].roots.agents, 'primary-agents');
  assert.deepEqual(accounts[1].roots, { properties: null, agents: null, attachments: null });
  assert.equal(environmentDriveAccounts({ ...env, GOOGLE_DRIVE_2_REFRESH_TOKEN: '' }).length, 1);
});

test('full primary is skipped and secondary owns the uploaded file and folders', async () => {
  const ctx = scenario({ full: ['primary'] });
  const result = await ctx.pool.upload(input);
  assert.equal(result.accountId, 'secondary');
  assert.equal(ctx.created.length, 1);
  assert.ok(!ctx.created[0].content.includes('primary-properties'));
  assert.ok(ctx.calls.some(call => call.account === 'secondary' && call.body?.includes('Solusindo Aset')));
  assert.ok(!ctx.calls.some(call => call.account === 'primary' && call.op === 'POST'));
});

test('storageQuotaExceeded after a stale quota read retries the same bytes on account 2', async () => {
  const ctx = scenario({ uploadError: 'storageQuotaExceeded' });
  const result = await ctx.pool.upload(input);
  assert.equal(result.accountId, 'secondary');
  const uploads = ctx.calls.filter(call => call.path?.startsWith('/upload/'));
  assert.deepEqual(uploads.map(call => call.account), ['primary', 'secondary']);
  assert.ok(ctx.created[0].content.includes('QA image bytes'));
});

test('permission and rate errors do not masquerade as full storage', async () => {
  for (const reason of ['insufficientFilePermissions', 'userRateLimitExceeded', 'dailyLimitExceeded']) {
    const ctx = scenario({ uploadError: reason });
    await assert.rejects(() => ctx.pool.upload(input), error => error instanceof DriveUploadError && error.reason === reason);
    assert.ok(!ctx.calls.some(call => call.account === 'secondary'));
  }
});

test('ambiguous network completion never creates a second-account duplicate', async () => {
  const ctx = scenario({ network: true });
  await assert.rejects(() => ctx.pool.upload(input), error => error.reason === 'network');
  assert.ok(!ctx.calls.some(call => call.account === 'secondary'));
});

test('sharing failures clean up this request and never trigger a second upload', async () => {
  const ctx = scenario({ sharingError: true });
  await assert.rejects(() => ctx.pool.upload(input), error => error.reason === 'sharing' && error.committed);
  assert.equal(ctx.created.length, 1);
  assert.equal(ctx.calls.filter(call => call.op === 'DELETE').length, 1);
});

test('both full returns an explicit 507 without creating folders or files', async () => {
  const ctx = scenario({ full: ['primary', 'secondary'] });
  await assert.rejects(() => ctx.pool.upload(input), error => error.status === 507);
  assert.equal(ctx.created.length, 0);
  assert.ok(!ctx.calls.some(call => call.op === 'POST'));
});

test('unlimited quota remains uploadable and private mode grants no public permission', async () => {
  const ctx = scenario({ unlimited: true });
  const result = await ctx.pool.upload({ ...input, publicRead: false });
  assert.equal(result.accountId, 'primary');
  assert.ok(!ctx.calls.some(call => call.path?.includes('/permissions')));
});

test('cleanup finds a file owned by the other account', async () => {
  const ctx = scenario({ deletePrimaryMissing: true });
  await ctx.pool.deleteFile('secondary-file');
  assert.deepEqual(ctx.calls.filter(call => call.op === 'DELETE').map(call => call.account), ['primary', 'secondary']);
  await assert.rejects(() => ctx.pool.deleteFile('../unsafe'), error => error.status === 400);
});

test('concurrent folder creation and token refresh are shared within an account', async () => {
  const ctx = scenario();
  await Promise.all([ctx.pool.upload(input), ctx.pool.upload(input)]);
  assert.equal(ctx.calls.filter(call => call.op === 'token').length, 1);
  const folders = ctx.calls.filter(call => call.op === 'POST' && call.path === '/drive/v3/files');
  assert.equal(folders.length, 2);
  const query = ctx.calls.find(call => call.op === 'GET' && call.path === '/drive/v3/files');
  assert.ok(new URLSearchParams(query.query).get('q').includes("O\\'Connor"));
});

test('status contains capacity facts and never credentials', async () => {
  const ctx = scenario({ full: ['primary'] });
  const result = await ctx.pool.status();
  assert.equal(result[0].storage.usage, '1000');
  assert.ok(!/token-|access-|secret-qa/.test(JSON.stringify(result)));
});


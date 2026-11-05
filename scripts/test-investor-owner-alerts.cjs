const assert = require('node:assert/strict');
const { test } = require('node:test');
const createLoader = require('./lib/marketing-test-loader.cjs');
const fixtureFeed = require('./fixtures/investor-feed.cjs');
const load = createLoader({ '@/lib/prisma': {} });
const policy = load('src/lib/investor-owner-alerts.ts');
const now = new Date('2026-11-06T12:00:00+07:00');
const listing = { ...fixtureFeed(new URLSearchParams()).items[0], assetCode: 'AST-owner-alert-fixture', auctionDate: '2026-11-10T03:00:00.000Z' };
const owner = { id: 'owner-qa', name: 'Owner QA', email: 'owner@example.com' };

test('strict auction-only >60% threshold, real positive prices, current inventory and WIB dates', () => {
  assert.equal(policy.qualifiesForOwnerAlert(listing, now), true);
  for (const delta of [
    { metricAuctionDropPct: 60 }, { metricAuctionDropPct: 59.999999 },
    { metricAuctionDropPct: null, metricMarketSpreadPct: 99 },
    { metricAuctionDropPct: NaN }, { metricAuctionDropPct: Infinity },
    { transactionType: 'SEWA' }, { listingCategory: 'PRIMARY' },
    { status: 'TERJUAL' }, { status: 'TARIK_LISTING' },
    { initialAuctionPrice: null }, { initialAuctionPrice: Infinity },
    { currentAuctionPrice: 0 }, { auctionDate: null },
    { auctionDate: 'invalid' }, { auctionDate: '2026-11-05T16:59:59Z' },
  ]) assert.equal(policy.qualifiesForOwnerAlert({ ...listing, ...delta }, now), false, JSON.stringify(delta));
  assert.equal(policy.qualifiesForOwnerAlert({ ...listing, metricAuctionDropPct: 60.000001 }, now), true);
  assert.equal(policy.qualifiesForOwnerAlert({ ...listing, auctionDate: '2026-11-05T17:00:00Z' }, now), true);
  assert.equal(policy.ownerAlertDropLabel(60.000001), '> 60%');
  assert.equal(policy.ownerAlertDropLabel(75.25), '75,25%');
  assert.equal(policy.ownerAlertAssetKey(listing), policy.ownerAlertAssetKey({ ...listing, id: '9999999' }));
});

function harness({ configured = true, ready = true, outcome = 'sent', current = true, photoFailure = false } = {}) {
  const calls = { claims: 0, photos: 0, begins: 0, sent: [], finishes: [], releases: [] };
  const excluded = new Set();
  let claimed = false;
  const mocks = {
    '@/lib/prisma': {}, '@/lib/investor-read.server': {}, '@/lib/investor-cma-legacy.server': {},
  };
  const service = createLoader(mocks)('src/lib/investor-owner-alerts.server.ts');
  const store = {
    ready: async () => ready,
    owners: async () => [owner],
    excluded: async () => excluded,
    claim: async (_owner, items) => {
      calls.claims++;
      if (claimed) return null;
      claimed = true;
      return { deliveryId: 'delivery-qa', keys: items.map(policy.ownerAlertAssetKey) };
    },
    current: async () => current,
    release: async (_claim, reason) => { calls.releases.push(reason); claimed = false; },
    begin: async () => { calls.begins++; return true; },
    finish: async (_claim, delivery) => {
      calls.finishes.push(delivery);
      if (['sent', 'uncertain'].includes(delivery.state)) excluded.add(policy.ownerAlertAssetKey(listing));
      claimed = false;
    },
  };
  const deps = {
    store,
    configured: () => configured,
    candidates: async () => ({ total: 3, items: excluded.has(policy.ownerAlertAssetKey(listing)) ? [] : [listing, { ...listing, id: '777' }, { ...listing, id: '778', metricAuctionDropPct: 60 }] }),
    photos: async () => { calls.photos++; if (photoFailure) throw new Error('photo failure'); return new Map(); },
    send: async (to, options, deliveryId) => { calls.sent.push({ to, options, deliveryId }); return { state: outcome }; },
  };
  return { calls, run: (options = {}) => service.runInvestorOwnerAlerts({ now, ...options }, deps), service };
}

test('dry run and missing SMTP/storage never claim, fetch photos or send email', async () => {
  for (const options of [{}, { configured: false }, { ready: false }]) {
    const h = harness(options);
    const result = await h.run({ dryRun: true });
    assert.equal(result.emailsSent, 0);
    assert.equal(h.calls.claims + h.calls.photos + h.calls.sent.length, 0);
  }
  const h = harness({ configured: false });
  await h.run();
  assert.equal(h.calls.claims, 0);
});

test('owner email uses actual prices/date/detail links and asset-level deduplication', async () => {
  const h = harness();
  const first = await h.run();
  assert.equal(first.emailsSent, 1);
  assert.equal(first.assetsSent, 1);
  assert.equal(h.calls.sent[0].to, owner.email);
  const item = h.calls.sent[0].options.aset[0];
  assert.match(item.frasaTurun, /75%/);
  assert.match(item.hargaSebelumnya, /1.000.000.000/);
  assert.match(item.hargaTampil, /250.000.000/);
  assert.match(item.spesifikasi, /10 Nov 2026/);
  assert.match(item.url, /^https:\/\/solusindoaset.com\/Lelang\//);
  assert.ok(!item.gambar.includes('localhost'));
  assert.equal((await h.run()).emailsSent, 0);
  assert.equal(h.calls.sent.length, 1);
});

test('overlapping runs do not send the same claimed batch twice', async () => {
  const h = harness();
  const runs = await Promise.all([h.run(), h.run()]);
  assert.equal(runs.reduce((sum, run) => sum + run.emailsSent, 0), 1);
  assert.equal(h.calls.sent.length, 1);
});

test('revoked recipient, sold/changed source and failed photo preparation cannot send', async () => {
  for (const options of [{ current: false }, { photoFailure: true }]) {
    const h = harness(options);
    await h.run();
    assert.equal(h.calls.sent.length, 0);
    assert.equal(h.calls.begins, 0);
    assert.equal(h.calls.releases.length, 1);
  }
});

test('SMTP rejections remain retryable; ambiguous acceptance is never automatically repeated', async () => {
  for (const outcome of ['retry', 'uncertain', 'unconfigured']) {
    const h = harness({ outcome });
    const result = await h.run();
    assert.equal(result.emailsSent, 0);
    assert.equal(h.calls.finishes[0].state, outcome === 'unconfigured' ? 'retry' : outcome);
    if (outcome === 'uncertain') {
      await h.run();
      assert.equal(h.calls.sent.length, 1);
    }
  }
});

test('email uses the existing client-property cards and escapes source content', () => {
  const { investorOwnerEmail, rekomendasiPropertiEmailHtml } = load('src/lib/mailer.ts');
  const options = harness().service.ownerAlertEmailOptions('<Owner>', [listing], new Map());
  options.aset[0].judul = '<script>alert(1)</script>';
  const email = investorOwnerEmail(options);
  const client = rekomendasiPropertiEmailHtml({ klienName: 'Client', subject: '', plainText: '', baru: options.aset, turunHarga: [] });
  assert.ok(email.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!email.html.includes('<script>'));
  assert.ok(email.html.includes('Lihat Detail'));
  assert.ok(email.html.includes('NOTIFIKASI OWNER'));
  assert.ok(email.html.includes('Buka Investor'));
  assert.ok(client.includes(options.aset[0].hargaTampil));
  assert.ok(email.text.includes(listing.listingUrl));
  assert.ok(!email.html.includes('Kirim ke WhatsApp'));
});

test('SMTP delivery tracking shares the campaign sender classification without sending real mail', async () => {
  const savedUser = process.env.GMAIL_USER, savedPassword = process.env.GMAIL_APP_PASSWORD;
  process.env.GMAIL_USER = 'sender@example.com'; process.env.GMAIL_APP_PASSWORD = 'mock-password';
  try {
    for (const [outcome, expected] of [
      [{ accepted: [owner.email], messageId: 'message-qa' }, 'sent'],
      [Object.assign(new Error('reject'), { responseCode: 550, command: 'DATA' }), 'retry'],
      [Object.assign(new Error('timeout'), { code: 'ETIMEDOUT', command: 'DATA' }), 'uncertain'],
    ]) {
      let payload;
      const mailer = createLoader({ nodemailer: { createTransport: () => ({ sendMail: async (value) => {
        payload = value; if (outcome instanceof Error) throw outcome; return outcome;
      } }) } })('src/lib/mailer.ts');
      const options = harness().service.ownerAlertEmailOptions(owner.name, [listing], new Map());
      const result = await mailer.sendInvestorOwnerEmail(owner.email, options, 'delivery-qa');
      assert.equal(result.state, expected);
      assert.equal(payload.messageId, '<investor-alert-delivery-qa@solusindoaset.com>');
    }
  } finally {
    if (savedUser === undefined) delete process.env.GMAIL_USER; else process.env.GMAIL_USER = savedUser;
    if (savedPassword === undefined) delete process.env.GMAIL_APP_PASSWORD; else process.env.GMAIL_APP_PASSWORD = savedPassword;
  }
});

test('cron denies missing/wrong secret even in development, and dryRun cannot send', async () => {
  const saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'qa-secret';
  let calls = 0;
  try {
    const route = createLoader({ '@/lib/investor-owner-alerts.server': { runInvestorOwnerAlerts: async (options) => {
      calls++; assert.equal(options.dryRun, true); return { ready: true, configured: true, emailsSent: 0 };
    } } })('src/app/api/cron/investor-owner-alerts/route.ts');
    const { NextRequest } = require('next/server');
    for (const secret of ['', 'wrong'])
      assert.equal((await route.POST(new NextRequest('http://localhost/api/cron/investor-owner-alerts', { method: 'POST', headers: { authorization: 'Bearer ' + secret } }))).status, 401);
    assert.equal(calls, 0);
    const response = await route.POST(new NextRequest('http://localhost/api/cron/investor-owner-alerts?dryRun=1', { method: 'POST', headers: { authorization: 'Bearer qa-secret' } }));
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
  } finally { if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved; }
});

test('scheduler checks every 15 minutes in WIB and prevents overlapping HTTP calls', () => {
  const { EventEmitter } = require('node:events');
  const saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'qa-scheduler-secret';
  let trigger, schedule, timezone, callback, requests = 0;
  try {
    const { startInvestorOwnerAlertScheduler } = require('./lib/investor-owner-alert-scheduler.cjs');
    startInvestorOwnerAlertScheduler(1234, {
      cron: { schedule: (rule, run, options) => { schedule = rule; trigger = run; timezone = options.timezone; } },
      http: { request: (options, done) => {
        requests++; callback = done;
        assert.equal(options.method, 'POST');
        assert.equal(options.path, '/api/cron/investor-owner-alerts');
        assert.equal(options.headers.Authorization, 'Bearer qa-scheduler-secret');
        const request = new EventEmitter(); request.end = () => {}; return request;
      } },
    });
    assert.equal(schedule, '*/15 * * * *');
    assert.equal(timezone, 'Asia/Jakarta');
    trigger(); trigger();
    assert.equal(requests, 1);
    const response = new EventEmitter(); response.statusCode = 200; callback(response);
    response.emit('data', JSON.stringify({ emailsSent: 0 })); response.emit('end');
    trigger(); assert.equal(requests, 2);
  } finally { if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved; }
});

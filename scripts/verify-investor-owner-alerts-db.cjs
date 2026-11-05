/** Exercises PostgreSQL claims in a TEMP table; no real outbox/source rows or SMTP are touched. */
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { Prisma } = require('@prisma/client');
const createLoader = require('./lib/marketing-test-loader.cjs');
const fixtureFeed = require('./fixtures/investor-feed.cjs');
require('@next/env').loadEnvConfig(process.cwd(), false);

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
  try {
    await db.connect();
    const before = (await db.query('SELECT count(*)::int n FROM public.investor_owner_alerts')).rows[0].n;
    await db.query('CREATE TEMP TABLE investor_owner_alerts (LIKE public.investor_owner_alerts INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)');
    const query = async (q, values) => {
      const sql = Array.isArray(q) ? Prisma.sql(q, ...values) : q;
      return db.query(sql.text, sql.values);
    };
    const adapter = {
      $queryRaw: async (q, ...values) => (await query(q, values)).rows,
      $executeRaw: async (q, ...values) => (await query(q, values)).rowCount,
      $transaction: async (run) => {
        await db.query('BEGIN');
        try { const result = await run(adapter); await db.query('COMMIT'); return result; }
        catch (error) { await db.query('ROLLBACK'); throw error; }
      },
    };
    const { investorAlertStore: store } = createLoader({ '@/lib/prisma': adapter })('src/lib/investor-owner-alert-store.server.ts');
    const owner = { id: 'qa-owner', name: 'QA', email: 'qa@example.com' };
    const item = { ...fixtureFeed(new URLSearchParams()).items[0], assetCode: 'QA-asset-1' };
    const now = new Date('2026-11-06T09:00:00+07:00');
    const at = (minutes) => new Date(now.getTime() + minutes * 60000);
    assert.equal(await store.ready(), true);
    const first = await store.claim(owner, [item], now);
    assert.equal(first.keys.length, 1);
    assert.equal(await store.claim(owner, [item], now), null, 'An active batch blocks concurrent claims');
    assert.equal(await store.begin(first, now), true);
    await store.finish(first, { state: 'sent', messageId: 'qa-message' }, now);
    assert.ok((await store.excluded(owner.id)).has('asset:QA-asset-1'));
    assert.equal(await store.claim(owner, [{ ...item, id: '8888' }], at(61)), null, 'New listing ID cannot re-alert a sent asset');
    const next = { ...item, assetCode: 'QA-asset-2' };
    assert.equal(await store.claim(owner, [next], at(1)), null, 'One-hour recipient cooldown');
    const second = await store.claim(owner, [next], at(61));
    await store.release(second, 'SOURCE_CHANGED', at(61));
    assert.equal(await store.claim(owner, [next], at(62)), null, 'Preparation retries wait their backoff');
    const retry = await store.claim(owner, [next], at(77));
    await store.begin(retry, at(77));
    assert.equal(await store.claim(owner, [next], at(83)), null);
    assert.ok((await store.excluded(owner.id)).has('asset:QA-asset-2'), 'Abandoned SMTP attempts become uncertain and never resend');
    const otherOwner = { ...owner, id: 'qa-owner-2' };
    const preparation = await store.claim(otherOwner, [item], now);
    assert.ok(preparation, 'Recipients deduplicate independently');
    const recovered = await store.claim(otherOwner, [item], at(6));
    assert.ok(recovered, 'Abandoned preparation can safely recover before SMTP');
    await db.query("UPDATE investor_owner_alerts SET attempts=4 WHERE owner_id=$1", [otherOwner.id]);
    await store.begin(recovered, at(6));
    await store.finish(recovered, { state: 'retry', errorCode: 'SMTP_REJECTED' }, at(6));
    assert.ok((await store.excluded(otherOwner.id)).has('asset:QA-asset-1'), 'Retries stop after five definite failures');
    const after = (await db.query('SELECT count(*)::int n FROM public.investor_owner_alerts')).rows[0].n;
    assert.equal(after, before, 'Real delivery records unchanged');
    console.log('PostgreSQL owner alerts passed: unique asset claims, concurrent-batch guard, cooldown, retry backoff/limit, stale preparation recovery and uncertain SMTP suppression. TEMP table only; no email sent.');
  } finally { await db.end(); }
}
main().catch((error) => { console.error(error.code || error); process.exitCode = 1; });

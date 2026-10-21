import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import express from 'express';
import { ClientOutbox } from '../state/client_outbox.js';
import { createAdminRouter } from '../routes/admin.js';
const NOW = Date.parse('2026-10-17T10:00:00+07:00');
const connection = { url: 'http://127.0.0.1/clients', token: 'private-token', timeoutMs: 1000 };
const input = { phone: '6280000000001', name: 'Uji', criteria: { location: 'Surabaya Barat', city: 'Surabaya', transaction_type: 'LELANG', category: 'RUMAH', max_price: 500e6 }, captured_at: NOW };
const passed = () => ({ status: 'passed', id_agent: 'AG108', checked_at: NOW, checks: { write: true, read: true, update: true, deduplication: true, cleanup: true } });
const receipt = () => Response.json({ id_klien: 'KL00001', id_agent: 'AG108', status: 'created' });
const logger = { error() {} };

test('status separates pending, retrying and confirmed save time without leaking contacts', async () => {
  let fail = true, now = NOW;
  const box = new ClientOutbox(':memory:', connection, { now: () => now, logger, fetchImpl: async () => fail ? new Response('private upstream body', { status: 401 }) : receipt() });
  assert.deepEqual(box.status(), { configured: true, pending: 0, retrying: 0, last_saved_at: null, probe: null });
  box.enqueue(input); assert.equal(box.status().pending, 1); assert.equal(box.status().retrying, 0);
  await box.flush(); assert.equal(box.status().retrying, 1); assert.equal(box.status().last_saved_at, null);
  assert.doesNotMatch(JSON.stringify(box.status()), /628000|private|Uji/);
  fail = false; now += 1001; await box.flush();
  assert.equal(box.status().pending, 0); assert.equal(box.status().retrying, 0); assert.equal(box.status().last_saved_at, now);
  await box.close();
});

test('check uses write credentials, persists proof and never queues a fake client', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'client-status-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'outbox.sqlite'), requests = [];
  const box = new ClientOutbox(file, connection, { now: () => NOW, logger, fetchImpl: async (url, options) => {
    requests.push({ url, options }); return Response.json({ ...passed(), secret_payload: 'must never leak' });
  } });
  assert.equal((await box.checkDatabase()).status, 'passed');
  assert.equal(requests[0].url, 'http://127.0.0.1/clients/check'); assert.equal(requests[0].options.headers.Authorization, 'Bearer private-token'); assert.equal(requests[0].options.body, '{}');
  assert.equal(box.db.prepare('SELECT COUNT(*) AS n FROM client_outbox').get().n, 0); assert.equal(box.status().last_saved_at, null);
  assert.doesNotMatch(JSON.stringify(box.status()), /secret_payload|must never|private-token/);
  await assert.rejects(box.checkDatabase(), { code: 'CLIENT_CHECK_RATE_LIMIT' }); await box.close();
  const restored = new ClientOutbox(file, connection, { now: () => NOW, logger }); assert.equal(restored.status().probe.status, 'passed'); await restored.close();
});

for (const [label, response, error] of [
  ['wrong token', () => new Response('secret', { status: 401 }), 'CLIENT_AUTH_FAILED'],
  ['database unavailable', () => new Response('db private error', { status: 503 }), 'CLIENT_DATABASE_UNAVAILABLE'],
  ['invalid success', () => Response.json({ status: 'passed' }), 'INVALID_CLIENT_CHECK'],
  ['cleanup unverified', () => Response.json({ ...passed(), checks: { ...passed().checks, cleanup: false } }), 'INVALID_CLIENT_CHECK'],
]) test(`check cannot show a false success: ${label}`, async () => {
  const box = new ClientOutbox(':memory:', connection, { now: () => NOW, logger, fetchImpl: async () => response() });
  const result = await box.checkDatabase(); assert.equal(result.status, 'failed'); assert.equal(result.error, error);
  assert.equal(box.status().last_saved_at, null); await box.close();
});

test('SQLite upgrade preserves a legacy pending capture', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'client-status-upgrade-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'old.sqlite'), legacy = new DatabaseSync(file);
  legacy.exec('CREATE TABLE client_outbox(phone TEXT PRIMARY KEY,payload TEXT NOT NULL,fingerprint TEXT NOT NULL,pending INTEGER NOT NULL DEFAULT 1,attempts INTEGER NOT NULL DEFAULT 0,retry_at INTEGER NOT NULL DEFAULT 0)');
  legacy.prepare('INSERT INTO client_outbox(phone,payload,fingerprint) VALUES(?,?,?)').run(input.phone, JSON.stringify(input), 'old'); legacy.close();
  const box = new ClientOutbox(file, connection, { now: () => NOW, logger, fetchImpl: async () => receipt() });
  assert.equal(box.status().pending, 1); await box.flush(); assert.equal(box.status().last_saved_at, NOW); await box.close();
});

test('admin check is authenticated and works without connecting WhatsApp', async (t) => {
  let checks = 0;
  const clients = { status: () => ({ configured: true, pending: 0, retrying: 0, last_saved_at: null, probe: null }), checkDatabase: async () => { checks++; return passed(); } };
  const app = express(); app.use('/admin', createAdminRouter({ token: 'test-secret', store: { sessions: new Map() }, processor: { clients } }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.code }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise((r) => server.close(r)); });
  const base = `http://127.0.0.1:${server.address().port}/admin/client-capture`, headers = { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' };
  assert.equal((await fetch(base)).status, 401); assert.equal((await (await fetch(base, { headers })).json()).configured, true);
  assert.equal((await fetch(base + '/check', { method: 'POST', headers, body: '{"phone":"6280000000001"}' })).status, 400); assert.equal(checks, 0);
  assert.equal((await (await fetch(base + '/check', { method: 'POST', headers, body: '{}' })).json()).status, 'passed'); assert.equal(checks, 1);
});

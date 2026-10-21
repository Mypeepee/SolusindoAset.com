import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { AgentConnections } from '../services/agent_connections.js';
import { Catalog } from '../services/catalog.js';
import { loadConfig } from '../config.js';

test('identitas agent terisolasi; QR dan start ditolak sebelum autentikasi', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'solusindo-agents-test-'));
  const config = loadConfig({ LLM_PROVIDER: 'gemini', LLM_MODEL: 'test', GEMINI_API_KEY: 'fake', ADMIN_API_TOKEN: 'a'.repeat(32), BAILEYS_AUTH_FILE: join(dir, 'session.sqlite') });
  const clients = [];
  const agents = new AgentConnections(config, new Catalog(), { createClient: (wa) => {
    const client = { config: wa, auth: null, status: 'stopped',
      getStatus() { return { status: this.status, connected: false, received: 0, sent: 0 }; },
      getPairing() { return { qr: `qr-for-session-${clients.indexOf(this)}`, code: null }; },
      start(callback) { this.callback = callback; this.auth = { close() {} }; this.status = 'awaiting_scan'; },
      async stop() {},
    };
    clients.push(client); return client;
  } });
  const app = express();
  app.use('/agents', agents.router());
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.code }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await agents.shutdown(); rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}/agents`;
  const headers = { Authorization: `Bearer ${config.adminToken}`, 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${base}/AG1/admin/whatsapp/pairing`)).status, 401);
  assert.equal((await fetch(`${base}/AG1/admin/whatsapp/connect`, { method: 'POST' })).status, 401);
  assert.equal(agents.entries.size, 0);
  for (const id of ['AG1', 'AG2']) {
    assert.equal((await fetch(`${base}/${id}/admin/whatsapp/connect`, { method: 'POST', headers, body: '{}' })).status, 202);
  }
  const first = agents.get('AG1'), second = agents.get('AG2');
  assert.notEqual(first.whatsapp.config.authFile, second.whatsapp.config.authFile);
  assert.notEqual(first.store, second.store);
  first.store.create('628123456789');
  assert.equal(second.store.sessions.size, 0);
  const qr1 = await (await fetch(`${base}/AG1/admin/whatsapp/pairing`, { headers })).json();
  const qr2 = await (await fetch(`${base}/AG2/admin/whatsapp/pairing`, { headers })).json();
  assert.notEqual(qr1.qr, qr2.qr);
  assert.equal((await fetch(`${base}/invalid/admin/whatsapp/status`, { headers })).status, 400);
  assert.throws(() => agents.get('../AG1'), { code: 'INVALID_AGENT' });
  agents.cleanup();
  assert.equal(agents.get('AG1'), first, 'sesi yang sudah dimulai tetap hidup saat cleanup');
});

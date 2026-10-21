import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { validClientCapture } from '../services/client_capture.js';
import { postJson, ServiceError, logFailure } from '../lib/http.js';
import { validClientCheck } from '../services/client_capture_status.js';

// Durable, latest-wins queue. Only the funnel snapshot is retained, never chat.
export class ClientOutbox {
  constructor(filename, connection, { now = Date.now, fetchImpl = fetch, logger = console, maxRows = 100000 } = {}) {
    Object.assign(this, { connection, now, fetchImpl, logger, maxRows });
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    if (filename !== ':memory:') chmodSync(filename, 0o600);
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS client_outbox (
        phone TEXT PRIMARY KEY, payload TEXT NOT NULL, fingerprint TEXT NOT NULL,
        pending INTEGER NOT NULL DEFAULT 1, attempts INTEGER NOT NULL DEFAULT 0, retry_at INTEGER NOT NULL DEFAULT 0
      );`);
    const columns = this.db.prepare('PRAGMA table_info(client_outbox)').all().map((row) => row.name);
    for (const [name, type] of [['stored_at', 'INTEGER'], ['last_error', 'TEXT']]) {
      if (!columns.includes(name)) this.db.exec(`ALTER TABLE client_outbox ADD COLUMN ${name} ${type}`);
    }
    this.db.exec('CREATE TABLE IF NOT EXISTS client_checks (id INTEGER PRIMARY KEY CHECK(id = 1), report TEXT NOT NULL)');
    this.running = null;
    this.checking = null;
  }

  enqueue(input) {
    if (!validClientCapture(input)) throw new ServiceError('INVALID_CLIENT_CAPTURE', 400);
    const fingerprint = createHash('sha256').update(JSON.stringify({ name: input.name, criteria: input.criteria })).digest('hex');
    const existing = this.db.prepare('SELECT fingerprint, payload FROM client_outbox WHERE phone = ?').get(input.phone);
    if (existing?.fingerprint === fingerprint || existing && JSON.parse(existing.payload).captured_at > input.captured_at) return false;
    if (!existing && this.db.prepare('SELECT COUNT(*) AS total FROM client_outbox').get().total >= this.maxRows) throw new ServiceError('CLIENT_CAPTURE_CAPACITY', 503);
    this.db.prepare(`INSERT INTO client_outbox(phone, payload, fingerprint) VALUES (?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET payload = excluded.payload, fingerprint = excluded.fingerprint, pending = 1, attempts = 0, retry_at = 0, last_error = NULL`)
      .run(input.phone, JSON.stringify(input), fingerprint);
    return true;
  }

  // A later introduction may enrich an already-qualified contact.
  setName(phone, name) {
    if (!name) return;
    const row = this.db.prepare('SELECT payload FROM client_outbox WHERE phone = ?').get(phone);
    if (row) this.enqueue({ ...JSON.parse(row.payload), name, captured_at: this.now() });
  }

  flush() {
    if (this.running) return this.running;
    this.running = this.sendPending().finally(() => { this.running = null; });
    return this.running;
  }

  async sendPending() {
    for (const row of this.db.prepare('SELECT * FROM client_outbox WHERE pending = 1 AND retry_at <= ? ORDER BY retry_at, rowid LIMIT 25').all(this.now())) {
      try {
        const result = await postJson(this.connection.url, { headers: { Authorization: `Bearer ${this.connection.token}` },
          body: JSON.parse(row.payload), timeoutMs: this.connection.timeoutMs, fetchImpl: this.fetchImpl });
        if (!/^KL\d+$/.test(result?.id_klien) || result.id_agent !== 'AG108' || !['created', 'updated', 'stale'].includes(result.status)) throw new ServiceError('INVALID_CLIENT_RECEIPT', 502);
        // A slow previous request cannot acknowledge a newer revision.
        this.db.prepare('UPDATE client_outbox SET pending = 0, attempts = 0, stored_at = ?, last_error = NULL WHERE phone = ? AND fingerprint = ?').run(this.now(), row.phone, row.fingerprint);
      } catch (error) {
        const delay = Math.min(300000, 1000 * 2 ** Math.min(row.attempts, 9));
        this.db.prepare('UPDATE client_outbox SET attempts = attempts + 1, retry_at = ?, last_error = ? WHERE phone = ? AND fingerprint = ?')
          .run(this.now() + delay, error.status === 401 ? 'CLIENT_AUTH_FAILED' : 'CLIENT_SAVE_FAILED', row.phone, row.fingerprint);
        logFailure(this.logger, 'client_capture_retry', error);
      }
    }
  }

  status() {
    const counts = this.db.prepare(`SELECT COUNT(*) FILTER (WHERE pending = 1) AS pending,
      COUNT(*) FILTER (WHERE pending = 1 AND attempts > 0) AS retrying, MAX(stored_at) AS last_saved_at FROM client_outbox`).get();
    const latest = this.db.prepare('SELECT report FROM client_checks WHERE id = 1').get();
    const probe = latest ? JSON.parse(latest.report) : null;
    // No contact numbers, funnel payloads, upstream bodies or tokens here.
    return { configured: true, ...counts, probe };
  }

  async checkDatabase() {
    if (this.checking) return this.checking;
    const last = this.status().probe;
    if (last && last.checked_at + 30000 > this.now()) {
      const error = new ServiceError('CLIENT_CHECK_RATE_LIMIT', 429);
      error.retryAfter = Math.ceil((last.checked_at + 30000 - this.now()) / 1000); throw error;
    }
    this.checking = this.runDatabaseCheck().finally(() => { this.checking = null; });
    return this.checking;
  }

  async runDatabaseCheck() {
    let report;
    try {
      const result = await postJson(`${this.connection.url.replace(/\/$/, '')}/check`, {
        headers: { Authorization: `Bearer ${this.connection.token}` }, body: {},
        timeoutMs: Math.max(20000, this.connection.timeoutMs), fetchImpl: this.fetchImpl });
      if (!validClientCheck(result) || result.status !== 'passed' || result.checked_at > this.now() + 300000 || result.checked_at < this.now() - 60000) throw new ServiceError('INVALID_CLIENT_CHECK', 502);
      report = { status: 'passed', id_agent: 'AG108', checked_at: result.checked_at,
        checks: { write: true, read: true, update: true, deduplication: true, cleanup: true } };
    } catch (error) {
      report = { status: 'failed', id_agent: 'AG108', checked_at: this.now(),
        error: error.status === 401 ? 'CLIENT_AUTH_FAILED' : error.code === 'INVALID_CLIENT_CHECK' ? 'INVALID_CLIENT_CHECK' :
          ['UPSTREAM_TIMEOUT', 'UPSTREAM_UNAVAILABLE'].includes(error.code) ? error.code : 'CLIENT_DATABASE_UNAVAILABLE' };
    }
    this.db.prepare('INSERT INTO client_checks(id, report) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET report = excluded.report').run(JSON.stringify(report));
    return report;
  }

  async close() { await Promise.all([this.running, this.checking]); this.db.close(); }
}

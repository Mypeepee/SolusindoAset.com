import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { validContact, validPhone } from '../lib/security.js';
import { ServiceError } from '../lib/http.js';

// Operational follow-ups, separate from the read-only property database. Never
// store chat history, financial qualification, or raw property records here;
// the outbox contains only the public stock-confirmation message.
export class AssetCheckStore {
  constructor(filename, { now = Date.now, maxRows = 10000 } = {}) {
    this.now = now; this.maxRows = maxRows;
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    if (filename !== ':memory:') chmodSync(filename, 0o600);
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS asset_checks (
        id TEXT PRIMARY KEY, tenant TEXT NOT NULL, contact TEXT NOT NULL,
        asset_id TEXT NOT NULL, location TEXT NOT NULL, auction_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
        created_at INTEGER NOT NULL, completed_at INTEGER,
        UNIQUE(tenant, contact, asset_id, auction_at)
      );
      CREATE INDEX IF NOT EXISTS asset_checks_queue ON asset_checks(tenant, status, created_at);
      CREATE TABLE IF NOT EXISTS stock_notifications (
        id TEXT PRIMARY KEY, tenant TEXT NOT NULL, asset_id TEXT NOT NULL, auction_at TEXT NOT NULL,
        recipient TEXT NOT NULL, body TEXT NOT NULL, message_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','retry','sent','failed','uncertain')),
        attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL,
        lease_until INTEGER, lease_token TEXT, error_code TEXT, sent_at INTEGER,
        UNIQUE(tenant, asset_id, auction_at, recipient)
      );
      CREATE INDEX IF NOT EXISTS stock_notifications_due ON stock_notifications(tenant, status, next_attempt_at);`);
    // Upgrade existing queues in place; old notes stay manual until a client
    // asks again, so a restart never blasts historical requests to the stoker.
    if (!this.db.prepare('PRAGMA table_info(asset_checks)').all().some((column) => column.name === 'notification_id')) {
      this.db.exec('ALTER TABLE asset_checks ADD COLUMN notification_id TEXT');
    }
    const columns = this.db.prepare('PRAGMA table_info(asset_checks)').all();
    for (const [name, type] of [['stock_result', 'TEXT'], ['stock_reference', 'TEXT'], ['stock_confirmed_at', 'INTEGER']]) {
      if (!columns.some((column) => column.name === name)) this.db.exec(`ALTER TABLE asset_checks ADD COLUMN ${name} ${type}`);
    }
  }

  forTenant(tenant) {
    if (tenant !== 'operator' && !/^AG\d{1,18}$/.test(tenant)) throw new ServiceError('INVALID_AGENT', 400);
    const project = `SELECT c.id, c.contact, c.asset_id, c.location, c.auction_at, c.status, c.created_at,
      n.id AS notification_id, n.status AS notification_status, n.recipient AS notification_recipient,
      n.attempts AS notification_attempts, n.error_code AS notification_error, n.sent_at AS notification_sent_at
      FROM asset_checks c LEFT JOIN stock_notifications n ON n.id = c.notification_id AND n.tenant = c.tenant`;
    const get = (id) => this.db.prepare(`${project} WHERE c.tenant = ? AND c.id = ?`).get(tenant, id);
    return {
      get,
      stockResult: (asset) => {
        // Confirmation is scoped to this tenant and this exact auction round.
        const row = this.db.prepare(`SELECT stock_result AS result, stock_confirmed_at AS confirmed_at
          FROM asset_checks WHERE tenant=? AND asset_id=? AND auction_at=?
          AND stock_result IN ('available','sold') AND stock_confirmed_at > ?
          ORDER BY stock_confirmed_at DESC, rowid DESC LIMIT 1`)
          .get(tenant, asset.id, new Date(asset.auction_at).toISOString(), this.now() - 86400000);
        return row ? { ...row, asset_id: asset.id, auction_at: new Date(asset.auction_at).toISOString() } : null;
      },
      enqueue: ({ contact, asset, notification }) => {
        if (!validContact(contact) || !/^[A-Z0-9][A-Z0-9-]{0,49}$/i.test(asset.id) || !Number.isFinite(Date.parse(asset.auction_at))) throw new ServiceError('INVALID_ASSET_CHECK', 400);
        if (notification && (!validPhone(notification.recipient) || typeof notification.body !== 'string' || !notification.body.trim() || notification.body.length > 4096 ||
          !/^[A-F0-9]{20,64}$/.test(notification.messageId))) throw new ServiceError('INVALID_ASSET_CHECK', 400);
        const at = new Date(asset.auction_at).toISOString();
        this.db.exec('BEGIN IMMEDIATE');
        try {
        // Completed follow-ups expire after 30 days; pending work is never
        // silently discarded to make space for a new request.
        this.db.prepare("DELETE FROM asset_checks WHERE status = 'completed' AND completed_at < ?").run(this.now() - 30 * 86400000);
        this.db.prepare("DELETE FROM stock_notifications WHERE status != 'sending' AND NOT EXISTS (SELECT 1 FROM asset_checks WHERE notification_id = stock_notifications.id)").run();
        const existing = this.db.prepare('SELECT id, status, stock_result, stock_confirmed_at FROM asset_checks WHERE tenant = ? AND contact = ? AND asset_id = ? AND auction_at = ?').get(tenant, contact, asset.id, at);
        if (notification && existing?.status === 'completed' && (!existing.stock_result || existing.stock_confirmed_at <= this.now() - 86400000)) {
          this.db.prepare("UPDATE asset_checks SET status='pending', completed_at=NULL WHERE tenant=? AND id=?").run(tenant, existing.id);
          existing.status = 'pending';
        }
        if (!existing && this.db.prepare('SELECT COUNT(*) AS total FROM asset_checks').get().total >= this.maxRows) throw new ServiceError('ASSET_CHECK_CAPACITY', 503);
        const id = existing?.id || randomUUID();
        let notificationId = null;
        if (notification && existing?.status !== 'completed') {
          notificationId = randomUUID();
          this.db.prepare(`INSERT INTO stock_notifications(id, tenant, asset_id, auction_at, recipient, body, message_id, next_attempt_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant, asset_id, auction_at, recipient) DO NOTHING`)
            .run(notificationId, tenant, asset.id, at, notification.recipient, notification.body, notification.messageId, this.now());
          notificationId = this.db.prepare('SELECT id FROM stock_notifications WHERE tenant = ? AND asset_id = ? AND auction_at = ? AND recipient = ?')
            .get(tenant, asset.id, at, notification.recipient).id;
          // A new client inquiry after a day may request a fresh confirmation.
          // Ambiguous sends still require manual review and are never replayed.
          this.db.prepare(`UPDATE stock_notifications SET status='pending', message_id=?, body=?, attempts=0,
            next_attempt_at=?, sent_at=NULL, error_code=NULL WHERE tenant=? AND id=? AND status='sent' AND sent_at<=?`)
            .run(notification.messageId, notification.body, this.now(), tenant, notificationId, this.now() - 86400000);
        }
        if (!existing) this.db.prepare('INSERT INTO asset_checks(id, tenant, contact, asset_id, location, auction_at, created_at, notification_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, tenant, contact, asset.id, String(asset.location || '').slice(0, 240), at, this.now(), notificationId);
        else if (notificationId) this.db.prepare('UPDATE asset_checks SET notification_id = ? WHERE id = ? AND tenant = ?').run(notificationId, id, tenant);
        const result = { ...get(id), created: !existing };
        this.db.exec('COMMIT');
        return result;
        } catch (error) { this.db.exec('ROLLBACK'); throw error; }
      },
      list: () => {
        const total = this.db.prepare("SELECT COUNT(*) AS total FROM asset_checks WHERE tenant = ? AND status = 'pending'").get(tenant).total;
        const items = this.db.prepare(`${project} WHERE c.tenant = ? AND c.status = 'pending' ORDER BY c.created_at ASC LIMIT 100`).all(tenant);
        return { total, items };
      },
      complete: (id, confirmation = {}) => {
        if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) throw new ServiceError('INVALID_ASSET_CHECK', 400);
        const { result: verdict, reference } = confirmation;
        if (Object.keys(confirmation).some((key) => !['result', 'reference'].includes(key)) ||
          verdict != null && (!['available', 'sold'].includes(verdict) || typeof reference !== 'string' || !reference.trim() || reference.length > 300) ||
          verdict == null && reference != null) throw new ServiceError('INVALID_STOCK_RESULT', 400);
        const result = this.db.prepare(`UPDATE asset_checks SET status='completed', completed_at=?,
          stock_result=?, stock_reference=?, stock_confirmed_at=? WHERE tenant=? AND id=? AND status='pending'`)
          .run(this.now(), verdict || null, verdict ? reference.trim() : null, verdict ? this.now() : null, tenant, id);
        if (!result.changes) throw new ServiceError('ASSET_CHECK_NOT_FOUND', 404);
        return { id, status: 'completed' };
      },
      claimNotification: (preferredId) => {
        this.db.exec('BEGIN IMMEDIATE');
        try {
          // An interrupted send has an ambiguous outcome. Do not auto-replay it.
          this.db.prepare("UPDATE stock_notifications SET status = 'uncertain', error_code = 'SEND_INTERRUPTED', lease_token = NULL WHERE tenant = ? AND status = 'sending' AND lease_until <= ?").run(tenant, this.now());
          const row = this.db.prepare(`SELECT n.* FROM stock_notifications n WHERE n.tenant = ? AND n.status IN ('pending','retry') AND n.next_attempt_at <= ?
            AND (? IS NULL OR n.id = ?)
            AND EXISTS (SELECT 1 FROM asset_checks c WHERE c.tenant = n.tenant AND c.notification_id = n.id AND c.status = 'pending')
            ORDER BY n.next_attempt_at ASC LIMIT 1`).get(tenant, this.now(), preferredId || null, preferredId || null);
          if (!row) { this.db.exec('COMMIT'); return null; }
          const lease = randomUUID();
          this.db.prepare("UPDATE stock_notifications SET status = 'sending', attempts = attempts + 1, lease_token = ?, lease_until = ? WHERE id = ? AND tenant = ?")
            .run(lease, this.now() + 120000, row.id, tenant);
          this.db.exec('COMMIT');
          return { ...row, lease_token: lease };
        } catch (error) { this.db.exec('ROLLBACK'); throw error; }
      },
      finishNotification: (id, lease, { status, code }) => {
        if (!['sent', 'retry', 'failed', 'uncertain'].includes(status)) throw new ServiceError('INVALID_NOTIFICATION_STATUS', 400);
        this.db.prepare(`UPDATE stock_notifications SET status = ?, error_code = ?, sent_at = ?, lease_until = NULL, lease_token = NULL,
          next_attempt_at = ? + MIN(300000, 5000 * (1 << MIN(attempts, 6))) WHERE tenant = ? AND id = ? AND lease_token = ? AND status = 'sending'`)
          .run(status, /^[A-Z][A-Z0-9_]{0,79}$/.test(code || '') ? code : null, status === 'sent' ? this.now() : null, this.now(), tenant, id, lease);
      },
      retryNotification: (id) => {
        if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) throw new ServiceError('INVALID_ASSET_CHECK', 400);
        const task = get(id);
        if (!task || task.status !== 'pending') throw new ServiceError('ASSET_CHECK_NOT_FOUND', 404);
        const result = this.db.prepare("UPDATE stock_notifications SET status = 'retry', next_attempt_at = ?, error_code = NULL WHERE tenant = ? AND id = ? AND status IN ('retry','failed','uncertain')")
          .run(this.now(), tenant, task.notification_id);
        if (!result.changes) throw new ServiceError('NOTIFICATION_NOT_RETRYABLE', 409);
      },
    };
  }

  close() { this.db.close(); }
}

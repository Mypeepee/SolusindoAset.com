import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

// Human ownership, closing cursor and structured search preferences survive
// restarts. Search snapshots may keep one safe pending text, never the full
// raw WhatsApp message history.
export class ConversationControl {
  constructor(filename, now = Date.now) {
    this.now = now;
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    if (filename !== ':memory:') chmodSync(filename, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS human_ownership(tenant TEXT, contact TEXT, reason TEXT, at INTEGER, PRIMARY KEY(tenant,contact));
      CREATE TABLE IF NOT EXISTS bot_messages(tenant TEXT, id TEXT, expires INTEGER, PRIMARY KEY(tenant,id));`);
    this.db.exec('CREATE TABLE IF NOT EXISTS closing_conversations(tenant TEXT, contact TEXT, state TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(tenant,contact))');
    this.db.exec('CREATE TABLE IF NOT EXISTS search_preferences(tenant TEXT, contact TEXT, state TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(tenant,contact))');
    if (!this.db.prepare('PRAGMA table_info(human_ownership)').all().some((column) => column.name === 'resume_at')) this.db.exec('ALTER TABLE human_ownership ADD COLUMN resume_at INTEGER');
    this.db.exec('CREATE TABLE IF NOT EXISTS bot_resumes(tenant TEXT, contact TEXT, at INTEGER, PRIMARY KEY(tenant,contact))');
    this.db.exec('CREATE TABLE IF NOT EXISTS owner_messages(tenant TEXT, id TEXT, expires INTEGER, PRIMARY KEY(tenant,id))');
  }
  forTenant(tenant) {
    return {
      getSearch: (contact) => {
        const row = this.db.prepare('SELECT state FROM search_preferences WHERE tenant=? AND contact=?').get(tenant, contact);
        return row ? JSON.parse(row.state) : null;
      },
      saveSearch: (contact, state) => {
        this.db.prepare('DELETE FROM search_preferences WHERE updated_at<?').run(this.now() - 30 * 86400000);
        this.db.prepare('INSERT INTO search_preferences VALUES(?,?,?,?) ON CONFLICT(tenant,contact) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at')
          .run(tenant, contact, JSON.stringify(state), this.now());
      },
      getConversion: (contact) => {
        const row = this.db.prepare('SELECT state FROM closing_conversations WHERE tenant=? AND contact=?').get(tenant, contact);
        return row ? JSON.parse(row.state) : null;
      },
      saveConversion: (contact, state) => {
        if (state.mode !== 'Closing_State') return this.db.prepare('DELETE FROM closing_conversations WHERE tenant=? AND contact=?').run(tenant, contact);
        this.db.prepare('INSERT INTO closing_conversations VALUES(?,?,?,?) ON CONFLICT(tenant,contact) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at')
          .run(tenant, contact, JSON.stringify(state), this.now());
      },
      get: (contact) => {
        const row = this.db.prepare('SELECT reason,at,resume_at FROM human_ownership WHERE tenant=? AND contact=?').get(tenant, contact);
        if (row?.resume_at == null && row) delete row.resume_at;
        return row;
      },
      list: () => this.db.prepare('SELECT contact,reason,at,resume_at FROM human_ownership WHERE tenant=?').all(tenant).map((row) => {
        if (row.resume_at == null) delete row.resume_at;
        return row;
      }),
      pause: (contact, reason, { at = this.now(), resume_at = null } = {}) => this.db.prepare('INSERT INTO human_ownership(tenant,contact,reason,at,resume_at) VALUES(?,?,?,?,?) ON CONFLICT(tenant,contact) DO UPDATE SET reason=excluded.reason,at=excluded.at,resume_at=excluded.resume_at').run(tenant, contact, reason, at, resume_at),
      resume: (contact) => {
        this.db.prepare('DELETE FROM human_ownership WHERE tenant=? AND contact=?').run(tenant, contact);
        this.db.prepare('INSERT INTO bot_resumes VALUES(?,?,?) ON CONFLICT(tenant,contact) DO UPDATE SET at=excluded.at').run(tenant, contact, this.now());
      },
      getResumeAt: (contact) => this.db.prepare('SELECT at FROM bot_resumes WHERE tenant=? AND contact=?').get(tenant, contact)?.at || 0,
      hasOwnerMessage: (id) => !!this.db.prepare('SELECT 1 FROM owner_messages WHERE tenant=? AND id=? AND expires>=?').get(tenant, id, this.now()),
      markOwnerMessage: (id) => {
        this.db.prepare('DELETE FROM owner_messages WHERE expires<?').run(this.now());
        this.db.prepare('INSERT OR REPLACE INTO owner_messages VALUES(?,?,?)').run(tenant, id, this.now() + 7 * 86400000);
      },
      markOutbound: (id) => {
        this.db.prepare('DELETE FROM bot_messages WHERE expires<?').run(this.now());
        this.db.prepare('INSERT OR REPLACE INTO bot_messages VALUES(?,?,?)').run(tenant, id, this.now() + 7 * 86400000);
      },
      isOutbound: (id) => !!this.db.prepare('SELECT 1 FROM bot_messages WHERE tenant=? AND id=? AND expires>=?').get(tenant, id, this.now()),
    };
  }
  close() { this.db.close(); }
}

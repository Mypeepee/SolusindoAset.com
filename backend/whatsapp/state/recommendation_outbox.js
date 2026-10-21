import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { RECOMMENDATION_BATCH_SIZE } from '../services/recommendation_policy.js';
import { AUCTION_FRESHNESS_VERSION } from '../services/auction_freshness.js';

// One durable queue per WhatsApp deployment, partitioned by sending agent.
// A send intent is committed before touching WhatsApp. Ambiguous attempts
// remain uncertain and are never silently sent a second time after restart.
export class RecommendationOutbox {
  constructor(filename, now = Date.now) {
    this.now = now;
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    if (filename !== ':memory:') chmodSync(filename, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS recommendation_agents (
        agent TEXT PRIMARY KEY, cursor TEXT, enabled INTEGER NOT NULL DEFAULT 1,
        initialized_at INTEGER, last_scan_at INTEGER, last_error TEXT
      );
      CREATE TABLE IF NOT EXISTS recommendation_candidates (
        agent TEXT NOT NULL, client TEXT NOT NULL, property TEXT NOT NULL,
        queued_at INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending', batch TEXT,
        PRIMARY KEY(agent,client,property)
      );
      CREATE TABLE IF NOT EXISTS recommendation_batches (
        id TEXT PRIMARY KEY, agent TEXT NOT NULL, client TEXT NOT NULL, phone TEXT NOT NULL,
        payload TEXT NOT NULL, state TEXT NOT NULL, created_at INTEGER NOT NULL,
        sent_at INTEGER, message_id TEXT, last_error TEXT
      );
      CREATE INDEX IF NOT EXISTS recommendation_pending ON recommendation_candidates(agent,state,queued_at);
      CREATE INDEX IF NOT EXISTS recommendation_cooldown ON recommendation_batches(agent,phone,created_at);
      CREATE TABLE IF NOT EXISTS recommendation_optouts (agent TEXT, phone TEXT, PRIMARY KEY(agent,phone));
      UPDATE recommendation_batches SET state='uncertain', last_error='DELIVERY_UNCERTAIN' WHERE state='sending';`);
    const columns = new Set(this.db.prepare('PRAGMA table_info(recommendation_agents)').all().map(r => r.name));
    for (const [name, type] of Object.entries({ daily_day: 'TEXT', daily_policy: 'TEXT', daily_after_client: "TEXT NOT NULL DEFAULT ''", daily_completed_at: 'INTEGER', daily_checked: 'INTEGER NOT NULL DEFAULT 0', daily_matched: 'INTEGER NOT NULL DEFAULT 0' })) {
      if (!columns.has(name)) this.db.exec(`ALTER TABLE recommendation_agents ADD COLUMN ${name} ${type}`);
    }
  }
  agent(agent) {
    this.db.prepare('INSERT OR IGNORE INTO recommendation_agents(agent) VALUES (?)').run(agent);
    return this.db.prepare('SELECT * FROM recommendation_agents WHERE agent=?').get(agent);
  }
  enabled(agent, value) {
    this.agent(agent);
    this.db.prepare('UPDATE recommendation_agents SET enabled=?,last_error=NULL WHERE agent=?').run(value ? 1 : 0, agent);
  }
  initialize(agent, cursor) {
    this.agent(agent);
    this.db.prepare('UPDATE recommendation_agents SET cursor=?,initialized_at=?,last_scan_at=?,last_error=NULL WHERE agent=? AND cursor IS NULL')
      .run(cursor, this.now(), this.now(), agent);
  }
  page(agent, previous, cursor, candidates) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.agent(agent).cursor === previous) {
        const insert = this.db.prepare('INSERT OR IGNORE INTO recommendation_candidates(agent,client,property,queued_at) VALUES (?,?,?,?)');
        for (const c of candidates) insert.run(agent, c.client_id, c.property_id, this.now());
        this.db.prepare('UPDATE recommendation_agents SET cursor=?,last_scan_at=?,last_error=NULL WHERE agent=?').run(cursor, this.now(), agent);
      }
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  pending(agent) {
    this.db.prepare("UPDATE recommendation_candidates SET state='expired' WHERE agent=? AND state='pending' AND queued_at<?").run(agent, this.now() - 7 * 86400000);
    const rows = this.db.prepare(`SELECT client,property FROM (
      SELECT client,property,queued_at,ROW_NUMBER() OVER(PARTITION BY client ORDER BY queued_at,CAST(property AS INTEGER)) AS rank
      FROM recommendation_candidates WHERE agent=? AND state='pending'
    ) WHERE rank<=${RECOMMENDATION_BATCH_SIZE} ORDER BY queued_at,client,rank LIMIT 300`).all(agent);
    const groups = new Map();
    for (const r of rows) {
      if (!groups.has(r.client)) groups.set(r.client, []);
      if (groups.get(r.client).length < RECOMMENDATION_BATCH_SIZE) groups.get(r.client).push(r.property);
    }
    return [...groups].map(([client, properties]) => ({ client, properties }));
  }
  daily(agent, day) {
    this.agent(agent);
    this.db.prepare("UPDATE recommendation_agents SET daily_day=?,daily_policy=?,daily_after_client='',daily_completed_at=NULL,daily_checked=0,daily_matched=0 WHERE agent=? AND (daily_day IS NULL OR daily_day<>? OR daily_policy IS NULL OR daily_policy<>?)").run(day, AUCTION_FRESHNESS_VERSION, agent, day, AUCTION_FRESHNESS_VERSION);
    return this.agent(agent);
  }
  dailyPage(agent, day, previous, page) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.agent(agent);
      if (current.daily_day === day && current.daily_after_client === previous && !current.daily_completed_at) {
        this.db.prepare("UPDATE recommendation_candidates SET state='expired' WHERE agent=? AND state='pending' AND queued_at<?").run(agent, this.now() - 7 * 86400000);
        const insert = this.db.prepare(`INSERT INTO recommendation_candidates(agent,client,property,queued_at) VALUES (?,?,?,?)
          ON CONFLICT(agent,client,property) DO UPDATE SET state='pending',batch=NULL,queued_at=excluded.queued_at WHERE recommendation_candidates.state IN ('skipped','expired')`);
        for (const c of page.candidates) insert.run(agent, c.client_id, c.property_id, this.now());
        this.db.prepare('UPDATE recommendation_agents SET daily_after_client=?,daily_completed_at=?,daily_checked=daily_checked+?,daily_matched=daily_matched+?,last_error=NULL WHERE agent=?')
          .run(page.after_client, page.more ? null : this.now(), page.checked, page.matched, agent);
      }
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  alreadyDelivered(agent, phone, ids) {
    const has = this.db.prepare(`SELECT 1 FROM recommendation_candidates c JOIN recommendation_batches b ON b.id=c.batch
      WHERE c.agent=? AND b.phone=? AND c.property=? AND c.state='delivered' LIMIT 1`);
    return ids.filter(id => has.get(agent, phone, id));
  }
  skip(agent, client, ids) {
    const update = this.db.prepare("UPDATE recommendation_candidates SET state='skipped' WHERE agent=? AND client=? AND property=? AND state='pending'");
    for (const id of ids) update.run(agent, client, id);
  }
  cooling(agent, phone) {
    // All duplicate CRM entries for a phone share the same daily limit.
    return !!this.db.prepare("SELECT 1 FROM recommendation_batches WHERE agent=? AND phone=? AND (created_at>? OR state IN ('sending','uncertain','sent')) LIMIT 1")
      .get(agent, phone, this.now() - 86400000);
  }
  begin(agent, client, draft) {
    const id = randomUUID();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.cooling(agent, draft.phone) || !this.agent(agent).enabled) { this.db.exec('ROLLBACK'); return null; }
      for (const property of draft.property_ids) {
        const row = this.db.prepare("SELECT state FROM recommendation_candidates WHERE agent=? AND client=? AND property=?").get(agent, client, property);
        if (row?.state !== 'pending') { this.db.exec('ROLLBACK'); return null; }
      }
      this.db.prepare("INSERT INTO recommendation_batches(id,agent,client,phone,payload,state,created_at) VALUES (?,?,?,?,?,'sending',?)")
        .run(id, agent, client, draft.phone, JSON.stringify(draft), this.now());
      const reserve = this.db.prepare("UPDATE recommendation_candidates SET state='reserved',batch=? WHERE agent=? AND client=? AND property=? AND state='pending'");
      for (const property of draft.property_ids) reserve.run(id, agent, client, property);
      this.db.exec('COMMIT'); return id;
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  sent(id, messageId) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare("UPDATE recommendation_batches SET state='sent',sent_at=?,message_id=?,last_error=NULL WHERE id=?").run(this.now(), messageId || null, id);
      this.db.prepare("UPDATE recommendation_candidates SET state='delivered' WHERE batch=?").run(id);
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  uncertain(id) {
    this.db.prepare("UPDATE recommendation_batches SET state='uncertain',last_error='DELIVERY_UNCERTAIN' WHERE id=?").run(id);
  }
  acknowledgements(agent) {
    return this.db.prepare("SELECT id,payload FROM recommendation_batches WHERE agent=? AND state='sent' ORDER BY created_at LIMIT 25").all(agent);
  }
  acknowledged(id) {
    // Retain IDs and delivery evidence for deduplication, discard message text
    // and the receipt once CRM has recorded the successful handoff.
    this.db.prepare("UPDATE recommendation_batches SET state='done',payload='{}' WHERE id=?").run(id);
  }
  error(agent, error) {
    this.agent(agent);
    this.db.prepare('UPDATE recommendation_agents SET last_error=? WHERE agent=?').run(error, agent);
  }
  recipientEnabled(agent, phone, enabled) {
    if (enabled) this.db.prepare('DELETE FROM recommendation_optouts WHERE agent=? AND phone=?').run(agent, phone);
    else this.db.prepare('INSERT OR IGNORE INTO recommendation_optouts(agent,phone) VALUES (?,?)').run(agent, phone);
  }
  recipientAllows(agent, phone) { return !this.db.prepare('SELECT 1 FROM recommendation_optouts WHERE agent=? AND phone=?').get(agent, phone); }
  review(agent, id, resolution) {
    const row = this.db.prepare("SELECT id FROM recommendation_batches WHERE agent=? AND id=? AND state='uncertain'").get(agent, id);
    if (!row) return false;
    if (resolution === 'delivered') this.sent(id, this.db.prepare('SELECT message_id FROM recommendation_batches WHERE id=?').get(id).message_id);
    else {
      this.db.prepare("UPDATE recommendation_batches SET state='skipped',payload='{}',last_error=NULL WHERE id=?").run(id);
      this.db.prepare("UPDATE recommendation_candidates SET state='skipped' WHERE batch=?").run(id);
    }
    return true;
  }
  status(agent) {
    const settings = this.agent(agent);
    const counts = this.db.prepare(`SELECT COUNT(*) FILTER(WHERE state='pending') AS pending,
      COUNT(*) FILTER(WHERE state='delivered') AS delivered FROM recommendation_candidates WHERE agent=?`).get(agent);
    const evidence = this.db.prepare(`SELECT COUNT(*) FILTER(WHERE state='uncertain') AS uncertain,
      COUNT(*) FILTER(WHERE state='sent') AS awaiting_ack,MAX(sent_at) AS last_sent_at FROM recommendation_batches WHERE agent=?`).get(agent);
    const needs_review = this.db.prepare("SELECT id,phone AS contact,created_at,payload FROM recommendation_batches WHERE agent=? AND state='uncertain' ORDER BY created_at LIMIT 20")
      .all(agent).map(row => ({ id: row.id, contact: row.contact, created_at: row.created_at, property_ids: JSON.parse(row.payload).property_ids }));
    return { enabled: !!settings.enabled, initialized_at: settings.initialized_at, last_scan_at: settings.last_scan_at,
      daily_day: settings.daily_day, daily_completed_at: settings.daily_completed_at, daily_checked: settings.daily_checked, daily_matched: settings.daily_matched,
      last_error: settings.last_error, ...counts, ...evidence, needs_review };
  }
  close() { this.db.close(); }
}

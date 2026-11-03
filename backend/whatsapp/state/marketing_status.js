import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

// Dispatch evidence survives restart; participant hashes are used only to count
// observed events. Raw reply text and viewer lists are not stored.
export class MarketingStatusStore {
  constructor(filename, now = Date.now) {
    this.now = now;
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    if (filename !== ":memory:") chmodSync(filename, 0o600);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS marketing_statuses (
        id TEXT PRIMARY KEY, message_id TEXT NOT NULL UNIQUE, account TEXT NOT NULL,
        state TEXT NOT NULL, created_at INTEGER NOT NULL, sent_at INTEGER, error TEXT,
        test INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS marketing_events (
        message_id TEXT NOT NULL, kind TEXT NOT NULL, participant TEXT NOT NULL,
        event_id TEXT NOT NULL, created_at INTEGER NOT NULL,
        PRIMARY KEY(message_id,kind,participant,event_id)
      );
      CREATE TABLE IF NOT EXISTS marketing_contacts (
        jid TEXT PRIMARY KEY, name TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS marketing_account (id INTEGER PRIMARY KEY CHECK(id=1), phone TEXT NOT NULL);
      UPDATE marketing_statuses SET state='uncertain',error='DELIVERY_UNCERTAIN' WHERE state='sending';`);
  }
  bindAccount(phone) {
    if (!phone) return;
    const previous = this.db
      .prepare("SELECT phone FROM marketing_account WHERE id=1")
      .get();
    if (previous?.phone && previous.phone !== phone)
      this.db.exec("DELETE FROM marketing_contacts");
    this.db
      .prepare(
        "INSERT INTO marketing_account(id,phone) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET phone=excluded.phone",
      )
      .run(phone);
  }
  clearContacts() {
    this.db.exec("DELETE FROM marketing_contacts");
  }
  contacts(items) {
    const insert = this.db.prepare(
      "INSERT INTO marketing_contacts(jid,name,updated_at) VALUES (?,?,?) ON CONFLICT(jid) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at",
    );
    for (const item of items.slice(0, 5000)) {
      if (/^[1-9]\d{6,14}@(s\.whatsapp\.net|lid)$/.test(item.jid))
        insert.run(item.jid, String(item.name || "").slice(0, 120), this.now());
    }
    this.db
      .prepare("DELETE FROM marketing_contacts WHERE updated_at < ?")
      .run(this.now() - 90 * 86400000);
  }
  listContacts() {
    return this.db
      .prepare(
        "SELECT jid,name FROM marketing_contacts ORDER BY name,jid LIMIT 2000",
      )
      .all();
  }
  get(id) {
    return this.db
      .prepare("SELECT * FROM marketing_statuses WHERE id=?")
      .get(id);
  }
  byMessage(id) {
    return this.db
      .prepare("SELECT * FROM marketing_statuses WHERE message_id=?")
      .get(id);
  }
  begin(id, messageId, account, test) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO marketing_statuses(id,message_id,account,state,created_at,test) VALUES (?,?,?,'sending',?,?)",
      )
      .run(id, messageId, account, this.now(), test ? 1 : 0);
    return this.get(id);
  }
  sent(id) {
    this.db
      .prepare(
        "UPDATE marketing_statuses SET state='published',sent_at=?,error=NULL WHERE id=?",
      )
      .run(this.now(), id);
  }
  uncertain(id) {
    this.db
      .prepare(
        "UPDATE marketing_statuses SET state='uncertain',error='DELIVERY_UNCERTAIN' WHERE id=? AND state='sending'",
      )
      .run(id);
  }
  observe(messageId, kind, participant, eventId = "") {
    const row = this.byMessage(messageId);
    if (
      !row ||
      !participant ||
      this.now() - row.created_at > 86400000 ||
      !["views", "replies", "reactions"].includes(kind)
    )
      return false;
    const hash = createHash("sha256")
      .update(messageId + "/" + participant)
      .digest("hex");
    this.db
      .prepare(
        "INSERT OR IGNORE INTO marketing_events(message_id,kind,participant,event_id,created_at) VALUES (?,?,?,?,?)",
      )
      .run(messageId, kind, hash, eventId, this.now());
    // A recipient event proves delivery even if the sender acknowledgement was lost.
    if (["sending", "uncertain"].includes(row.state)) this.sent(row.id);
    return true;
  }
  latestTest(account) {
    return (
      this.db
        .prepare(
          "SELECT sent_at FROM marketing_statuses WHERE account=? AND test=1 AND state='published' ORDER BY sent_at DESC LIMIT 1",
        )
        .get(account)?.sent_at || null
    );
  }
  metrics(id) {
    const row = this.get(id);
    if (!row) return null;
    const rows = this.db
      .prepare(
        "SELECT kind,COUNT(*) AS count FROM marketing_events WHERE message_id=? GROUP BY kind",
      )
      .all(row.message_id);
    const counts = Object.fromEntries(
      rows.map((item) => [item.kind, Number(item.count)]),
    );
    return {
      id,
      state: row.state,
      message_id: row.message_id,
      created_at: row.created_at,
      sent_at: row.sent_at,
      values: {
        views: counts.views ?? null,
        replies: counts.replies ?? null,
        reactions: counts.reactions ?? null,
      },
      reason:
        this.now() - row.created_at >= 86400000
          ? "STATUS_EXPIRED"
          : "METRICS_UNAVAILABLE",
    };
  }
  close() {
    this.db.close();
  }
}

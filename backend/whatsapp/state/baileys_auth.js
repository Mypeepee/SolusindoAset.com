import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync, openSync, closeSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { BufferJSON, initAuthCreds, proto } from '@whiskeysockets/baileys';

// Menyimpan semua tipe key, termasuk lid-mapping/device-list/tctoken pada Baileys 7.
export function createBaileysAuth(filename) {
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const lock = `${filename}.lock`;
  try {
    const pid = Number(readFileSync(lock, 'utf8'));
    try { process.kill(pid, 0); throw new Error('BAILEYS_SESSION_IN_USE'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    unlinkSync(lock);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const fd = openSync(lock, 'wx', 0o600);
  writeFileSync(fd, String(process.pid));
  closeSync(fd);
  let db;
  try {
    db = new DatabaseSync(filename);
    chmodSync(filename, 0o600);
    db.exec(`PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS auth (category TEXT, id TEXT, value TEXT NOT NULL, PRIMARY KEY(category, id));`);
  } catch (error) { db?.close(); unlinkSync(lock); throw error; }
  const read = db.prepare('SELECT value FROM auth WHERE category = ? AND id = ?');
  const put = db.prepare('INSERT OR REPLACE INTO auth(category, id, value) VALUES (?, ?, ?)');
  const remove = db.prepare('DELETE FROM auth WHERE category = ? AND id = ?');
  const decode = (category, id) => {
    const row = read.get(category, id);
    return row ? JSON.parse(row.value, BufferJSON.reviver) : null;
  };
  const encode = (category, id, value) => put.run(category, id, JSON.stringify(value, BufferJSON.replacer));
  const state = {
    creds: decode('credentials', 'current') || initAuthCreds(),
    keys: {
      async get(category, ids) {
        return Object.fromEntries(ids.map((id) => {
          let value = decode(category, id);
          if (category === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.create(value);
          return [id, value];
        }));
      },
      async set(data) {
        db.exec('BEGIN IMMEDIATE');
        try {
          for (const [category, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) {
              if (value == null) remove.run(category, id);
              else encode(category, id, value);
            }
          }
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
    },
  };
  let closed = false;
  return {
    state,
    saveCreds: () => encode('credentials', 'current', state.creds),
    reset() {
      db.exec('DELETE FROM auth');
      state.creds = initAuthCreds();
      encode('credentials', 'current', state.creds);
    },
    close() {
      if (closed) return;
      closed = true;
      db.close();
      unlinkSync(lock);
    },
  };
}

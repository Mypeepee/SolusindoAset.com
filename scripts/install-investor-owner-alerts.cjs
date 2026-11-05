const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'), false);

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 30000 });
  try {
    await db.connect();
    if (process.argv.includes('--apply')) {
      await db.query(fs.readFileSync(path.join(__dirname, '../prisma/migration_investor_owner_alerts.sql'), 'utf8'));
      console.log('Penyimpanan notifikasi owner Investor sudah terpasang. Tidak ada email dikirim.');
    }
    const result = await db.query("SELECT to_regclass('investor_owner_alerts') IS NOT NULL AS ready");
    console.log(JSON.stringify(result.rows[0]));
  } finally { await db.end(); }
}
main().catch((error) => { console.error(error.code || error.name); process.exitCode = 1; });

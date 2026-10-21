// Read-only deployment check. Custom SQL triggers are not managed by Prisma.
const path = require('node:path');
const { Client } = require('pg');
const { Prisma } = require('@prisma/client');

require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'), false);

async function checkDatabase() {
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    options: '-c default_transaction_read_only=on',
  });
  db.on('error', () => {});
  try {
    await db.connect();
    const { rows: columns } = await db.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'",
    );
    const tables = new Map();
    for (const row of columns) {
      if (!tables.has(row.table_name)) tables.set(row.table_name, new Set());
      tables.get(row.table_name).add(row.column_name);
    }
    const missing = [];
    for (const model of Prisma.dmmf.datamodel.models) {
      const table = model.dbName || model.name;
      for (const field of model.fields.filter((field) => field.kind !== 'object')) {
        const column = field.dbName || field.name;
        if (!tables.get(table)?.has(column)) missing.push(`${table}.${column}`);
      }
    }
    const { rows: enumRows } = await db.query(`
      SELECT t.typname, e.enumlabel FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public'
    `);
    const enumValues = new Set(enumRows.map((row) => `${row.typname}.${row.enumlabel}`));
    for (const type of Prisma.dmmf.datamodel.enums) {
      for (const value of type.values) {
        const name = `${type.dbName || type.name}.${value.dbName || value.name}`;
        if (!enumValues.has(name)) missing.push(`enum:${name}`);
      }
    }
    if (missing.length) {
      console.error('Database belum sesuai schema.prisma:', missing.join(', '));
      return false;
    }
    const { rows: [prices] } = await db.query(`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE harga_efektif IS DISTINCT FROM (
          CASE WHEN harga_promo > 0 AND harga_promo < harga THEN harga_promo ELSE harga END
        ))::int AS inconsistent,
        count(*) FILTER (WHERE harga_efektif IS NULL)::int AS empty
      FROM public.listing
    `);
    const { rows: triggers } = await db.query(`
      SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.listing'::regclass
      AND tgname = 'trg_listing_harga_efektif' AND NOT tgisinternal AND tgenabled <> 'D'
    `);
    if (prices.inconsistent || prices.empty || !triggers.length) {
      console.error('Harga listing belum konsisten. Jalankan npm run db:urut:perbaiki.');
      return false;
    }
    console.log(`Database OK: ${Prisma.dmmf.datamodel.models.length} model lengkap, enum lengkap, ${prices.total} harga listing konsisten, trigger aktif.`);
    return true;
  } finally {
    await db.end().catch(() => {});
  }
}

if (require.main === module) {
  checkDatabase().then((ok) => { process.exitCode = ok ? 0 : 1; }).catch((error) => {
    console.error('Pemeriksaan database gagal:', error.code || error.name);
    process.exitCode = 1;
  });
}
module.exports = { checkDatabase };

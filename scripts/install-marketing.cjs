const fs = require("node:fs");
const { Client } = require("pg");
require("dotenv").config({ quiet: true });
require("dotenv").config({ path: ".env.local", override: true, quiet: true });
const apply = process.argv.includes("--apply");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL belum diisi.");
const schema = new URL(connectionString).searchParams.get("schema") || "public";
const client = new Client({ connectionString });
(async () => {
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('search_path', quote_ident($1) || ',public', true)",
      [schema],
    );
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    const sql = fs
      .readFileSync("prisma/migration_marketing.sql", "utf8")
      .replace(/^BEGIN;$/m, "")
      .replace(/^COMMIT;$/m, "");
    await client.query(sql);
    const { rows } = await client.query(
      "SELECT enabled FROM marketing_settings WHERE id='company'",
    );
    if (rows.length !== 1)
      throw new Error("Pengaturan perusahaan belum terbentuk.");
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(
      JSON.stringify({
        mode: apply ? "installed" : "rollback rehearsal passed",
        automationEnabled: rows[0].enabled,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error("Pemasaran:", error.code || error.name || "INSTALL_FAILED");
  process.exitCode = 1;
});

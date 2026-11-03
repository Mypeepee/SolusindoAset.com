import { Pool, types } from "pg";
import { Prisma } from "@prisma/client";

type Reader = Pick<Prisma.TransactionClient, "$queryRaw">;
const globalPool = globalThis as typeof globalThis & {
  investorReadPool?: Pool;
};
const pool =
  globalPool.investorReadPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 120_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 20_000,
    query_timeout: 25_000,
    idle_in_transaction_session_timeout: 60_000,
    // Preserve exact source identifiers. NUMERIC remains a decimal string until
    // the same explicit Number conversion used by the valuation engine.
    types: {
      getTypeParser: (oid) =>
        oid === 20
          ? (value: string) => BigInt(value)
          : types.getTypeParser(oid),
    },
  });
if (!globalPool.investorReadPool)
  pool.on("error", (error) => console.error("[Investor reader]", error.name));
// Share the bounded pool across HMR and server route bundles.
globalPool.investorReadPool = pool;
const schema = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL).searchParams.get("schema") || "public"
  : "public";

/** Dedicated, bounded reader for bulk valuations; never performs source writes. */
export async function withInvestorRead<T>(
  read: (reader: Reader) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query(
      "SELECT set_config('search_path', quote_ident($1) || ',public', true)",
      [schema],
    );
    const reader = {
      $queryRaw: async (
        query: TemplateStringsArray | Prisma.Sql,
        ...values: unknown[]
      ) => {
        const sql = Array.isArray(query)
          ? Prisma.sql(query as TemplateStringsArray, ...values)
          : (query as Prisma.Sql);
        return (await client.query(sql.text, sql.values)).rows;
      },
    } as Reader;
    const result = await read(reader);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = true;
    }
    throw error;
  } finally {
    client.release(broken);
  }
}
export const closeInvestorReadPool = () => pool.end();

/** Read-only transaction, exact IDs, parameter binding and connection cleanup. */
const assert = require("node:assert/strict");
const calls = [];
let rollbackFailure = false,
  config;
const client = {
  query: async (text, values) => {
    calls.push({ text, values });
    if (rollbackFailure && text === "ROLLBACK")
      throw new Error("Connection lost");
    return { rows: [{ value: "1000000000.25" }] };
  },
  release: (broken) => calls.push({ release: broken }),
};
const load = require("./lib/investor-test-loader.cjs")({
  pg: {
    Pool: class {
      constructor(options) {
        config = options;
      }
      on() {}
      async connect() {
        return client;
      }
      async end() {}
    },
    types: { getTypeParser: () => (value) => value },
  },
});
const { withInvestorRead, closeInvestorReadPool } = load(
  "src/lib/investor-read.server.ts",
);
(async () => {
  const malicious = "x' OR 1=1 --";
  const rows = await withInvestorRead(
    (tx) => tx.$queryRaw`SELECT value FROM listing WHERE id=${malicious}`,
  );
  assert.equal(
    calls[0].text,
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  assert.ok(calls[2].text.includes("$1"));
  assert.equal(calls[2].values[0], malicious);
  assert.ok(!calls[2].text.includes(malicious));
  assert.equal(rows[0].value, "1000000000.25");
  assert.equal(calls[3].text, "COMMIT");
  assert.equal(calls[4].release, false);
  assert.equal(config.max, 2);
  assert.equal(config.statement_timeout, 20000);
  assert.equal(
    config.types.getTypeParser(20)("9223372036854775807"),
    9223372036854775807n,
  );
  calls.length = 0;
  await assert.rejects(
    withInvestorRead(async () => {
      throw new Error("Failed");
    }),
    /Failed/,
  );
  assert.equal(calls[2].text, "ROLLBACK");
  assert.equal(calls[3].release, false);
  calls.length = 0;
  rollbackFailure = true;
  await assert.rejects(
    withInvestorRead(async () => {
      throw new Error("Failed");
    }),
    /Failed/,
  );
  assert.equal(calls[3].release, true);
  await closeInvestorReadPool();
  console.log(
    "Investor reader passed: read-only repeatable-read transactions, exact BigInt IDs, parameter binding, bounded pool/timeouts and rollback/release on failure.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

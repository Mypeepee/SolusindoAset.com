/** One canonical SQL calculation serves read-only compatibility and ingestion. */
const fs = require("node:fs");
const load = require("./lib/investor-test-loader.cjs")({ "@/lib/prisma": {} });
const { legacyCmaQuery } = load("src/lib/investor-cma-legacy.server.ts");
const query = legacyCmaQuery(
  { records: new Map() },
  "__CITY__",
  "__INTENT__",
  "__DISTRICT__",
);
let index = 0;
const sql = query.sql.replace(/\?/g, () => {
  const value = query.values[index++];
  return value === "__CITY__"
    ? "p_city"
    : value === "__INTENT__"
      ? "p_intent"
      : value === "__DISTRICT__"
        ? "p_district"
        : value === "[]"
          ? "p_aliases"
          : (() => {
              throw new Error("Unrecognized canonical SQL parameter");
            })();
});
const fn = `CREATE OR REPLACE FUNCTION investor_v2_compute(p_aliases jsonb,p_city text,p_district text,p_intent text)
RETURNS SETOF jsonb LANGUAGE sql STABLE AS $canonical$
 SELECT to_jsonb(result) FROM (${sql}) result
$canonical$;`;
const template = fs.readFileSync("scripts/sql/investor-v2-storage.sql", "utf8");
const output = template.replace("-- __CANONICAL_FUNCTION__", fn);
const target = "prisma/migration_investor_intent_v2.sql";
if (process.argv.includes("--check")) {
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== output)
    throw new Error("Regenerate Investor v2 SQL");
  console.log("Canonical Investor v2 SQL is current.");
} else {
  fs.writeFileSync(target, output);
  console.log("Generated", target);
}

const assert = require("node:assert/strict");
require("dotenv").config({ quiet: true });
require("dotenv").config({ path: ".env.local", override: true, quiet: true });
const { PrismaClient } = require("@prisma/client");
const createLoader = require("./lib/marketing-test-loader.cjs");
const db = new PrismaClient();
const rollback = new Error("DISCOUNT_QA_ROLLBACK");
(async () => {
  const before = await db.preferensiKlien.findFirst({ select: { id_preferensi: true, diskon_jenis: true, diskon_persen: true } });
  assert.ok(before, "Requires one existing preference for a rolled-back persistence check");
  try {
    await db.$transaction(async tx => {
      await tx.preferensiKlien.update({ where: { id_preferensi: before.id_preferensi }, data: { diskon_jenis: "KEDUANYA", diskon_persen: 50 } });
      const saved = await tx.preferensiKlien.findUnique({ where: { id_preferensi: before.id_preferensi } });
      assert.equal(saved.diskon_jenis, "KEDUANYA");
      assert.equal(saved.diskon_persen, 50);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  assert.deepEqual(await db.preferensiKlien.findUnique({ where: { id_preferensi: before.id_preferensi }, select: { id_preferensi: true, diskon_jenis: true, diskon_persen: true } }), before);
  for (const data of [{ diskon_jenis: "KEDUANYA", diskon_persen: 0 }, { diskon_jenis: "OR", diskon_persen: 50 }, { diskon_jenis: null, diskon_persen: 50 }]) {
    await assert.rejects(db.$transaction(tx => tx.preferensiKlien.update({ where: { id_preferensi: before.id_preferensi }, data })), /preferensi_diskon_valid/);
  }
  const load = createLoader();
  const { withInvestorRead, closeInvestorReadPool } = load("src/lib/investor-read.server.ts");
  try {
    const { getClientDiscountScope } = load("src/lib/investor-cma-legacy.server.ts");
    const metrics = await withInvestorRead(tx => getClientDiscountScope(tx, "BELI", { loc_kota: "Surabaya" }));
    assert.ok(metrics.length > 0);
    const { lolosDiskon } = load("src/lib/preferensiDiskon.ts");
    const matches = metrics.filter(row => lolosDiskon({ diskon_jenis: "KEDUANYA", diskon_persen: 50 }, row));
    assert.ok(matches.every(row => row.kelurahan > 50 && row.turunLelang > 50));
    console.log(JSON.stringify({ ok: true, persistenceRollback: true, invalidPairsRejected: 3, canonicalValuations: metrics.length, bothAbove50: matches.length, retainedClientChanges: 0 }));
  } finally { await closeInvestorReadPool(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());

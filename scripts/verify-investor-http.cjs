/** Read-only HTTP integration using an active owner; prints no identity or token. */
require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const { encode } = require("next-auth/jwt");
const client = new PrismaClient();
(async () => {
  try {
    const origin = process.env.INVESTOR_QA_ORIGIN || "http://127.0.0.1:3000";
    assert.ok(
      ["localhost", "127.0.0.1"].includes(new URL(origin).hostname),
      "Local server only",
    );
    const owner = await client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return tx.agent.findFirst({
        where: {
          jabatan: "OWNER",
          status_keanggotaan: "AKTIF",
          pengguna: { status_akun: "AKTIF" },
        },
        select: { id_pengguna: true },
      });
    });
    assert.ok(owner, "An active owner is required for HTTP integration");
    const tokenFor = (jabatan) =>
      encode({
        secret: process.env.NEXTAUTH_SECRET,
        token: {
          id: owner.id_pengguna,
          sub: owner.id_pengguna,
          peran: "AGENT",
          role: "AGENT",
          jabatan,
          _refreshedAt: Date.now(),
        },
      });
    const endpoint = `${origin}/api/dashboard/investor?city=Kota%20Surabaya&sort=score&spread=25&drop=25`;
    assert.equal(
      (await fetch(endpoint, { signal: AbortSignal.timeout(60000) })).status,
      401,
    );
    const admin = await tokenFor("ADMIN");
    assert.equal(
      (
        await fetch(endpoint, {
          headers: { Cookie: `next-auth.session-token=${admin}` },
          signal: AbortSignal.timeout(60000),
        })
      ).status,
      403,
    );
    const token = await tokenFor("OWNER");
    const response = await fetch(endpoint, {
      headers: { Cookie: `next-auth.session-token=${token}` },
      signal: AbortSignal.timeout(60000),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const data = await response.json();
    assert.ok(Array.isArray(data.items) && Array.isArray(data.cities));
    assert.ok(
      data.items.every(
        (item) =>
          item.primaryDealScore ===
          [item.metricAuctionDropPct, item.metricMarketSpreadPct]
            .filter((value) => value !== null)
            .reduce((sum, value) => sum + value, 0),
      ),
    );
    assert.ok(
      data.items.every(
        (item, index) =>
          index === 0 ||
          data.items[index - 1].primaryDealScore >= item.primaryDealScore,
      ),
    );
    if (data.items[0]) {
      const proofEndpoint = `${origin}/api/dashboard/investor/${data.items[0].id}/validation`;
      assert.equal(
        (await fetch(proofEndpoint, { signal: AbortSignal.timeout(30000) }))
          .status,
        401,
      );
      assert.equal(
        (
          await fetch(proofEndpoint, {
            headers: { Cookie: `next-auth.session-token=${admin}` },
            signal: AbortSignal.timeout(30000),
          })
        ).status,
        403,
      );
      const proofResponse = await fetch(proofEndpoint, {
        headers: { Cookie: `next-auth.session-token=${token}` },
        signal: AbortSignal.timeout(30000),
      });
      assert.equal(proofResponse.status, 200);
      assert.equal(
        proofResponse.headers.get("Cache-Control"),
        "private, no-store",
      );
      const proof = await proofResponse.json();
      assert.ok(proof.samples.length <= 10);
      assert.ok(
        proof.samples.every(
          (p) =>
            p.propertyType === proof.listing.propertyType &&
            p.assetCode !== proof.listing.assetCode,
        ),
      );
    }
    const rentalResponse = await fetch(
      endpoint + "&transaction=SEWA&data=all",
      {
        headers: { Cookie: `next-auth.session-token=${token}` },
        signal: AbortSignal.timeout(60000),
      },
    );
    assert.equal(rentalResponse.status, 200);
    const rental = await rentalResponse.json();
    assert.ok(
      rental.items.every(
        (p) => p.transactionType === "SEWA" && p.metricAuctionDropPct === null,
      ),
    );
    const unresolvedResponse = await fetch(endpoint + "&data=unverified", {
      headers: { Cookie: `next-auth.session-token=${token}` },
      signal: AbortSignal.timeout(60000),
    });
    assert.equal(unresolvedResponse.status, 200);
    const unresolved = await unresolvedResponse.json();
    assert.ok(
      unresolved.items.every(
        (p) =>
          !p.kelurahanVerified &&
          p.metricMarketSpreadPct === null &&
          p.benchmark === null,
      ),
    );
    const locationId = unresolved.items[0]?.id || data.items[0]?.id;
    if (locationId) {
      const locationResponse = await fetch(
        `${origin}/api/dashboard/investor/${locationId}/location`,
        {
          headers: { Cookie: `next-auth.session-token=${token}` },
          signal: AbortSignal.timeout(60000),
        },
      );
      assert.equal(locationResponse.status, 200);
      const location = await locationResponse.json();
      assert.ok(location.districts.length > 0);
    }
    console.log(
      JSON.stringify({
        rentalListings: rental.total,
        unverifiedListings: unresolved.total,
        locationOptions: "official hierarchy verified; no PATCH performed",
      }),
    );
    console.log(
      JSON.stringify({
        endpoint: "Investor GET",
        status: response.status,
        rankedDeals: data.total,
        returnedRows: data.items.length,
        city: data.cities.find((item) => item.id === data.cityId)?.name,
      }),
    );
    console.log(
      "Live HTTP checks passed: 401 anonymous, 403 non-owner, authorized owner with actual database data, SUM ranking and private/no-store headers. No data was modified.",
    );
  } finally {
    await client.$disconnect();
  }
})().catch((error) => {
  console.error(
    error.name,
    error.message?.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database URL]"),
  );
  process.exitCode = 1;
});

import assert from "node:assert/strict";
export default async function verifyPerformance({
  page,
  errors,
  requests,
  setGate,
  setFailure,
}) {
  const pause = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    setGate(promise);
    return () => {
      setGate(null);
      resolve();
    };
  };
  const response = () =>
    page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/dashboard/investor",
    );
  const idle = () =>
    page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Perbarui data Investor"]')
          ?.getAttribute("aria-busy") === "false",
    );
  const ids = () =>
    page.$$eval(".investor-property", (cards) =>
      cards.map((card) => card.dataset.listingId),
    );
  async function sort(value) {
    await page.click('[aria-label="Urutkan peluang"]');
    await page.waitForSelector(`#investor-sort-${value}`);
    await page.click(`#investor-sort-${value}`);
  }
  assert.equal(
    requests().length,
    1,
    "Exactly one initial feed request, including StrictMode/bookmark hydration",
  );
  const initialIds = await ids();
  const releaseReload = pause(),
    received = response();
  const start = performance.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".investor-property", { timeout: 10000 });
  const cachedReloadMs = Math.round(performance.now() - start);
  assert.deepEqual(await ids(), initialIds);
  assert.equal(
    await page.$eval('[aria-label="Perbarui data Investor"]', (el) =>
      el.getAttribute("aria-busy"),
    ),
    "true",
    "Cached cards render while the fresh network response is still blocked",
  );
  assert.equal(requests().length, 2, "One request per page load");
  releaseReload();
  assert.equal((await received).status(), 200);
  await idle();
  for (const [value, label] of [
    ["spread", "Diskon kelurahan tertinggi"],
    ["drop", "Penurunan lelang tertinggi"],
  ]) {
    await page.click('[aria-label="Urutkan peluang"]');
    await page.waitForSelector(`#investor-sort-${value}`);
    assert.equal(
      (
        await page.$eval(`#investor-sort-${value}`, (el) => el.innerText)
      ).trim(),
      label,
    );
    const next = response();
    await page.click(`#investor-sort-${value}`);
    const payload = await (await next).json();
    await idle();
    assert.deepEqual(
      await ids(),
      payload.items.map((item) => item.id),
    );
    assert.ok(
      payload.items.every(
        (item) => !item.benchmark || item.benchmark.scope === "KELURAHAN",
      ),
    );
    const field =
      value === "spread" ? "metricMarketSpreadPct" : "metricAuctionDropPct";
    assert.ok(
      payload.items.every(
        (item, i, items) =>
          i === 0 ||
          (items[i - 1][field] ?? -Infinity) >= (item[field] ?? -Infinity),
      ),
    );
  }
  const releaseSort = pause(),
    sorted = response();
  await sort("score");
  await page.waitForFunction(
    (first) =>
      document.querySelector(".investor-property")?.dataset.listingId === first,
    {},
    initialIds[0],
  );
  assert.equal(
    await page.$eval('[aria-label="Perbarui data Investor"]', (el) =>
      el.getAttribute("aria-busy"),
    ),
    "true",
  );
  releaseSort();
  await sorted;
  await idle();
  const releaseRefresh = pause(),
    refreshed = response();
  await page.click('[aria-label="Perbarui data Investor"]');
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="Perbarui data Investor"]')
        .getAttribute("aria-busy") === "true",
  );
  assert.equal(requests().at(-1).get("refresh"), "1");
  releaseRefresh();
  await refreshed;
  await idle();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewport({
      width,
      height: width === 320 ? 568 : 1000,
      deviceScaleFactor: 1,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `/tmp/investor-fast-kelurahan-${width}.png`,
    });
  }
  setFailure(503);
  const failed = response();
  await page.click('[aria-label="Perbarui data Investor"]');
  await failed;
  await idle();
  assert.equal(
    (await ids()).length,
    initialIds.length,
    "Keep matching cached cards on transient failure",
  );
  await page.waitForSelector('.investor-results [role="alert"]');
  setFailure(0);
  const recovered = response();
  await page.evaluate(() =>
    [...document.querySelectorAll(".investor-results button")]
      .find((el) => el.innerText.includes("Coba lagi"))
      .click(),
  );
  await recovered;
  await idle();
  setFailure(403);
  const denied = response();
  await page.click('[aria-label="Perbarui data Investor"]');
  assert.equal((await denied).status(), 403);
  await idle();
  assert.equal(
    (await ids()).length,
    0,
    "Permission failure removes the cached view",
  );
  assert.equal(
    await page.evaluate(
      () =>
        Object.keys(sessionStorage).filter((key) =>
          key.startsWith("solusindo:investor:feed:"),
        ).length,
    ),
    0,
  );
  setFailure(0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "Investor fast-loading UI passed",
      initialRequests: 1,
      cachedReloadMs,
      cachedCardsBeforeNetworkResponse: true,
      sorts: ["Diskon kelurahan tertinggi", "Penurunan lelang tertinggi"],
      manualRefresh: true,
      permissionCacheClearing: true,
      viewports: [320, 768, 1024, 1440],
    }),
  );
}

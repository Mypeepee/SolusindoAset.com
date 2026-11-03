/** Actual local OWNER dashboard, SELECT-only DB setup, no fixture Investor feed. */
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";
dotenv.config({ quiet: true });
const client = new PrismaClient();
const origin = process.env.INVESTOR_QA_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
let browser, page;
let stage = "read-only owner lookup";
const errors = [];
const feedStatuses = [];
try {
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
  assert.ok(owner);
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET,
    token: {
      id: owner.id_pengguna,
      sub: owner.id_pengguna,
      peran: "AGENT",
      role: "AGENT",
      jabatan: "OWNER",
      _refreshedAt: Date.now(),
    },
  });
  browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.INVESTOR_QA_BROWSER ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  page = await browser.newPage();
  const compactLayouts = [];
  async function verifyRealCardFit(state) {
    await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
    await page.mouse.move(0, 0);
    const layout = await page.evaluate(async () => {
      const cards = [...document.querySelectorAll(".investor-property")];
      cards[0].scrollIntoView({ block: "start", behavior: "instant" });
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      let scroller = cards[0].parentElement;
      while (
        scroller &&
        !["auto", "scroll"].includes(getComputedStyle(scroller).overflowY)
      )
        scroller = scroller.parentElement;
      const rect = cards[0].getBoundingClientRect();
      return {
        maxHeight: Math.ceil(
          Math.max(...cards.map((card) => card.getBoundingClientRect().height)),
        ),
        availableHeight: scroller.clientHeight,
        fullCardVisible:
          rect.top >= scroller.getBoundingClientRect().top - 1 &&
          rect.bottom <= innerHeight,
        overflow: document.documentElement.scrollWidth > innerWidth,
        clipped: cards.some(
          (card) => card.scrollHeight > card.clientHeight + 1,
        ),
      };
    });
    assert.ok(
      layout.maxHeight <= layout.availableHeight - 12,
      `${state}: ${JSON.stringify(layout)}`,
    );
    assert.equal(layout.fullCardVisible, true);
    assert.equal(layout.overflow || layout.clipped, false);
    compactLayouts.push({ state, ...layout });
    await page.screenshot({
      path: `/tmp/investor-compact-actual-${state}-320.png`,
    });
  }
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/dashboard/investor")
      feedStatuses.push(response.status());
  });
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  page.setDefaultTimeout(60000);
  await browser.setCookie({
    name: "next-auth.session-token",
    value: token,
    url: origin,
    httpOnly: true,
    sameSite: "Lax",
  });
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const url = new URL(request.url());
    // Avoid unrelated dashboard integrations/side effects; Investor, auth and
    // same-origin listing photos retain their actual server responses.
    if (
      url.origin === origin &&
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/dashboard/investor") &&
      !url.pathname.startsWith("/api/auth/") &&
      url.pathname !== "/api/dashboard/agent/kpi-cards" &&
      !url.pathname.startsWith("/api/regions/") &&
      !url.pathname.startsWith("/api/foto/") &&
      !/^\/api\/listing\/\d+\/riwayat-lelang$/.test(url.pathname) &&
      !url.pathname.startsWith("/api/drive-image")
    ) {
      if (url.pathname === "/api/dashboard/acara")
        return request.respond({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
      if (url.pathname === "/api/dashboard/agent/listing-performance")
        return request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            totalActive: 0,
            totalHot: 0,
            topPerformers: [],
            needsAttention: [],
          }),
        });
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          items: [],
          unread: 0,
          notifications: [],
        }),
      });
    }
    if (request.method() !== "GET") return request.abort();
    return request.continue();
  });
  const responsePromise = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/dashboard/investor" &&
      r.status() === 200,
    { timeout: 120000 },
  );
  stage = "active listing feed";
  await page.goto(`${origin}/dashboard/investor?city=Kota%20Surabaya`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  const response = await responsePromise;
  const feed = await response.json();
  await page.waitForSelector(".investor-property");
  assert.equal(
    await page.$$eval(".investor-property", (rows) => rows.length),
    30,
  );
  assert.equal(feed.pageSize, 30);
  assert.ok(feed.total > 0);
  assert.equal(new URL(response.url()).searchParams.get("data"), "all");
  assert.equal(feed.total, feed.summary.activeListings);
  assert.equal(await page.$('[aria-label="Tampilan peluang"]'), null);
  const sourceRows = await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    return tx.listing.findMany({
      where: { id_property: { in: feed.items.map((item) => BigInt(item.id)) } },
      select: {
        id_property: true,
        status_tayang: true,
        jenis_transaksi: true,
        harga: true,
        nilai_limit_lelang: true,
        harga_promo: true,
        luas_tanah: true,
        alamat_lengkap: true,
        gambar: true,
        legalitas: true,
      },
    });
  });
  for (const item of feed.items) {
    const source = sourceRows.find(
      (row) => String(row.id_property) === item.id,
    );
    assert.ok(source);
    assert.equal(source.status_tayang, "TERSEDIA");
    assert.equal(source.jenis_transaksi, item.listingCategory);
    assert.equal(item.certificateType, source.legalitas);
    const known = [
      item.metricMarketSpreadPct,
      item.metricAuctionDropPct,
    ].filter((value) => value !== null);
    assert.equal(
      item.primaryDealScore,
      known.length ? known.reduce((sum, value) => sum + value, 0) : null,
    );
    assert.equal(Number(source.luas_tanah), item.landAreaSqm);
    assert.equal(source.alamat_lengkap || "", item.address);
    const price =
      source.jenis_transaksi === "LELANG"
        ? Number(source.nilai_limit_lelang) || Number(source.harga)
        : Number(source.harga_promo) > 0 &&
            Number(source.harga_promo) < Number(source.harga)
          ? Number(source.harga_promo)
          : Number(source.harga);
    assert.equal(item.currentAuctionPrice, price);
    const sourcePhotos = (source.gambar || "")
      .split(",")
      .map((photo) => photo.trim())
      .filter(Boolean)
      .slice(0, 50);
    assert.ok(Array.isArray(item.imageUrls));
    assert.ok(item.imageUrls.length <= sourcePhotos.length);
    assert.equal(item.imageUrl, item.imageUrls[0] || "");
    for (const photo of item.imageUrls) {
      if (photo.startsWith(`/api/foto/${item.id}?`)) {
        const url = new URL(photo, origin);
        assert.equal(url.searchParams.get("view"), "card");
        assert.ok(
          /^https?:/.test(sourcePhotos[Number(url.searchParams.get("index"))]),
        );
      } else if (photo.startsWith("/api/drive-image?")) {
        const driveId = new URL(photo, origin).searchParams.get("id");
        assert.ok(sourcePhotos.some((source) => source.includes(driveId)));
      } else assert.ok(sourcePhotos.includes(photo));
    }
  }
  const investorPhotoHeight = await page.$eval(
    ".investor-card-photo",
    (el) => el.getBoundingClientRect().height,
  );
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewport({ width, height: 1100, deviceScaleFactor: 1 });
    const layout = await page.evaluate(() => {
      const grid = document.querySelector(".investor-property-grid");
      const cards = [...grid.querySelectorAll(".investor-property")];
      const row = cards.filter(
        (card) =>
          Math.abs(
            card.getBoundingClientRect().top -
              cards[0].getBoundingClientRect().top,
          ) < 1,
      );
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap);
      return {
        grid: grid.clientWidth,
        used:
          row.reduce(
            (sum, card) => sum + card.getBoundingClientRect().width,
            0,
          ) +
          gap * (row.length - 1),
        columns: row.length,
      };
    });
    assert.ok(
      Math.abs(layout.grid - layout.used) < 2,
      `${width}: unused right space ${JSON.stringify(layout)}`,
    );
  }
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  stage = "actual 30-per-page navigation and combined ranking";
  const secondPromise = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/dashboard/investor" &&
      new URL(r.url()).searchParams.get("page") === "2" &&
      r.status() === 200,
  );
  await page.click('.investor-page-numbers.is-wide [aria-label="Halaman 2"]');
  const second = await (await secondPromise).json();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.investor-page-numbers.is-wide [aria-current="page"]')
        ?.textContent.trim() === "2" &&
      !document.querySelector('[aria-label="Perbarui data Investor"]').disabled,
  );
  assert.equal(second.items.length, 30);
  assert.ok(
    second.items.every(
      (item) => !feed.items.some((previous) => previous.id === item.id),
    ),
  );
  assert.ok(
    second.items.every(
      (item) =>
        item.primaryDealScore === null ||
        item.primaryDealScore <= feed.items.at(-1).primaryDealScore,
    ),
  );
  assert.equal(new URL(page.url()).searchParams.get("page"), "2");
  await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
  await page.$eval(".investor-pagination", (el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const paginationBounds = await page.$eval(".investor-page-tray", (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, viewport: innerWidth };
  });
  assert.ok(
    paginationBounds.left >= 0 &&
      paginationBounds.right <= paginationBounds.viewport,
  );
  await page.screenshot({ path: "/tmp/investor-pagination-actual-mobile.png" });
  const firstPromise = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/dashboard/investor" &&
      new URL(r.url()).searchParams.get("page") === "1" &&
      r.status() === 200,
  );
  await page.click(
    '.investor-page-numbers.is-compact [aria-label="Halaman 1"]',
  );
  await firstPromise;
  await page.waitForFunction(
    () =>
      !document.querySelector('[aria-label="Perbarui data Investor"]').disabled,
  );
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  assert.equal(await page.$('.investor-dashboard [role="alert"]'), null);
  assert.equal(
    await page.$eval(".investor-total-deals", (el) => el.textContent.trim()),
    feed.summary.worthItCount.toLocaleString("id-ID"),
  );
  assert.equal(
    await page.$eval(".investor-total-assets", (el) => el.textContent.trim()),
    feed.summary.activeListings.toLocaleString("id-ID"),
  );
  assert.match(
    await page.$eval('[aria-label="Transaksi"]', (el) => el.textContent),
    /Beli/,
  );
  stage = "actual ranked suggestion carousel";
  const suggestions = feed.summary.suggestedDeals;
  assert.equal(suggestions.length, Math.min(5, feed.summary.worthItCount));
  assert.equal(suggestions[0].id, feed.summary.topDeal.id);
  assert.equal(
    new Set(suggestions.map((p) => p.assetCode || p.id)).size,
    suggestions.length,
  );
  assert.ok(
    suggestions.every(
      (p, i) =>
        p.transactionType !== "SEWA" &&
        (i === 0 || suggestions[i - 1].primaryDealScore >= p.primaryDealScore),
    ),
  );
  await page.focus(".investor-featured");
  await page.click('[aria-label="Properti rekomendasi berikutnya"]');
  await page.waitForFunction(
    (id) =>
      document.querySelector(".investor-featured").dataset.activeListingId ===
      id,
    {},
    suggestions[1].id,
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".investor-suggestion-slide").length === 1,
  );
  await page.click('[aria-label="Lihat aset unggulan"]');
  await page.waitForSelector('[role="dialog"]');
  assert.ok(
    (await page.$eval('[role="dialog"]', (el) => el.textContent)).includes(
      suggestions[1].title,
    ),
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Lihat aset unggulan",
  );
  await page.click('[aria-label="Properti rekomendasi sebelumnya"]');
  await page.waitForFunction(
    (id) =>
      document.querySelector(".investor-featured").dataset.activeListingId ===
      id,
    {},
    suggestions[0].id,
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".investor-suggestion-slide").length === 1,
  );
  await (
    await page.$(".investor-summary")
  ).screenshot({ path: "/tmp/investor-overview-actual-desktop.png" });
  await page.screenshot({ path: "/tmp/investor-owner-actual-desktop.png" });
  await page.setViewport({ width: 390, height: 1200, deviceScaleFactor: 1 });
  await (
    await page.$(".investor-summary")
  ).screenshot({ path: "/tmp/investor-overview-actual-mobile.png" });
  await page.screenshot({ path: "/tmp/investor-owner-actual-mobile.png" });
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.screenshot({
    path: "/tmp/investor-restored-live-desktop.png",
    fullPage: true,
  });
  stage = "actual multi-photo Investor gallery";
  const multiPhotoListing = feed.items.find(
    (item) => item.imageUrls.length > 1,
  );
  assert.ok(multiPhotoListing);
  const sourceGallery = `.investor-property[data-listing-id="${multiPhotoListing.id}"] .investor-card-photo`;
  await page.$eval(sourceGallery, (el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await page.hover(sourceGallery);
  await page.waitForFunction(
    (selector) =>
      getComputedStyle(document.querySelector(`${selector} .is-next`))
        .opacity === "1",
    {},
    sourceGallery,
  );
  await page.click(`${sourceGallery} .is-next`);
  await page.waitForFunction(
    (selector) =>
      document.querySelector(selector).dataset.photoIndex === "1" &&
      document.querySelector(`${selector} img`)?.naturalWidth > 0,
    {},
    sourceGallery,
  );
  await page.screenshot({ path: "/tmp/investor-gallery-actual-desktop.png" });
  await verifyRealCardFit("buy");
  stage = "actual CMA validation response";
  const proofPromise = page.waitForResponse((r) =>
    /\/api\/dashboard\/investor\/\d+\/validation$/.test(
      new URL(r.url()).pathname,
    ),
  );
  await page.click(".investor-property .investor-primary");
  const proofResponse = await proofPromise;
  assert.equal(proofResponse.status(), 200);
  const proof = await proofResponse.json();
  stage = "actual CMA proof rendering";
  await page.waitForSelector(".investor-proof-table");
  assert.ok(proof.samples.length <= 9);
  assert.equal(
    await page.$$eval(".investor-proof-table tbody tr", (rows) => rows.length),
    proof.samples.length + 1,
  );
  assert.equal(
    await page.$$eval(
      ".investor-proof-table [data-target]",
      (rows) => rows.length,
    ),
    1,
  );
  assert.ok(proof.minBaselinePricePerSqm > 0);
  assert.ok(proof.minBaselinePricePerSqm <= proof.benchmark.avgPricePerSqm);
  assert.equal(
    proof.cheapestPeer.baselinePricePerSqm,
    proof.minBaselinePricePerSqm,
  );
  assert.notEqual(proof.cheapestPeer.id, proof.listing.id);
  const price = proof.listing.currentAuctionPrice;
  const expectedPurchase =
    price +
    Math.round(price * 0.05) +
    Math.round(price * 0.02) +
    Math.round(price * 0.011) +
    Math.round(price * 0.004) +
    135e6;
  const purchaseShown = await page.$eval('[data-cost="total"]', (el) =>
    Number(el.textContent.replace(/[^\d]/g, "")),
  );
  assert.equal(purchaseShown, expectedPurchase);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewport({
      width,
      height: width === 320 ? 568 : 1000,
      deviceScaleFactor: 1,
    });
    await page.$eval(".investor-roi-dialog", (el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({
      path: `/tmp/investor-roi-actual-cma-${width}.png`,
    });
    assert.equal(
      await page.$eval(
        ".investor-roi-dialog",
        (el) => el.scrollWidth <= el.clientWidth,
      ),
      true,
    );
  }
  stage = "actual CMA source thumbnails";
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".investor-cma-photo img")].some(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    { timeout: 60000 },
  );
  const loadedProofPhotos = await page.$$eval(
    ".investor-cma-photo img",
    (images) =>
      images.filter((image) => image.complete && image.naturalWidth > 0).length,
  );
  await page.screenshot({ path: "/tmp/investor-roi-actual-cma-1440.png" });
  const historyPromise = page.waitForResponse((r) =>
    /\/api\/listing\/\d+\/riwayat-lelang$/.test(new URL(r.url()).pathname),
  );
  await page.click("#investor-tab-history");
  const historyResponse = await historyPromise;
  assert.equal(historyResponse.status(), 200);
  const history = await historyResponse.json();
  assert.equal(history.ok, true);
  await page.waitForFunction(() =>
    document
      .querySelector("#investor-panel-history")
      .innerText.includes("SAAT INI"),
  );
  const matching = history.riwayat.filter(
    (item) => item.cakupan === "SAMA" && item.harga_efektif > 0,
  );
  const currentIndex = matching.findIndex((item) => item.is_current);
  if (currentIndex > 0) {
    const actualDrop =
      ((matching[0].harga_efektif - matching[currentIndex].harga_efektif) /
        matching[0].harga_efektif) *
      100;
    assert.ok(
      Math.abs(actualDrop - proof.listing.metricAuctionDropPct) < 0.00001,
    );
  }
  assert.ok(await page.$("#investor-panel-history svg"));
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewport({
      width,
      height: width === 320 ? 568 : 1000,
      deviceScaleFactor: 1,
    });
    await page.$eval(".investor-roi-dialog", (el) => {
      el.scrollTop = 0;
    });
    assert.equal(
      await page.$eval(
        ".investor-roi-dialog",
        (el) => el.scrollWidth <= el.clientWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `/tmp/investor-roi-actual-history-${width}.png`,
    });
  }
  if (process.env.INVESTOR_QA_LIVE_ROI_ONLY === "1") {
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector('[role="dialog"]'),
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        status: "Actual Investor ROI passed",
        activeListings: feed.total,
        actualCardRows: sourceRows.length,
        proofRows: proof.samples.length + 1,
        loadedProofPhotos,
        benchmarkCount: proof.benchmark.sampleCount,
        minimumFromFullPool: proof.minBaselinePricePerSqm,
        purchaseTotal: purchaseShown,
        historyEvents: history.riwayat.length,
        sameHistoryCollector: true,
        viewports: [320, 768, 1024, 1440],
        source: "actual active database; GET only; no source writes",
      }),
    );
    await browser.close();
    await client.$disconnect();
    process.exit(0);
  }
  await page.click("#investor-tab-cma");
  await page.screenshot({
    path: "/tmp/investor-restored-live-proof.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "/tmp/investor-restored-live-mobile.png",
    fullPage: true,
  });
  const rentPromise = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/dashboard/investor" &&
      new URL(r.url()).searchParams.get("transaction") === "SEWA" &&
      r.status() === 200,
  );
  stage = "rental feed";
  await page.click('[aria-label="Transaksi"]');
  await page.waitForSelector("#investor-transaction-sewa");
  await page.click("#investor-transaction-sewa");
  const rental = await (await rentPromise).json();
  await page.waitForFunction(
    () =>
      !document.querySelector('[aria-label="Perbarui data Investor"]').disabled,
  );
  assert.ok(
    rental.items.every(
      (p) => p.transactionType === "SEWA" && p.metricAuctionDropPct === null,
    ),
  );
  assert.equal(await page.$("#investor-min-drop"), null);
  await verifyRealCardFit("rent");
  await page.screenshot({
    path: "/tmp/investor-live-rent.png",
    fullPage: true,
  });
  const buyPromise = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/dashboard/investor" &&
      new URL(r.url()).searchParams.get("transaction") === "BELI" &&
      r.status() === 200,
  );
  stage = "buy feed restoration";
  await page.click('[aria-label="Transaksi"]');
  await page.waitForSelector("#investor-transaction-beli");
  await page.click("#investor-transaction-beli");
  await buyPromise;
  await page.waitForFunction(
    () =>
      !document.querySelector('[aria-label="Perbarui data Investor"]').disabled,
  );
  const cleaningPromise = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/dashboard/investor" &&
      new URL(r.url()).searchParams.get("data") === "unverified" &&
      r.status() === 200,
  );
  stage = "unverified location feed";
  await page.click('[aria-label="Cakupan listing"]');
  await page.waitForSelector("#investor-scope-unverified");
  await page.click("#investor-scope-unverified");
  const cleaning = await (await cleaningPromise).json();
  assert.ok(
    cleaning.items.every(
      (p) => !p.kelurahanVerified && p.metricMarketSpreadPct === null,
    ),
  );
  await page.waitForSelector(".investor-property");
  await verifyRealCardFit("unverified");
  const optionsPromise = page.waitForResponse((r) =>
    /\/api\/dashboard\/investor\/\d+\/location/.test(new URL(r.url()).pathname),
  );
  stage = "location reference options";
  await page.click('.investor-property [aria-label="Pilih kelurahan"]');
  assert.equal((await optionsPromise).status(), 200);
  await page.waitForSelector(
    '#investor-correction-district option[value]:not([value=""])',
  );
  await page.screenshot({
    path: "/tmp/investor-live-location.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.deepEqual(errors, []);
  stage = "shared public property card shell";
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const publicResponse = await page.goto(
    `${origin}/Lelang?kota=Kota%20Surabaya`,
    {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    },
  );
  assert.equal(publicResponse.status(), 200);
  await page.waitForSelector('[data-property-card="true"]');
  const publicCard = await page.$eval(
    '[data-property-card="true"]',
    (card) => ({
      tag: card.tagName,
      radius: getComputedStyle(card).borderRadius,
      background: getComputedStyle(card).backgroundColor,
      photo: !!card.querySelector("img"),
      agent: !!card.querySelector('img[alt="Agent"]'),
      detail: card.textContent.includes("Lihat detail"),
    }),
  );
  assert.deepEqual(publicCard, {
    tag: "DIV",
    radius: "24px",
    background: "rgb(17, 17, 17)",
    photo: true,
    agent: true,
    detail: true,
  });
  const publicPhotoHeight = await page.$eval(
    '[data-property-card="true"] > div',
    (el) => el.getBoundingClientRect().height,
  );
  assert.equal(
    investorPhotoHeight,
    publicPhotoHeight,
    "Investor uses the actual Lelang card's photo dimensions",
  );
  stage = "Home search owner and default location depth";
  await page.goto(origin, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForSelector("#search-keyword");
  const homeBar = await page.$eval("#search-keyword", (input) => {
    let owner = input.parentElement;
    while (owner && !owner.className.includes("rounded-[2rem]"))
      owner = owner.parentElement;
    return {
      background: getComputedStyle(owner).backgroundColor,
      radius: getComputedStyle(owner).borderRadius,
      labels: owner.textContent,
    };
  });
  assert.equal(homeBar.background, "rgb(255, 255, 255)");
  await page.focus('[aria-label="Lokasi"][role="button"]');
  await page.keyboard.press("Space");
  const regionPanel = '[role="dialog"][aria-label="Pilih lokasi"]';
  await page.waitForSelector(regionPanel);
  await page.type(`${regionPanel} input`, "Kota Surabaya");
  await page.waitForSelector(
    `${regionPanel} [aria-label="Lihat Kecamatan di Kota Surabaya"]`,
  );
  await page.screenshot({ path: "/tmp/home-search-owner-desktop.png" });
  await page.keyboard.press("Escape");
  const filteredSearch = await page.evaluate(async () => {
    const response = await fetch(
      "/api/dashboard/investor?city=all&kota=Kota+Surabaya&data=all&tipe=RUMAH&minHarga=100000000&maxHarga=500000000&minLT=100&maxLT=500",
    );
    return { status: response.status, body: await response.json() };
  });
  assert.equal(filteredSearch.status, 200);
  assert.ok(filteredSearch.body.total > 0);
  assert.ok(
    filteredSearch.body.items.every(
      (item) =>
        item.cityName === "Kota Surabaya" &&
        item.propertyType === "RUMAH" &&
        item.currentAuctionPrice >= 100e6 &&
        item.currentAuctionPrice <= 500e6 &&
        item.landAreaSqm >= 100 &&
        item.landAreaSqm <= 500,
    ),
  );
  const canonicalCity = await page.evaluate(async () =>
    (await fetch("/api/dashboard/investor?city=all&kota=Kota+Surabaya")).json(),
  );
  assert.equal(
    canonicalCity.total,
    feed.total,
    "Home city selection resolves to the same actual Investor scope",
  );
  const secondary = await page.evaluate(async () => {
    const get = async (scope) => {
      const response = await fetch(
        `/api/dashboard/investor?city=all&category=SECONDARY&data=${scope}`,
      );
      if (!response.ok) throw new Error(`Secondary feed ${response.status}`);
      return response.json();
    };
    return { all: await get("all"), deals: await get("deals") };
  });
  assert.equal(secondary.all.total, secondary.all.summary.activeListings);
  assert.equal(secondary.deals.total, secondary.all.summary.worthItCount);
  assert.ok(secondary.all.total >= secondary.deals.total);
  assert.ok(
    secondary.all.items.every((item) => item.listingCategory === "SECONDARY"),
  );
  stage = "actual Secondary cards with no Worth-it qualification";
  await page.goto(`${origin}/dashboard/investor?city=all&category=SECONDARY`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll(".investor-property").length === count &&
      !document.querySelector('[aria-label="Perbarui data Investor"]').disabled,
    {},
    Math.min(30, secondary.all.total),
  );
  assert.equal(new URL(page.url()).searchParams.get("data"), "all");
  assert.deepEqual(
    await page.$$eval(".investor-property", (cards) =>
      cards.map((card) => card.dataset.listingId),
    ),
    secondary.all.items.map((item) => item.id),
  );
  await page.screenshot({ path: "/tmp/investor-secondary-actual-desktop.png" });
  if (secondary.all.items.length) await verifyRealCardFit("secondary");
  stage = "reported persisted Worth-it/Secondary/Surabaya URL";
  const secondarySurabaya = await page.evaluate(async () => {
    const response = await fetch(
      "/api/dashboard/investor?city=Kota+Surabaya&category=SECONDARY&data=all&sort=spread",
    );
    if (!response.ok) throw new Error(`Secondary Surabaya ${response.status}`);
    return response.json();
  });
  assert.ok(secondarySurabaya.total > 0);
  assert.equal(secondarySurabaya.summary.worthItCount, 0);
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(
    `${origin}/dashboard/investor?city=Kota%20Surabaya&category=SECONDARY&data=deals&sort=spread`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(
    (count) =>
      new URL(location.href).searchParams.get("data") === "all" &&
      document.querySelectorAll(".investor-property").length === count &&
      !document.querySelector('[aria-label="Perbarui data Investor"]').disabled,
    {},
    Math.min(30, secondarySurabaya.total),
  );
  assert.deepEqual(
    await page.$$eval(".investor-property", (cards) =>
      cards.map((card) => card.dataset.listingId),
    ),
    secondarySurabaya.items.map((item) => item.id),
  );
  assert.ok(await page.$(".investor-scope-recovery"));
  assert.equal(
    await page.$eval(".investor-total-deals", (el) => el.textContent.trim()),
    "0",
  );
  await page.screenshot({
    path: "/tmp/investor-stale-filter-actual-desktop.png",
  });
  await verifyRealCardFit("persisted-secondary");
  await page.click(".investor-scope-recovery button");
  await page.waitForFunction(
    () =>
      !new URL(location.href).searchParams.has("category") &&
      document.querySelectorAll(".investor-property").length === 30 &&
      !document.querySelector('[aria-label="Perbarui data Investor"]').disabled,
  );
  assert.equal(new URL(page.url()).searchParams.get("city"), "Kota Surabaya");
  assert.equal(
    await page.$eval(".investor-total-assets", (el) => el.textContent.trim()),
    feed.summary.activeListings.toLocaleString("id-ID"),
  );
  console.log(
    JSON.stringify({
      status: response.status(),
      activeListings: feed.total,
      rankedDeals: feed.summary.worthItCount,
      sourceRowsMatched: sourceRows.length,
      sourceGalleryPhotos: multiPhotoListing.imageUrls.length,
      photoHeightMatchesLelang: investorPhotoHeight,
      secondaryListings: secondary.all.total,
      secondaryWorthIt: secondary.deals.total,
      recoveredSurabayaCards: secondarySurabaya.total,
      recoveredScope: "all, automatic from the original persisted deals URL",
      rankedSuggestions: suggestions.length,
      cards: 30,
      ranking: "signed market discount + historical auction drop",
      certificates: "actual source legalitas enum; no certificate numbers",
      pageSize: 30,
      pagination:
        "numbered desktop/mobile; page 2 has 30 distinct lower-ranked assets",
      fluidGrid: "full row width at 320/390/768/1024/1440px",
      rentalListings: rental.total,
      unverifiedListings: cleaning.total,
      locationOptions: "actual reference provider; no save",
      proofStatus: proofResponse.status(),
      proofRows: proof.samples.length,
      mobileOverflow: false,
      compactLayouts,
      publicCard,
      homeSearch: "white shared bar; Home still drills into kecamatan",
      filteredListings: filteredSearch.body.total,
      canonicalCityDeals: canonicalCity.total,
      source: "actual active database; no Investor response mocked",
    }),
  );
} catch (error) {
  console.error(`Actual browser QA failed at: ${stage}`);
  console.error(JSON.stringify({ pageErrors: errors, feedStatuses }));
  if (page)
    await page
      .screenshot({ path: "/tmp/investor-compact-actual-failure.png" })
      .catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  await client.$disconnect();
}
// Standalone QA is complete; do not retain idle SDK transport handles in Node.
process.exit(0);

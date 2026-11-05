/** Browser QA with isolated network fixtures. Live database math is verified separately. */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { encode } from "next-auth/jwt";
import fixtureFeed from "./fixtures/investor-feed.cjs";
import roiHistory from "./fixtures/investor-roi-history.cjs";
import verifyRoi from "./lib/verify-investor-roi.mjs";
import verifyPerformance from "./lib/verify-investor-performance.mjs";
import verifySold from "./lib/verify-investor-sold.mjs";
import verifyAuctionDate from "./lib/verify-investor-auction-date.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const origin = process.env.INVESTOR_QA_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.INVESTOR_QA_BROWSER ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  protocolTimeout: 120000,
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(120000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let failFeed = false,
  denyFeed = false,
  investorRequests = 0;
let compactStress = false;
let cardPresentation = null;
let cardGallery = "multiple";
let overviewState = null;
let failLocation = false,
  conflictLocation = false,
  locationWrites = 0;
let failProof = false,
  expandedProof = false,
  manyProof = true;
let roiState = {};
let performanceGate = null;
const performanceRequests = [];
const soldRequests = [];
const soldIds = new Set();
let soldStatus = 200;
let soldDelay = 0;
let qaSessionCookie = "";
const session = {
  user: {
    id: "investor-qa",
    name: "Owner QA",
    peran: "AGENT",
    role: "AGENT",
    jabatan: "OWNER",
    agentId: "qa",
  },
  expires: "2099-01-01T00:00:00.000Z",
};
await page.setRequestInterception(true);
page.on("request", async (request) => {
  try {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname === "/api/dashboard/investor") {
      investorRequests++;
      performanceRequests.push(url.searchParams);
      const feed = JSON.parse(JSON.stringify(fixtureFeed(url.searchParams)));
      if (process.env.INVESTOR_QA_AUCTION_DATE_ONLY === "1") {
        const now = Date.now();
        for (const [index, offset] of [5, -4, 0, null, 5, 5, null].entries()) {
          const item = feed.items[index];
          if (!item) continue;
          item.listingCategory = index === 4 ? "PRIMARY" : "LELANG";
          item.transactionType = index === 5 ? "SEWA" : "BELI";
          item.auctionDate = index === 6 ? "invalid-date" : offset === null
            ? null : new Date(now + offset * 86_400_000).toISOString();
        }
      }
      if (soldIds.size) {
        const count = feed.items.length;
        feed.items = feed.items.filter((item) => !soldIds.has(item.id));
        feed.total -= count - feed.items.length;
      }
      // Isolated presentation boundary states; never imported by the app.
      if (process.env.INVESTOR_QA_CARDS_ONLY === "1" && feed.items[0]) {
        const first = feed.items[0];
        if (cardPresentation)
          Object.assign(first, {
            listingCategory: "LELANG",
            metricMarketSpreadPct: cardPresentation[0],
            metricAuctionDropPct: cardPresentation[1],
          });
        if (cardGallery === "broken")
          first.imageUrls = [
            "/images/missing-investor-gallery-test.jpg",
            "/images/hero/pasinan1.jpg",
          ];
        if (cardGallery === "single") first.imageUrls = [first.imageUrl];
        if (cardGallery === "empty") {
          first.imageUrls = [];
          first.imageUrl = "";
        }
      }

      if (overviewState === "negative") feed.summary.avgMarketSpread = -8.9;
      if (overviewState === "empty") {
        feed.items = [];
        feed.total = 0;
        feed.summary = {
          ...feed.summary,
          activeListings: 0,
          worthItCount: 0,
          avgMarketSpread: null,
          benchmarkCoverage: 0,
          topDeal: null,
          suggestedDeals: [],
        };
      }
      if (compactStress) {
        // Layout stress only: long real-world geography length, unverified
        // location and an expired auction schedule on the same auction card.
        const listing = feed.items.find(
          (item) => item.listingCategory === "LELANG",
        );
        assert.ok(listing);
        feed.items = [
          {
            ...listing,
            title:
              "Sebidang tanah berikut bangunan rumah dengan rincian alamat panjang yang tetap tersedia secara lengkap melalui Detail",
            address:
              "Jalan Permukiman Utama Nomor 123, RT 004 / RW 006, Kompleks Perumahan Dengan Keterangan Lokasi Lengkap",
            cityName: "Kabupaten Kepulauan Siau Tagulandang Biaro",
            districtName: "Kecamatan Dengan Nama Wilayah Yang Panjang",
            kelurahanId: null,
            kelurahanName: null,
            kelurahanVerified: false,
            benchmark: null,
            metricMarketSpreadPct: null,
            auctionDate: "2025-11-27T03:00:00.000Z",
          },
        ];
        feed.total = 1;
        feed.pageCount = 1;
      }
      if (performanceGate) await performanceGate;
      if (url.searchParams.get("q") === "lambat")
        await new Promise((resolve) => setTimeout(resolve, 700));
      if (!request.isInterceptResolutionHandled())
        await request.respond({
          status: denyFeed ? 403 : failFeed ? 503 : 200,
          contentType: "application/json",
          body: JSON.stringify(
            denyFeed
              ? { error: "Akses owner Anda sudah tidak aktif." }
              : failFeed
                ? { error: "Database sedang tidak tersedia. Coba lagi." }
                : feed,
          ),
        });
      return;
    }
    const soldId = url.pathname.match(
      /^\/api\/dashboard\/investor\/(\d+)\/status$/,
    )?.[1];
    if (url.origin === origin && soldId) {
      soldRequests.push({ id: soldId, method: request.method(), body: request.postData() });
      const status = soldStatus;
      if (soldDelay) await new Promise((resolve) => setTimeout(resolve, soldDelay));
      if (status === 200) soldIds.add(soldId);
      return request.respond({
        status,
        contentType: "application/json",
        body: JSON.stringify(status === 200
          ? { success: true, message: "Aset berhasil ditandai terjual." }
          : { error: "Status aset belum dapat disimpan." }),
      });
    }
    const locationId = url.pathname.match(
      /^\/api\/dashboard\/investor\/(\d+)\/location$/,
    )?.[1];
    if (url.origin === origin && locationId) {
      const patch = request.method() === "PATCH";
      if (patch) locationWrites++;
      if (patch && !conflictLocation) fixtureFeed.correctLocation(locationId);
      return request.respond({
        status: failLocation ? 503 : patch && conflictLocation ? 409 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          failLocation
            ? { error: "Referensi wilayah belum dapat dimuat. Coba lagi." }
            : patch && conflictLocation
              ? {
                  error:
                    "Lokasi listing sudah berubah. Muat ulang pilihan sebelum menyimpan.",
                }
              : patch
                ? { kelurahanName: "Kebraon" }
                : {
                    cityName: "Kota Surabaya",
                    revision: "a".repeat(32),
                    districts: [{ id: "357801", name: "Karangpilang" }],
                    selectedDistrictId: "357801",
                    kelurahan: [{ id: "3578011001", name: "Kebraon" }],
                    currentKelurahan: null,
                  },
        ),
      });
    }
    const proofId = url.pathname.match(
      /^\/api\/dashboard\/investor\/(\d+)\/validation$/,
    )?.[1];
    if (url.origin === origin && proofId) {
      if (roiState.delay)
        await new Promise((resolve) => setTimeout(resolve, roiState.delay));
      const proof = fixtureFeed.proof(proofId, {
        expanded: roiState.expanded || expandedProof,
        many: manyProof,
      });
      if (roiState.missingLand) proof.listing.landAreaSqm = null;
      return request.respond({
        status: failProof ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          failProof ? { error: "Bukti CMA gagal dimuat. Coba lagi." } : proof,
        ),
      });
    }
    const historyId = url.pathname.match(
      /^\/api\/listing\/(\d+)\/riwayat-lelang$/,
    )?.[1];
    if (url.origin === origin && historyId)
      return request.respond({
        status: roiState.failHistory ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          roiState.failHistory
            ? { error: "Gagal" }
            : roiHistory(fixtureFeed.proof(historyId).listing),
        ),
      });
    if (url.origin === origin && url.pathname.startsWith("/api/regions/")) {
      const provinces = [{ id: "35", name: "Jawa Timur" }];
      const cities = [
        { id: "3578", name: "Kota Surabaya", province: "Jawa Timur" },
        { id: "3573", name: "Kota Malang", province: "Jawa Timur" },
      ];
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          url.pathname.endsWith("/cities")
            ? { cities }
            : {
                items:
                  url.searchParams.get("level") === "provinsi"
                    ? provinces
                    : cities,
              },
        ),
      });
    }
    if (
      url.origin === origin &&
      url.pathname === "/api/dashboard/agent/listing-performance"
    ) {
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
    }
    if (url.origin === origin && url.pathname === "/api/dashboard/acara") {
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    }
    if (
      url.origin === origin &&
      url.pathname === "/api/dashboard/agent/kpi-cards"
    ) {
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            totalPendapatan: 250000000,
            totalTransaksi: 12,
            totalListing: 45,
            totalLeads: 23,
            pendapatanDelta: null,
            pendapatanTahunIni: 250000000,
            pendapatanTahunLalu: 0,
            transaksiBulanIni: 2,
            transaksiBulanLalu: 1,
            transaksiTahunIni: 12,
            leadBulanIni: 3,
            leadBulanLalu: 2,
            leadDelta: null,
          },
        }),
      });
    }
    if (url.origin === origin && url.pathname === "/api/auth/session")
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session),
      });
    if (url.origin === origin && url.pathname.startsWith("/api/"))
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
    // Local NextAuth may retain a production HTTPS cookie name. Supply both
    // signed QA names only to this local origin, never to remote image hosts.
    return request.continue(url.origin === origin && qaSessionCookie
      ? { headers: { ...request.headers(), cookie: qaSessionCookie } }
      : undefined);
  } catch (error) {
    if (!request.isInterceptResolutionHandled())
      await request.abort().catch(() => {});
  }
});
async function authenticate(jabatan = "OWNER") {
  session.user.jabatan = jabatan;
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET,
    token: {
      id: "investor-qa",
      sub: "investor-qa",
      peran: "AGENT",
      role: "AGENT",
      jabatan,
      agentId: "qa",
      _refreshedAt: Date.now(),
    },
  });
  qaSessionCookie = `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`;
  await browser.setCookie({
    name: "next-auth.session-token",
    value: token,
    url: origin,
    httpOnly: true,
    sameSite: "Lax",
  });
}
const clickText = async (text, rootSelector = ".investor-dashboard") => {
  assert.ok(
    await page.evaluate(
      (text, rootSelector) => {
        const button = [
          ...document.querySelector(rootSelector).querySelectorAll("button"),
        ].find((item) => item.textContent.trim() === text);
        if (!button) return false;
        button.click();
        return true;
      },
      text,
      rootSelector,
    ),
    `Button: ${text}`,
  );
};
async function openInvestorFilters() {
  if (!(await page.$(".investor-filter-dialog")))
    await page.click('[aria-label="Filter tambahan"]');
  await page.waitForSelector(".investor-filter-dialog");
}
async function closeInvestorFilters() {
  if (await page.$(".investor-filter-dialog")) {
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector(".investor-filter-dialog"),
    );
  }
}
async function chooseScope(value) {
  await closeInvestorFilters();
  await page.click('[aria-label="Cakupan listing"]');
  await page.waitForSelector(`#investor-scope-${value}`);
  await page.click(`#investor-scope-${value}`);
}
async function toggleSavedOnly() {
  await openInvestorFilters();
  await page.click('[aria-label="Tampilkan properti tersimpan"]');
  await page.click(".investor-filter-dialog-footer .investor-primary");
  await page.waitForFunction(
    () => !document.querySelector(".investor-filter-dialog"),
  );
}
async function chooseCategory(label) {
  await openInvestorFilters();
  await clickText(label, ".investor-category-tabs");
  await page.click(".investor-filter-dialog-footer .investor-primary");
  await page.waitForFunction(
    () => !document.querySelector(".investor-filter-dialog"),
  );
}
async function chooseCity(name) {
  await closeInvestorFilters();
  await page.focus('.investor-home-search-bar [aria-label="Kota / Kabupaten"]');
  await page.keyboard.press("Space");
  const panel = '[role="dialog"][aria-label="Pilih lokasi"]';
  await page.waitForSelector(panel);
  await page.waitForFunction(
    (panel) => !document.querySelector(`${panel} [aria-busy="true"]`),
    {},
    panel,
  );
  await clickText("Reset", panel);
  await page.type(`${panel} input`, name);
  await page.waitForFunction(
    (panel, name) =>
      [...document.querySelector(panel).querySelectorAll("button")].some(
        (button) => button.textContent.trim().startsWith(name),
      ),
    {},
    panel,
    name,
  );
  await page.$$eval(
    `${panel} button`,
    (buttons, name) =>
      buttons
        .find((button) => button.textContent.trim().startsWith(name))
        .click(),
    name,
  );
  assert.equal(
    await page.$$eval(`${panel} button[aria-label]`, (buttons) =>
      buttons.some((button) =>
        /Lihat Kecamatan/.test(button.getAttribute("aria-label")),
      ),
    ),
    false,
  );
  await page.$$eval(`${panel} button`, (buttons) =>
    buttons.find((button) => button.textContent.includes("Terapkan")).click(),
  );
  await page.waitForFunction(
    (panel) => !document.querySelector(panel),
    {},
    panel,
  );
}
async function verifyHomeSearch() {
  await closeInvestorFilters();
  const bar = ".investor-home-search-bar";
  const panel = '[role="dialog"][aria-label="Pilih lokasi"]';
  await page.focus(`${bar} [aria-label="Kota / Kabupaten"]`);
  await page.keyboard.press("Space");
  await page.waitForSelector(panel);
  await page.waitForSelector(
    `${panel} [aria-label="Lihat Kota / Kab. di Jawa Timur"]`,
  );
  await page.click(`${panel} [aria-label="Lihat Kota / Kab. di Jawa Timur"]`);
  await page.waitForFunction(
    (panel) =>
      document.querySelector(panel)?.textContent.includes("Kota Malang"),
    {},
    panel,
  );
  assert.equal(
    await page.$$eval(`${panel} button[aria-label]`, (buttons) =>
      buttons.some((button) =>
        /Lihat Kecamatan/.test(button.getAttribute("aria-label")),
      ),
    ),
    false,
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    (panel) => !document.querySelector(panel),
    {},
    panel,
  );

  await page.click(`${bar} [aria-label="Jenis properti"]`);
  const typePanel = '[role="dialog"][aria-label="Jenis properti"]';
  await page.waitForSelector(typePanel);
  for (const option of [
    "Apartemen",
    "Gudang",
    "Hotel & Villa",
    "Pabrik",
    "Ruko",
    "Rumah",
    "Tanah",
    "Toko",
  ]) {
    assert.ok(
      await page.$eval(
        typePanel,
        (el, option) =>
          [...el.querySelectorAll("button")].some(
            (button) => button.textContent.trim() === option,
          ),
        option,
      ),
    );
  }
  await clickText("Rumah", typePanel);
  await page.$$eval(`${typePanel} button`, (buttons) =>
    buttons.find((button) => button.textContent.includes("Terapkan")).click(),
  );
  await page.waitForFunction(
    () => new URLSearchParams(location.search).get("tipe") === "RUMAH",
  );
  await waitForIdle();
  await openInvestorFilters();

  await setInput('[aria-label="Harga minimum"]', 500e6);
  await setInput('[aria-label="Harga maksimum"]', 300e6);
  assert.equal(
    await page.$eval('[aria-label="Harga minimum"]', (el) =>
      el.getAttribute("aria-invalid"),
    ),
    "true",
  );
  const beforeInvalid = investorRequests;
  await page.click(".investor-filter-dialog-footer .investor-primary");
  assert.equal(
    investorRequests,
    beforeInvalid,
    "Invalid ranges must never reach the feed",
  );
  await setInput('[aria-label="Harga minimum"]', 200e6);
  await page.click(".investor-filter-dialog-footer .investor-primary");
  await waitForCards(2);
  await waitForIdle();
  assert.deepEqual(
    await page.$$eval(".investor-property", (cards) =>
      cards.map((card) => card.dataset.listingId).sort(),
    ),
    ["901", "906"],
  );
  assert.equal(new URL(page.url()).searchParams.get("minHarga"), "200000000");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForCards(2);
  await openInvestorFilters();
  assert.match(
    await page.$eval('[aria-label="Harga minimum"]', (el) => el.value),
    /200.000.000/,
  );
  await closeInvestorFilters();
  await openInvestorFilters();
  assert.equal(await page.$('[aria-label="Luas bangunan minimum"]'), null);
  await setInput('[aria-label="Luas tanah minimum"]', 101);
  await setInput('[aria-label="Luas tanah maksimum"]', 200);
  await page.click(".investor-filter-dialog-footer .investor-primary");
  await waitForCards(0);
  await waitForIdle();
  await clickText("Reset filter", ".investor-filter-dialog");
  await chooseCity("Kota Surabaya");
  await waitForCards(6);
  await waitForIdle();

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.focus(`${bar} [aria-label="Kota / Kabupaten"]`);
  await page.keyboard.press("Space");
  await page.waitForSelector(panel);
  await page.type(`${panel} input`, "Malang");
  await page.waitForFunction(
    (panel) =>
      document.querySelector(panel)?.textContent.includes("Kota Malang"),
    {},
    panel,
  );
  assert.equal(
    await page.$$eval(`${panel} button[aria-label]`, (buttons) =>
      buttons.some((button) =>
        /Lihat Kecamatan/.test(button.getAttribute("aria-label")),
      ),
    ),
    false,
  );
  await page.screenshot({ path: "/tmp/investor-home-city-mobile.png" });
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    (panel) => !document.querySelector(panel),
    {},
    panel,
  );

  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
}
const waitForCards = (count) =>
  page.waitForFunction(
    (count) => document.querySelectorAll(".investor-property").length === count,
    {},
    count,
  );
const setInput = async (selector, value) => {
  const slider = selector.startsWith("#investor-min-");
  if (slider) await openInvestorFilters();
  await page.$eval(
    selector,
    (element, value) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },
    String(value),
  );
  if (slider) {
    await page.click(".investor-filter-dialog-footer .investor-primary");
    await page.waitForFunction(
      () => !document.querySelector(".investor-filter-dialog"),
    );
    await waitForIdle();
  }
};
const waitForIdle = () =>
  page.waitForFunction(
    () =>
      !document.querySelector('[aria-label="Perbarui data Investor"]').disabled,
  );
const cardLayouts = [];
async function verifyOverview() {
  const expected = fixtureFeed(
    new URLSearchParams({ city: "city-sby" }),
  ).summary;
  assert.equal(
    await page.$eval(".investor-total-deals", (el) => el.textContent.trim()),
    expected.worthItCount.toLocaleString("id-ID"),
  );
  assert.equal(
    await page.$eval(".investor-total-assets", (el) => el.textContent.trim()),
    expected.activeListings.toLocaleString("id-ID"),
  );
  const ratio = Number(
    await page.$eval('.investor-ratio[role="meter"]', (el) =>
      el.getAttribute("aria-valuenow"),
    ),
  );
  assert.ok(
    Math.abs(ratio - (expected.worthItCount / expected.activeListings) * 100) <
      0.0001,
  );
  await page.focus('[aria-label="Lihat aset unggulan"]');
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="dialog"]');
  assert.match(
    await page.$eval('[role="dialog"]', (el) => el.textContent),
    new RegExp(expected.topDeal.title),
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Lihat aset unggulan"]') ===
      document.activeElement,
  );
  assert.equal(
    await page.$eval(
      '[aria-label="Lihat aset unggulan"]',
      (el) => el === document.activeElement,
    ),
    true,
  );
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const bounds = await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const main = document.querySelector(".investor-summary");
      main.scrollIntoView({ block: "start", behavior: "instant" });
      const controls = [...main.querySelectorAll("input, select, button")];
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        outside: controls
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.left < 0 || r.right > innerWidth + 1;
          })
          .map((el) => el.id || el.getAttribute("aria-label")),
        cards: main.querySelectorAll(".investor-summary-card").length,
        clippedSummary: [
          ...main.querySelectorAll(".investor-summary-card"),
        ].flatMap((card) =>
          [...card.querySelectorAll("h2, strong, p")]
            .filter(
              (el) =>
                el.getBoundingClientRect().bottom >
                card.getBoundingClientRect().bottom - 5,
            )
            .map((el) => el.textContent),
        ),
        compactCards: [...main.querySelectorAll(".investor-summary-card")].map(
          (el) => el.getBoundingClientRect().height <= 200,
        ),
        ctaOverlap: [
          ...main.querySelectorAll(
            ".investor-featured h2, .investor-featured h3, .investor-featured-metric, .investor-featured-price-row strong",
          ),
        ].some((el) => {
          const r = el.getBoundingClientRect();
          const c = main
            .querySelector(".investor-featured-cta")
            .getBoundingClientRect();
          return (
            r.left < c.right &&
            r.right > c.left &&
            r.top < c.bottom &&
            r.bottom > c.top
          );
        }),
        primaryFields: [
          ".investor-search-city",
          ".investor-search-keyword",
          ".investor-search-transaction",
          ".investor-search-type",
        ].every(
          (selector) =>
            document.querySelector(selector).getBoundingClientRect().width > 0,
        ),
      };
    });
    assert.equal(
      bounds.overflow,
      false,
      `Overview ${width}: horizontal overflow`,
    );
    assert.deepEqual(
      bounds.outside,
      [],
      `Overview ${width}: controls outside viewport`,
    );
    assert.equal(bounds.cards, 3);
    assert.deepEqual(
      bounds.clippedSummary,
      [],
      `Summary text must fit at ${width}px`,
    );
    assert.ok(
      bounds.compactCards.every(Boolean),
      `Summary cards stay compact at ${width}px`,
    );
    assert.equal(
      bounds.ctaOverlap,
      false,
      `Featured CTA must not overlap text at ${width}px`,
    );
    assert.equal(
      bounds.primaryFields,
      true,
      `Four visible search fields at ${width}px`,
    );
  }
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.$eval(".investor-summary", (el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await (
    await page.$(".investor-summary")
  ).screenshot({ path: "/tmp/investor-overview-desktop.png" });
  await page.setViewport({ width: 320, height: 1200, deviceScaleFactor: 1 });
  await (
    await page.$(".investor-summary")
  ).screenshot({ path: "/tmp/investor-overview-mobile.png" });
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  const structure = await page.evaluate(() => {
    const main = document.querySelector(".investor-dashboard");
    const cards = [...main.querySelectorAll(".investor-summary-card")].map(
      (el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      },
    );
    return {
      children: [...main.children].slice(1, 4).map((el) => el.className),
      cards,
      hiddenHeading:
        getComputedStyle(main.querySelector("h1")).clip ===
        "rect(0px, 0px, 0px, 0px)",
      searchBackground: getComputedStyle(
        main.querySelector(".investor-home-search-bar"),
      ).backgroundColor,
    };
  });
  assert.match(structure.children[0], /investor-summary/);
  assert.match(structure.children[1], /investor-home-search/);
  assert.match(structure.children[2], /investor-results/);
  assert.equal(structure.hiddenHeading, true);
  assert.equal(structure.searchBackground, "rgb(255, 255, 255)");
  for (const card of structure.cards.slice(0, 2))
    assert.ok(
      card.height <= 200 && card.width > card.height,
      JSON.stringify(structure.cards),
    );
  assert.ok(structure.cards[2].width > structure.cards[0].width * 1.8);
  assert.deepEqual(
    await page.$$eval(".investor-summary-card", (els) =>
      els.map((el) => el.dataset.dashboardAccent),
    ),
    ["emerald", "sky", "amber"],
  );
  await page.screenshot({ path: "/tmp/investor-three-cards-desktop.png" });
  await page.focus('[aria-label="Transaksi"]');
  await page.keyboard.press("Space");
  await page.waitForSelector('[role="listbox"]');
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Transaksi",
  );
  // The Home picker is authored and keyboard accessible; Investor stops at city.
  await page.focus('.investor-home-search-bar [aria-label="Kota / Kabupaten"]');
  await page.keyboard.press("Space");
  await page.waitForSelector('[role="dialog"][aria-label="Pilih lokasi"]');
  await page.keyboard.press("Escape");
  assert.equal(
    await page.$eval(
      '.investor-home-search-bar [aria-label="Kota / Kabupaten"]',
      (el) => el === document.activeElement,
    ),
    true,
  );
}
async function verifyInvestorRefinement() {
  assert.equal(await page.$(".investor-card-points"), null);
  assert.doesNotMatch(
    await page.$eval(".investor-dashboard", (el) => el.innerText),
    /\bpoin\b/i,
  );
  assert.match(
    await page.$eval(".investor-featured-score", (el) => el.textContent),
    /%$/,
  );
  const layouts = [];
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewport({
      width,
      height: width === 320 ? 568 : 1000,
      deviceScaleFactor: 1,
    });
    await page.mouse.move(0, 0);
    const layout = await page.evaluate(async () => {
      const cards = [...document.querySelectorAll(".investor-property")];
      cards[0].scrollIntoView({ block: "start", behavior: "instant" });
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const first = cards[0];
      const caption = first.querySelector(".investor-card-photo-meta");
      const photo = first
        .querySelector(".investor-card-photo")
        .getBoundingClientRect();
      const meta = caption.getBoundingClientRect();
      const labels = cards.flatMap((card) => [
        ...card.querySelectorAll(".investor-action-label"),
      ]);
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        twoLines: cards.every((card) => {
          const a = card.querySelector(".investor-card-title-link");
          return (
            a.clientHeight <= 38 &&
            getComputedStyle(a).webkitLineClamp === "2" &&
            a.title === a.textContent.trim()
          );
        }),
        centered: labels.every((label) => {
          const l = label.getBoundingClientRect(),
            b = label.closest("button").getBoundingClientRect();
          return (
            Math.abs(l.x + l.width / 2 - b.x - b.width / 2) <= 1 &&
            l.x >= b.x &&
            l.right <= b.right
          );
        }),
        captionPosition:
          meta.left >= photo.left &&
          meta.bottom <= photo.bottom &&
          photo.bottom - meta.bottom <= 16,
        plainCaption:
          getComputedStyle(caption).backgroundColor === "rgba(0, 0, 0, 0)" &&
          getComputedStyle(first.querySelector(".investor-card-type"))
            .borderRadius === "0px",
        certificate: caption
          .querySelector(".investor-card-certificate")
          .textContent.trim(),
        iconFamily:
          Boolean(first.querySelector(".investor-card-category svg path")) &&
          !first
            .querySelector(".investor-card-category svg")
            ?.classList.contains("lucide"),
        neutralShell: getComputedStyle(first).backgroundImage === "none",
      };
    });
    assert.equal(layout.overflow, false);
    for (const key of [
      "twoLines",
      "centered",
      "captionPosition",
      "plainCaption",
      "iconFamily",
      "neutralShell",
    ])
      assert.equal(
        layout[key],
        true,
        `${width}: ${key} ${JSON.stringify(layout)}`,
      );
    assert.equal(layout.certificate, "SHM");
    layouts.push({ width, ...layout });
    if ([320, 768, 1440].includes(width))
      await page.screenshot({ path: `/tmp/investor-refinement-${width}.png` });
  }
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.click('[aria-label="Urutkan peluang"]');
  await page.waitForSelector('[role="listbox"]');
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'));
  const focus = await page.$eval('[aria-label="Urutkan peluang"]', (el) => ({
    color: getComputedStyle(el).outlineColor,
    width: getComputedStyle(el).outlineWidth,
    shadow: getComputedStyle(el).boxShadow,
    style: getComputedStyle(el).outlineStyle,
    visible: el.matches(":focus-visible"),
    text: el.textContent,
  }));
  assert.ok(
    focus.style === "none" ||
      ["rgb(203, 213, 225)", "rgb(241, 245, 249)", "rgba(0, 0, 0, 0)"].includes(
        focus.color,
      ),
    JSON.stringify(focus),
  );
  assert.ok(focus.shadow === "none" || focus.shadow.includes("203, 213, 225"));
  assert.match(focus.text, /Paling worth-it/);
  await page.$eval('[aria-label="Urutkan peluang"]', async (el) => {
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    el.focus();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  await page.keyboard.press("ArrowDown");
  await page.waitForSelector('[role="listbox"]');
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'));
  await page.focus('.investor-home-search-bar [aria-label="Kota / Kabupaten"]');
  await page.keyboard.press("Space");
  await page.waitForSelector(
    '[role="dialog"][aria-label="Pilih lokasi"] input',
  );
  const input = '[role="dialog"][aria-label="Pilih lokasi"] input';
  const inputFocus = await page.$eval(input, async (el) => {
    // Allow the previous Radix focus scope to finish restoring before the next popup.
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    el.focus();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await Promise.allSettled(
      el.getAnimations().map((animation) => animation.finished),
    );
    return {
      active: document.activeElement === el,
      border: getComputedStyle(el).borderColor,
      outline: getComputedStyle(el).outlineStyle,
    };
  });
  assert.equal(inputFocus.active, true);
  assert.ok(
    ["rgb(148, 163, 184)", "rgb(229, 231, 235)"].includes(inputFocus.border),
    JSON.stringify(inputFocus),
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await page.$eval(".investor-property .investor-primary", (el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await page.click(".investor-property .investor-primary");
  await page.waitForSelector(".investor-proof-table");
  assert.doesNotMatch(
    await page.$eval('[role="dialog"]', (el) => el.innerText),
    /\bpoin\b/i,
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ status: "Investor refinement passed", layouts, focus }),
  );
}

async function verifyDetailLink(card = ".investor-property") {
  const selector = `${card} .investor-card-actions .investor-button`;
  const link = await page.$eval(selector, (el) => ({
    tag: el.tagName,
    href: el.href,
    target: el.target,
    rel: el.rel.split(/\s+/),
  }));
  assert.equal(link.tag, "A");
  assert.equal(link.target, "_blank");
  assert.ok(link.rel.includes("noopener"));
  assert.ok(link.rel.includes("noreferrer"));
  const id = await page.$eval(card, (el) => el.dataset.listingId);
  const expected = fixtureFeed(
    new URLSearchParams({ city: "city-sby" }),
  ).items.find((listing) => listing.id === id);
  assert.ok(expected);
  assert.equal(link.href, new URL(expected.listingUrl, origin).href);
  const currentUrl = page.url();
  const opened = browser.waitForTarget(
    (target) => target.type() === "page" && target.url() === link.href,
    { timeout: 30000 },
  );
  await page.click(selector);
  const detailPage = await (await opened).page();
  assert.ok(detailPage);
  assert.notEqual(detailPage, page);
  assert.equal(page.url(), currentUrl);
  assert.equal(await page.$('[role="dialog"]'), null);
  await detailPage.close();
  await page.bringToFront();
}

async function verifyActionHover(card) {
  for (const action of [".investor-primary", ".investor-button"]) {
    const selector = `${card} .investor-card-actions ${action}`;
    await page.mouse.move(0, 0);
    await page.$eval(selector, async (el) => {
      el.scrollIntoView({ block: "center", behavior: "instant" });
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    await page.hover(selector);
    await page.waitForFunction(
      (selector) =>
        getComputedStyle(document.querySelector(selector), "::before")
          .opacity === "1",
      {},
      selector,
    );
    const hover = await page.$eval(selector, (el) => ({
      color: getComputedStyle(el).color,
      iconMotion: getComputedStyle(el.querySelector(".investor-action-icon"))
        .transform,
      minHeight: el.getBoundingClientRect().height,
    }));
    assert.equal(hover.color, "rgb(8, 41, 27)");
    assert.notEqual(hover.iconMotion, "none");
    assert.ok(hover.minHeight >= 44);
  }
  await page.screenshot({ path: "/tmp/investor-card-action-hover.png" });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  assert.equal(
    await page.$eval(
      `${card} .investor-button .investor-action-icon`,
      (el) => getComputedStyle(el).transform,
    ),
    "none",
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await page.mouse.move(0, 0);
}

async function verifyInvestorCards() {
  const card = `.investor-property[data-listing-id="${fixtureFeed(new URLSearchParams({ city: "city-sby" })).items[0].id}"]`;
  const gallery = `${card} .investor-card-photo`;
  const photoIndex = () =>
    page.$eval(gallery, (el) => Number(el.dataset.photoIndex));
  const refreshCard = async () => {
    await page.mouse.move(0, 0);
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/dashboard/investor" &&
        r.status() === 200,
    );
    await page.click('[aria-label="Perbarui data Investor"]');
    await response;
    await waitForIdle();
  };
  assert.equal(
    await page.$eval(gallery, (el) => Number(el.dataset.photoCount)),
    3,
  );
  assert.equal(await photoIndex(), 0);
  await page.$eval(gallery, (el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await page.hover(gallery);
  await page.waitForFunction(
    (selector) =>
      getComputedStyle(document.querySelector(`${selector} .is-next`))
        .opacity === "1",
    {},
    gallery,
  );
  assert.equal(
    await page.$eval(`${gallery} .is-next`, (button) => {
      const r = button.getBoundingClientRect();
      return button.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
      );
    }),
    true,
    "Photo arrow must own its pointer target",
  );
  await page.click(`${gallery} [aria-label="Foto properti berikutnya"]`);
  await page.waitForFunction(
    (selector) => document.querySelector(selector).dataset.photoIndex === "1",
    {},
    gallery,
  );
  assert.equal(await page.$('[role="dialog"]'), null);
  await page.focus(gallery);
  await page.keyboard.press("ArrowRight");
  assert.equal(await photoIndex(), 2);
  await page.keyboard.press("ArrowLeft");
  assert.equal(await photoIndex(), 1);
  await page.click(`${gallery} [aria-label="Foto properti sebelumnya"]`);
  assert.equal(await photoIndex(), 0);
  const actionLabels = await page.$$eval(
    `${card} .investor-card-actions > :is(button, a)`,
    (buttons) =>
      buttons.map(
        (button) =>
          button.textContent.trim() || button.getAttribute("aria-label"),
      ),
  );
  assert.match(actionLabels[0], /Analisis ROI/);
  assert.match(actionLabels[1], /Bookmark/);
  assert.match(actionLabels[2], /Lihat detail/);
  await page.click(`${card} .investor-card-actions .investor-primary`);
  await page.waitForSelector('[role="dialog"]');
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await verifyDetailLink(card);
  await page.click(`${card} .investor-bookmark`);
  assert.equal(
    await page.$eval(`${card} .investor-bookmark`, (button) =>
      button.getAttribute("aria-pressed"),
    ),
    "true",
  );
  for (const [values, colours] of [
    [
      [0, 0],
      ["rgb(255, 255, 255)", "rgb(255, 255, 255)"],
    ],
    [
      [1, 29.9],
      ["rgb(180, 188, 184)", "rgb(180, 188, 184)"],
    ],
    [
      [30, 50],
      ["rgb(251, 146, 60)", "rgb(251, 146, 60)"],
    ],
    [
      [50.1, 94.7],
      ["rgb(248, 113, 113)", "rgb(248, 113, 113)"],
    ],
    [
      [-95, -5],
      ["rgb(168, 178, 173)", "rgb(168, 178, 173)"],
    ],
    [
      [null, null],
      ["rgb(168, 178, 173)", "rgb(168, 178, 173)"],
    ],
  ]) {
    cardPresentation = values;
    await refreshCard();
    assert.deepEqual(
      await page.$$eval(`${card} .investor-card-metric strong`, (values) =>
        values.map((value) => getComputedStyle(value).color),
      ),
      colours,
    );
    if (values[0] < 0)
      assert.match(
        await page.$eval(
          `${card} .investor-card-market`,
          (el) => el.textContent,
        ),
        /Di atas/,
      );
    if (values[0] === null)
      assert.equal(
        await page.$eval(
          `${card} .investor-card-market strong`,
          (el) => el.textContent,
        ),
        "—",
      );
  }
  cardPresentation = null;
  cardGallery = "broken";
  await refreshCard();
  await page.waitForFunction(
    (selector) =>
      document
        .querySelector(selector)
        .textContent.includes("Foto belum tersedia"),
    {},
    gallery,
  );
  await page.click(`${gallery} [aria-label="Foto properti berikutnya"]`);
  await page.waitForFunction(
    (selector) => document.querySelector(`${selector} img`)?.naturalWidth > 0,
    {},
    gallery,
  );
  assert.equal(
    await page.$eval(gallery, (el) =>
      el.textContent.includes("Foto belum tersedia"),
    ),
    false,
  );
  for (const mode of ["single", "empty"]) {
    cardGallery = mode;
    await refreshCard();
    assert.equal(await page.$(`${gallery} .investor-gallery-arrow`), null);
    assert.equal(await page.$(`${gallery} .investor-gallery-dots`), null);
  }
  cardGallery = "multiple";
  await refreshCard();
  await verifyCompactCards("redesigned");
  await page.setViewport({
    width: 320,
    height: 568,
    deviceScaleFactor: 1,
    hasTouch: false,
  });
  await page.$eval(gallery, (el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const bounds = await page.$eval(gallery, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  const touch = (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
  await touch(
    "touchStart",
    bounds.x + bounds.width * 0.65,
    bounds.y + bounds.height / 2,
  );
  await touch(
    "touchMove",
    bounds.x + bounds.width * 0.35,
    bounds.y + bounds.height / 2 + 2,
  );
  await touch("touchEnd", 0, 0);
  await page.waitForFunction(
    (selector) => document.querySelector(selector).dataset.photoIndex === "1",
    {},
    gallery,
  );
  await touch("touchStart", bounds.x + 100, bounds.y + 45);
  await touch("touchMove", bounds.x + 102, bounds.y + 115);
  await touch("touchEnd", 0, 0);
  assert.equal(
    await photoIndex(),
    1,
    "Vertical scrolling must not switch photo",
  );
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await cdp.detach();
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  assert.equal(
    await page.$eval(
      `${gallery} img`,
      (el) => getComputedStyle(el).animationName,
    ),
    "none",
  );
  await page.click(`${gallery} [aria-label="Foto properti berikutnya"]`);
  assert.equal(await photoIndex(), 2);
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.$eval(card, (el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  assert.equal(
    await page.$eval(gallery, (el) => el.getBoundingClientRect().height),
    256,
  );
  // Fine-pointer hover runs in HOVER_ONLY with a fresh mouse context; CDP touch
  // emulation above deliberately changes pointer capabilities for gallery tests.
  await page.screenshot({ path: "/tmp/investor-card-redesign-desktop.png" });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.$eval(card, (el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await page.screenshot({ path: "/tmp/investor-card-redesign-mobile.png" });
  assert.deepEqual(errors, []);
}

async function verifyPersistedFilterRecovery() {
  const staleUrl = `${origin}/dashboard/investor?city=Kota%20Surabaya&category=SECONDARY&data=deals&sort=spread`;
  await page.goto(staleUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      new URL(location.href).searchParams.get("data") === "all" &&
      document.querySelectorAll(".investor-property").length === 2,
  );
  await waitForIdle();
  assert.equal(
    await page.$eval(".investor-total-deals", (el) => el.textContent.trim()),
    "0",
  );
  assert.match(
    await page.$eval('[aria-label="Cakupan listing"]', (el) => el.textContent),
    /Semua/,
  );
  assert.match(
    await page.$eval(".investor-scope-recovery", (el) => el.textContent),
    /Menampilkan 2 properti tersedia.*Secondary/,
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({
      width,
      height: width === 320 ? 568 : 900,
      deviceScaleFactor: 1,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.screenshot({
    path: "/tmp/investor-persisted-recovery-desktop.png",
  });
  await clickText("Hapus filter tambahan", ".investor-scope-recovery");
  await waitForCards(6);
  await waitForIdle();
  const cleared = new URL(page.url()).searchParams;
  assert.equal(cleared.get("category"), null);
  assert.equal(cleared.get("city"), "Kota Surabaya");
  assert.equal(cleared.get("data"), "all");
  assert.equal(cleared.get("sort"), "spread");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForCards(6);
  await waitForIdle();
  // Real query/range mismatches must stay empty, never show unrelated assets.
  await page.goto(`${staleUrl}&q=kelurahan-tidak-ada`, {
    waitUntil: "domcontentloaded",
  });
  await waitForIdle();
  assert.equal(new URL(page.url()).searchParams.get("data"), "deals");
  assert.equal(await page.$(".investor-property"), null);
  assert.equal(await page.$(".investor-scope-recovery"), null);
  await page.goto(`${staleUrl}&minLT=110000`, {
    waitUntil: "domcontentloaded",
  });
  await waitForIdle();
  assert.equal(new URL(page.url()).searchParams.get("data"), "deals");
  assert.equal(await page.$(".investor-property"), null);
  assert.deepEqual(errors, []);
}

async function verifySimpleToolbar() {
  assert.equal(new URL(page.url()).searchParams.get("data"), "all");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({
      width,
      height: width === 320 ? 568 : 900,
      deviceScaleFactor: 1,
    });
    await page.$eval(".investor-home-search", (el) =>
      el.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    const layout = await page.evaluate(() => {
      const row = document.querySelector(".investor-filter-toolbar");
      const buttons = [...row.querySelectorAll("button")].map((el) =>
        el.getBoundingClientRect(),
      );
      return {
        height: row.getBoundingClientRect().height,
        overflow: document.documentElement.scrollWidth > innerWidth,
        ys: buttons.map((r) => r.y),
        outside: buttons.some((r) => r.x < 0 || r.right > innerWidth + 1),
      };
    });
    assert.ok(layout.height <= 44, JSON.stringify({ width, ...layout }));
    assert.ok(
      Math.max(...layout.ys) - Math.min(...layout.ys) <= 1,
      `One toolbar row at ${width}px`,
    );
    assert.equal(layout.overflow, false);
    assert.equal(layout.outside, false);
    await page.focus("#investor-search");
    assert.equal(
      await page.$eval(
        "#investor-search",
        (el) => getComputedStyle(el).outlineStyle,
      ),
      "none",
    );
    await page.screenshot({
      path: `/tmp/investor-single-toolbar-${width}.png`,
    });
  }
  await page.click('[aria-label="Transaksi"]');
  await page.waitForSelector("#investor-transaction-sewa");
  for (const id of ["beli", "sewa"])
    assert.ok(
      await page.$eval(`#investor-transaction-${id}`, (el) =>
        Boolean(el.querySelector('span[aria-hidden="true"] svg')),
      ),
      `Icon on ${id} option`,
    );
  await page.click("#investor-transaction-sewa");
  await waitForCards(3);
  await waitForIdle();
  assert.ok(
    await page.$(
      ".investor-search-transaction [data-search-select-icon] .lucide-key-round",
    ),
  );
  await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
  await openInvestorFilters();
  assert.equal(await page.$("#investor-min-drop"), null);
  assert.equal(await page.$('[aria-label="Luas bangunan minimum"]'), null);
  await page.click('[aria-label="Periode sewa"]');
  await page.waitForSelector('[role="listbox"]');
  assert.ok(
    await page.$eval('[role="listbox"]', (el) => {
      const r = el.getBoundingClientRect();
      return r.x >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    }),
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'));
  assert.ok(
    await page.$(".investor-filter-dialog"),
    "Nested Select Escape keeps filter dialog open",
  );
  const modal = await page.$eval(".investor-filter-dialog", (el) => {
    const r = el.getBoundingClientRect();
    const f = el.querySelector("footer").getBoundingClientRect();
    return {
      fits:
        r.x >= 0 &&
        r.right <= innerWidth &&
        r.y >= 0 &&
        r.bottom <= innerHeight,
      footer: f.bottom <= innerHeight,
    };
  });
  assert.equal(modal.fits, true);
  assert.equal(modal.footer, true);
  await page.waitForFunction(() =>
    Boolean(document.activeElement?.closest(".investor-filter-dialog")),
  );
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    await page.waitForFunction(() =>
      Boolean(document.activeElement?.closest(".investor-filter-dialog")),
    );
  }
  await closeInvestorFilters();
  await page.waitForFunction(
    () => document.activeElement?.id === "investor-filter-trigger",
  );
  await page.click('[aria-label="Transaksi"]');
  await page.waitForSelector("#investor-transaction-beli");
  await page.click("#investor-transaction-beli");
  await waitForCards(6);
  await waitForIdle();
  assert.ok(
    await page.$(
      ".investor-search-transaction [data-search-select-icon] .lucide-house",
    ),
  );
  await openInvestorFilters();
  await setInput('[aria-label="Harga minimum"]', 500e6);
  await setInput('[aria-label="Harga maksimum"]', 300e6);
  const before = investorRequests;
  await page.click(".investor-filter-dialog-footer .investor-primary");
  assert.equal(investorRequests, before, "Invalid range must not reach API");
  assert.equal(
    await page.$eval('[aria-label="Harga minimum"]', (el) =>
      el.getAttribute("aria-invalid"),
    ),
    "true",
  );
  assert.ok(
    await page.$eval('[aria-label="Harga minimum"]', (el) =>
      Boolean(document.getElementById(el.getAttribute("aria-describedby"))),
    ),
  );
  await setInput('[aria-label="Harga minimum"]', 200e6);
  await setInput('[aria-label="Luas tanah minimum"]', 100);
  await setInput('[aria-label="Luas tanah maksimum"]', 500);
  await page.click(".investor-filter-dialog-footer .investor-primary");
  await waitForCards(3);
  await waitForIdle();
  await page.waitForFunction(
    () => !document.querySelector(".investor-filter-dialog"),
  );
  assert.equal(new URL(page.url()).searchParams.get("minHarga"), "200000000");
  assert.equal(new URL(page.url()).searchParams.get("minLT"), "100");
  assert.equal(await page.$('[aria-label="Tampilan peluang"]'), null);
  assert.equal(await page.$(".investor-results table"), null);
  await openInvestorFilters();
  await clickText("Reset filter", ".investor-filter-dialog");
  await page.click(".investor-filter-dialog-footer .investor-primary");
  await waitForIdle();
  await chooseCity("Kota Surabaya");
  await waitForCards(6);
  await waitForIdle();
  const beforeDraft = investorRequests;
  await openInvestorFilters();
  const categoryIcons = await page.$$eval(
    ".investor-category-tabs button",
    (buttons) => buttons.every((button) => button.querySelector("svg")),
  );
  assert.equal(categoryIcons, true);
  await clickText("Secondary", ".investor-category-tabs");
  await setInput('[aria-label="Luas tanah minimum"]', 110000);
  await page.focus('[aria-label="Luas tanah minimum"]');
  await page.waitForFunction(
    () =>
      getComputedStyle(
        document.querySelector('[aria-label="Luas tanah minimum"]'),
      ).borderColor === "rgb(148, 163, 184)",
  );
  const focus = await page.$eval('[aria-label="Luas tanah minimum"]', (el) => {
    const css = getComputedStyle(el);
    return {
      outline: css.outlineStyle,
      border: css.borderColor,
      shadow: css.boxShadow,
    };
  });
  assert.deepEqual(focus, {
    outline: "none",
    border: "rgb(148, 163, 184)",
    shadow: "none",
  });
  await closeInvestorFilters();
  assert.equal(
    investorRequests,
    beforeDraft,
    "Closing draft filters never changes applied results",
  );
  await openInvestorFilters();
  assert.equal(
    await page.$eval('[aria-label="Luas tanah minimum"]', (el) => el.value),
    "",
  );
  assert.equal(
    await page.$eval(
      '.investor-category-tabs button[aria-pressed="true"]',
      (el) => el.textContent,
    ),
    "Semua",
  );
  await closeInvestorFilters();
  await chooseCategory("Secondary");
  await waitForCards(2);
  await waitForIdle();
  assert.equal(
    await page.$eval(".investor-total-deals", (el) => el.textContent.trim()),
    "0",
  );
  await chooseScope("deals");
  await waitForCards(2);
  await waitForIdle();
  await page.waitForSelector(".investor-scope-recovery");
  assert.match(
    await page.$eval(".investor-scope-recovery", (el) => el.textContent),
    /Menampilkan 2 properti tersedia.*Secondary/,
  );
  assert.equal(new URL(page.url()).searchParams.get("data"), "all");
  await chooseCategory("Semua");
  await waitForCards(6);
  await waitForIdle();
  await page.evaluate(() => {
    const url = new URL(location.href);
    url.searchParams.set("view", "table");
    history.replaceState(null, "", url);
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForFunction(
    () => !new URL(location.href).searchParams.has("view"),
  );
  assert.equal(await page.$(".investor-results table"), null);
  await chooseScope("unverified");
  await waitForCards(1);
  await waitForIdle();
  assert.match(
    await page.$eval(".investor-property", (el) => el.textContent),
    /Data Kelurahan Belum Terverifikasi/,
  );
  await chooseScope("deals");
  await waitForCards(6);
  await waitForIdle();
  await page.click('.investor-property button[aria-label^="Bookmark"]');
  await toggleSavedOnly();
  await waitForCards(1);
  await waitForIdle();
  await toggleSavedOnly();
  await waitForCards(6);
  await waitForIdle();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.$eval(".investor-summary", (el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await page.screenshot({ path: "/tmp/investor-simple-final-desktop.png" });
  await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
  await page.$eval(".investor-home-search", (el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await page.screenshot({ path: "/tmp/investor-simple-final-mobile.png" });
  assert.deepEqual(errors, []);
}

async function verifySuggestionCarousel() {
  const selector = ".investor-featured";
  const activeId = () =>
    page.$eval(selector, (el) => el.dataset.activeListingId);
  const first = fixtureFeed(new URLSearchParams({ city: "city-sby" })).summary
    .suggestedDeals;
  assert.equal(first.length, 5);
  await page.$eval(selector, (el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForFunction(
    () =>
      document.querySelector(".investor-featured").dataset.autoplay ===
      "playing",
  );
  const initial = await activeId();
  await page.waitForFunction(
    (id) =>
      document.querySelector(".investor-featured").dataset.activeListingId !==
      id,
    { timeout: 8000 },
    initial,
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".investor-suggestion-slide").length === 1,
  );
  const rotated = await activeId();
  assert.notEqual(rotated, initial, "Autoplay must change the actual property");
  assert.match(
    await page.$eval(".investor-suggestion-position", (el) => el.textContent),
    /2\/5/,
  );

  // Focus pauses rotation; arrows select a real listing, and the stable CTA opens that listing.
  await page.focus(selector);
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    () => document.querySelectorAll(".investor-suggestion-slide").length === 1,
  );
  const third = await activeId();
  assert.equal(third, first[2].id);
  const box = await page.$eval(selector, (el) => ({
    height: el.getBoundingClientRect().height,
  }));
  assert.ok(
    box.height <= 200,
    "Carousel controls must preserve compact card height",
  );
  await page.click('[aria-label="Lihat aset unggulan"]');
  await page.waitForSelector('[role="dialog"]');
  assert.ok(
    (await page.$eval('[role="dialog"]', (el) => el.textContent)).includes(
      first[2].title,
    ),
  );
  await page.mouse.move(0, 0);
  await new Promise((resolve) => setTimeout(resolve, 5200));
  assert.equal(
    await activeId(),
    third,
    "Opening a modal pauses the underlying carousel",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Lihat aset unggulan",
  );

  // Explicit pause remains in force after pointer and keyboard leave the card.
  await page.click('[aria-label="Jeda rekomendasi otomatis"]');
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForFunction(
    () =>
      document.querySelector(".investor-featured").dataset.autoplay ===
      "paused",
  );
  await new Promise((resolve) => setTimeout(resolve, 5200));
  assert.equal(await activeId(), third);
  await page.click('[aria-label="Putar rekomendasi otomatis"]');
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.hover(selector);
  await page.waitForFunction(
    () =>
      document.querySelector(".investor-featured").dataset.autoplay ===
      "paused",
  );
  await new Promise((resolve) => setTimeout(resolve, 5200));
  assert.equal(await activeId(), third, "Hover must pause autoplay");

  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(
    () =>
      document.querySelector(".investor-featured").dataset.autoplay ===
      "paused",
  );
  await page.evaluate(() => {
    delete document.visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.$eval(".investor-property", (el) =>
    el.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".investor-featured").dataset.autoplay ===
      "paused",
  );

  // Real touch input: horizontal swipe advances; vertical movement keeps the same property.
  await page.setViewport({
    width: 320,
    height: 568,
    deviceScaleFactor: 1,
    hasTouch: false,
  });
  await page.$eval(selector, (el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const rect = await page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  const touch = (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
  await touch("touchStart", rect.x + rect.width - 24, rect.y + 72);
  await touch("touchMove", rect.x + rect.width - 110, rect.y + 74);
  await touch("touchEnd", 0, 0);
  await page.waitForFunction(
    (id) =>
      document.querySelector(".investor-featured").dataset.activeListingId !==
      id,
    {},
    third,
  );
  const swiped = await activeId();
  await touch("touchStart", rect.x + 60, rect.y + 72);
  await touch("touchMove", rect.x + 62, rect.y + 125);
  await touch("touchEnd", 0, 0);
  assert.equal(
    await activeId(),
    swiped,
    "Vertical scrolling must not select another property",
  );
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await cdp.detach();

  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.waitForFunction(
    () =>
      document.querySelector(".investor-featured").dataset.autoplay ===
      "paused",
  );
  assert.equal(
    await page.$eval(
      '[aria-label="Putar rekomendasi otomatis"]',
      (el) => el.disabled,
    ),
    true,
  );
  await page.click('[aria-label="Properti rekomendasi berikutnya"]');
  await page.waitForFunction(
    () => document.querySelectorAll(".investor-suggestion-slide").length === 1,
  );
  assert.notEqual(
    await activeId(),
    swiped,
    "Reduced motion retains manual navigation",
  );
  // Restore the initial slide and desktop environment for the rest of the suite.
  await page.focus(selector);
  for (let i = 0; i < 5 && (await activeId()) !== first[0].id; i++)
    await page.keyboard.press("ArrowLeft");
  assert.equal(await activeId(), first[0].id);
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await page.setViewport({
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    hasTouch: false,
  });
}

async function verifyCompactCards(state) {
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [768, 1024],
    [1440, 900],
  ]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.mouse.move(0, 0);
    const layout = await page.evaluate(async () => {
      const cards = [...document.querySelectorAll(".investor-property")];
      const preview =
        cards.find((card) => card.querySelector(".has-auction")) || cards[0];
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      preview.scrollIntoView({ block: "start", behavior: "instant" });
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      let scroller = cards[0].parentElement;
      while (
        scroller &&
        !["auto", "scroll"].includes(getComputedStyle(scroller).overflowY)
      )
        scroller = scroller.parentElement;
      const bounds = scroller.getBoundingClientRect();
      const first = preview.getBoundingClientRect();
      const actions = [
        ...preview.querySelectorAll(
          ".investor-card-actions button, .investor-bookmark, .investor-card-location button",
        ),
      ];
      const clampedAddresses = cards.every((card) => {
        const button = card.querySelector(".investor-card-title-link");
        return (
          button.clientHeight <= 38 &&
          getComputedStyle(button).webkitLineClamp === "2" &&
          button.getAttribute("title") === button.textContent.trim()
        );
      });
      return {
        maxHeight: Math.ceil(
          Math.max(...cards.map((card) => card.getBoundingClientRect().height)),
        ),
        availableHeight: Math.floor(bounds.height),
        overflow: document.documentElement.scrollWidth > innerWidth,
        innerScroll: cards.some((card) =>
          [...card.querySelectorAll("*"), card].some(
            (el) =>
              ["auto", "scroll"].includes(getComputedStyle(el).overflowY) &&
              el.scrollHeight > el.clientHeight + 1,
          ),
        ),
        clipped: cards.some(
          (card) => card.scrollHeight > card.clientHeight + 1,
        ),
        visible:
          first.top >= bounds.top - 1 &&
          first.bottom <= Math.min(bounds.bottom, innerHeight),
        topOffset: first.top - bounds.top,
        bottom: first.bottom,
        actionsVisible: actions.every((button) => {
          const rect = button.getBoundingClientRect();
          return (
            rect.top >= bounds.top &&
            rect.bottom <= Math.min(bounds.bottom, innerHeight)
          );
        }),
        touchTargets: actions.every(
          (button) =>
            button.getBoundingClientRect().height >= 44 &&
            button.getBoundingClientRect().width >= 44,
        ),
        clampedAddresses,
      };
    });
    assert.equal(
      layout.overflow,
      false,
      `${state} ${width}: horizontal overflow`,
    );
    assert.equal(
      layout.innerScroll,
      false,
      `${state} ${width}: internal card scrolling`,
    );
    assert.equal(
      layout.clipped,
      false,
      `${state} ${width}: card content clipped`,
    );
    assert.ok(
      layout.maxHeight <= layout.availableHeight - 12,
      `${state} ${width}: ${JSON.stringify(layout)}`,
    );
    assert.equal(
      layout.visible && layout.actionsVisible,
      true,
      `${state} ${width}: full card/actions visible ${JSON.stringify(layout)}`,
    );
    assert.equal(
      layout.touchTargets,
      true,
      `${state} ${width}: action target under 44px`,
    );
    assert.equal(
      layout.clampedAddresses,
      true,
      `${state} ${width}: address must clamp to two lines with the full value available`,
    );
    cardLayouts.push({ state, width, height, cardHeight: layout.maxHeight });
    if (width === 320 || width === 1440)
      await page.screenshot({
        path: `/tmp/investor-compact-${state}-${width}.png`,
      });
  }
}
try {
  await authenticate();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(`${origin}/dashboard/investor`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await waitForCards(9);
  await waitForIdle();
  if (process.env.INVESTOR_QA_AUCTION_DATE_ONLY === "1") {
    await verifyAuctionDate({ page, errors });
    await browser.close();
    process.exit(0);
  }
  if (process.env.INVESTOR_QA_SOLD_ONLY === "1") {
    await verifySold({
      page,
      errors,
      requests: soldRequests,
      setResponse: (status, delay = 0) => {
        soldStatus = status;
        soldDelay = delay;
      },
    });
    await browser.close();
    process.exit(0);
  }
  if (process.env.INVESTOR_QA_DETAIL_ONLY === "1") {
    await verifyDetailLink();
    assert.deepEqual(errors, []);
    console.log(
      "Investor detail link passed: canonical asset URL opens in a separate tab; original page stays unchanged without a dialog.",
    );
    await browser.close();
    process.exit(0);
  }
  if (process.env.INVESTOR_QA_PERFORMANCE_ONLY === "1") {
    await verifyPerformance({
      page,
      errors,
      requests: () => performanceRequests,
      setGate: (gate) => {
        performanceGate = gate;
      },
      setFailure: (status) => {
        failFeed = status === 503;
        denyFeed = status === 403;
      },
    });
    await browser.close();
    process.exit(0);
  }
  if (process.env.INVESTOR_QA_ROI_ONLY === "1") {
    await verifyRoi({
      page,
      errors,
      setRoiState: (patch) => {
        roiState = { ...roiState, ...patch };
      },
      setFailProof: (value) => {
        failProof = value;
      },
    });
    await browser.close();
    process.exit(0);
  }
  if (process.env.INVESTOR_QA_REFINEMENT_ONLY === "1") {
    await verifyInvestorRefinement();
    await browser.close();
    process.exit(0);
  }
  if (process.env.INVESTOR_QA_HOVER_ONLY === "1") {
    await verifyActionHover(
      `.investor-property[data-listing-id="${fixtureFeed(new URLSearchParams({ city: "city-sby" })).items[0].id}"]`,
    );
    console.log(
      "Investor hover passed: precise pointer hover, nested icon motion, dark text on emerald, 44px targets and reduced motion.",
    );
    await browser.close();
    process.exit(0);
  }
  await verifyOverview();
  if (process.env.INVESTOR_QA_CARDS_ONLY === "1") {
    await verifyInvestorCards();
    console.log(
      "Investor card redesign passed: source-photo gallery arrows/keyboard/touch, vertical scroll, local failure recovery, zero/single-photo states, all discount colour boundaries, negative/unknown labels, unchanged footer actions, Lelang media geometry, complete responsive cards and reduced motion.",
    );
  } else if (process.env.INVESTOR_QA_RECOVERY_ONLY === "1") {
    await verifyPersistedFilterRecovery();
    console.log(
      "Persisted filter recovery passed: original Secondary/Worth-it URL automatically shows two real-shaped cards with zero qualifying deals; visible scope/notice, same-city reset, reload, responsive layout, no unrelated query/land fallback.",
    );
  } else if (process.env.INVESTOR_QA_TOOLBAR_ONLY === "1") {
    await verifySimpleToolbar();
    console.log(
      "Simple toolbar browser QA passed: one row at 320/390/768/1440px; Beli/Sewa icons; no keyword box; modal focus/escape; nested rental dropdown; shared range validation/application; default all listings, empty Worth-it recovery, cards-only URL restoration, atomic filter apply/cancel, neutral input focus, category icons, saved filters and reset.",
    );
  } else {
    await verifySuggestionCarousel();
    if (process.env.INVESTOR_QA_SUGGESTIONS_ONLY === "1") {
      assert.deepEqual(errors, []);
      console.log(
        "Carousel browser QA passed: five-second autoplay; matching detail/focus restoration; pause/resume; hover, focus, modal, hidden/offscreen pauses; real touch/vertical scroll; live reduced-motion changes; compact desktop/mobile geometry.",
      );
    } else {
      await chooseScope("deals");
      await waitForIdle();
      overviewState = "negative";
      await page.click('[aria-label="Perbarui data Investor"]');
      await page.waitForSelector(".investor-summary-card.is-negative");
      assert.match(
        await page.$eval(".investor-average-spread", (el) => el.textContent),
        /-8,9%/,
      );
      assert.match(
        await page.$eval(
          ".investor-summary-card.is-negative",
          (el) => el.textContent,
        ),
        /Di atas pembanding lokal/,
      );
      await waitForIdle();
      overviewState = "empty";
      await page.click('[aria-label="Perbarui data Investor"]');
      await waitForCards(0);
      await waitForIdle();
      assert.equal(await page.$('.investor-ratio[role="meter"]'), null);
      assert.equal(
        await page.$eval(".investor-total-deals", (el) =>
          el.textContent.trim(),
        ),
        "0",
      );
      assert.equal(
        await page.$eval(".investor-average-spread", (el) =>
          el.textContent.trim(),
        ),
        "—",
      );
      assert.equal(await page.$(".investor-featured-cta"), null);
      assert.equal(await page.$(".investor-suggestion-controls"), null);
      overviewState = null;
      await page.click('[aria-label="Perbarui data Investor"]');
      await waitForCards(6);
      await waitForIdle();
      assert.match(
        await page.$eval(".investor-card-title-link", (el) => el.textContent),
        /Kawasan uji Banyuurip, Sawahan, Kota Surabaya/,
      );
      assert.equal(
        await page.$eval(".investor-property", (el) =>
          el.textContent.includes("Harga/m²"),
        ),
        false,
      );
      assert.equal(await page.$(".investor-property time"), null);
      assert.equal(await page.$('.investor-property img[alt="Agent"]'), null);
      assert.match(
        await page.$eval(".investor-card-price", (el) => el.textContent),
        /Rp\s*70\.000\.000/,
      );
      assert.match(
        await page.$eval(".investor-card-land", (el) => el.textContent),
        /100 m²/,
      );
      assert.match(
        await page.$eval(".investor-card-title-link", (el) =>
          el.getAttribute("aria-label"),
        ),
        new RegExp(expected.topDeal.title),
      );
      assert.match(
        await page.$eval(
          ".investor-property .investor-card-market",
          (el) => el.textContent,
        ),
        /90%/,
      );
      assert.equal(
        await page.$eval('[aria-label="Urutkan peluang"]', (el) =>
          el.textContent.replace("Urutkan peluang", "").trim(),
        ),
        "Skor tertinggi",
      );
      assert.equal(
        await page.$eval(".investor-dashboard", (el) =>
          el.textContent.includes("Data demo"),
        ),
        false,
      );
      assert.deepEqual(
        await page.$$eval("aside nav:last-of-type a", (elements) =>
          elements.map((el) => el.textContent.trim()),
        ),
        ["Jadwal & Acara", "Scrape", "Investor"],
      );
      await verifyHomeSearch();
      await verifyCompactCards("buy");
      await page.screenshot({
        path: "/tmp/investor-live-desktop.png",
        fullPage: true,
      });
      await page.click('[aria-label="Halaman berikutnya"]');
      await waitForCards(1);
      await page.click('[aria-label="Halaman sebelumnya"]');
      await waitForCards(6);
      await chooseCity("Kota Malang");
      await waitForCards(1);
      await chooseCity("Kota Surabaya");
      await waitForCards(6);
      await page.type("#investor-search", "Banyuurip");
      await waitForCards(3);
      await page.click('[aria-label="Hapus pencarian"]');
      await waitForCards(6);
      assert.equal(
        await page.$eval(
          "#investor-search",
          (el) => document.activeElement === el,
        ),
        true,
      );
      await setInput("#investor-min-spread", 95);
      await setInput("#investor-min-drop", 70);
      await waitForCards(3);
      assert.match(
        await page.$eval(".investor-featured", (el) => el.textContent),
        /Penurunan lelang/,
      );
      assert.match(
        await page.$eval(".investor-featured", (el) => el.textContent),
        /Spread pasar 10%/,
      );
      assert.match(
        await page.$$eval(".investor-card-title-link", (els) =>
          els.map((el) => el.getAttribute("aria-label")).join(" "),
        ),
        /tanpa pembanding pasar/,
      );
      await setInput("#investor-min-spread", 100);
      await setInput("#investor-min-drop", 100);
      await waitForCards(6);
      await waitForIdle();
      assert.equal(new URL(page.url()).searchParams.get("data"), "all");
      assert.match(
        await page.$eval(".investor-scope-recovery", (el) => el.textContent),
        /Belum ada yang lolos ambang diskon/,
      );
      await clickText("Hapus filter tambahan", ".investor-scope-recovery");
      await waitForCards(6);
      await page.type("#investor-search", "lambat");
      await page.waitForRequest(
        (request) =>
          new URL(request.url()).pathname === "/api/dashboard/investor" &&
          new URL(request.url()).searchParams.get("q") === "lambat",
      );
      await page.click('[aria-label="Hapus pencarian"]');
      await page.type("#investor-search", "Rungkut");
      await page.keyboard.press("Enter");
      await waitForCards(1);
      await page.waitForFunction(() =>
        document
          .querySelector(".investor-property")
          .textContent.includes("Rungkut"),
      );
      await new Promise((resolve) => setTimeout(resolve, 800));
      assert.match(
        await page.$eval(".investor-property", (el) => el.textContent),
        /Rungkut/,
      );
      await page.click('[aria-label="Hapus pencarian"]');
      await waitForCards(6);
      await waitForIdle();
      failFeed = true;
      await page.click('[aria-label="Perbarui data Investor"]');
      await page.waitForSelector('[role="alert"]');
      await waitForCards(6);
      assert.match(
        await page.$eval('[role="alert"]', (el) => el.textContent),
        /snapshot terakhir/,
      );
      failFeed = false;
      await clickText("Coba lagi");
      await page.waitForFunction(
        () => !document.querySelector('[role="alert"]'),
      );
      await waitForIdle();
      denyFeed = true;
      await page.click('[aria-label="Perbarui data Investor"]');
      await page.waitForSelector('[role="alert"]');
      await waitForCards(0);
      denyFeed = false;
      await page.click('[aria-label="Perbarui data Investor"]');
      await waitForCards(6);
      await waitForIdle();
      await page.click('[aria-label="Urutkan peluang"]');
      await page.waitForSelector("#investor-sort-score");
      await page.click("#investor-sort-score");
      await waitForIdle();
      await page.click('.investor-property button[aria-label^="Bookmark"]');
      await page.waitForSelector(
        '.investor-property button[aria-pressed="true"]',
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForCards(6);
      await page.waitForSelector(
        '.investor-property button[aria-pressed="true"]',
      );
      await toggleSavedOnly();
      await waitForCards(1);
      await toggleSavedOnly();
      await waitForCards(6);
      await verifyDetailLink();
      await page.click(".investor-property .investor-primary");
      await page.waitForSelector(".investor-proof-table tbody tr");
      assert.equal(
        await page.$$eval(
          ".investor-proof-table tbody tr",
          (rows) => rows.length,
        ),
        10,
      );
      assert.match(
        await page.$eval('[role="dialog"]', (el) => el.textContent),
        /seluruh 14 pembanding valid/,
      );
      await page.screenshot({
        path: "/tmp/investor-cma-validation-desktop.png",
        fullPage: true,
      });
      await page.waitForSelector(
        '[data-scenario="Rata-rata"] [data-value="resale"]',
      );
      assert.notEqual(
        await page.$eval(
          '[data-scenario="Rata-rata"] [data-value="resale"]',
          (el) => el.textContent.trim(),
        ),
        "—",
        "CMA initializes resale without manual input",
      );
      await page.click(".investor-roi-section-heading button");
      await page.waitForSelector("#investor-purchase-price");
      await setInput("#investor-purchase-price", -1);
      await page.waitForSelector(
        '#investor-purchase-price[aria-invalid="true"]',
      );
      for (let index = 0; index < 8; index++) {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(() =>
            Boolean(document.activeElement?.closest('[role="dialog"]')),
          ),
          true,
        );
      }
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => !document.querySelector('[role="dialog"]'),
      );
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.textContent.includes("Analisis ROI"),
        ),
        true,
      );
      // Hover opens the same validation panel; keyboard/click are equivalent.
      await page.mouse.move(0, 0);
      await page.hover(
        '.investor-property [aria-label^="Validasi data Market Spread"]',
      );
      await page.waitForSelector(".investor-proof-table");
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => !document.querySelector('[role="dialog"]'),
      );
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 700)),
      );
      assert.equal(
        await page.$('[role="dialog"]'),
        null,
        "Dismissed hover panel must stay closed until pointer leaves",
      );
      await page.mouse.move(0, 0);
      expandedProof = true;
      manyProof = false;
      await page.focus(
        '.investor-property [aria-label^="Validasi data Market Spread"]',
      );
      await page.keyboard.press("Enter");
      await page.waitForFunction(() =>
        document
          .querySelector('[role="dialog"]')
          ?.textContent.includes("Sampel kelurahan"),
      );
      assert.match(
        await page.$eval('[role="dialog"]', (el) => el.textContent),
        /Kecamatan Sawahan/,
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => !document.querySelector('[role="dialog"]'),
      );
      failProof = true;
      await page.click(".investor-property .investor-primary");
      await page.waitForSelector('[role="dialog"] [role="alert"]');
      assert.equal(await page.$(".investor-proof-table"), null);
      failProof = false;
      await clickText("Coba lagi", '[role="dialog"]');
      await page.waitForSelector(".investor-proof-table");
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => !document.querySelector('[role="dialog"]'),
      );
      expandedProof = false;
      assert.equal(await page.$('[aria-label="Tampilan peluang"]'), null);
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
      await waitForCards(6);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: "/tmp/investor-live-mobile.png",
        fullPage: true,
      });
      await page.click(".investor-property .investor-primary");
      await page.waitForSelector('[role="dialog"]');
      await page.waitForFunction(() => {
        const r = document
          .querySelector('[role="dialog"]')
          ?.getBoundingClientRect();
        return (
          r &&
          r.left >= 0 &&
          r.top >= 0 &&
          r.right <= innerWidth &&
          r.bottom <= innerHeight
        );
      });
      assert.equal(
        await page.$eval('[role="dialog"]', (el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left >= 0 &&
            r.top >= 0 &&
            r.right <= innerWidth &&
            r.bottom <= innerHeight
          );
        }),
        true,
      );
      await page.waitForSelector(".investor-proof-table");
      await page.screenshot({
        path: "/tmp/investor-cma-validation-mobile.png",
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await page.emulateMediaFeatures([
        { name: "prefers-reduced-motion", value: "reduce" },
      ]);
      assert.equal(
        await page.$eval(
          ".investor-property",
          (el) => getComputedStyle(el).transitionDuration,
        ),
        "0s",
      );
      await page.setViewport({
        width: 1440,
        height: 1100,
        deviceScaleFactor: 1,
      });
      await closeInvestorFilters();
      await page.click('[aria-label="Transaksi"]');
      await page.waitForSelector("#investor-transaction-sewa");
      await page.click("#investor-transaction-sewa");
      await waitForCards(3);
      await waitForIdle();
      assert.equal(await page.$("#investor-min-drop"), null);
      assert.equal(await page.$(".investor-category-tabs"), null);
      assert.match(
        await page.$eval(".investor-dashboard", (el) => el.textContent),
        /Periode sewa/,
      );
      assert.equal(
        await page.$$eval(".investor-property", (els) =>
          els.every((el) => !el.textContent.includes("Penurunan lelang")),
        ),
        true,
      );
      await verifyCompactCards("rent");
      await page.click(".investor-property .investor-primary");
      await page.waitForSelector(".investor-proof-table");
      assert.equal(await page.$("#investor-resale"), null);
      assert.match(
        await page.$eval('[role="dialog"]', (el) => el.textContent),
        /Analisis sewa/,
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => !document.querySelector('[role="dialog"]'),
      );
      await closeInvestorFilters();
      await page.click('[aria-label="Transaksi"]');
      await page.waitForSelector("#investor-transaction-beli");
      await page.click("#investor-transaction-beli");
      await waitForCards(6);
      await waitForIdle();
      await chooseCategory("Primary");
      await waitForCards(2);
      assert.equal(
        await page.$$eval(".investor-property", (els) =>
          els.every((el) => el.textContent.includes("PRIMARY")),
        ),
        true,
      );
      await chooseCategory("Semua");
      await waitForCards(6);
      await waitForIdle();
      await chooseScope("unverified");
      await waitForCards(1);
      assert.match(
        await page.$eval(".investor-property", (el) => el.textContent),
        /Data Kelurahan Belum Terverifikasi/,
      );
      await verifyCompactCards("unverified");
      failLocation = true;
      await page.click('.investor-property [aria-label="Pilih kelurahan"]');
      await page.waitForSelector('[role="dialog"] [role="alert"]');
      failLocation = false;
      await clickText("Muat ulang pilihan", '[role="dialog"]');
      await page.waitForFunction(
        () =>
          document.querySelector(
            '#investor-correction-kel option[value="3578011001"]',
          ) && !document.querySelector("#investor-correction-kel").disabled,
      );
      await page.select("#investor-correction-kel", "3578011001");
      conflictLocation = true;
      await clickText("Simpan kelurahan", '[role="dialog"]');
      await page.waitForFunction(() =>
        document
          .querySelector('[role="dialog"]')
          ?.textContent.includes("sudah berubah"),
      );
      assert.equal(
        await page.$eval("#investor-correction-kel", (el) => el.disabled),
        true,
      );
      conflictLocation = false;
      await clickText("Muat ulang pilihan", '[role="dialog"]');
      await page.waitForFunction(
        () => !document.querySelector("#investor-correction-kel").disabled,
      );
      await page.select("#investor-correction-kel", "3578011001");
      await clickText("Simpan kelurahan", '[role="dialog"]');
      await page.waitForFunction(
        () => !document.querySelector('[role="dialog"]'),
      );
      await waitForCards(0);
      assert.equal(locationWrites, 2);
      assert.equal(
        await page.$eval(".investor-dashboard", (el) =>
          el.textContent.includes("Luas bangunan"),
        ),
        false,
      );
      await page.goto(
        `${origin}/dashboard/investor?transaction=SEWA&city=city-sby&category=LELANG&upcoming=1&sort=drop&data=all`,
        { waitUntil: "domcontentloaded" },
      );
      await waitForCards(3);
      await waitForIdle();
      assert.equal(
        await page.$eval('[aria-label="Urutkan peluang"]', (el) =>
          el.textContent.replace("Urutkan peluang", "").trim(),
        ),
        "Skor tertinggi",
      );
      assert.equal(await page.$("#investor-min-drop"), null);
      compactStress = true;
      await page.goto(`${origin}/dashboard/investor?city=city-sby`, {
        waitUntil: "domcontentloaded",
      });
      await waitForCards(1);
      await verifyCompactCards("long-content");
      await page.click(".investor-card-title-link");
      await page.waitForSelector('[role="dialog"]');
      assert.match(
        await page.$eval('[role="dialog"]', (el) => el.textContent),
        /rincian alamat panjang yang tetap tersedia secara lengkap/,
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => !document.querySelector('[role="dialog"]'),
      );
      await page.waitForFunction(
        () =>
          document.querySelector(".investor-card-title-link") ===
          document.activeElement,
      );
      assert.equal(
        await page.$eval(
          ".investor-card-title-link",
          (el) => el === document.activeElement,
        ),
        true,
      );
      compactStress = false;
      // Cross-screen regression: the owner uses the same KPI shell and its original actions.
      await page.goto(`${origin}/dashboard`, {
        waitUntil: "networkidle2",
        timeout: 120000,
      });
      const ownerHandle = await page.waitForFunction(() => {
        const tiles = [...document.querySelectorAll("[data-dashboard-accent]")];
        if (
          tiles.length !== 4 ||
          !tiles[0].textContent.includes("Total Pendapatan") ||
          tiles.some((tile) => tile.getBoundingClientRect().width < 100)
        )
          return false;
        return tiles.map((tile) => ({
          accent: tile.dataset.dashboardAccent,
          radius: getComputedStyle(tile).borderRadius,
          interactive: tile.getAttribute("role") === "button",
        }));
      });
      const ownerTiles = await ownerHandle.jsonValue();
      assert.deepEqual(
        ownerTiles.map((tile) => tile.accent),
        ["emerald", "violet", "sky", "amber"],
      );
      assert.ok(
        ownerTiles.every((tile) => tile.radius === "24px" && tile.interactive),
      );
      await page.screenshot({ path: "/tmp/dashboard-owner-shared-kpi.png" });
      await authenticate("ADMIN");
      await page.goto(`${origin}/dashboard/investor`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.waitForFunction(
        () => !location.pathname.startsWith("/dashboard/investor"),
      );
      assert.equal(errors.length, 0, errors.join("\n"));
      console.log(JSON.stringify({ cardLayouts }));
      console.log(
        `Browser QA passed (${investorRequests} feed requests): BELI/SEWA isolation, category filter, land-only cards, missing-kelurahan correction/retry/conflict, signed SUM ranking, OR thresholds, remote search/cancellation, server pagination, error/stale/retry, sorting, persisted bookmarks, automatic ROI, cards/table/map, keyboard, mobile, reduced motion, and owner-only navigation.`,
      );
    }
  }
} catch (error) {
  await page
    .screenshot({
      path: "/tmp/investor-live-failure.png",
      fullPage: true,
    })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
// Standalone QA is complete; do not retain idle SDK transport handles in Node.
process.exit(0);

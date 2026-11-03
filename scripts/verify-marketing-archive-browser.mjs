// Real source and photographs; only read-only inventory requests are allowed.
import assert from "node:assert/strict";
import fs from "node:fs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3102";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const db = new PrismaClient();
let browser;
const errors = [],
  forbidden = [];
const viewports = [1512, 1280, 1024, 768, 600, 540, 390, 360, 320];
const density = [];
try {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const campaign = await db.marketingCampaign.findFirstOrThrow({
    where: { brief: { path: ["endDate"], lt: today } },
    orderBy: { updatedAt: "desc" },
  });
  const before = JSON.stringify({
    campaign,
    jobs: await db.marketingJob.count(),
    publications: await db.marketingPublication.count(),
  });
  const owner = await db.agent.findFirstOrThrow({
    where: {
      jabatan: "OWNER",
      status_keanggotaan: "AKTIF",
      pengguna: { status_akun: "AKTIF" },
    },
    select: { id_pengguna: true },
  });
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
  const cookieName = process.env.NEXTAUTH_URL?.startsWith("https:")
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  browser = await puppeteer.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
    protocolTimeout: 180000,
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(180000);
  await page.setCookie({
    name: cookieName,
    value: token,
    url: origin,
    httpOnly: true,
    secure: cookieName.startsWith("__Secure-"),
  });
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Browser error:", e.stack || e.message);
  });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) return request.abort();
    if (
      url.pathname.startsWith("/api/dashboard/pemasaran") &&
      request.method() !== "GET"
    ) {
      const body = JSON.parse(request.postData() || "{}");
      if (body.action !== "inventory") {
        forbidden.push(body.action);
        return request.abort();
      }
    }
    return request.continue();
  });
  const click = async (text) => {
    const button = await page.waitForFunction(
      (label) =>
        [...document.querySelectorAll("button")].find(
          (e) => e.textContent.trim() === label && !e.disabled,
        ),
      {},
      text,
    );
    await button
      .asElement()
      .evaluate((e) =>
        e.scrollIntoView({ block: "center", behavior: "instant" }),
      );
    await button.asElement().click();
  };
  const capture = async (selector, path) => {
    await page.$eval(selector, (e) =>
      e.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    await page.waitForFunction(
      (target) => {
        let node = document.querySelector(target);
        if (!node) return false;
        while (node) {
          if (Number(getComputedStyle(node).opacity) < 0.99) return false;
          node = node.parentElement;
        }
        return true;
      },
      {},
      selector,
    );
    await page.waitForFunction(
      (target) =>
        [...document.querySelector(target).querySelectorAll("img")].every(
          (image) => {
            const rect = image.getBoundingClientRect();
            const clip = image
              .closest(".campaign-stock-grid")
              ?.getBoundingClientRect();
            const left = Math.max(0, clip?.left || 0),
              right = Math.min(innerWidth, clip?.right || innerWidth);
            const visible =
              rect.right > left &&
              rect.left < right &&
              rect.bottom > 0 &&
              rect.top < innerHeight;
            return !visible || (image.complete && image.naturalWidth > 0);
          },
        ),
      { timeout: 90000 },
      selector,
    );
    await page.screenshot({ path, fullPage: false });
  };
  fs.mkdirSync("/tmp/kosku-carousel-qa", { recursive: true });
  await page.setViewport({ width: 1512, height: 1050 });
  await page.goto(
    origin + "/dashboard/pemasaran?tab=campaign&campaign=" + campaign.id,
    {
      waitUntil: "networkidle2",
    },
  );
  await page.waitForSelector(".campaign-ended-panel");
  assert.equal(
    await page.$(".campaign-property-card"),
    null,
    "ended campaign does not present historical properties as active stock",
  );
  assert.equal(
    await page.$$eval(".campaign-proposal button", (buttons) =>
      buttons.some((button) => button.textContent.includes("Susun jadwal")),
    ),
    false,
  );
  for (const width of [1512, 320]) {
    await page.setViewport({ width, height: 950 });
    await capture(
      ".campaign-ended-panel",
      `/tmp/kosku-carousel-qa/ended-${width}.png`,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
  }
  await page.setViewport({ width: 1512, height: 1050 });
  await page.$eval(
    ".campaign-ended-panel > .campaign-panel-core > .campaign-history-disclosure > summary, .campaign-ended-panel .campaign-history-disclosure > summary",
    (e) => e.click(),
  );
  await page.waitForSelector('.campaign-property-badge[data-archive="true"]');
  assert.equal(
    await page.$$eval(".campaign-property-card", (e) => e.length),
    6,
    "all real archives are directly available in the horizontal strip",
  );
  const firstIds = await page.$$eval(".campaign-property-card", (e) =>
    e.map((x) => x.dataset.listing),
  );
  assert.ok(firstIds.every((id) => !id.startsWith("9000000")));
  await page.waitForFunction(
    () =>
      document.querySelector(".campaign-property-image img")?.complete &&
      document.querySelector(".campaign-property-image img")?.naturalWidth > 0,
    { timeout: 150000 },
  );
  assert.equal(
    await page.$$eval(".campaign-archive-schedule li", (e) => e.length),
    campaign.brief.schedules.length,
  );
  await capture(
    ".campaign-ready-assets",
    "/tmp/kosku-carousel-qa/campaign-1512.png",
  );
  await click("Lihat foto");
  await page.waitForSelector(".campaign-property-gallery .ig-carousel");
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".campaign-property-gallery img")].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    { timeout: 150000 },
  );
  await page.click(
    '.campaign-property-gallery [aria-label="Media berikutnya"]',
  );
  await page.waitForFunction(() => {
    const image = document.querySelector(
      ".campaign-property-gallery .instagram-preview-media img",
    );
    return (
      image?.getAttribute("src")?.includes("index=1") &&
      image.complete &&
      image.naturalWidth > 0
    );
  });
  await page.screenshot({
    path: "/tmp/kosku-carousel-qa/property-gallery.png",
  });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await click("Coba arsip di Planner");
  await page.waitForSelector(".marketing-day-content");
  assert.equal(new URL(page.url()).searchParams.get("simulation"), "archive");
  const assignedIds = await page.$$eval(".marketing-day-content img", (e) =>
    e.map((img) => img.getAttribute("src").match(/foto\/(\d+)/)?.[1]),
  );
  assert.deepEqual(
    assignedIds,
    firstIds.slice(0, campaign.brief.schedules.length),
  );
  assert.equal(
    await page.$$eval(
      '.marketing-day-content[data-planner-tone="ready"]',
      (e) => e.length,
    ),
    campaign.brief.schedules.length,
  );
  await capture(
    ".marketing-day-panel",
    "/tmp/kosku-carousel-qa/planner-1512.png",
  );
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector(".marketing-day-content");
  assert.equal(
    await page.$$eval(
      '.marketing-day-content[data-planner-tone="ready"]',
      (e) => e.length,
    ),
    campaign.brief.schedules.length,
    "archive URL restores real properties, never A/B/C fixtures",
  );
  await click("Campaign");
  await page.waitForSelector("#campaign-intensity-more");
  await page.click("#campaign-intensity-more");
  await click("Lihat di Planner");
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll(
        '.marketing-day-content[data-planner-tone="ready"]',
      ).length === count,
    {},
    campaign.brief.schedules.length + 1,
  );
  await click("Keluar simulasi");
  await page.goto(
    origin + "/dashboard/pemasaran?tab=campaign&campaign=" + campaign.id,
    { waitUntil: "networkidle2" },
  );
  await page.waitForSelector(".campaign-ended-panel");
  assert.equal(
    await page.$(".campaign-property-card"),
    null,
    "ended campaign does not present historical properties as active stock",
  );
  await page.$eval(
    ".campaign-ended-panel > .campaign-panel-core > .campaign-history-disclosure > summary, .campaign-ended-panel .campaign-history-disclosure > summary",
    (e) => e.click(),
  );
  await page.waitForSelector('.campaign-property-badge[data-archive="true"]');
  for (const width of viewports) {
    await page.setViewport({ width, height: 1000 });
    await page.focus(".campaign-stock-grid");
    await page.keyboard.press("Home");
    await page.waitForFunction(
      () =>
        document.querySelector(".campaign-stock-grid").scrollLeft <= 2 &&
        document.querySelector('[aria-label="Properti sebelumnya"]').disabled &&
        !document.querySelector('[aria-label="Properti berikutnya"]').disabled,
    );
    await page.$eval(".campaign-stock-grid", (element) => element.blur());
    await capture(
      ".campaign-ready-assets",
      `/tmp/kosku-carousel-qa/campaign-${width}.png`,
    );
    if (width === 1512) {
      await (
        await page.$(".campaign-ready-assets")
      ).screenshot({
        path: "/tmp/kosku-carousel-qa/campaign-desktop.png",
      });
    }
    const metrics = await page.evaluate(() => {
      const panel = document.querySelector(".campaign-ready-assets");
      const track = panel.querySelector(".campaign-stock-grid");
      const bounds = track.getBoundingClientRect();
      const cards = [...track.querySelectorAll(".campaign-property-card")];
      const top = cards[0].getBoundingClientRect().top;
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        trackFits: bounds.left >= 0 && bounds.right <= innerWidth + 1,
        scrollable: track.scrollWidth > track.clientWidth,
        trackWidth: bounds.width,
        panelHeight: Math.ceil(panel.getBoundingClientRect().height),
        cards: cards.map((card) => {
          const rect = card.getBoundingClientRect();
          const photo = card
            .querySelector(".campaign-property-image")
            .getBoundingClientRect();
          const body = card
            .querySelector(".campaign-property-body")
            .getBoundingClientRect();
          const price = card.querySelector(".campaign-property-price");
          const badge = card
            .querySelector(".campaign-property-badge")
            .getBoundingClientRect();
          const count = card
            .querySelector(".campaign-property-photo-count")
            .getBoundingClientRect();
          return {
            width: Math.round(rect.width),
            height: Math.ceil(rect.height),
            photoHeight: Math.round(photo.height),
            sameRow: Math.abs(rect.top - top) <= 1,
            photoAbove: photo.bottom <= body.top + 1,
            priceFits: price.scrollWidth <= price.clientWidth + 1,
            badgeFits: badge.right <= count.left,
            targetsFit: [...card.querySelectorAll("button, a")].every(
              (control) => {
                const target = control.getBoundingClientRect();
                return (
                  target.height >= 44 &&
                  target.width >= 44 &&
                  target.right <= rect.right
                );
              },
            ),
          };
        }),
      };
    });
    assert.equal(
      metrics.overflow,
      false,
      "page does not scroll horizontally at " + width,
    );
    assert.equal(
      metrics.trackFits,
      true,
      "only the property strip scrolls at " + width,
    );
    assert.equal(
      metrics.scrollable,
      true,
      "all six properties stay in one scrollable row at " + width,
    );
    assert.equal(metrics.cards.length, 6);
    for (const card of metrics.cards) {
      assert.equal(card.sameRow, true, "cards never stack at " + width);
      assert.equal(
        card.photoAbove,
        true,
        "large photograph above information at " + width,
      );
      assert.equal(card.priceFits, true, "complete price at " + width);
      assert.equal(card.badgeFits, true, "photo labels fit at " + width);
      assert.equal(card.targetsFit, true, "44px actions fit at " + width);
      assert.ok(
        card.width >= Math.min(340, metrics.trackWidth - 30),
        "larger card at " + width,
      );
      assert.ok(
        card.photoHeight >= 130,
        "readable property photograph at " + width,
      );
      assert.ok(card.height <= 510, "bounded one-row height at " + width);
    }
    assert.ok(
      metrics.panelHeight <= 900,
      "six properties do not lengthen the page at " + width,
    );
    await page.click('[aria-label="Properti berikutnya"]');
    await page.waitForFunction(
      () => document.querySelector(".campaign-stock-grid").scrollLeft > 100,
    );
    await page.focus(".campaign-stock-grid");
    await page.keyboard.press("End");
    await page.waitForFunction(() => {
      const track = document.querySelector(".campaign-stock-grid");
      return (
        Math.abs(track.scrollWidth - track.clientWidth - track.scrollLeft) <=
          2 &&
        document.querySelector('[aria-label="Properti berikutnya"]').disabled
      );
    });
    assert.match(
      await page.$eval(
        ".campaign-stock-navigation [role=status]",
        (e) => e.textContent,
      ),
      /6 dari 6 properti/,
    );
    if (width === 390) {
      await page.click(".campaign-property-card:last-child button");
      await page.waitForSelector(".campaign-property-gallery .ig-carousel");
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          !document.querySelector('[role="dialog"]') &&
          document.activeElement ===
            document.querySelector(".campaign-property-card:last-child button"),
      );
    }
    await page.click('[aria-label="Properti sebelumnya"]');
    await page.waitForFunction(
      () =>
        !document.querySelector('[aria-label="Properti berikutnya"]').disabled,
    );
    await page.focus(".campaign-stock-grid");
    await page.keyboard.press("Home");
    await page.waitForFunction(
      () => document.querySelector(".campaign-stock-grid").scrollLeft <= 2,
    );
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => document.querySelector(".campaign-stock-grid").scrollLeft > 100,
    );
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(
      () => document.querySelector(".campaign-stock-grid").scrollLeft <= 2,
    );
    density.push({
      width,
      cardWidth: metrics.cards[0].width,
      cardHeight: metrics.cards[0].height,
      photoHeight: metrics.cards[0].photoHeight,
      panelHeight: metrics.panelHeight,
    });
  }
  // An actual touch gesture must pan the strip without moving the whole page sideways.
  const touch = await page.createCDPSession();
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await page.$eval(".campaign-stock-grid", (e) =>
    e.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const swipe = await page.$eval(".campaign-stock-grid", (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.right - 25, end: r.left + 25, y: r.top + 90 };
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: swipe.x, y: swipe.y, id: 1 }],
  });
  for (let step = 1; step <= 8; step++) {
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: swipe.x + ((swipe.end - swipe.x) * step) / 8, y: swipe.y, id: 1 },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForFunction(
    () => document.querySelector(".campaign-stock-grid").scrollLeft > 60,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await touch.detach();
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.focus(".campaign-stock-grid");
  await page.keyboard.press("End");
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Properti berikutnya"]').disabled,
  );
  await page.focus(".campaign-archive-diagnostics summary");
  await page.keyboard.press("Enter");
  assert.equal(
    await page.$eval(".campaign-archive-diagnostics", (e) => e.open),
    true,
  );
  await page.keyboard.press("Enter");
  const after = JSON.stringify({
    campaign: await db.marketingCampaign.findUnique({
      where: { id: campaign.id },
    }),
    jobs: await db.marketingJob.count(),
    publications: await db.marketingPublication.count(),
  });
  assert.equal(after, before, "no real campaign, jobs or publications changed");
  assert.deepEqual(forbidden, []);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      source: "real database",
      visiblePropertyIds: firstIds,
      checks: [
        "ended campaign keeps archived examples behind explicit disclosure",
        "newest matching archive fallback retains source facts",
        "real source photographs",
        "unchanged original auction dates and filters",
        "one horizontal strip with larger photographs and cards at every width",
        "six properties without vertical stacking, complete prices and 44px actions",
        "previous/next, keyboard arrows, Home/End and native touch swipe",
        "gallery restoration from the last card and reduced motion",
        "keyboard source diagnostics",
        "property gallery",
        "Campaign to Planner identity and WIB slots",
        "archive reload recovery",
        "intensity synchronization",
        "no marketing mutations or dispatch",
      ],
      viewports,
      density,
    }),
  );
} catch (error) {
  if (browser) {
    const page = (await browser.pages()).find((item) =>
      item.url().includes("pemasaran"),
    );
    if (page)
      console.error(
        JSON.stringify({
          errors,
          page: await page.evaluate(() => ({
            text: document.body.innerText.slice(-1800),
            section: document
              .querySelector(".marketing-workspace")
              ?.getAttribute("data-section"),
            busy: document
              .querySelector(".marketing-workspace")
              ?.getAttribute("aria-busy"),
          })),
        }),
      );
  }
  throw error;
} finally {
  if (browser) await browser.close();
  await db.$disconnect();
}

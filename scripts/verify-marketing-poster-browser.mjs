// Authenticated browser fixtures. All marketing writes and external requests are blocked.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";
import createLoader from "./lib/marketing-test-loader.cjs";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3041";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const { DEFAULT_CONFIG, captionFor } = createLoader()(
  "src/lib/marketing/domain.ts",
);
const asset = {
  id: "contoh-desain",
  title: "CONTOH DESAIN · Gudang untuk langkah berikutnya",
  address: "Alamat pengujian pratinjau poster",
  city: "Lampung Timur",
  category: "LELANG",
  propertyType: "GUDANG",
  price: 40328160000,
  landArea: 71992,
  certificateType: "SHM",
  auctionDate: "2026-12-20T02:00:00Z",
  listingUrl: "/Lelang/contoh-desain",
  images: [],
  revision: "qa",
};
const config = { ...DEFAULT_CONFIG, companyName: "Akun pengujian poster" };
const job = {
  id: "a0000000-0000-0000-0000-000000000001",
  listingId: asset.id,
  scheduledFor: "2026-11-12T02:00:00Z",
  status: "queued",
  reason: null,
  caption: captionFor(asset, config),
  snapshot: asset,
  media: [
    { name: "feed.jpg", channel: "instagram", width: 1080, height: 1350 },
    ...[1, 2, 3].map((i) => ({
      name: `photo-${i}.jpg`,
      channel: "instagram",
      width: 1080,
      height: 1350,
    })),
    { name: "story.jpg", channel: "whatsapp", width: 1080, height: 1920 },
  ],
  publications: [],
};
const planner = {
  month: "2026-11",
  jobs: [job],
  now: "2026-11-02T02:00:00Z",
  campaignPeriods: [],
  pendingCampaigns: [],
};
const seed = {
  config,
  planner,
  jobs: { items: [job], total: 1, page: 1, pageSize: 20 },
  summary: {
    nextSlot: null,
    lastTickAt: null,
    lastError: null,
    needsReview: 0,
    published: [],
  },
  connection: {
    instagram: { connected: false, configured: false, setup: { checks: [] } },
    whatsapp: { connected: false, tested: false, contacts: [], phone: null },
  },
};
const db = new PrismaClient();
let browser, page;
let stage = "owner-read";
const errors = [],
  writes = [];
try {
  const owner = await db.agent.findFirstOrThrow({
    where: {
      jabatan: "OWNER",
      status_keanggotaan: "AKTIF",
      pengguna: { status_akun: "AKTIF", peran: "AGENT" },
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
      process.env.MARKETING_QA_BROWSER ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
  });
  page = await browser.newPage();
  await page.setCacheEnabled(false);
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(180000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setCookie({
    name: cookieName,
    value: token,
    url: origin,
    secure: cookieName.startsWith("__Secure-"),
    httpOnly: true,
  });
  await page.setRequestInterception(true);
  let brokenPhoto = false;
  const feed = await fs.readFile(
    "docs/previews/marketing-instagram-poster.jpg",
  );
  const story = await fs.readFile("docs/previews/marketing-whatsapp-story.jpg");
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin && !["data:", "blob:"].includes(url.protocol))
      return request.abort();
    const json = (body, status = 200) =>
      request.respond({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (url.pathname === "/api/dashboard/pemasaran") {
      if (request.method() !== "GET") {
        writes.push(url.pathname);
        return json({ error: "QA_WRITE_BLOCKED" }, 403);
      }
      return json(url.searchParams.get("mode") === "planner" ? planner : seed);
    }
    if (url.pathname === "/api/dashboard/pemasaran/media") {
      if (brokenPhoto && url.searchParams.get("name") === "photo-2.jpg")
        return request.respond({ status: 404, body: "" });
      return request.respond({
        status: 200,
        contentType: "image/jpeg",
        body: url.searchParams.get("name") === "story.jpg" ? story : feed,
      });
    }
    if (
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/auth/")
    ) {
      if (request.method() !== "GET") writes.push(url.pathname);
      return json({ items: [], total: 0 });
    }
    return request.continue();
  });
  const openPreview = async () => {
    stage = "open-preview";
    await page.click(".marketing-history > summary");
    await page.waitForSelector(".marketing-job-list .marketing-action");
    await page.click(".marketing-job-list .marketing-action");
    await page.waitForSelector(".marketing-preview-modal");
    await page.waitForFunction(
      () =>
        document.querySelector(
          ".marketing-preview-modal .instagram-preview-media img",
        )?.naturalWidth > 0,
    );
  };
  await page.setViewport({ width: 1440, height: 1100 });
  stage = "navigation";
  console.log("QA: opening local Pemasaran fixture");
  await page.goto(
    origin + "/dashboard/pemasaran?tab=planner&month=2026-11&date=2026-11-12",
    { waitUntil: "networkidle2" },
  );
  await openPreview();
  console.log("QA: carousel, caption and copy");
  stage = "carousel-copy";
  assert.equal(
    await page.$$eval(
      ".marketing-preview-modal .ig-slide-thumbnails button",
      (els) => els.length,
    ),
    4,
  );
  assert.match(
    await page.$eval(".marketing-preview-images", (el) => el.textContent),
    /4:5.*4 slide/,
  );
  assert.match(
    await page.$eval(".marketing-preview-images", (el) => el.textContent),
    /9:16.*1 poster/,
  );
  await page.focus(".marketing-preview-modal .ig-carousel");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    () =>
      document.querySelector(".ig-slide-description strong")?.textContent ===
      "Foto detail 1",
  );
  await page.click(
    '.marketing-preview-modal [aria-label="Lihat slide 4: Foto detail 3"]',
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".ig-slide-description strong")?.textContent ===
      "Foto detail 3",
  );
  assert.equal(
    await page.$eval('[aria-label="Media berikutnya"]', (el) => el.disabled),
    true,
  );
  assert.equal(
    await page.$eval(".marketing-caption", (el) => el.textContent),
    job.caption,
  );
  await page.evaluate(() => {
    window.__copiedCaption = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedCaption = text;
        },
      },
    });
  });
  await page.evaluate(() =>
    [...document.querySelectorAll(".marketing-preview-modal button")]
      .find((el) => el.textContent === "Salin caption")
      .click(),
  );
  await page.waitForFunction(() => window.__copiedCaption.length > 0);
  assert.equal(await page.evaluate(() => window.__copiedCaption), job.caption);
  const downloads = await page.$$eval(".marketing-download", (els) =>
    els.map((el) => ({ download: el.download, href: el.getAttribute("href") })),
  );
  assert.equal(downloads.length, 2);
  assert.ok(
    downloads.every(
      (el) =>
        el.download && el.href.startsWith("/api/dashboard/pemasaran/media?"),
    ),
  );
  await page.screenshot({
    path: "docs/previews/marketing-preview-desktop.png",
  });
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  await page.evaluate(() =>
    [...document.querySelectorAll(".marketing-preview-modal button")]
      .find((el) => el.textContent === "Salin caption")
      .click(),
  );
  await page.waitForFunction(() =>
    document.body.textContent.includes(
      "Pilih teks caption lalu salin secara manual",
    ),
  );
  brokenPhoto = true;
  console.log("QA: image failure and phone layout");
  stage = "image-failure";
  await page.click(
    '.marketing-preview-modal [aria-label="Lihat slide 3: Foto detail 2"]',
  );
  // A decoded thumbnail may keep the same resource alive in Chromium's image cache.
  // Give the failed network response its own URL while exercising the real onError.
  await page.$eval(".instagram-preview-media img", (image) => {
    image.src += "&qaFailure=1";
  });
  await page.waitForSelector(".instagram-preview-fallback");
  await page.click('[aria-label="Media sebelumnya"]');
  await page.waitForFunction(
    () =>
      document.querySelector(".instagram-preview-media img")?.naturalWidth > 0,
  );
  for (const width of [390, 320]) {
    stage = "viewport-" + width;
    await page.setViewport({ width, height: 844 });
    assert.equal(
      await page.$eval(
        ".marketing-preview-modal",
        (el) => el.scrollWidth > el.clientWidth,
      ),
      false,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `docs/previews/marketing-preview-${width}.png`,
    });
  }
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !document.querySelector(".marketing-preview-modal"),
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent.trim()),
    "Materi",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(
    "PASS: preview 4 slides, keyboard/thumbnails, full caption, copy success/failure, downloads, broken-photo recovery, 1440/390/320px, reduced motion, Escape/focus return; zero writes.",
  );
} catch (error) {
  console.error("QA failed at", stage, error.message);
  await page
    ?.screenshot({ path: "/tmp/kosku-social-preview-failure.png" })
    .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await db.$disconnect();
}

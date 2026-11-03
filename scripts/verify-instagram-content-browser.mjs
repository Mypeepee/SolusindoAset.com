// All Instagram requests are intercepted locally. No external side effect is permitted.
import assert from "node:assert/strict";
import fs from "node:fs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const db = new PrismaClient();
let browser;
const capabilities = {
  insights: true,
  comments: true,
  deleteMedia: true,
  verified: true,
  missing: [],
};
const post = {
  id: "18011111111111111",
  caption:
    "Konten simulasi untuk pengujian pengelolaan Instagram.\nCaption lengkap tetap dapat dibaca pada detail konten.",
  type: "CAROUSEL_ALBUM",
  product: "FEED",
  mediaUrl: origin + "/images/hero/pasinan1.jpg",
  thumbnailUrl: null,
  permalink: "https://www.instagram.com/p/fixture/",
  timestamp: "2026-10-28T02:00:00.000Z",
  likes: 12,
  comments: 2,
  commentsEnabled: true,
};
const second = {
  ...post,
  id: "18022222222222222",
  type: "VIDEO",
  product: "REELS",
  mediaUrl: null,
  thumbnailUrl: origin + "/images/hero/rungkut.jpg",
  caption: "Reel simulasi pengujian",
};
const comment = {
  id: "17911111111111111",
  text: "Komentar simulasi pengujian.",
  username: "fixture_user",
  timestamp: "2026-10-28T03:00:00Z",
  hidden: false,
  likes: 0,
};
const reply = {
  ...comment,
  id: "17922222222222222",
  username: "fixture_company",
  text: "Balasan simulasi.",
};
const list = {
  account: {
    id: "17841411111111111",
    username: "fixture_company",
    name: "Akun simulasi pengujian",
    picture: null,
    followers: 100,
    following: 20,
    mediaCount: 2,
  },
  items: [post],
  after: "fixture_next",
  capabilities,
  fetchedAt: "2026-10-28T04:00:00.000Z",
};
let scenario = "success",
  delayed = false,
  deleted = false;
const writes = [],
  pageErrors = [],
  report = [];
try {
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
  const name = process.env.NEXTAUTH_URL?.startsWith("https:")
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  const dashboardResponse = await fetch(origin + "/api/dashboard/pemasaran", {
    headers: { Cookie: name + "=" + token },
  });
  assert.equal(dashboardResponse.status, 200);
  const dashboard = await dashboardResponse.json();
  const before =
    await db.$queryRaw`SELECT count(*)::int AS count FROM marketing_instagram_actions`;
  browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.MARKETING_QA_BROWSER ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setCookie({
    name,
    value: token,
    url: origin,
    httpOnly: true,
    secure: name.startsWith("__Secure-"),
  });
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    try {
      const url = new URL(request.url());
      if (!["data:", "blob:"].includes(url.protocol) && url.origin !== origin)
        return request.abort();
      const json = (body, status = 200) =>
        request.respond({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (url.pathname === "/api/dashboard/pemasaran/instagram/content") {
        if (request.method() === "POST") {
          const body = JSON.parse(request.postData());
          writes.push(body);
          if (scenario === "write-error")
            return json({ error: "PROVIDER_ERROR" }, 503);
          if (scenario === "uncertain")
            return json({ error: "INSTAGRAM_ACTION_UNCERTAIN" }, 409);
          if (body.action === "delete-media") deleted = true;
          return json({ success: true, id: "17933333333333333" });
        }
        if (delayed) await new Promise((resolve) => setTimeout(resolve, 1200));
        if (scenario === "read-error")
          return json({ error: "RATE_LIMIT" }, 503);
        const mode = url.searchParams.get("mode");
        if (mode === "detail")
          return json({
            media: post,
            children: [
              post,
              {
                ...post,
                id: "18033333333333333",
                type: "IMAGE",
                mediaUrl: origin + "/images/hero/rungkut.jpg",
              },
            ],
            capabilities:
              scenario === "permissions"
                ? { ...capabilities, comments: false, deleteMedia: false }
                : capabilities,
            insights: [
              "views",
              "reach",
              "likes",
              "comments",
              "saved",
              "shares",
              "total_interactions",
            ].map((name) => ({
              name,
              value: name === "saved" ? null : name === "views" ? 0 : 20,
              issue: name === "saved" ? "METRICS_UNAVAILABLE" : null,
            })),
            fetchedAt: list.fetchedAt,
          });
        if (mode === "comments")
          return json({
            items: scenario === "empty-comments" ? [] : [comment],
            after: "fixture_comment_next",
          });
        if (mode === "replies") return json({ items: [reply], after: null });
        if (mode === "stories" || scenario === "empty")
          return json({ ...list, items: [], after: null });
        return json({
          ...list,
          capabilities:
            scenario === "permissions"
              ? { ...capabilities, comments: false, deleteMedia: false }
              : capabilities,
          items: deleted
            ? []
            : url.searchParams.get("after")
              ? [second]
              : [post],
          after: url.searchParams.get("after") ? null : "fixture_next",
        });
      }
      if (url.pathname === "/api/dashboard/pemasaran") return json(dashboard);
      if (request.method() !== "GET" && url.pathname.startsWith("/api/"))
        return json({ error: "QA_EXTERNAL_WRITE_BLOCKED" }, 403);
      return request.continue();
    } catch (error) {
      if (!request.isInterceptResolutionHandled()) await request.abort();
      pageErrors.push("interception: " + error.message);
    }
  });
  const text = (selector) => page.$eval(selector, (node) => node.textContent);
  async function click(label, scope = "body") {
    await page.waitForFunction(
      ({ label, scope }) =>
        [
          ...(document.querySelector(scope)?.querySelectorAll("button") || []),
        ].some(
          (node) =>
            (node.textContent.trim() === label ||
              node.getAttribute("aria-label") === label) &&
            node.getClientRects().length &&
            !node.disabled,
        ),
      {},
      { label, scope },
    );
    const found = await page.evaluate(
      ({ label, scope }) => {
        const root = document.querySelector(scope);
        const button = [...root.querySelectorAll("button")].find(
          (node) =>
            (node.textContent.trim() === label ||
              node.getAttribute("aria-label") === label) &&
            node.getClientRects().length &&
            !node.disabled,
        );
        if (!button) return false;
        button.click();
        return true;
      },
      { label, scope },
    );
    assert.ok(found, "Enabled button: " + label);
  }
  async function navigate() {
    await page.goto(
      origin + "/dashboard/pemasaran?tab=instagram&igSource=live",
      {
        waitUntil: "networkidle2",
      },
    );
    await page.waitForSelector(".instagram-workspace");
  }
  async function pointerClick(label, scope = ".marketing-small-modal") {
    const handle = await page.evaluateHandle(
      ({ label, scope }) =>
        [...document.querySelector(scope).querySelectorAll("button")].find(
          (button) => button.textContent.trim() === label && !button.disabled,
        ),
      { label, scope },
    );
    assert.ok(handle.asElement(), "Clickable button: " + label);
    await handle.asElement().click();
    await handle.dispose();
  }
  delayed = true;
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(origin + "/dashboard/pemasaran?tab=instagram&igSource=live", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".ig-loading");
  delayed = false;
  await page.waitForSelector(".instagram-card");
  assert.match(await text(".instagram-account"), /fixture_company/);
  await click("Muat lebih banyak");
  await page.waitForFunction(
    () => document.querySelectorAll(".instagram-card").length === 2,
  );
  await click("Reel", ".instagram-filters");
  assert.equal(
    await page.$$eval(".instagram-card", (nodes) => nodes.length),
    1,
  );
  await click("Semua", ".instagram-filters");
  // A user can delete directly from a card without opening analytics first.
  assert.equal(
    await page.$$eval(".ig-card-actions button", (buttons) => buttons.length),
    2,
  );
  await page.setViewport({ width: 320, height: 844 });
  await page.click(".ig-card-actions button");
  await page.waitForSelector(".instagram-delete-dialog");
  assert.equal(await page.$(".instagram-detail-modal"), null);
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent.trim()),
    "Batal",
  );
  assert.match(await text(".ig-delete-preview"), /Konten simulasi/);
  await page.screenshot({
    path: "docs/previews/instagram-direct-delete-confirmation-320.png",
  });
  await pointerClick("Batal");
  await page.waitForFunction(
    () => !document.querySelector(".instagram-delete-dialog"),
  );
  await page.waitForFunction(
    () => document.activeElement?.closest(".ig-card-actions") !== null,
  );
  assert.equal(
    writes.filter((item) => item.action === "delete-media").length,
    0,
  );
  await page.screenshot({
    path: "docs/previews/instagram-direct-delete-320.png",
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "docs/previews/instagram-direct-delete-desktop.png",
  });
  report.push(
    "visible labelled delete on every live card; one-click confirmation without analytics; phone cancellation restores card focus",
  );
  await page.type("#instagram-content-search", "tidak-cocok");
  await page.waitForSelector(".ig-empty");
  await page.click('[aria-label="Hapus pencarian konten"]');
  assert.equal(
    await page.$eval("#instagram-content-search", (node) => node.value),
    "",
  );
  assert.equal(
    await page.$eval(
      "#instagram-content-search",
      (node) => document.activeElement === node,
    ),
    true,
  );
  await page.screenshot({
    path: "/tmp/kosku-instagram-desktop.png",
    fullPage: true,
  });
  await click("Analitik & kelola");
  await page.waitForSelector(".instagram-metrics");
  assert.match(await text(".instagram-metrics"), /Belum tersedia/);
  assert.match(await text(".instagram-metrics"), /Tayangan0/);
  await page.click('.instagram-detail-modal [aria-label="Media berikutnya"]');
  assert.match(
    await text(".instagram-detail-modal .instagram-gallery-nav"),
    /02 \/ 02/,
  );
  await click("Komentar", ".instagram-detail-content");
  await page.waitForSelector(".instagram-comment");
  await click("Lihat balasan");
  await page.waitForSelector(".instagram-replies .instagram-comment");
  await click("Sembunyikan", ".instagram-comment");
  await page.waitForFunction(
    () =>
      document.querySelector(".instagram-comment").dataset.hidden === "true",
  );
  await click("Tampilkan", ".instagram-comment");
  await click("Nonaktifkan");
  await click("Aktifkan");
  await click("Balas", ".instagram-comment");
  await page.type("#instagram-reply", "Balasan fixture browser");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role="dialog"]')].some((node) =>
      node.textContent.includes("Buang draf balasan?"),
    ),
  );
  await click("Lanjut menulis");
  assert.equal(
    await page.$eval("#instagram-reply", (node) => node.value),
    "Balasan fixture browser",
  );
  await click("Kirim balasan");
  await page.waitForFunction(() => !document.querySelector("#instagram-reply"));
  assert.equal(writes.filter((item) => item.action === "reply").length, 1);
  await click("Hapus", ".instagram-comment");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent.trim()),
    "Batal",
  );
  await click("Batal");
  await click("Hapus", ".instagram-comment");
  await click("Hapus komentar");
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('[role="dialog"]')].some((node) =>
        node.textContent.includes("Hapus komentar?"),
      ),
  );
  await click("Hapus dari Instagram");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent.trim()),
    "Batal",
  );
  const beforeDelete = writes.filter(
    (item) => item.action === "delete-media",
  ).length;
  await page.evaluate(() => {
    window.__instagramNativeUuid = crypto.randomUUID;
    window.__instagramNativeRandom = crypto.getRandomValues;
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(crypto, "getRandomValues", {
      configurable: true,
      value: undefined,
    });
  });
  await pointerClick("Hapus postingan");
  await page.waitForFunction(() =>
    document
      .querySelector(".marketing-small-modal .marketing-error")
      ?.textContent.includes("Permintaan belum dikirim"),
  );
  assert.equal(
    writes.filter((item) => item.action === "delete-media").length,
    beforeDelete,
  );
  await page.evaluate(() =>
    Object.defineProperty(crypto, "getRandomValues", {
      configurable: true,
      value: window.__instagramNativeRandom,
    }),
  );
  scenario = "write-error";
  await pointerClick("Hapus postingan");
  await page.waitForFunction(() =>
    document
      .querySelector(".marketing-small-modal .marketing-error")
      ?.textContent.includes("Instagram belum dapat"),
  );
  assert.ok(await page.$(".marketing-small-modal"));
  scenario = "success";
  await pointerClick("Hapus postingan");
  await page.waitForFunction(
    () => !document.querySelector(".instagram-detail-modal"),
  );
  const deletes = writes.filter((item) => item.action === "delete-media");
  assert.equal(deletes.length, 2);
  assert.equal(deletes[0].requestId, deletes[1].requestId);
  assert.match(
    deletes[0].requestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  await page.evaluate(() =>
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: window.__instagramNativeUuid,
    }),
  );
  report.push(
    "real pointer deletion, no native randomUUID, CSPRNG fallback, pre-send error recovery and stable retry ID",
  );
  report.push(
    "loading, pagination, filter/search/clear, media gallery, analytics null/zero, replies, hide/show, comment toggle, draft guard, reply, delete confirmations and failure recovery",
  );
  deleted = false;
  scenario = "success";
  await navigate();
  await page.click(".ig-card-actions button");
  await page.waitForSelector(".instagram-delete-dialog");
  assert.equal(await page.$(".instagram-detail-modal"), null);
  await pointerClick("Hapus postingan");
  await page.waitForFunction(
    () => !document.querySelector(".instagram-delete-dialog"),
  );
  await page.waitForSelector(".ig-empty");
  assert.equal(
    writes.filter((item) => item.action === "delete-media").length,
    3,
  );
  report.push(
    "direct gallery deletion succeeds, closes confirmation and refreshes the empty library",
  );
  deleted = false;
  scenario = "success";
  await navigate();
  await click("Analitik & kelola");
  await page.waitForSelector(".instagram-metrics");
  await click("Komentar", ".instagram-detail-content");
  await page.waitForSelector(".instagram-comment");
  await click("Balas", ".instagram-comment");
  await page.type(
    "#instagram-reply",
    "Draf dengan hasil pengiriman belum pasti",
  );
  const repliesBefore = writes.filter((item) => item.action === "reply").length;
  scenario = "uncertain";
  await click("Kirim balasan");
  await page.waitForFunction(
    () =>
      document.querySelector("#instagram-reply")?.disabled &&
      document
        .querySelector('.instagram-composer button[type="submit"]')
        ?.getAttribute("aria-busy") === "false",
  );
  assert.equal(
    await page.$eval("#instagram-reply", (node) => node.value),
    "Draf dengan hasil pengiriman belum pasti",
  );
  assert.equal(
    writes.filter((item) => item.action === "reply").length,
    repliesBefore + 1,
  );
  assert.equal(
    await page.$eval(
      '.instagram-composer button[type="submit"]',
      (node) => node.disabled,
    ),
    true,
  );
  await page.keyboard.press("Escape");
  await click("Buang draf");
  report.push("uncertain reply retains draft and prevents blind resubmission");
  scenario = "permissions";
  await navigate();
  await click("Analitik & kelola");
  await page.waitForSelector(".instagram-manage");
  assert.equal(
    await page.$eval(
      ".instagram-manage .instagram-danger",
      (node) => node.disabled,
    ),
    true,
  );
  await page.keyboard.press("Escape");
  scenario = "read-error";
  await navigate();
  await page.waitForSelector(".instagram-notice.marketing-error");
  scenario = "empty";
  await navigate();
  await page.waitForSelector(".instagram-workspace .ig-empty");
  scenario = "success";
  await navigate();
  await click("Story aktif");
  await page.waitForFunction(() =>
    document
      .querySelector(".ig-empty")
      ?.textContent.includes("Belum ada Story aktif"),
  );
  report.push(
    "permission restrictions, rate limit/retry, empty media, active-story empty state",
  );
  for (const width of [390, 320]) {
    await page.setViewport({ width, height: 844 });
    await navigate();
    await page.waitForSelector(".instagram-card");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      "No page overflow at " + width,
    );
    await click("Analitik & kelola");
    await page.waitForSelector(".instagram-metrics");
    assert.equal(
      await page.$eval(
        ".instagram-detail-modal",
        (node) => node.getBoundingClientRect().width <= window.innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `/tmp/kosku-instagram-mobile-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.$eval(
        ".instagram-detail-layout",
        (node) => node.scrollWidth <= node.clientWidth + 1,
      ),
      true,
    );
    await page.$eval(".instagram-detail-layout", (node) => {
      node.scrollTop = node.scrollHeight;
    });
    assert.equal(
      await page.$eval(".instagram-manage .instagram-danger", (node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom <= window.innerHeight && rect.top >= 0;
      }),
      true,
      "Delete action is reachable on mobile",
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector(".instagram-detail-modal"),
    );
  }
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await navigate();
  await page.focus("#instagram-content-search");
  await page.keyboard.press("Tab");
  assert.ok(
    await page.evaluate(() => document.activeElement.tagName === "BUTTON"),
  );
  assert.equal(
    await page.$eval(
      ".ig-picker-photo img",
      (node) => getComputedStyle(node).transitionDuration,
    ),
    "0s",
  );
  report.push(
    "320/390px no overflow, mobile detail, keyboard focus, reduced motion",
  );
  assert.deepEqual(pageErrors, []);
  const after =
    await db.$queryRaw`SELECT count(*)::int AS count FROM marketing_instagram_actions`;
  assert.deepEqual(after, before);
  const result = {
    verified: true,
    checks: report,
    simulatedWrites: writes.length,
    actualInstagramWrites: 0,
    pageErrors,
  };
  fs.writeFileSync(
    "/tmp/kosku-instagram-browser-report.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  if (browser) await browser.close();
  await db.$disconnect();
}

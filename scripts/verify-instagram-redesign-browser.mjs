// Read-only account setup; example content and all mutations stay local to the browser.
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
  const cookieName = process.env.NEXTAUTH_URL?.startsWith("https:")
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  const headers = { Cookie: cookieName + "=" + token };
  const dashboardResponse = await fetch(origin + "/api/dashboard/pemasaran", {
    headers,
  });
  assert.equal(dashboardResponse.status, 200);
  const dashboard = await dashboardResponse.json();
  const fixture = {
    account: {
      id: "17841411111111111",
      username: "fixture_company",
      name: "Akun pengujian",
      picture: null,
      followers: 1234,
      following: 20,
      mediaCount: 0,
    },
    items: [],
    after: null,
    capabilities: {
      insights: true,
      comments: true,
      deleteMedia: true,
      verified: true,
      missing: [],
    },
    fetchedAt: "2026-11-02T02:00:00.000Z",
  };
  const before =
    await db.$queryRaw`SELECT count(*)::int AS count FROM marketing_instagram_actions`;
  const requests = [],
    errors = [];
  browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.MARKETING_QA_BROWSER ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setCookie({
    name: cookieName,
    value: token,
    url: origin,
    secure: cookieName.startsWith("__Secure-"),
    httpOnly: true,
  });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
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
      requests.push({
        method: request.method(),
        mode: url.searchParams.get("mode"),
        mediaId: url.searchParams.get("mediaId"),
      });
      assert.equal(
        request.method(),
        "GET",
        "Examples must never dispatch a mutation",
      );
      assert.ok(
        ["media", "stories"].includes(url.searchParams.get("mode") || "media"),
        "Example detail and comments must never call the API",
      );
      return json(fixture);
    }
    if (url.pathname === "/api/dashboard/pemasaran") return json(dashboard);
    if (request.method() !== "GET" && url.pathname.startsWith("/api/"))
      return json({ error: "QA_WRITE_BLOCKED" }, 403);
    return request.continue();
  });
  async function click(text, scope = "body") {
    await page.waitForFunction(
      ({ text, scope }) =>
        [
          ...(document.querySelector(scope)?.querySelectorAll("button") || []),
        ].some(
          (node) =>
            (node.textContent.trim() === text ||
              node.getAttribute("aria-label") === text) &&
            !node.disabled &&
            node.getClientRects().length,
        ),
      {},
      { text, scope },
    );
    await page.evaluate(
      ({ text, scope }) =>
        [...document.querySelector(scope).querySelectorAll("button")]
          .find(
            (node) =>
              (node.textContent.trim() === text ||
                node.getAttribute("aria-label") === text) &&
              !node.disabled &&
              node.getClientRects().length,
          )
          .click(),
      { text, scope },
    );
  }
  async function navigate(query = "&igSource=examples") {
    await page.goto(origin + "/dashboard/pemasaran?tab=instagram" + query, {
      waitUntil: "networkidle2",
    });
    await page.waitForSelector(
      '.instagram-studio[data-source="examples"] .ig-post-card',
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".ig-carousel img")].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
  }
  await page.setViewport({ width: 1512, height: 1200 });
  // No source parameter must show the actual empty account, never sample posts.
  await page.goto(origin + "/dashboard/pemasaran?tab=instagram", {
    waitUntil: "networkidle2",
  });
  await page.waitForSelector('.instagram-studio[data-source="live"] .ig-empty');
  assert.equal(await page.$(".ig-example-banner"), null);
  assert.equal(await page.$$eval(".ig-post-card", (nodes) => nodes.length), 0);
  await navigate();
  assert.equal(await page.$$eval(".ig-post-card", (nodes) => nodes.length), 3);
  assert.match(
    await page.$eval(".ig-example-banner", (node) => node.textContent),
    /ilustrasi/,
  );
  assert.match(
    await page.$eval(
      ".ig-studio-heading",
      (node) => getComputedStyle(node).fontFamily,
    ),
    /Instagram Jakarta/,
  );
  assert.equal(
    await page.$eval(
      ".instagram-studio",
      (node) => getComputedStyle(node).backgroundColor,
    ),
    "rgb(9, 27, 24)",
  );
  assert.match(
    await page.$eval(".ig-carousel .instagram-preview-media img", (node) =>
      node.getAttribute("src"),
    ),
    /example-business.jpg/,
  );
  assert.equal(
    await page.$$eval(".ig-slide-thumbnails button", (nodes) => nodes.length),
    4,
  );
  assert.equal(
    await page.$eval(
      ".ig-gallery-panel",
      (node) => getComputedStyle(node).backgroundColor,
    ),
    "rgba(0, 0, 0, 0)",
  );
  assert.equal(
    await page.$eval(
      ".ig-review-artwork .instagram-preview-media img",
      (node) => {
        const image = node.getBoundingClientRect();
        const frame = node.parentElement.getBoundingClientRect();
        return (
          getComputedStyle(node).objectFit === "contain" &&
          image.height <= frame.height + 1 &&
          image.width <= frame.width + 1
        );
      },
    ),
    true,
    "Inspector must show the whole media without a grid-item crop",
  );
  await click("Media berikutnya", ".ig-review-artwork");
  assert.match(
    await page.$eval(".ig-carousel .instagram-preview-media img", (node) =>
      node.getAttribute("src"),
    ),
    /pasinan1.jpg/,
  );
  await page.focus(".ig-review-artwork .ig-carousel");
  await page.keyboard.press("ArrowRight");
  assert.match(
    await page.$eval(".ig-carousel .instagram-preview-media img", (node) =>
      node.getAttribute("src"),
    ),
    /pasinan2.jpg/,
  );
  await click("Lihat slide 4: Akses sekitar");
  assert.match(
    await page.$eval(".ig-carousel .instagram-preview-media img", (node) =>
      node.getAttribute("src"),
    ),
    /pasinan3.jpg/,
  );
  await page.click(".ig-post-card:nth-child(2) .ig-post-preview");
  assert.match(
    await page.$eval(".ig-review-info h3", (node) => node.textContent),
    /Rumah Unimas/,
  );
  assert.match(
    await page.$eval(".ig-carousel .instagram-preview-media img", (node) =>
      node.getAttribute("src"),
    ),
    /example-home.jpg/,
  );
  await click("Media berikutnya", ".ig-review-artwork");
  assert.match(
    await page.$eval(".ig-carousel .instagram-preview-media img", (node) =>
      node.getAttribute("src"),
    ),
    /unimas2.jpg/,
  );
  await page.click(".ig-post-card:first-child .ig-post-preview");
  await page.setViewport({ width: 1512, height: 1600 });
  await (
    await page.$(".instagram-studio")
  ).screenshot({ path: "/tmp/kosku-instagram-carousel-workspace.png" });
  await page.setViewport({ width: 1512, height: 1100 });
  await click("Analitik & kelola");
  await page.waitForSelector(".ig-detail-example-label");
  assert.match(
    await page.$eval(".instagram-metrics", (node) => node.textContent),
    /Tayangan4.820/,
  );
  assert.equal(await page.$(".instagram-manage"), null);
  await click("Media berikutnya", ".instagram-detail-modal");
  assert.match(
    await page.$eval(
      ".instagram-detail-modal .instagram-preview-media img",
      (node) => node.getAttribute("src"),
    ),
    /pasinan1.jpg/,
  );
  await click("Komentar", ".instagram-detail-content");
  await page.waitForSelector(".ig-example-comments");
  assert.equal(await page.$(".ig-example-comments form"), null);
  await page.screenshot({ path: "/tmp/kosku-instagram-carousel-detail.png" });
  await page.keyboard.press("Escape");
  await page.waitForSelector(".instagram-detail-modal", { hidden: true });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.focus("#instagram-content-search");
  await page.type("#instagram-content-search", "Rumah Unimas");
  await page.waitForFunction(
    () => document.querySelectorAll(".ig-post-card").length === 1,
  );
  assert.equal(await page.$$eval(".ig-post-card", (nodes) => nodes.length), 1);
  await page.click('[aria-label="Hapus pencarian konten"]');
  await page.click(".ig-source-control button:first-child");
  await page.waitForSelector(".ig-empty");
  assert.equal(await page.$$eval(".ig-post-card", (nodes) => nodes.length), 0);
  await click("Contoh carousel");
  assert.equal(await page.$$eval(".ig-post-card", (nodes) => nodes.length), 3);
  for (const width of [1280, 1024, 768, 390, 320]) {
    await page.setViewport({ width, height: 940 });
    await navigate("&igSource=examples");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Document overflow at ${width}`,
    );
    assert.equal(
      await page.$eval(
        ".ig-review-layout",
        (node) => node.scrollWidth <= node.clientWidth + 1,
      ),
      true,
      `Review overflow at ${width}`,
    );
    if (width <= 390) {
      await page.setViewport({ width, height: 3000 });
      await (
        await page.$(".instagram-studio")
      ).screenshot({
        path: `/tmp/kosku-instagram-carousel-mobile-${width}.png`,
      });
      await page.setViewport({ width, height: 940 });
      await page.$eval(".instagram-preview-media", (node) => {
        const touch = (x, y) =>
          new Touch({ identifier: 1, target: node, clientX: x, clientY: y });
        node.dispatchEvent(
          new TouchEvent("touchstart", {
            bubbles: true,
            touches: [touch(230, 200)],
          }),
        );
        node.dispatchEvent(
          new TouchEvent("touchend", {
            bubbles: true,
            changedTouches: [touch(100, 205)],
          }),
        );
      });
      await page.waitForFunction(() =>
        document
          .querySelector(".ig-review-artwork .instagram-preview-media img")
          .getAttribute("src")
          .includes("pasinan1"),
      );
      await click("Analitik & kelola");
      await page.waitForSelector(".ig-detail-example-label");
      assert.equal(
        await page.$eval(
          ".instagram-detail-layout",
          (node) => node.scrollWidth <= node.clientWidth + 1,
        ),
        true,
      );
      await page.keyboard.press("Escape");
    }
  }
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await navigate(
    "&igSource=examples&igPreview=example-home&igExample=example-home",
  );
  await page.waitForSelector(".ig-detail-example-label");
  await page.keyboard.press("Escape");
  assert.match(
    await page.$eval(".ig-review-info h3", (node) => node.textContent),
    /Rumah Unimas/,
  );
  await page.focus("#instagram-content-search");
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.tagName),
    "BUTTON",
  );
  const after =
    await db.$queryRaw`SELECT count(*)::int AS count FROM marketing_instagram_actions`;
  assert.deepEqual(after, before);
  assert.deepEqual(errors, []);
  const result = {
    verified: true,
    sampleCarousels: 3,
    viewports: [1512, 1280, 1024, 768, 390, 320],
    actualInstagramWrites: 0,
    checks: [
      "compact dark emerald workspace",
      "default live empty state without sample substitution",
      "photo gallery and bounded inspector",
      "poster as real first slide",
      "same-property photo sequences",
      "thumbnails, keyboard and swipe",
      "property selection resets slides",
      "source separation",
      "read-only examples",
      "analytics and comments",
      "search",
      "URL restoration",
      "reduced motion",
      "narrow viewport overflow",
    ],
    errors,
  };
  fs.writeFileSync(
    "/tmp/kosku-instagram-carousel-report.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} catch (error) {
  if (browser) {
    const pages = await browser.pages();
    console.log(
      await pages
        .at(-1)
        ?.$$eval(".ig-review-layout, .ig-review-layout *", (nodes) =>
          nodes
            .filter((node) => node.scrollWidth > node.clientWidth + 1)
            .map((node) => ({
              tag: node.tagName,
              class: node.className,
              width: node.clientWidth,
              scroll: node.scrollWidth,
              display: getComputedStyle(node).display,
            }))
            .slice(0, 30),
        ),
    );
    await pages
      .at(-1)
      ?.screenshot({
        path: "/tmp/kosku-instagram-redesign-failure.png",
        fullPage: true,
      })
      .catch(() => {});
  }
  throw error;
} finally {
  if (browser) await browser.close();
  await db.$disconnect();
}

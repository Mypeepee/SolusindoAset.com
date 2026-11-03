// Read-only, localhost-only regression of the connect button. Meta is never contacted.
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
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
  const response = await fetch(origin + "/api/dashboard/pemasaran", {
    headers: { Cookie: cookieName + "=" + token },
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.config.enabled, false);
  const loginMode = data.connection.instagram.setup.loginMode || "unified";
  const actualConnected = data.connection.instagram.connected;
  if (loginMode === "facebook") assert.equal(actualConnected, true);
  const actualSnapshot = JSON.stringify(data);
  let showActual = true;
  const before = await db.marketingPublication.count({
    where: { state: "published" },
  });
  // Exercise the same-origin button in a local-only browser fixture. Real config is unchanged.
  data.connection.instagram.setup.origin = origin;
  data.connection.instagram.configured = true;
  data.connection.instagram.connected = false;
  data.connection.instagram.setup.ready = true;
  data.connection.instagram.setup.checks =
    data.connection.instagram.setup.checks.map((check) => ({
      ...check,
      ready: true,
    }));
  browser = await puppeteer.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const navigations = [];
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["data:", "blob:"].includes(url.protocol) && url.origin !== origin)
      return request.abort();
    if (url.pathname === "/api/dashboard/pemasaran/instagram/connect") {
      navigations.push(url.pathname);
      return request.respond({
        status: 200,
        contentType: "text/html",
        body: "<p id='oauth-probe'>OAuth navigation reached; no external request sent.</p>",
      });
    }
    if (
      url.pathname === "/api/dashboard/pemasaran" &&
      request.method() === "GET"
    )
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: showActual ? actualSnapshot : JSON.stringify(data),
      });
    if (
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/auth/")
    )
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    // Attach the test session only after the strict loopback origin check above.
    // This also exercises HTTPS-configured NextAuth without weakening its cookies.
    return request.continue({
      headers: { ...request.headers(), cookie: cookieName + "=" + token },
    });
  });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(origin + "/dashboard/pemasaran?tab=pengaturan", {
    waitUntil: "networkidle2",
  });
  await page.waitForSelector(".marketing-connection");
  if (actualConnected) {
    const text = await page.$eval(
      ".marketing-connection",
      (node) => node.textContent,
    );
    assert.match(text, /Terhubung/);
    assert.ok(text.includes(data.connection.instagram.username));
    await page.screenshot({ path: "/tmp/kosku-instagram-connected.png" });
  }
  showActual = false;
  for (const width of [1440, 768, 375]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(origin + "/dashboard/pemasaran", {
      waitUntil: "networkidle2",
    });
    await page.waitForSelector(".marketing-calendar");
    const button = await page.evaluateHandle(() =>
      [...document.querySelectorAll(".marketing-header-actions button")].find(
        (node) => node.textContent.trim() === "Hubungkan Instagram",
      ),
    );
    assert.ok(button.asElement());
    await button.asElement().click();
    await page.waitForSelector("#oauth-probe");
    assert.equal(
      new URL(page.url()).pathname,
      "/api/dashboard/pemasaran/instagram/connect",
    );
  }
  await page.goto(origin + "/dashboard/pemasaran?tab=pengaturan", {
    waitUntil: "networkidle2",
  });
  const guide = await page.evaluateHandle(() =>
    [...document.querySelectorAll(".marketing-connection button")].find(
      (node) => node.textContent.trim() === "Panduan koneksi",
    ),
  );
  assert.ok(guide.asElement());
  await guide
    .asElement()
    .evaluate((node) => node.scrollIntoView({ block: "center" }));
  await guide.asElement().click();
  try {
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  } catch (error) {
    await page.screenshot({ path: "/tmp/kosku-unified-browser-failure.png" });
    console.error(
      JSON.stringify({ browserErrors: errors, guideOpened: false }),
    );
    throw error;
  }
  const guideText = await page.$eval(
    '[role="dialog"]',
    (node) => node.textContent,
  );
  assert.match(
    guideText,
    loginMode === "facebook" ? /Facebook Login/ : /Unified Login/,
  );
  assert.match(guideText, /META_APP_SECRET/);
  if (loginMode === "unified") assert.match(guideText, /INSTAGRAM_CONFIG_ID/);
  else assert.match(guideText, /pages_show_list/);
  assert.match(guideText, /instagram_manage_insights/);
  assert.doesNotMatch(guideText, /INSTAGRAM_APP_SECRET/);
  for (const width of [1440, 375]) {
    await page.setViewport({ width, height: 900 });
    const box = await page.$eval('[role="dialog"]', (node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: innerWidth };
    });
    assert.ok(box.left >= 0 && box.right <= box.width + 1);
    await page.screenshot({
      path: `/tmp/kosku-${loginMode}-guide-${width}.png`,
    });
  }
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent.trim()),
    "Panduan koneksi",
  );
  await page.goto(
    origin +
      "/dashboard/pemasaran?tab=pengaturan&instagram=error&instagramError=OAUTH_STATE_INVALID",
    { waitUntil: "networkidle2" },
  );
  await page.waitForSelector('.marketing-connection [role="alert"]');
  assert.match(
    await page.$eval(
      '.marketing-connection [role="alert"]',
      (node) => node.textContent,
    ),
    /Sesi login Instagram tidak cocok/,
  );
  assert.equal(navigations.length, 3);
  assert.deepEqual(errors, []);
  assert.equal(
    await db.marketingPublication.count({ where: { state: "published" } }),
    before,
  );
  console.log(
    JSON.stringify({
      passed: true,
      viewports: [1440, 768, 375],
      headerStartsOAuth: true,
      inlineFailureReason: true,
      loginMode,
      actualConnected,
      loginGuideMatchesMode: true,
      guideKeyboardAndResponsive: true,
      externalRequestsSent: false,
      publishedNothing: true,
    }),
  );
} finally {
  await db.$disconnect();
  if (browser) {
    const timeout = setTimeout(() => browser.process()?.kill("SIGKILL"), 5000);
    try {
      await browser.close();
    } finally {
      clearTimeout(timeout);
    }
  }
}

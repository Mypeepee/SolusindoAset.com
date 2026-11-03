import assert from "node:assert/strict";
import fs from "node:fs/promises";
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
  console.log("Memeriksa akun OWNER untuk pengujian lokal…");
  const owner = await db.agent.findFirst({
    where: {
      jabatan: "OWNER",
      status_keanggotaan: "AKTIF",
      pengguna: { status_akun: "AKTIF" },
    },
    select: { id_pengguna: true },
  });
  assert.ok(owner);
  console.log("Akun pengujian tersedia; membuka browser…");
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
  const page = await browser.newPage(),
    errors = [];
  console.log("Browser siap.");
  page.setDefaultTimeout(90000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setExtraHTTPHeaders({ Cookie: `${cookieName}=${token}` });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    // Verify that the menu glyph is present even when Iconify cannot be reached.
    if (/api\.iconify\.design/.test(request.url())) return request.abort();
    if (request.method() !== "GET") return request.abort();
    return request.continue();
  });
  await fs.mkdir("docs/previews", { recursive: true });
  for (const width of [1512, 390]) {
    console.log(`Memeriksa menu dan Campaign pada ${width}px…`);
    await page.setViewport({ width, height: 1000 });
    await page.goto(origin + "/dashboard/pemasaran?tab=campaign", {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await page.waitForSelector('[data-section="campaign"]');
    if (width < 768) await page.click('button[aria-label="Buka menu"]');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('a[href="/dashboard/pemasaran"]')].some(
        (el) =>
          el.getBoundingClientRect().width > 0 && el.querySelector("svg path"),
      ),
    );
    const menu = await page.evaluate(() => {
      const target = [
        ...document.querySelectorAll('a[href="/dashboard/pemasaran"]'),
      ].find((el) => el.getBoundingClientRect().width > 0);
      const links = [...target.parentElement.querySelectorAll("a")];
      return {
        labels: links.slice(0, 3).map((el) => el.textContent.trim()),
        icon: !!target.querySelector("svg path"),
        count: document.querySelectorAll('a[href="/dashboard/pemasaran"]')
          .length,
      };
    });
    assert.deepEqual(menu.labels, ["Dashboard", "Pemasaran", "Tugas"]);
    assert.ok(menu.icon);
    assert.equal(menu.count, width < 768 ? 2 : 1);
    await page.screenshot({
      path: `docs/previews/pemasaran-menu-${width}.png`,
      fullPage: false,
    });
    if (width < 768) await page.keyboard.press("Escape");
    assert.equal(
      await page.$eval(
        '.marketing-tabs [aria-current="page"]',
        (el) => el.textContent,
      ),
      "Campaign",
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      browser: "passed",
      widths: [1512, 390],
      iconify: "blocked",
      writes: 0,
      errors,
    }),
  );
} finally {
  await browser?.close();
  await db.$disconnect();
}

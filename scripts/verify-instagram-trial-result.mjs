// Inspect the real trial post and open/cancel its delete confirmation. Never DELETE.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const jobId = process.argv[2];
assert.match(jobId || "", /^[a-f0-9-]{36}$/);
const db = new PrismaClient();
let browser;
const blockedWrites = [],
  pageErrors = [];
try {
  const publication = await db.marketingPublication.findUniqueOrThrow({
    where: { jobId_channel: { jobId, channel: "instagram" } },
  });
  assert.equal(publication.state, "published");
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
      process.env.MARKETING_QA_BROWSER ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(180000);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setCookie({
    name: cookieName,
    value: token,
    url: origin,
    secure: cookieName.startsWith("__Secure-"),
    httpOnly: true,
  });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      blockedWrites.push(new URL(request.url()).pathname);
      return request.respond({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "READ_ONLY_VERIFICATION" }),
      });
    }
    return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(
    `${origin}/dashboard/pemasaran?tab=instagram&igMedia=${publication.externalId}`,
    { waitUntil: "networkidle2" },
  );
  await page.waitForSelector(
    ".instagram-detail-modal .instagram-manage .instagram-danger",
  );
  const deletionAvailable = await page.$eval(
    ".instagram-detail-modal .instagram-manage .instagram-danger",
    (button) => !button.disabled,
  );
  assert.equal(deletionAvailable, true);
  const count = await page.$$eval(
    ".instagram-detail-modal .ig-slide-thumbnails button",
    (buttons) => buttons.length,
  );
  assert.equal(count, 4);
  for (let index = 0; index < count; index++) {
    await page.$$eval(
      ".instagram-detail-modal .ig-slide-thumbnails button",
      (buttons, index) => buttons[index].click(),
      index,
    );
    await page.waitForFunction(
      (index) => {
        const image = document.querySelector(
          ".instagram-detail-modal .instagram-preview-media img",
        );
        return (
          image?.naturalWidth > 0 &&
          image.alt.includes(`slide ${index + 1} dari`)
        );
      },
      {},
      index,
    );
  }
  await page.$$eval(
    ".instagram-detail-modal .ig-slide-thumbnails button",
    (buttons) => buttons[0].click(),
  );
  await page.waitForFunction(
    () =>
      document.querySelector(
        ".instagram-detail-modal .instagram-preview-media img",
      )?.naturalWidth > 0,
  );
  await fs.mkdir("docs/previews", { recursive: true });
  await page.screenshot({
    path: "docs/previews/instagram-trial-live-post.png",
  });
  await page.$eval(
    ".instagram-detail-modal .instagram-manage .instagram-danger",
    (button) => button.click(),
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role="dialog"]')].some((dialog) =>
      dialog.textContent.includes("Hapus postingan ini?"),
    ),
  );
  const confirmation = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(
      (node) => node.textContent.includes("Hapus postingan ini?"),
    );
    return {
      enabled: [...dialog.querySelectorAll("button")].some(
        (button) =>
          button.textContent.trim() === "Hapus postingan" && !button.disabled,
      ),
      focusedCancel: document.activeElement?.textContent.trim() === "Batal",
    };
  });
  assert.deepEqual(confirmation, { enabled: true, focusedCancel: true });
  await page.screenshot({
    path: "docs/previews/instagram-trial-live-delete-confirmation.png",
  });
  await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(
      (node) => node.textContent.includes("Hapus postingan ini?"),
    );
    [...dialog.querySelectorAll("button")]
      .find((button) => button.textContent.trim() === "Batal")
      .click();
  });
  assert.deepEqual(blockedWrites, []);
  assert.deepEqual(pageErrors, []);
  const retained = await db.marketingPublication.findUniqueOrThrow({
    where: { id: publication.id },
  });
  assert.equal(retained.state, "published");
  assert.equal(retained.errorCode, null);
  const report = {
    verified: true,
    jobId,
    mediaId: publication.externalId,
    permalink: publication.permalink,
    slides: count,
    allSlideImagesLoaded: true,
    deletionAvailable,
    confirmation,
    deleted: false,
    blockedWrites,
    pageErrors,
  };
  await fs.writeFile(
    "docs/previews/instagram-trial-live-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await db.$disconnect();
}

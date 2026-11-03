// Deletes only the explicitly requested trial post through the real application UI.
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
const target = "18079119182441886";
const db = new PrismaClient();
let browser, page;
const responses = [],
  errors = [];
try {
  const owner = await db.agent.findFirstOrThrow({
    where: {
      jabatan: "OWNER",
      status_keanggotaan: "AKTIF",
      pengguna: { status_akun: "AKTIF" },
    },
    select: { id_pengguna: true },
  });
  const connection = await db.marketingConnection.findUniqueOrThrow({
    where: { id: "instagram" },
    select: { accountId: true },
  });
  const jwt = await encode({
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
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(180000);
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.log(JSON.stringify({ browserError: error.message }));
  });
  await page.setCookie({
    name: cookieName,
    value: jwt,
    url: origin,
    secure: cookieName.startsWith("__Secure-"),
    httpOnly: true,
  });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (["GET", "HEAD"].includes(request.method())) return request.continue();
    const url = new URL(request.url());
    let body;
    try {
      body = JSON.parse(request.postData() || "{}");
    } catch {}
    if (
      url.origin === origin &&
      url.pathname === "/api/dashboard/pemasaran/instagram/content" &&
      request.method() === "POST" &&
      body?.action === "delete-media" &&
      body.mediaId === target &&
      body.accountId === connection.accountId
    )
      return request.continue();
    return request.respond({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "UNRELATED_WRITE_BLOCKED" }),
    });
  });
  page.on("response", async (response) => {
    if (
      response.request().method() !== "POST" ||
      new URL(response.url()).pathname !==
        "/api/dashboard/pemasaran/instagram/content"
    )
      return;
    const result = await response.json().catch(() => ({}));
    const record = {
      status: response.status(),
      error: result.error || null,
      success: result.success === true,
    };
    responses.push(record);
    console.log(JSON.stringify(record));
  });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(
    `${origin}/dashboard/pemasaran?tab=instagram&igMedia=${target}`,
    { waitUntil: "networkidle2" },
  );
  await page.waitForSelector(
    ".instagram-detail-modal .instagram-manage .instagram-danger",
  );
  const ready = await page.$eval(
    ".instagram-detail-modal .instagram-manage .instagram-danger",
    (button) => !button.disabled,
  );
  assert.equal(ready, true);
  console.log(
    JSON.stringify(
      await page.evaluate(() => ({
        secureContext: isSecureContext,
        randomUUID: typeof crypto.randomUUID,
      })),
    ),
  );
  await page.$eval(
    ".instagram-detail-modal .instagram-manage .instagram-danger",
    (button) => button.click(),
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role="dialog"]')].some((dialog) =>
      dialog.textContent.includes("Hapus postingan ini?"),
    ),
  );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        "/api/dashboard/pemasaran/instagram/content",
    { timeout: 125000 },
  );
  await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(
      (node) => node.textContent.includes("Hapus postingan ini?"),
    );
    [...dialog.querySelectorAll("button")]
      .find((button) => button.textContent.trim() === "Hapus postingan")
      .click();
  });
  const response = await responsePromise;
  await fs.mkdir("docs/previews", { recursive: true });
  await page.screenshot({
    path: "docs/previews/instagram-real-delete-result.png",
  });
  console.log(
    JSON.stringify({
      httpStatus: response.status(),
      uiError: await page.$$eval(
        '.instagram-studio-dialog [role="alert"]',
        (nodes) => nodes.map((node) => node.textContent),
      ),
      responses,
      errors,
    }),
  );
  if (response.status() !== 200) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ error: error.message, responses, errors }));
  await page
    ?.screenshot({ path: "/tmp/kosku-real-delete-failure.png" })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  await db.$disconnect();
}

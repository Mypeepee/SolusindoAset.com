/**
 * Verify the actual local Next.js → API → Prisma → PostgreSQL connection.
 * No network interception or fixture data is used. Credentials remain in memory.
 * --write-check creates, updates and removes only its own temporary DRAFT.
 * --browser also checks the actual dashboard and saves a screenshot to /private/tmp.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root, true);
const origin = process.env.BERITA_CHECK_ORIGIN || "http://127.0.0.1:3000";
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const databaseUrl = new URL(process.env.DATABASE_URL);
assert.ok(
  localHosts.has(databaseUrl.hostname),
  "Database checks are restricted to localhost.",
);
assert.ok(
  localHosts.has(new URL(origin).hostname),
  "Authenticated checks are restricted to a local server.",
);
assert.ok(process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET must be configured.");

const prisma = new PrismaClient();
let temporaryId;
let temporarySlug;

async function main() {
  const owner = await prisma.agent.findFirst({
    where: {
      jabatan: "OWNER",
      pengguna: { status_akun: "AKTIF", peran: "AGENT" },
    },
    select: { id_agent: true, id_pengguna: true },
  });
  assert.ok(
    owner,
    "An active Owner is required to verify the authenticated API.",
  );
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 300,
    token: {
      id: owner.id_pengguna,
      sub: owner.id_pengguna,
      agentId: owner.id_agent,
      jabatan: "OWNER",
      peran: "AGENT",
      role: "AGENT",
      _refreshedAt: 0,
    },
  });
  const cookie = `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`;
  const request = async (pathname, options = {}) => {
    const response = await fetch(`${origin}${pathname}`, {
      ...options,
      headers: { cookie, ...options.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    const raw = await response.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      const data = raw.match(
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
      );
      let message;
      try {
        message = data && JSON.parse(data[1]).err?.message;
      } catch {
        /* Preserve a readable HTTP failure. */
      }
      throw new Error(
        `${pathname}: HTTP ${response.status}, ${message || "server returned a non-JSON response"}`,
      );
    }
    assert.ok(
      response.ok,
      `${pathname}: HTTP ${response.status}, ${body.error || "request failed"}`,
    );
    return body;
  };

  const session = await request("/api/auth/session");
  assert.equal(
    session.user?.agentId,
    owner.id_agent,
    "The live session must resolve to the actual database agent.",
  );
  assert.equal(session.user?.jabatan, "OWNER");
  console.log("PASS: actual database Owner session resolves through NextAuth.");

  const [total, rows, grouped] = await Promise.all([
    prisma.berita.count(),
    prisma.berita.findMany({
      orderBy: [{ tanggal_diupdate: "desc" }, { id_berita: "desc" }],
      take: 12,
      select: {
        id_berita: true,
        judul: true,
        slug: true,
        status_publish: true,
      },
    }),
    prisma.berita.groupBy({ by: ["status_publish"], _count: { _all: true } }),
  ]);
  const listing = await request("/api/berita/admin?page=1&pageSize=12");
  assert.equal(listing.total, total);
  assert.deepEqual(
    listing.items.map((row) => row.id),
    rows.map((row) => String(row.id_berita)),
  );
  for (const count of grouped)
    assert.equal(listing.statusCounts[count.status_publish], count._count._all);
  for (const row of rows) {
    const { item } = await request(`/api/berita/admin/${row.id_berita}`);
    assert.equal(item.judul, row.judul);
    assert.equal(item.slug, row.slug);
    assert.equal(item.status_publish, row.status_publish);
  }
  console.log(
    `PASS: live list, detail and metrics match ${total} saved database articles.`,
  );

  if (rows.length) {
    const selected = rows[0];
    const search = await request(
      `/api/berita/admin?q=${encodeURIComponent(selected.judul)}`,
    );
    assert.ok(
      search.items.some((item) => item.id === String(selected.id_berita)),
    );
    const filtered = await request(
      `/api/berita/admin?status=${selected.status_publish}`,
    );
    assert.ok(
      filtered.items.every(
        (item) => item.status_publish === selected.status_publish,
      ),
    );
    console.log("PASS: actual database search and status filtering.");
  }

  if (process.argv.includes("--write-check")) {
    temporarySlug = `uji-koneksi-berita-${randomUUID()}`;
    const created = await request("/api/berita/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        judul: "[UJI KONEKSI SEMENTARA] Database berita",
        slug: temporarySlug,
        isi_berita:
          "Draf sementara untuk memverifikasi penyimpanan melalui API.",
        status_publish: "DRAFT",
        kategori: "Berita Properti",
        meta_description: "Pengujian koneksi database berita.",
      }),
    });
    temporaryId = BigInt(created.item.id);
    const saved = await prisma.berita.findUniqueOrThrow({
      where: { id_berita: temporaryId },
    });
    assert.equal(saved.slug, temporarySlug);
    assert.equal(saved.status_publish, "DRAFT");
    assert.equal(saved.id_agent, owner.id_agent);
    assert.equal(saved.meta_description, "Pengujian koneksi database berita.");
    await request(`/api/berita/admin/${temporaryId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        judul: "[UJI KONEKSI SEMENTARA] Penyimpanan diperbarui",
        slug: temporarySlug,
      }),
    });
    const updated = await prisma.berita.findUniqueOrThrow({
      where: { id_berita: temporaryId },
    });
    assert.ok(updated.judul.includes("diperbarui"));
    assert.equal(updated.meta_description, saved.meta_description);
    await request(`/api/berita/admin/${temporaryId}`, { method: "DELETE" });
    assert.equal(
      await prisma.berita.findUnique({ where: { id_berita: temporaryId } }),
      null,
    );
    console.log(
      "PASS: API create/update/delete persist in PostgreSQL; temporary draft removed.",
    );
    temporaryId = undefined;
  }

  if (process.argv.includes("--browser")) {
    const { default: puppeteer } = await import("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      executablePath:
        process.env.BERITA_CHECK_BROWSER ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    });
    let page;
    const browserErrors = [];
    try {
      await browser.setCookie({
        name: "next-auth.session-token",
        value: token,
        url: origin,
        httpOnly: true,
        expires: Math.floor(Date.now() / 1000) + 300,
      });
      page = await browser.newPage();
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400 && response.url().startsWith(origin))
          browserErrors.push(
            `${response.status()} ${new URL(response.url()).pathname}`,
          );
      });
      await page.setViewport({ width: 1440, height: 1100 });
      const response = await page.goto(`${origin}/dashboard/berita`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      assert.equal(response.status(), 200);
      await page.waitForFunction(
        (expected) =>
          document.querySelectorAll("#berita-results article").length ===
            expected &&
          !document
            .querySelector("#berita-results")
            ?.getAttribute("aria-busy")
            ?.includes("true"),
        { timeout: 30000 },
        rows.length,
      );
      const titles = await page.$$eval(
        "#berita-results article h3",
        (elements) => elements.map((element) => element.textContent),
      );
      assert.deepEqual(
        titles,
        rows.map((row) => row.judul),
      );
      await page.screenshot({
        path: "/private/tmp/berita-database-connected.png",
        fullPage: true,
      });
      console.log(
        "PASS: actual dashboard renders the database articles without mocked API responses.",
      );
    } catch (error) {
      if (page) {
        await page.screenshot({
          path: "/private/tmp/berita-connection-failure.png",
          fullPage: true,
        });
        console.error(
          JSON.stringify({
            browserErrors,
            state: await page.evaluate(() => ({
              url: location.pathname,
              heading: document.querySelector("h1")?.textContent,
              articles: document.querySelectorAll("#berita-results article")
                .length,
              resultsPresent: !!document.querySelector("#berita-results"),
              alert: document.querySelector('[role="alert"]')?.textContent,
            })),
          }),
        );
      }
      throw error;
    } finally {
      await browser.close();
    }
  }
  assert.equal(
    await prisma.berita.count(),
    total,
    "The check must not leave additional articles behind.",
  );
  console.log(
    `VERIFIED: ${databaseUrl.hostname}/${databaseUrl.pathname.slice(1)} → public.berita → live API${process.argv.includes("--browser") ? " → dashboard" : ""} (${total} articles).`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  // Never remove an existing article; cleanup is limited to this run's unique draft slug.
  if (temporaryId || temporarySlug) {
    await prisma.berita.deleteMany({
      where: {
        ...(temporaryId ? { id_berita: temporaryId } : {}),
        slug: temporarySlug,
        status_publish: "DRAFT",
      },
    });
  }
  await prisma.$disconnect();
}

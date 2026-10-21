/** Browser interaction QA with isolated news/session fixtures. Never writes live articles. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { encode } from "next-auth/jwt";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const origin = process.env.BERITA_QA_ORIGIN || "http://127.0.0.1:3107";
assert.ok(
  new URL(origin).hostname === "127.0.0.1" ||
    new URL(origin).hostname === "localhost",
  "QA runs only against a local server",
);
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.BERITA_QA_BROWSER ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  protocolTimeout: 120000,
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
let role = "OWNER";
let saved;
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
const titles = [
  "Pasar properti 2026: momentum baru untuk investasi cerdas",
  "Panduan membeli rumah pertama di tengah perubahan pasar",
  "Membaca peluang lelang properti di Jawa Timur",
  "Investasi jangka panjang dimulai dari keputusan yang tepat",
  "Lima hal yang perlu diketahui sebelum mengajukan KPR",
  "Merancang masa depan kota yang lebih berkelanjutan",
  "Legalitas properti: dokumen yang wajib Anda periksa",
  "Hunian modern dan arah baru gaya hidup perkotaan",
  "Strategi diversifikasi portofolio aset Anda",
  "Kabar terbaru perkembangan kawasan Surabaya Barat",
  "Mengapa lokasi tetap menentukan nilai sebuah rumah",
  "Tips menilai aset sebelum mengikuti lelang",
  "Perubahan suku bunga dan dampaknya pada properti",
  "Sektor properti komersial kembali menunjukkan pertumbuhan",
];
const statuses = [
  "PUBLISHED",
  "PUBLISHED",
  "DRAFT",
  "SCHEDULED",
  "DRAFT",
  "ARCHIVED",
];
const categories = [
  "Analisa Pasar",
  "Panduan Pembeli",
  "Tips Lelang",
  "Investasi",
  "Berita Properti",
  "Legal & Dokumen",
];
const now = Date.now();
const articles = titles.map((judul, index) => ({
  id: String(index + 1),
  judul,
  slug: `artikel-${index + 1}`,
  ringkasan:
    "Perspektif dan wawasan terkini dari tim redaksi Solusindo Aset untuk keputusan properti yang lebih cerdas.",
  gambar_utama:
    index === 2
      ? null
      : `/images/hero/${["unimas3.jpg", "unimas2.jpg", "malang.jpg", "balongsari.jpeg"][index % 4]}`,
  kategori: categories[index % categories.length],
  penulis: index % 2 ? "Nadia Putri" : "Tim Redaksi",
  status_publish: statuses[index % statuses.length],
  berita_utama: index === 0,
  berita_unggulan: index === 1,
  views: 3412 - index * 171,
  readMinutes: 4 + (index % 3),
  tanggal_publish: new Date(
    now +
      (statuses[index % statuses.length] === "SCHEDULED"
        ? 86400000
        : -index * 86400000),
  ).toISOString(),
  tanggal_dibuat: new Date(now - index * 86400000).toISOString(),
  tanggal_diupdate: new Date(now - index * 3600000).toISOString(),
  review_requested_at: index === 2 ? new Date(now).toISOString() : null,
  requested_publish_at: null,
  isi_berita:
    "## Peluang baru di pasar properti\n\nPasar properti Indonesia terus berkembang. Artikel ini menghadirkan wawasan untuk membantu pembaca mengambil keputusan.\n\n> Investasi yang baik dimulai dari informasi yang tepat.\n\n- Pahami kebutuhan Anda\n- Periksa legalitas aset\n- Konsultasikan dengan ahli",
  galeri_gambar: [],
  tag: ["properti", "investasi"],
  sumber_berita: null,
  meta_description: "Analisa pasar properti dari Solusindo Aset.",
  id_agent: "qa",
  share: 0,
}));
const requests = [];
await page.setRequestInterception(true);
page.on("request", async (request) => {
  try {
    const url = new URL(request.url());
    const json = (data, status = 200) =>
      request.respond({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.origin !== origin && !url.protocol.startsWith("data"))
      return request.abort();
    if (url.pathname === "/api/auth/session")
      return json({
        user: {
          name: "Editorial QA",
          email: "qa@example.test",
          jabatan: role,
          peran: "AGENT",
          role: "AGENT",
          agentId: "qa",
        },
        expires: new Date(now + 86400000).toISOString(),
      });
    if (url.pathname === "/api/berita/upload")
      return json({ url: "/images/hero/unimas2.jpg" });
    if (url.pathname.startsWith("/api/berita/admin")) {
      requests.push(url.pathname + url.search);
      if (request.method() !== "GET") {
        saved = JSON.parse(request.postData() || "{}");
        return json({ item: articles[0], count: saved.ids?.length || 1 });
      }
      const id = url.pathname.split("/").at(-1);
      if (/^\d+$/.test(id))
        return json({ item: articles.find((item) => item.id === id) });
      let items = [...articles];
      const sp = url.searchParams;
      if (sp.get("status"))
        items = items.filter(
          (item) => item.status_publish === sp.get("status"),
        );
      if (sp.get("q"))
        items = items.filter((item) =>
          `${item.judul} ${item.kategori} ${item.penulis}`
            .toLowerCase()
            .includes(sp.get("q").toLowerCase()),
        );
      if (sp.get("kategori"))
        items = items.filter((item) => item.kategori === sp.get("kategori"));
      if (sp.get("penulis"))
        items = items.filter((item) => item.penulis === sp.get("penulis"));
      if (sp.get("review"))
        items = items.filter((item) => item.review_requested_at);
      const total = items.length;
      const currentPage = Number(sp.get("page") || 1);
      return json({
        items: items.slice((currentPage - 1) * 12, currentPage * 12),
        total,
        page: currentPage,
        pageSize: 12,
        totalPages: Math.max(1, Math.ceil(total / 12)),
        statusCounts: articles.reduce(
          (counts, item) => ({
            ...counts,
            [item.status_publish]: (counts[item.status_publish] || 0) + 1,
          }),
          {},
        ),
        authors: ["Tim Redaksi", "Nadia Putri"],
        activity: articles.map((item) => ({
          date: item.tanggal_dibuat,
          status: item.status_publish,
        })),
        reviewCount: 1,
      });
    }
    if (url.pathname.startsWith("/api/"))
      return json({
        items: [],
        notifications: [],
        data: [],
        unreadCount: 0,
        total: 0,
      });
    return request.continue();
  } catch (error) {
    failures.push(error.message);
    if (!request.isInterceptResolutionHandled()) await request.abort();
  }
});
const token = await encode({
  secret: process.env.NEXTAUTH_SECRET,
  token: {
    sub: "editorial-qa",
    peran: "AGENT",
    role: "AGENT",
    jabatan: "OWNER",
    agentId: "qa",
  },
});
await browser.setCookie({
  name: "next-auth.session-token",
  value: token,
  url: origin,
  httpOnly: true,
  sameSite: "Lax",
});
const clickText = async (text, rootSelector = "body") =>
  page.evaluate(
    (text, rootSelector) => {
      const button = [
        ...document.querySelector(rootSelector).querySelectorAll("button"),
      ].find((element) => element.textContent.trim() === text);
      if (!button) throw new Error(`Button not found: ${text}`);
      button.click();
    },
    text,
    rootSelector,
  );
const fill = async (selector, value) => {
  await page.click(selector);
  await page.$eval(selector, (element) => element.select());
  await page.keyboard.press("Backspace");
  await page.keyboard.type(value);
};
try {
  const response = await page.goto(`${origin}/dashboard/berita`, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  assert.equal(response.status(), 200);
  await page.waitForSelector("article h3");
  await page.waitForFunction(
    () => document.querySelectorAll("article h3").length === 12,
  );
  await page.click('button[aria-label="Halaman berikutnya"]');
  await page.waitForFunction(
    () => document.querySelectorAll("article h3").length === 2,
  );
  await page.click('button[aria-label="Halaman sebelumnya"]');
  await page.waitForFunction(
    () => document.querySelectorAll("article h3").length === 12,
  );
  assert.equal(
    await page.$eval("h1", (element) => element.textContent),
    "Kelola Berita.",
  );
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.top < innerHeight && rect.bottom > 0;
      })
      .every((image) => image.complete),
  );
  await page.screenshot({
    path: "/private/tmp/berita-desktop.png",
    fullPage: true,
  });
  await page.keyboard.down("Meta");
  await page.keyboard.press("KeyK");
  await page.keyboard.up("Meta");
  assert.equal(
    await page.evaluate(() => document.activeElement.getAttribute("type")),
    "search",
  );
  await page.keyboard.type("pasar");
  await page.waitForFunction(
    () => document.querySelectorAll("article h3").length === 4,
  );
  assert.ok(requests.at(-1).includes("q=pasar"));
  await fill('input[type="search"]', "");
  await page.waitForFunction(
    () => document.querySelectorAll("article h3").length === 12,
  );
  await page.click("#berita-tab-DRAFT");
  await page.waitForFunction(
    () => document.querySelectorAll("article h3").length === 4,
  );
  await page.click("#berita-tab-all");
  await page.waitForFunction(
    () => document.querySelectorAll("article h3").length === 12,
  );
  await page.click('button[aria-controls="advanced-berita-filters"]');
  await page.select("#advanced-berita-filters select", "Nadia Putri");
  await page.waitForFunction(
    () => document.querySelectorAll("article h3").length === 7,
  );
  await page.select('select[aria-label="Filter kategori"]', "Investasi");
  await page.waitForFunction(
    () => document.querySelectorAll("article h3").length === 2,
  );
  assert.ok(requests.at(-1).includes("penulis=Nadia+Putri"));
  await clickText("Reset semua");
  await page.waitForFunction(
    () => document.querySelectorAll("article h3").length === 12,
  );
  await page.click('button[aria-controls="advanced-berita-filters"]');
  await page.click('button[aria-label="Tampilan grid"]');
  assert.equal(
    await page.$eval('button[aria-label="Tampilan grid"]', (element) =>
      element.getAttribute("aria-pressed"),
    ),
    "true",
  );
  await page.screenshot({
    path: "/private/tmp/berita-grid.png",
    fullPage: true,
  });
  await page.click('button[aria-label="Tampilan daftar"]');
  await page.click('input[aria-label="Pilih semua artikel di halaman ini"]');
  await page.waitForSelector('[aria-label="Aksi massal artikel"]');
  await clickText("Arsipkan", '[aria-label="Aksi massal artikel"]');
  await clickText("Arsipkan artikel", '[role="dialog"]');
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(saved.action, "ARCHIVED");
  assert.equal(saved.ids.length, 12);
  await page.click('button[title="Pratinjau cepat"]');
  await page.waitForSelector('[role="dialog"] h2');
  await page.waitForFunction(() =>
    document
      .querySelector('[role="dialog"]')
      .textContent.includes("Peluang baru di pasar properti"),
  );
  await page.screenshot({ path: "/private/tmp/berita-preview.png" });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await clickText("Tulis Berita");
  await page.waitForSelector("#article-title");
  await fill("#article-title", "Artikel uji editorial yang siap ditinjau");
  await fill(
    "#article-content",
    "## Pengantar\n\nIsi artikel untuk memeriksa editor dan alur penyimpanan.",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.querySelectorAll('[role="dialog"]').length === 2,
  );
  await clickText("Lanjut menulis", '[role="dialog"]:last-of-type');
  await page.waitForFunction(
    () => document.querySelectorAll('[role="dialog"]').length === 1,
  );
  await page.screenshot({ path: "/private/tmp/berita-editor.png" });
  await clickText("Simpan artikel", '[role="dialog"]');
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(saved.judul, "Artikel uji editorial yang siap ditinjau");
  assert.equal(saved.status_publish, "DRAFT");
  await clickText("Tulis Berita");
  await page.waitForSelector("#article-title");
  await fill("#article-title", "Artikel terjadwal dengan gambar dan SEO");
  await fill(
    "#article-content",
    "Konten properti untuk menguji publikasi terjadwal dan pengaturan SEO.",
  );
  await fill(
    '[role="dialog"] textarea[maxlength="160"]',
    "Meta description artikel terjadwal untuk hasil pencarian.",
  );
  await fill('input[aria-label="Slug artikel"]', "artikel-terjadwal-qa");
  await fill('input[aria-label="URL gambar utama"]', "h");
  const uploadInput = await page.$('input[type="file"]');
  await uploadInput.uploadFile(
    path.join(root, "public/images/hero/unimas2.jpg"),
  );
  await page.waitForSelector('select[aria-label="Rasio potong"]');
  await page.select('select[aria-label="Rasio potong"]', "1");
  await page.waitForFunction(() =>
    [
      ...document.querySelector('[role="dialog"]').querySelectorAll("button"),
    ].some(
      (button) => button.textContent.trim() === "Simpan" && !button.disabled,
    ),
  );
  await clickText("Simpan", '[role="dialog"]');
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="URL gambar utama"]')?.value ===
      "/images/hero/unimas2.jpg",
  );
  await page.select(
    '[role="dialog"] select:has(option[value="SCHEDULED"])',
    "SCHEDULED",
  );
  const schedule = new Date(now + 86400000 + 7 * 3600000)
    .toISOString()
    .slice(0, 16);
  await page.$eval(
    'input[aria-label="Jadwal publikasi WIB"]',
    (element, value) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },
    schedule,
  );
  await page.waitForFunction(() =>
    document
      .querySelector('[role="dialog"]')
      .textContent.includes("Tayang dalam"),
  );
  await page.screenshot({ path: "/private/tmp/berita-scheduler.png" });
  await clickText("Jadwalkan", '[role="dialog"]');
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(saved.status_publish, "SCHEDULED");
  assert.equal(saved.slug, "artikel-terjadwal-qa");
  assert.equal(saved.gambar_utama, "/images/hero/unimas2.jpg");
  assert.ok(saved.meta_description.startsWith("Meta description"));
  assert.equal(
    Date.parse(saved.tanggal_publish),
    Date.parse(`${schedule}:00+07:00`),
  );
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.screenshot({
    path: "/private/tmp/berita-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile viewport must not overflow",
  );
  role = "ADMIN";
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("article h3");
  assert.equal(
    await page.$('input[aria-label="Pilih semua artikel di halaman ini"]'),
    null,
  );
  assert.equal(await page.$('button[title="Hapus permanen"]'), null);
  await page.click("article h3 button");
  await page.waitForSelector("#article-title");
  await page.waitForFunction(() =>
    document
      .querySelector('[role="dialog"]')
      .textContent.includes("Revisi disimpan sebagai draf baru"),
  );
  await clickText("Ajukan review", '[role="dialog"]');
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(saved.submit_review, true);
  assert.equal(saved.status_publish, "DRAFT");
  assert.ok(!("berita_utama" in saved));
  assert.deepEqual(failures, []);
  process.stdout.write(
    "Browser QA passed: list/grid, pagination, search shortcut and debounce, status/category/author filters, transactional bulk archive, preview, draft save, crop/upload, SEO, WIB scheduling, unsaved protection, mobile overflow and Admin review.\nScreenshots: /private/tmp/berita-{desktop,grid,preview,editor,scheduler,mobile}.png\n",
  );
} catch (error) {
  process.stderr.write(
    JSON.stringify({
      lastRequests: requests.slice(-8),
      state: await page.evaluate(() => ({
        articles: document.querySelectorAll("article h3").length,
        query: document.querySelector('input[type="search"]')?.value,
        dialogs: document.querySelectorAll('[role="dialog"]').length,
        active: document.activeElement?.getAttribute("aria-label"),
        errorText: document.querySelector('[role="alert"]')?.textContent,
      })),
    }) + "\n",
  );
  await page.screenshot({
    path: "/private/tmp/berita-qa-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}

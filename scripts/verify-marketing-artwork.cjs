// Local browser rendering only. No database, account or publication calls.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const QRCode = require("qrcode");
const sharp = require("sharp");
const load = require("./lib/marketing-test-loader.cjs")({ "@/lib/prisma": {} });
const { posterHtml, fitMarketingPoster } = load(
  "src/lib/marketing/media.server.ts",
);
const { DEFAULT_CONFIG, captionFor, marketingListingUrl } = load(
  "src/lib/marketing/domain.ts",
);

(async () => {
  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.MARKETING_QA_BROWSER ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (request) =>
      request.url().startsWith("data:") || request.url() === "about:blank"
        ? request.continue()
        : request.abort(),
    );
    const font = (
      await fs.readFile(
        "public/fonts/plus-jakarta-sans/PlusJakartaSans-Variable.ttf",
      )
    ).toString("base64");
    const logo =
      "data:image/png;base64," +
      (
        await fs.readFile("public/images/logo/LogoSolusindoPremier.png")
      ).toString("base64");
    const photos = await Promise.all(
      ["pasinan1.jpg", "pasinan2.jpg", "pasinan3.jpg"].map((name) =>
        fs.readFile("public/images/hero/" + name),
      ),
    );
    const asset = {
      id: "contoh-desain",
      assetKey: "qa:artwork",
      title:
        "CONTOH DESAIN · Lahan dan bangunan untuk langkah besar usaha Anda",
      address: "Alamat contoh untuk pengujian desain, Lampung Timur",
      city: "Lampung Timur",
      price: 40328160000,
      landArea: 71992,
      certificateType: "SHM",
      category: "LELANG",
      propertyType: "GUDANG",
      auctionDate: "2026-12-20T02:00:00Z",
      listingUrl: "/Lelang/contoh-desain",
      images: [],
      revision: "qa",
    };
    const config = {
      ...DEFAULT_CONFIG,
      companyName: "Solusindo Premier Property",
      companyPhone: "",
    };
    const url = marketingListingUrl(asset.listingUrl);
    const qr = await QRCode.toDataURL(url, {
      width: 360,
      margin: 3,
      errorCorrectionLevel: "M",
    });
    await fs.mkdir("docs/previews", { recursive: true });
    const results = [];
    for (const story of [false, true]) {
      const height = story ? 1920 : 1350;
      await page.setViewport({ width: 1080, height, deviceScaleFactor: 1 });
      for (const count of [1, 2, 3]) {
        await page.setContent(
          posterHtml(
            asset,
            config,
            photos.slice(0, count),
            story,
            font,
            logo,
            qr,
          ),
        );
        await fitMarketingPoster(page);
        await page.waitForFunction(() =>
          [...document.images].every(
            (img) => img.complete && img.naturalWidth > 0,
          ),
        );
        const layout = await page.evaluate(() => {
          const frame = document.querySelector(".story-frame"),
            collage = document.querySelector(".collage"),
            price = document.querySelector(".price"),
            heading = document.querySelector("h1"),
            footer = document.querySelector(".footer");
          return {
            width: frame.clientWidth,
            height: frame.clientHeight,
            scroll: frame.scrollHeight,
            photoCount: document.querySelectorAll(".collage img").length,
            collageHeight: collage.clientHeight,
            priceClipped: price.scrollWidth > price.clientWidth,
            titleClipped: heading.scrollHeight > heading.clientHeight,
            qrCount: document.querySelectorAll(".qr img").length,
            footerBottom: footer.getBoundingClientRect().bottom,
            title: heading.textContent,
          };
        });
        assert.equal(layout.width, 1080);
        assert.equal(layout.height, height);
        assert.equal(layout.scroll, height);
        assert.equal(layout.photoCount, count);
        assert.ok(layout.collageHeight >= 300);
        assert.equal(layout.priceClipped, false);
        assert.equal(layout.titleClipped, false);
        assert.equal(layout.qrCount, 1);
        assert.ok(layout.footerBottom <= height);
        if (count === 3) {
          const file = `docs/previews/marketing-${story ? "whatsapp-story" : "instagram-poster"}.jpg`;
          const bytes = await (
            await page.$(".story-frame")
          ).screenshot({ path: file, type: "jpeg", quality: 90 });
          const metadata = await sharp(bytes).metadata();
          assert.equal(metadata.width, 1080);
          assert.equal(metadata.height, height);
        }
        results.push({ format: story ? "9:16" : "4:5", ...layout });
      }
      const long = {
        ...asset,
        title:
          "CONTOH DESAIN · " +
          "Judul properti panjang untuk memastikan informasi tetap terbaca ".repeat(
            5,
          ),
        price: 999999999999999,
        certificateType: "Sertifikat Hak Milik",
        address: "Alamat lengkap yang panjang ".repeat(30),
      };
      await page.setContent(
        posterHtml(long, config, photos, story, font, logo, qr),
      );
      await fitMarketingPoster(page);
      assert.equal(
        await page.$eval(".price", (el) => el.scrollWidth > el.clientWidth),
        false,
      );
      assert.equal(
        await page.$eval("h1", (el) => el.scrollHeight > el.clientHeight),
        false,
      );
      assert.equal(
        await page.$eval(
          ".story-frame",
          (el) => el.scrollHeight > el.clientHeight,
        ),
        false,
      );
    }
    const caption = captionFor(asset, config);
    assert.ok(caption.includes(url));
    assert.ok(caption.length <= 2200);
    await fs.writeFile(
      "docs/previews/marketing-artwork-qa.json",
      JSON.stringify({ results, caption, externalRequests: 0 }, null, 2) + "\n",
    );
    console.log(
      "PASS: 1/2/3 photos; 1080×1350 and 1080×1920; full prices/titles, long copy, local QR, caption destination; no external requests.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

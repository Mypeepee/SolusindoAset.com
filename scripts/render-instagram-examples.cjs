// Code-rendered example covers. Uses only local photography/fonts; never calls Instagram.
const fs = require("node:fs/promises");
const path = require("node:path");
const load = require("./lib/marketing-test-loader.cjs")({ "@/lib/prisma": {} });
const { propertyCoverHtml } = load("src/lib/marketing/property-cover.ts");
const { fitMarketingPoster } = load("src/lib/marketing/media.server.ts");
const covers = [
  {
    id: "example-business",
    title: "Gudang Pasinan.",
    location: "Tambakagung · Mojokerto, Jawa Timur",
    category: "Gudang",
    photo: "pasinan1.jpg",
    photos: ["pasinan2.jpg", "pasinan3.jpg"],
    price: "Rp15.500.000.000",
    facts: ["Luas tanah", "17.630 m²"],
  },
  {
    id: "example-home",
    title: "Rumah Unimas.",
    location: "Hunian & lingkungan sekitar",
    category: "Rumah",
    photo: "unimas2.jpg",
    photos: ["unimas3.jpg"],
  },
  {
    id: "example-warehouse",
    title: "Gudang Kedinding.",
    location: "Kenjeran · Surabaya, Jawa Timur",
    category: "Gudang",
    photo: "kedinding2.jpg",
    photos: ["kedinding1.jpg"],
    price: "Rp1.235.100.000",
    facts: ["Luas tanah", "200 m²"],
  },
];
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
    const fontData = (
      await fs.readFile(
        "public/fonts/plus-jakarta-sans/PlusJakartaSans-Variable.ttf",
      )
    ).toString("base64");
    const logo =
      "data:image/png;base64," +
      (
        await fs.readFile("public/images/logo/LogoSolusindoPremier.png")
      ).toString("base64");
    const dir = "public/images/instagram-examples";
    await fs.mkdir(dir, { recursive: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
    for (const cover of covers) {
      const photo =
        "data:image/jpeg;base64," +
        (
          await fs.readFile(path.join("public/images/hero", cover.photo))
        ).toString("base64");
      await page.setContent(
        propertyCoverHtml({
          ...cover,
          photo,
          photos: await Promise.all(
            cover.photos.map(
              async (name) =>
                "data:image/jpeg;base64," +
                (
                  await fs.readFile(path.join("public/images/hero", name))
                ).toString("base64"),
            ),
          ),
          brand: "SOLUSINDO PREMIER",
          fontData,
          logo,
          sample: true,
        }),
      );
      await page.evaluate(() => document.fonts.ready);
      await fitMarketingPoster(page);
      await page.waitForFunction(() =>
        [...document.images].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      );
      await (
        await page.$(".story-frame")
      ).screenshot({
        path: path.join(dir, cover.id + ".jpg"),
        type: "jpeg",
        quality: 92,
      });
    }
    console.log("Rendered 3 example carousel covers at 1080 × 1350.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

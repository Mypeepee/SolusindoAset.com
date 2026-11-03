/** Investor photo provenance and discount-intensity boundaries. No database writes. */
const assert = require("node:assert/strict");
const { NextRequest } = require("next/server");
const createLoader = require("./lib/investor-test-loader.cjs");
const load = createLoader();
const { investorDiscountTone, investorCertificateLabel, compactInvestorPages } =
  load("src/lib/investor-presentation.ts");
const { investorPhotoUrls } = load("src/lib/investor-deals-row.server.ts");
for (const [value, expected] of [
  [null, "unknown"],
  [NaN, "unknown"],
  [-95, "above"],
  [0, "zero"],
  [0.1, "subtle"],
  [1, "subtle"],
  [29.9, "subtle"],
  [30, "good"],
  [50, "good"],
  [50.1, "exceptional"],
  [94.7, "exceptional"],
])
  assert.equal(investorDiscountTone(value), expected, String(value));
for (const [raw, expected] of [
  ["SHM", "SHM"],
  ["HGB", "HGB"],
  ["STRATA_TITLE", "Strata Title"],
  ["AJB", "AJB"],
  [null, null],
  ["SHM 001234", null],
])
  assert.equal(investorCertificateLabel(raw), expected);
for (const total of [1, 2, 3, 4, 5, 66, 1000]) {
  for (let current = 1; current <= total; current++) {
    const tokens = compactInvestorPages(current, total);
    const pages = tokens.filter((p) => typeof p === "number");
    assert.ok(pages.length <= 3);
    assert.ok(tokens.length <= 5);
    assert.ok(pages.includes(current));
    assert.equal(pages[0], 1);
    assert.equal(pages.at(-1), total);
    assert.equal(new Set(pages).size, pages.length);
  }
}
assert.deepEqual(Array.from(investorPhotoUrls(null, "7")), []);
assert.deepEqual(
  Array.from(
    investorPhotoUrls(
      " /images/one.jpg, https://file.lelang.go.id/a.jpg, https://file.lelang.go.id/b.jpg, https://file.lelang.go.id/a.jpg, drive_id, https://drive.google.com/file/d/drive_id/view, javascript:bad, //external.example/a.jpg ",
      "7",
    ),
  ),
  [
    "/images/one.jpg",
    "/api/foto/7?w=640&view=card&index=1",
    "/api/foto/7?w=640&view=card&index=2",
    "/api/drive-image?id=drive_id&sz=w800",
  ],
);
assert.equal(
  investorPhotoUrls(
    Array.from(
      { length: 70 },
      (_, i) => `https://file.lelang.go.id/${i}.jpg`,
    ).join(","),
    "7",
  ).length,
  50,
);

let source =
  "https://file.lelang.go.id/one.jpg, https://file.lelang.go.id/two.jpg";
let unavailable = false,
  stockReads = 0,
  queries = 0,
  fetched = "",
  resize;
const routeLoad = createLoader({
  "@/lib/prisma": {
    listing: {
      findUnique: async () => {
        queries++;
        return { gambar: source };
      },
    },
  },
  "@/lib/fotoListing": {
    resolveFetchableImage: (raw) => raw?.split(",")[0].trim() || null,
    fetchImageBytes: async (url) => {
      fetched = url;
      return unavailable ? null : Buffer.from("photo");
    },
  },
  "fs/promises": {
    readFile: async () => {
      stockReads++;
      return Buffer.from("stock");
    },
  },
  sharp: () => {
    const pipeline = {
      resize: (...args) => {
        resize = args;
        return pipeline;
      },
      jpeg: () => pipeline,
      toBuffer: async () => Buffer.from("resized"),
    };
    return pipeline;
  },
});
const { GET } = routeLoad("src/app/api/foto/[id]/route.ts");
const request = (query) =>
  GET(new NextRequest(`http://localhost/api/foto/7${query}`), {
    params: { id: "7" },
  });
(async () => {
  assert.equal((await request("?view=card&index=1&w=640")).status, 200);
  assert.equal(fetched, "https://file.lelang.go.id/two.jpg");
  assert.equal(resize.length, 1);
  assert.equal(resize[0].width, 640);
  assert.equal(
    resize[0].height,
    undefined,
    "Gallery proxy must preserve the source aspect ratio",
  );
  const before = queries;
  for (const index of ["-1", "50", "1.5", "bad"])
    assert.equal((await request(`?view=card&index=${index}`)).status, 400);
  assert.equal(queries, before);
  assert.equal((await request("?view=card&index=3")).status, 404);
  unavailable = true;
  assert.equal((await request("?view=card&index=0")).status, 404);
  assert.equal(
    stockReads,
    0,
    "Missing gallery sources must never show another property's photo",
  );
  source = null;
  assert.equal(
    (await request("")).status,
    200,
    "Existing email photo behavior remains compatible",
  );
  assert.equal(stockReads, 1);
  assert.equal(resize[0], 236);
  assert.equal(resize[1], 296);
  console.log(
    "Investor presentation passed: zero/muted/orange/red boundaries, negative/unknown safeguards, ordered deduplicated genuine photo URLs, indexed image selection, original aspect ratio, honest missing photos and email compatibility.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

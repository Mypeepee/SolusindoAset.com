const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const { instagramRequestId } = require("./lib/marketing-test-loader.cjs")()(
  "src/app/dashboard/pemasaran/components/instagram-api.ts",
);
test("Instagram actions create secure version-four IDs without crypto.randomUUID", () => {
  const source = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };
  const ids = Array.from({ length: 100 }, () => instagramRequestId(source));
  for (const id of ids)
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  assert.equal(new Set(ids).size, ids.length);
});
test("an unsupported browser reports a known pre-send error", () => {
  assert.throws(
    () => instagramRequestId({}),
    (error) =>
      error.code === "INSTAGRAM_REQUEST_ID_UNAVAILABLE" &&
      error.message.includes("belum dikirim"),
  );
});

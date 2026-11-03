const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID, randomBytes } = require("node:crypto");
const { createTrialMediaServer } = require("./instagram-trial-media.cjs");
test("trial gateway exposes only one job's signed feed/detail JPEGs, with no application proxy", async () => {
  const cwd = process.cwd(),
    key = process.env.MARKETING_ENCRYPTION_KEY;
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "kosku-trial-media-"),
  );
  const job = randomUUID(),
    bytes = Buffer.from("JPEG fixture");
  let server;
  try {
    process.env.MARKETING_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.chdir(directory);
    await fs.mkdir(path.join("uploads", "marketing", job), { recursive: true });
    await fs.writeFile(
      path.join("uploads", "marketing", job, "feed.jpg"),
      bytes,
    );
    const { mediaSignature } = require(
      path.join(cwd, "scripts/lib/marketing-test-loader.cjs"),
    )({ "@/lib/prisma": {} })("src/lib/marketing/security.server.ts");
    server = await createTrialMediaServer(job);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = "http://127.0.0.1:" + server.address().port;
    const expires = Date.now() + 60000;
    const signed = `/api/pemasaran/media/${job}/feed.jpg?expires=${expires}&signature=${mediaSignature(job, "feed.jpg", expires)}`;
    for (const route of [
      "/",
      "/dashboard",
      "/api/auth/session",
      `/api/pemasaran/media/${randomUUID()}/feed.jpg`,
      `/api/pemasaran/media/${job}/story.jpg`,
      `/api/pemasaran/media/${job}/../trial.json`,
    ])
      assert.equal((await fetch(origin + route)).status, 404, route);
    assert.equal(
      (await fetch(origin + `/api/pemasaran/media/${job}/feed.jpg`)).status,
      403,
    );
    assert.equal(
      (await fetch(origin + signed.replace(/signature=.*/, "signature=wrong")))
        .status,
      403,
    );
    assert.equal(
      (await fetch(origin + signed, { method: "POST" })).status,
      404,
    );
    const response = await fetch(origin + signed);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    const head = await fetch(origin + signed, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    process.chdir(cwd);
    if (key === undefined) delete process.env.MARKETING_ENCRYPTION_KEY;
    else process.env.MARKETING_ENCRYPTION_KEY = key;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

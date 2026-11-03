const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const { NextRequest } = require("next/server");

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, "..", relative);
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, URLSearchParams,
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
  }, { filename });
  return module.exports;
}

const referral = load("src/lib/referral.ts", {
  "@/lib/prisma": {}, "@/lib/notifications": {},
});
const { GET } = load("src/app/r/[code]/route.ts", { "@/lib/referral": referral });

test("referral stays on the public origin when Next sees the proxy's localhost", async () => {
  const request = new NextRequest("https://localhost:3000/r/AG108", {
    headers: { host: "solusindoaset.com", "x-forwarded-host": "solusindoaset.com", "x-forwarded-proto": "https" },
  });
  const response = await GET(request, { params: { code: "AG108" } });
  assert.equal(response.status, 307);
  const location = response.headers.get("location");
  assert.equal(location, "/?ref=AG108&daftar=1");
  assert.equal(new URL(location, "https://solusindoaset.com/r/AG108").origin, "https://solusindoaset.com");
  const cookie = response.cookies.get("ref_code");
  assert.equal(cookie.value, "AG108");
  assert.equal(cookie.maxAge, 60 * 60 * 24 * 3);
  assert.equal(cookie.path, "/");
  assert.equal(cookie.sameSite, "lax");
});

test("normalizes referral codes and preserves local development origin", async () => {
  for (const raw of ["108", "ag108", "AG 0108"]) {
    const response = await GET(new NextRequest("http://127.0.0.1:3000/r/108"), { params: { code: raw } });
    const destination = new URL(response.headers.get("location"), "http://127.0.0.1:3000/r/108");
    assert.equal(destination.href, "http://127.0.0.1:3000/?ref=AG108&daftar=1");
  }
});

test("invalid and already decoded codes return home without setting attribution", async () => {
  for (const raw of ["", "%", "bad-code", "//evil.example", "AG108?ref=AG999"]) {
    const response = await GET(new NextRequest("https://localhost:3000/r/invalid"), { params: { code: raw } });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "/");
    assert.equal(response.cookies.get("ref_code"), undefined);
  }
});

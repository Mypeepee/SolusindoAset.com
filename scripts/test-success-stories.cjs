const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const ts = require("typescript");
const { NextRequest, NextResponse } = require("next/server");
const sharp = require("sharp");
const root = path.resolve(__dirname, "..");
const nativeRequire = createRequire(path.join(root, "package.json"));

function loadTS(relative, mocks, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const requireModule = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/")
        ? path.join(root, "src", name.slice(2))
        : path.resolve(path.dirname(filename), name);
      const file = [base, `${base}.ts`, `${base}.tsx`].find(
        (candidate) =>
          fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      );
      return loadTS(file, mocks, cache);
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      require: requireModule,
      console,
      Buffer,
      URL,
      File,
      Request,
      Response,
      AbortSignal,
      process,
    },
    { filename },
  );
  return module.exports;
}

async function main() {
  const state = {
    session: null,
    agent: null,
    queries: 0,
    inserts: 0,
    files: [],
    records: new Map(),
  };
  const prisma = {
    agent: { findUnique: async () => state.agent },
    $executeRaw: async (_sql, ...values) => {
      state.inserts++;
      const [
        id,
        images,
        type,
        title,
        location,
        desc,
        marketPrice,
        dealPrice,
        tiktokUrl,
        createdBy,
      ] = values;
      if (state.records.has(id)) return 0;
      state.records.set(id, {
        id,
        images,
        type,
        title,
        location,
        desc,
        marketPrice,
        dealPrice,
        tiktokUrl,
        createdBy,
      });
      return 1;
    },
    $queryRaw: async (_sql, ...values) => {
      state.queries++;
      return [...state.records.values()].filter(
        (row) =>
          !values.length ||
          (row.id === values[0] && row.createdBy === values[1]),
      );
    },
  };
  const mocks = {
    "@/lib/prisma": { __esModule: true, default: prisma },
    "next-auth": { getServerSession: async () => state.session },
    "@/app/api/auth/[...nextauth]/authOptions": { authOptions: {} },
    "node:fs/promises": {
      mkdir: async () => {},
      writeFile: async (...args) => state.files.push(args),
    },
  };
  const cache = new Map();
  const route = loadTS("src/app/api/about/stories/route.ts", mocks, cache);
  const images = loadTS(
    "src/app/api/about/stories/images/route.ts",
    mocks,
    cache,
  );
  const { successStorySchema } = loadTS(
    "src/lib/success-story-schema.ts",
    mocks,
    cache,
  );
  const fixture = {
    id: "27dd0cf4-79bc-4dd1-978e-e3f3460cf01f",
    title: "Proyek uji selesai",
    location: "Surabaya, Jawa Timur",
    type: "Aset Lelang",
    desc: "Dokumentasi pengujian alur serah terima yang sudah selesai.",
    images: [
      "/uploads/success-stories/AG106/27dd0cf4-79bc-4dd1-978e-e3f3460cf01f.webp",
    ],
    marketPrice: 2000000000,
    dealPrice: 1500000000,
    tiktokUrl: "https://vt.tiktok.com/example/",
  };
  const post = (body = fixture) =>
    new NextRequest("http://localhost:3000/api/about/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await route.POST(post())).status,
    401,
    "Anonymous creation denied",
  );
  assert.equal(
    (await images.POST(post())).status,
    401,
    "Anonymous upload denied before reading files",
  );
  state.session = { user: { id: "AC106", jabatan: "OWNER" } };
  assert.equal(
    (await route.POST(post())).status,
    403,
    "An account without an agent cannot create",
  );
  for (const position of [
    "AGENT",
    "ADMIN",
    "PRINCIPAL",
    "STOKER",
    "TEAMLEADER",
  ]) {
    state.agent = {
      id_agent: "AG106",
      jabatan: position,
      status_keanggotaan: "AKTIF",
      pengguna: { status_akun: "AKTIF" },
    };
    assert.equal(
      (await route.POST(post())).status,
      403,
      `${position} cannot create despite stale OWNER session`,
    );
    assert.equal(
      (await images.POST(post())).status,
      403,
      `${position} cannot upload`,
    );
  }
  for (const [membership, account] of [
    ["PENDING", "AKTIF"],
    ["SUSPEND", "AKTIF"],
    ["AKTIF", "NONAKTIF"],
    ["AKTIF", "DIBEKUKAN"],
  ]) {
    state.agent = {
      id_agent: "AG106",
      jabatan: "OWNER",
      status_keanggotaan: membership,
      pengguna: { status_akun: account },
    };
    assert.equal(
      (await route.POST(post())).status,
      403,
      "Inactive OWNER rejected",
    );
  }
  assert.equal(state.inserts, 0);
  assert.equal(state.queries, 0);
  assert.equal(state.files.length, 0);
  state.agent = {
    id_agent: "AG106",
    jabatan: "OWNER",
    status_keanggotaan: "AKTIF",
    pengguna: { status_akun: "AKTIF" },
  };
  for (const data of [
    { ...fixture, images: [] },
    { ...fixture, marketPrice: 0 },
    { ...fixture, dealPrice: -1 },
    { ...fixture, tiktokUrl: "javascript:alert(1)" },
    { ...fixture, tiktokUrl: "https://tiktok.com.evil.example/test" },
    {
      ...fixture,
      images: [
        "/uploads/success-stories/AG999/27dd0cf4-79bc-4dd1-978e-e3f3460cf01f.webp",
      ],
    },
  ]) {
    assert.equal(
      (await route.POST(post(data))).status,
      422,
      "Invalid payload rejected",
    );
  }
  assert.equal(
    successStorySchema.safeParse({ ...fixture, dealPrice: 3000000000 }).success,
    true,
    "Valid price comparisons do not invent a discount",
  );
  const created = await route.POST(post());
  assert.equal(created.status, 201);
  assert.equal((await created.json()).story.dealPrice, fixture.dealPrice);
  assert.equal((await route.POST(post())).status, 200, "Retry is idempotent");
  assert.equal(state.records.size, 1);
  state.session = null;
  const publicList = await route.GET();
  assert.equal(publicList.status, 200);
  const publicBody = await publicList.json();
  assert.equal(publicBody.stories.length, 7);
  assert.equal(publicBody.stories[0].title, fixture.title);
  assert.equal(
    publicBody.stories[0].createdBy,
    undefined,
    "Public stories omit author metadata",
  );

  state.session = { user: { id: "AC106" } };
  const uploadRequest = (file) => {
    const form = new FormData();
    form.append("image", file);
    return new NextRequest("http://localhost:3000/api/about/stories/images", {
      method: "POST",
      body: form,
    });
  };
  assert.equal(
    (
      await images.POST(
        uploadRequest(
          new File(["bad image"], "photo.jpg", { type: "image/jpeg" }),
        ),
      )
    ).status,
    422,
    "MIME spoofing is rejected by decoding",
  );
  assert.equal(
    (
      await images.POST(
        uploadRequest(
          new File(["<svg></svg>"], "photo.svg", { type: "image/svg+xml" }),
        ),
      )
    ).status,
    415,
  );
  const png = await sharp({
    create: { width: 100, height: 80, channels: 3, background: "#1a7055" },
  })
    .png()
    .toBuffer();
  const uploaded = await images.POST(
    uploadRequest(new File([png], "photo.png", { type: "image/png" })),
  );
  assert.equal(uploaded.status, 201);
  assert.match(
    (await uploaded.json()).url,
    /^\/uploads\/success-stories\/AG106\/[a-f0-9-]+\.webp$/,
  );
  assert.equal(
    (await sharp(state.files[0][1]).metadata()).format,
    "webp",
    "Images are actually optimized",
  );
  let imageReads = 0;
  let missingImage = false;
  const media = loadTS(
    "src/app/uploads/success-stories/[owner]/[filename]/route.ts",
    {
      "node:fs/promises": {
        readFile: async () => {
          imageReads++;
          if (missingImage)
            throw Object.assign(new Error("Missing"), { code: "ENOENT" });
          return state.files[0][1];
        },
      },
    },
  );
  const imageRequest = new NextRequest(
    "http://localhost:3000/uploads/success-stories/AG106/photo.webp",
  );
  assert.equal(
    (
      await media.GET(imageRequest, {
        params: { owner: "AG106", filename: "../schema.prisma" },
      })
    ).status,
    404,
  );
  assert.equal(
    imageReads,
    0,
    "Invalid paths are rejected before filesystem access",
  );
  const imageParams = {
    params: { owner: "AG106", filename: `${fixture.id}.webp` },
  };
  const served = await media.GET(imageRequest, imageParams);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/webp");
  assert.match(served.headers.get("cache-control"), /immutable/);
  assert.equal(
    (await served.arrayBuffer()).byteLength,
    state.files[0][1].byteLength,
  );
  missingImage = true;
  assert.equal((await media.GET(imageRequest, imageParams)).status, 404);
  console.log(
    "Success stories: authorization, stale roles, validation, public reads, idempotent creation, image processing, and serving newly uploaded media passed.",
  );
}

module.exports = { loadTS };
if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

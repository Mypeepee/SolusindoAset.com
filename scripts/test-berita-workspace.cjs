/* Focused editorial policy and endpoint tests. No database or network is used. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const root = path.resolve(__dirname, "..");
const cache = new Map();
let editor = { id_agent: "qa", jabatan: "OWNER", penulis: "Redaksi" };
let writes = [];
let records = [];
let reads = [];
class TestResponse extends Response {
  static json(body, init) {
    return new TestResponse(JSON.stringify(body), {
      ...init,
      headers: { "content-type": "application/json" },
    });
  }
}
const database = {
  berita: {
    findUnique: async () => records[0] || null,
    findMany: async (args) => {
      reads.push(args);
      return records;
    },
    count: async () => records.length,
    update: async (args) => {
      writes.push(args);
      return { ...records[0], ...args.data };
    },
    updateMany: async (args) => {
      writes.push(args);
      return { count: records.length };
    },
    deleteMany: async (args) => {
      writes.push(args);
      return { count: records.length };
    },
    delete: async (args) => {
      writes.push(args);
      return {};
    },
    create: async (args) => {
      writes.push(args);
      return { ...args.data, id_berita: 1n };
    },
  },
  $transaction: async (fn) => {
    const start = writes.length;
    try {
      return await fn(database);
    } catch (error) {
      writes = writes.slice(0, start);
      throw error;
    }
  },
};
const mocks = {
  "next/server": { NextResponse: TestResponse },
  "next/cache": { revalidatePath() {} },
  "@/lib/prisma": { __esModule: true, default: database },
  "@/lib/berita": {
    toListItem: (row) => ({ id: String(row.id_berita), judul: row.judul }),
    toDetail: (row) => row,
    uniqueSlug: async (slug) => slug,
  },
};
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const instance = new Module(file, module);
  cache.set(file, instance);
  instance.filename = file;
  instance.paths = Module._nodeModulePaths(path.dirname(file));
  instance.require = (id) => {
    if (id.endsWith("/_guard") || id === "./_guard" || id === "../_guard")
      return { requireBeritaEditor: async () => editor };
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith("@/")) return load(path.join("src", id.slice(2)) + ".ts");
    if (id.startsWith("."))
      return load(
        path.relative(root, path.resolve(path.dirname(file), id)) + ".ts",
      );
    return require(id);
  };
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  instance._compile(compiled.outputText, file);
  return instance.exports;
}
const { beritaPermissions } = load("src/lib/beritaPermissions.ts");
const { editorialWriteError, scheduleError } = load(
  "src/app/api/berita/admin/_workflow.ts",
);
const { validateBerita, normalizeBerita } = load(
  "src/app/api/berita/admin/_payload.ts",
);
const single = load("src/app/api/berita/admin/[id]/route.ts");
const bulk = load("src/app/api/berita/admin/bulk/route.ts");
const create = load("src/app/api/berita/admin/route.ts");
const params = { params: { id: "1" } };
const request = (body) => ({ json: async () => body });
const draft = {
  id_berita: 1n,
  judul: "Panduan investasi properti",
  isi_berita: "Isi berita yang sudah disimpan.",
  slug: "panduan-investasi",
  status_publish: "DRAFT",
  berita_utama: false,
  berita_unggulan: false,
  galeri_gambar: '["/one.webp","/two.webp"]',
  tag: '["properti","investasi"]',
  kategori: "Investasi",
  penulis: "Redaksi",
  tanggal_publish: null,
  review_requested_at: null,
  requested_publish_at: null,
};
const future = () => new Date(Date.now() + 86400000).toISOString();

test("Only Owner can publish, delete, pin and assign roles", () => {
  assert.equal(beritaPermissions("OWNER").canAssignRoles, true);
  for (const role of ["ADMIN", "PRINCIPAL"]) {
    assert.equal(beritaPermissions(role).canEdit, true);
    assert.equal(beritaPermissions(role).canPublish, false);
    assert.equal(beritaPermissions(role).canDelete, false);
  }
  assert.equal(beritaPermissions("AGENT").canEdit, false);
  assert.equal(beritaPermissions(null).canEdit, false);
});
test("Admin may write a draft or request review but cannot bypass publication controls", () => {
  assert.equal(
    editorialWriteError("ADMIN", {
      status_publish: "DRAFT",
      submit_review: true,
    }),
    null,
  );
  for (const status of ["PUBLISHED", "SCHEDULED", "ARCHIVED"])
    assert.ok(editorialWriteError("ADMIN", { status_publish: status }));
  for (const field of ["berita_utama", "berita_unggulan"])
    assert.ok(editorialWriteError("ADMIN", { [field]: true }));
  assert.ok(
    editorialWriteError(
      "ADMIN",
      { judul: "Live change" },
      { ...draft, status_publish: "PUBLISHED" },
    ),
  );
  assert.ok(
    editorialWriteError(
      "ADMIN",
      { berita_utama: false },
      { ...draft, berita_utama: true },
    ),
  );
});
test("Scheduling requires a valid future timestamp and review scheduling stays a draft", () => {
  for (const date of [null, "", "invalid", "2020-01-01T00:00:00Z"])
    assert.ok(
      scheduleError({ status_publish: "SCHEDULED", tanggal_publish: date }),
    );
  assert.equal(
    scheduleError({ status_publish: "SCHEDULED", tanggal_publish: future() }),
    null,
  );
  const result = normalizeBerita({
    ...draft,
    submit_review: true,
    requested_publish_at: future(),
  });
  assert.equal(result.status_publish, "DRAFT");
  assert.ok(result.review_requested_at instanceof Date);
  assert.ok(result.requested_publish_at instanceof Date);
  assert.equal(result.tanggal_publish, null);
});
test("SEO, field limits, media URLs and JSON arrays survive validation and partial updates", () => {
  assert.equal(
    validateBerita({ ...draft, meta_description: "Deskripsi pencarian." }).ok,
    true,
  );
  assert.equal(
    validateBerita({ ...draft, meta_description: "x".repeat(161) }).ok,
    false,
  );
  assert.equal(validateBerita({ ...draft, judul: "x".repeat(256) }).ok, false);
  assert.equal(
    validateBerita({ ...draft, gambar_utama: "javascript:alert(1)" }).ok,
    false,
  );
  const normalized = normalizeBerita(draft);
  assert.deepEqual(JSON.parse(normalized.galeri_gambar), [
    "/one.webp",
    "/two.webp",
  ]);
  assert.deepEqual(JSON.parse(normalized.tag), ["properti", "investasi"]);
});
test("Unauthenticated endpoint calls return before any write", async () => {
  editor = TestResponse.json({ error: "Unauthorized" }, { status: 401 });
  writes = [];
  assert.equal(
    (await bulk.POST(request({ ids: ["1"], action: "DELETE" }))).status,
    401,
  );
  assert.equal(
    (await single.PATCH(request({ judul: "attempt" }), params)).status,
    401,
  );
  assert.equal(writes.length, 0);
});
test("Admin API attempts to publish, delete or bulk archive are rejected", async () => {
  editor = { id_agent: "qa", jabatan: "ADMIN", penulis: "Redaksi" };
  records = [draft];
  writes = [];
  assert.equal(
    (
      await create.POST(
        request({
          ...draft,
          id_berita: undefined,
          status_publish: "PUBLISHED",
        }),
      )
    ).status,
    403,
  );
  assert.equal((await single.DELETE({}, params)).status, 403);
  assert.equal(
    (await bulk.POST(request({ ids: ["1"], action: "ARCHIVED" }))).status,
    403,
  );
  assert.equal(writes.length, 0);
});
test("Admin review submission persists the review and proposed time, with no publication", async () => {
  editor = { id_agent: "qa", jabatan: "ADMIN", penulis: "Redaksi" };
  records = [draft];
  writes = [];
  const result = await single.PATCH(
    request({
      judul: "Draf diperbaiki",
      status_publish: "DRAFT",
      submit_review: true,
      requested_publish_at: future(),
    }),
    params,
  );
  assert.equal(result.status, 200);
  assert.equal(writes[0].data.status_publish, "DRAFT");
  assert.ok(writes[0].data.review_requested_at);
  assert.equal(writes[0].where.status_publish, "DRAFT");
});
test("Owner pin-only PATCH preserves the article, gallery, tags and SEO fields", async () => {
  editor = { id_agent: "qa", jabatan: "OWNER", penulis: "Owner" };
  records = [{ ...draft, meta_description: "Deskripsi SEO." }];
  writes = [];
  const result = await single.PATCH(request({ berita_utama: true }), params);
  assert.equal(result.status, 200);
  const update = writes.at(-1);
  assert.equal(update.data.judul, draft.judul);
  assert.equal(update.data.meta_description, "Deskripsi SEO.");
  assert.deepEqual(JSON.parse(update.data.galeri_gambar), [
    "/one.webp",
    "/two.webp",
  ]);
});
test("Bulk validation rejects missing IDs and invalid operations atomically", async () => {
  editor = { id_agent: "qa", jabatan: "OWNER", penulis: "Owner" };
  records = [draft];
  writes = [];
  for (const body of [
    null,
    { ids: [], action: "DELETE" },
    { ids: ["-1"], action: "DELETE" },
    { ids: ["1"], action: "BOGUS" },
    { ids: Array(51).fill("1"), action: "DELETE" },
  ])
    assert.equal((await bulk.POST(request(body))).status, 400);
  assert.equal(
    (await bulk.POST(request({ ids: ["1", "2"], action: "DELETE" }))).status,
    409,
  );
  assert.equal(writes.length, 0);
});
test("Owner can archive a valid batch in one transaction", async () => {
  editor = { id_agent: "qa", jabatan: "OWNER", penulis: "Owner" };
  records = [draft];
  writes = [];
  const result = await bulk.POST(request({ ids: ["1"], action: "ARCHIVED" }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).count, 1);
  assert.equal(writes[0].data.status_publish, "ARCHIVED");
});

test("Public search keeps the publication deadline restriction when adding search filters", async () => {
  const service = load("src/lib/berita.ts");
  records = [];
  reads = [];
  await service.getPublishedList({ q: "villa" });
  const where = reads[0].where;
  assert.ok(where.OR.some((filter) => filter.judul));
  assert.deepEqual(where.AND[0].OR[0], { status_publish: "PUBLISHED" });
  assert.equal(where.AND[0].OR[1].status_publish, "SCHEDULED");
  assert.ok(where.AND[0].OR[1].tanggal_publish.lte instanceof Date);
});
test("Publication cron requires its secret and updates only due approved schedules", async () => {
  const cron = load("src/app/api/cron/berita-publish/route.ts");
  const original = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "editorial-test-secret";
  writes = [];
  records = [draft];
  try {
    assert.equal((await cron.GET({ headers: new Headers() })).status, 401);
    assert.equal(writes.length, 0);
    assert.equal(
      (
        await cron.GET({
          headers: new Headers({
            authorization: "Bearer editorial-test-secret",
          }),
        })
      ).status,
      200,
    );
    assert.equal(writes[0].where.status_publish, "SCHEDULED");
    assert.ok(writes[0].where.tanggal_publish.lte instanceof Date);
    assert.equal(writes[0].data.status_publish, "PUBLISHED");
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { pathToFileURL } = require('node:url');
const { ensureProductionBuild, productionBuildStatus, buildPath } = require('./production-build.cjs');
const temporaryRoot = path.resolve(__dirname, '../.runtime');
fs.mkdirSync(temporaryRoot, { recursive: true });

function fixture(t) {
  const root = fs.mkdtempSync(path.join(temporaryRoot, 'test-production-'));
  t.after(() => {
    assert.equal(path.dirname(root), temporaryRoot);
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}
function build(root, directory, id = 'complete-build') {
  const location = buildPath(root, directory);
  fs.mkdirSync(path.join(location, 'server/app'), { recursive: true });
  fs.mkdirSync(path.join(location, 'static'), { recursive: true });
  fs.writeFileSync(path.join(location, 'BUILD_ID'), id);
  for (const name of ['build-manifest', 'app-build-manifest', 'prerender-manifest', 'routes-manifest', 'required-server-files']) {
    fs.writeFileSync(path.join(location, name + '.json'), '{}');
  }
  fs.writeFileSync(path.join(location, 'server/pages-manifest.json'), '{}');
  fs.writeFileSync(path.join(location, 'server/app-paths-manifest.json'), JSON.stringify({ '/page': 'app/page.js' }));
  fs.writeFileSync(path.join(location, 'server/app/page.js'), 'module.exports = {};');
  fs.writeFileSync(path.join(location, 'server/webpack-runtime.js'), 'module.exports = {};');
}

test('BUILD_ID alone cannot make a partial build production-ready', (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '.next'));
  fs.writeFileSync(path.join(root, '.next/BUILD_ID'), 'old-build');
  assert.equal(productionBuildStatus(root).ok, false);
  build(root, '.next');
  assert.equal(productionBuildStatus(root).ok, true);
  fs.unlinkSync(path.join(root, '.next/server/app/page.js'));
  assert.equal(productionBuildStatus(root).ok, false);
});

test('a complete build starts without running the compiler again', async (t) => {
  const root = fixture(t); build(root, '.next');
  const ready = await ensureProductionBuild({ root, build() { assert.fail('Do not rebuild a valid deployment.'); } });
  assert.equal(ready.ok, true);
});

test('a missing production build is compiled automatically and validated', async (t) => {
  const root = fixture(t);
  let called = 0;
  const ready = await ensureProductionBuild({ root, build: async (dir, stage) => { called++; build(dir, stage, 'recovered-build'); } });
  assert.equal(called, 1); assert.equal(ready.ok, true);
  assert.equal(fs.readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8'), 'recovered-build');
  assert.equal(fs.existsSync(path.join(root, '.runtime/production-build.lock')), false);
});

test('a failed or incomplete replacement preserves the previous working build', async (t) => {
  const root = fixture(t); build(root, '.next', 'working-build');
  await assert.rejects(ensureProductionBuild({ root, force: true, build: async () => { throw new Error('compiler failed'); } }), /compiler failed/);
  await assert.rejects(ensureProductionBuild({ root, force: true, build: async (dir, stage) => {
    fs.mkdirSync(buildPath(dir, stage)); fs.writeFileSync(path.join(dir, stage, 'BUILD_ID'), 'partial-build');
  } }), /belum lengkap/);
  assert.equal(fs.readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8'), 'working-build');
  assert.equal(fs.existsSync(path.join(root, '.runtime/production-build.lock')), false);
});

test('a successful replacement archives the previous build', async (t) => {
  const root = fixture(t); build(root, '.next', 'previous-build');
  await ensureProductionBuild({ root, force: true, build: async (dir, stage) => build(dir, stage, 'new-build') });
  const archive = fs.readdirSync(path.join(root, '.local-backups'))[0];
  assert.equal(fs.readFileSync(path.join(root, '.local-backups', archive, 'previous-next/BUILD_ID'), 'utf8'), 'previous-build');
  assert.equal(fs.readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8'), 'new-build');
});

test('a live build lock prevents two compilers from changing production simultaneously', async (t) => {
  const root = fixture(t); fs.mkdirSync(path.join(root, '.runtime'));
  fs.writeFileSync(path.join(root, '.runtime/production-build.lock'), String(process.pid));
  await assert.rejects(ensureProductionBuild({ root, build() { assert.fail('Lock must prevent compilation.'); } }), /sedang berjalan/);
});

test('an active website prevents replacing files underneath the running server', async (t) => {
  const root = fixture(t); build(root, '.next');
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const previousPort = process.env.PORT;
  process.env.PORT = String(server.address().port);
  try {
    await assert.rejects(ensureProductionBuild({ root, force: true, build() { assert.fail('The live build must be protected.'); } }), /masih dipakai/);
  } finally {
    if (previousPort === undefined) delete process.env.PORT; else process.env.PORT = previousPort;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('an empty stale lock does not permanently prevent recovery', async (t) => {
  const root = fixture(t); fs.mkdirSync(path.join(root, '.runtime'));
  fs.writeFileSync(path.join(root, '.runtime/production-build.lock'), '');
  assert.equal((await ensureProductionBuild({ root, build: async (dir, stage) => build(dir, stage) })).ok, true);
});

test('production output cannot escape the workspace or use the development directory', () => {
  for (const directory of ['..', '.', '../src', '.next/../src', '.next-dev', 'C:\\Windows']) {
    assert.throws(() => buildPath(temporaryRoot, directory));
  }
});

test('development uses a different output directory from production', async () => {
  const { default: config } = await import(pathToFileURL(path.resolve(__dirname, '../next.config.mjs')).href);
  const constants = require('next/constants');
  assert.equal(config(constants.PHASE_DEVELOPMENT_SERVER).distDir, '.next-dev');
  assert.equal(config(constants.PHASE_PRODUCTION_SERVER).distDir, process.env.NEXT_BUILD_DIR || '.next');
});

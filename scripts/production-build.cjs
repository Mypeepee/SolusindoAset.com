const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');

const workspace = path.resolve(__dirname, '..');
const manifests = ['build-manifest.json', 'app-build-manifest.json', 'prerender-manifest.json',
  'routes-manifest.json', 'required-server-files.json', 'server/pages-manifest.json', 'server/app-paths-manifest.json'];

function buildPath(root, directory) {
  if (!/^\.next(?:-[a-zA-Z0-9._-]+)?$/.test(directory) || directory === '.next-dev') {
    throw new Error('Direktori build produksi harus berupa .next atau .next-<nama>.');
  }
  const resolved = path.resolve(root, directory);
  if (path.dirname(resolved) !== path.resolve(root)) throw new Error('Direktori build di luar project.');
  return resolved;
}

function productionBuildStatus(root = workspace, directory = process.env.NEXT_BUILD_DIR || '.next') {
  const location = buildPath(root, directory);
  const missing = [];
  try { if (!fs.readFileSync(path.join(location, 'BUILD_ID'), 'utf8').trim()) missing.push('BUILD_ID'); }
  catch { missing.push('BUILD_ID'); }
  for (const file of manifests) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(location, file), 'utf8'));
      if (file === 'server/pages-manifest.json' || file === 'server/app-paths-manifest.json') {
        for (const entry of Object.values(data)) {
          if (typeof entry !== 'string' || !fs.existsSync(path.join(location, 'server', entry))) {
            missing.push(`${file}: ${entry}`);
          }
        }
      }
    } catch { missing.push(file); }
  }
  for (const file of ['server/webpack-runtime.js', 'static']) {
    if (!fs.existsSync(path.join(location, file))) missing.push(file);
  }
  return { ok: missing.length === 0, location, missing };
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = (open) => { socket.destroy(); resolve(open); };
    socket.setTimeout(2000);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

function compile(root, directory) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], {
      cwd: root, stdio: 'inherit', windowsHide: true,
      env: { ...process.env, NODE_ENV: 'production', NEXT_BUILD_DIR: directory,
        NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096' },
    });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Build gagal (kode ${code}). Build lama tetap disimpan.`)));
  });
}

async function ensureProductionBuild({ root = workspace, directory = process.env.NEXT_BUILD_DIR || '.next',
  force = false, build = compile } = {}) {
  const current = productionBuildStatus(root, directory);
  if (current.ok && !force) return current;
  const port = Number(process.env.PORT || process.env.port || 3000);
  if (await portOpen(port)) throw new Error(`Port ${port} masih dipakai. Hentikan server website sebelum membangun ulang produksi.`);
  const runtime = path.join(root, '.runtime');
  fs.mkdirSync(runtime, { recursive: true });
  const lock = path.join(runtime, 'production-build.lock');
  if (fs.existsSync(lock)) {
    const pid = Number(fs.readFileSync(lock, 'utf8'));
    let alive = false;
    if (Number.isSafeInteger(pid) && pid > 0) {
      try { process.kill(pid, 0); alive = true; } catch (error) { alive = error.code !== 'ESRCH'; }
    }
    if (alive) throw new Error('Build produksi sedang berjalan. Tunggu proses build tersebut selesai.');
    fs.unlinkSync(lock);
  }
  fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
  const stage = `.next-build-${process.pid}-${Date.now()}`;
  const stagePath = buildPath(root, stage);
  try {
    console.log(current.ok ? '[build] Membangun versi produksi baru...' :
      `[build] Build produksi belum lengkap (${current.missing.slice(0, 3).join(', ')}). Membangun ulang otomatis...`);
    await build(root, stage);
    const ready = productionBuildStatus(root, stage);
    if (!ready.ok) throw new Error(`Hasil build belum lengkap: ${ready.missing.join(', ')}`);
    // Keep the old directory until the replacement has passed validation.
    const backup = path.resolve(root, '.local-backups', `build-${Date.now()}-${process.pid}`, 'previous-next');
    if (!backup.startsWith(path.resolve(root, '.local-backups') + path.sep)) throw new Error('Lokasi backup tidak aman.');
    let archived = false;
    if (fs.existsSync(current.location)) {
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.renameSync(current.location, backup);
      archived = true;
    }
    try { fs.renameSync(stagePath, current.location); }
    catch (error) {
      if (archived && !fs.existsSync(current.location)) fs.renameSync(backup, current.location);
      throw error;
    }
    const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
    if (revision.status === 0) fs.writeFileSync(path.join(current.location, '.built-from-commit'), revision.stdout.trim() + '\n');
    console.log('[build] Build produksi lengkap dan siap dijalankan.');
    return productionBuildStatus(root, directory);
  } finally {
    // Next adds the temporary type directory to tsconfig while building.
    try {
      const configFile = path.join(root, 'tsconfig.json');
      if (fs.existsSync(configFile)) {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        const generated = `${stage}/types/**/*.ts`;
        if (config.include?.includes(generated)) {
          config.include = config.include.filter((item) => item !== generated);
          fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
        }
      }
    } finally {
      fs.unlinkSync(lock);
    }
  }
}

module.exports = { ensureProductionBuild, productionBuildStatus, buildPath };
if (require.main === module) {
  process.env.NODE_ENV = 'production';
  require('@next/env').loadEnvConfig(workspace, false);
  ensureProductionBuild({ force: true }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

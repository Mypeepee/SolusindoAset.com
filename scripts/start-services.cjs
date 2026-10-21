const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const shellEnv = { ...process.env };
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const children = new Set();
let stopping = false;
process.chdir(root);

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill();
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());

function launch(label, executable, args, env = process.env) {
  const child = spawn(executable, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  children.add(child);
  child.once('error', (error) => {
    console.error(`[${label}] Gagal memulai: ${error.code || error.name}`);
    children.delete(child);
    stop(1);
  });
  child.once('exit', (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`[${label}] Proses berhenti (${code}).`);
      stop(code || 1);
    }
  });
  return child;
}

function portOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (open) => { socket.destroy(); resolve(open); };
    socket.setTimeout(2000);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

async function main() {
  require('@next/env').loadEnvConfig(root, false);
  // A local recovery configuration is created only after a verified DB relocation.
  const localPostgres = path.join(root, '.runtime', 'postgres.json');
  if (fs.existsSync(localPostgres)) {
    const url = new URL(process.env.DATABASE_URL);
    if (['localhost', '127.0.0.1'].includes(url.hostname) && !await portOpen(url.hostname, Number(url.port || 5432))) {
      const pg = JSON.parse(fs.readFileSync(localPostgres, 'utf8'));
      const started = spawnSync(pg.pgCtl, ['start', '-D', pg.dataDirectory, '-l', pg.log, '-w', '-t', '45'],
        { stdio: 'inherit', windowsHide: true });
      if (started.status !== 0) throw new Error('PostgreSQL lokal tidak dapat dimulai.');
    }
  }
  if (!await require('./check-database.cjs').checkDatabase()) {
    throw new Error('Lengkapi migrasi database sebelum menjalankan aplikasi.');
  }
  const websitePort = Number(process.env.PORT || process.env.port || 3000);
  if (await portOpen('127.0.0.1', websitePort)) {
    throw new Error(`Port ${websitePort} sudah dipakai. Hentikan proses website lama sebelum menjalankan npm start lagi.`);
  }
  await require('./production-build.cjs').ensureProductionBuild();

  const botFile = path.join(root, 'backend', 'whatsapp', '.env');
  if (fs.existsSync(botFile) && !process.argv.includes('--website-only')) {
    const bot = require('dotenv').parse(fs.readFileSync(botFile));
    const runtimeFile = path.join(root, '.runtime', 'node-path.txt');
    const runtimeDirectory = fs.existsSync(runtimeFile) ? fs.readFileSync(runtimeFile, 'utf8').trim() : null;
    const executable = process.env.CHATBOT_NODE_EXECUTABLE ||
      (runtimeDirectory ? path.join(runtimeDirectory, process.platform === 'win32' ? 'node.exe' : 'node') : process.execPath);
    const version = spawnSync(executable, ['-p', 'process.versions.node'], { encoding: 'utf8', windowsHide: true });
    const [major, minor] = (version.stdout || '').trim().split('.').map(Number);
    if (version.status !== 0 || !(major > 22 || major === 22 && minor >= 13)) {
      throw new Error('Backend chatbot memerlukan Node.js >=22.13. Atur CHATBOT_NODE_EXECUTABLE ke runtime yang sesuai.');
    }
    const botOrigin = `http://${bot.HOST || '127.0.0.1'}:${bot.PORT || 3100}`;
    if (await portOpen(bot.HOST || '127.0.0.1', Number(bot.PORT || 3100))) {
      const response = await fetch(`${botOrigin}/admin/recommendations`, {
        headers: { Authorization: `Bearer ${bot.ADMIN_API_TOKEN}` }, signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Port chatbot dipakai layanan yang tidak sesuai dengan konfigurasi bot.');
      console.log(`Backend chatbot sudah aktif: ${botOrigin}`);
    } else {
      // Do not pass the website's database credentials to the WhatsApp process.
      const botEnv = { ...shellEnv, NODE_ENV: 'production' };
      for (const key of ['DATABASE_URL', 'DIRECT_URL', 'NEXTAUTH_SECRET', 'WHATSAPP_BACKEND_TOKEN', 'WHATSAPP_BACKEND_URL', 'PORT', 'HOST']) delete botEnv[key];
      botEnv.PATH = `${path.dirname(executable)}${path.delimiter}${botEnv.PATH || ''}`;
      launch('chatbot', executable, ['backend/whatsapp/index.js'], botEnv);
    }
  } else if (!process.argv.includes('--website-only')) {
    console.warn('Backend chatbot belum dikonfigurasi: siapkan backend/whatsapp/.env.');
  }
  launch('website', process.execPath, ['server.js']);
}

main().catch((error) => {
  console.error('Startup gagal:', error.message);
  stop(1);
});

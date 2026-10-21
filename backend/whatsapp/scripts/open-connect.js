import dotenv from 'dotenv';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { serviceDirectory } from '../config.js';

dotenv.config({ path: resolve(serviceDirectory, '.env'), quiet: true });
if (!process.env.ADMIN_API_TOKEN) throw new Error('ADMIN_API_TOKEN belum diisi pada .env.');
const url = new URL(`http://127.0.0.1:${Number(process.env.PORT || 3100)}/connect`);
url.hash = new URLSearchParams({ token: process.env.ADMIN_API_TOKEN }).toString();
// Fragment tidak dikirim dalam HTTP/access log. Halaman menghapusnya setelah dibaca.
const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open';
const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url.href] : [url.href];
const child = spawn(command, args, { shell: false, stdio: 'ignore', detached: true });
child.on('error', () => {
  console.error('Browser tidak dapat dibuka. Buka /connect lalu masukkan token admin dari .env secara lokal.');
  process.exitCode = 1;
});
child.unref();
console.info(`Membuka ${url.origin}${url.pathname}. Token tidak ditampilkan di terminal.`);

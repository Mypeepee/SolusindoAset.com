import dotenv from 'dotenv';
import express from 'express';
import { resolve } from 'node:path';
import { serviceDirectory } from '../config.js';
import { secretsEqual } from '../lib/security.js';

// Endpoint sementara untuk tahap verifikasi Meta, sebelum credential API tersedia.
// POST sengaja mendapat 503: pesan belum diproses, jadi jangan di-ACK sebagai berhasil.
dotenv.config({ path: resolve(serviceDirectory, '.env'), quiet: true });
const token = process.env.WA_VERIFY_TOKEN?.trim();
const port = Number(process.env.PORT || 3100);
if (!token || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Isi WA_VERIFY_TOKEN dan PORT yang valid di .env sebelum verifikasi.');
  process.exitCode = 1;
} else {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  });
  app.get('/health', (req, res) => res.json({ ok: true, mode: 'verification_only', whatsapp_connected: false }));
  app.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] !== 'subscribe' ||
        !secretsEqual(req.query['hub.verify_token'], token) ||
        typeof req.query['hub.challenge'] !== 'string') return res.sendStatus(403);
    console.info(JSON.stringify({ event: 'webhook_verification_accepted', at: new Date().toISOString() }));
    return res.type('text/plain').send(req.query['hub.challenge']);
  });
  app.post('/webhook', (req, res) => res.set('Retry-After', '60').status(503).json({ error: 'SETUP_NOT_COMPLETE' }));
  app.use((req, res) => res.sendStatus(404));
  const server = app.listen(port, '127.0.0.1', () => console.info(`Webhook verification listening on 127.0.0.1:${port}`));
  server.on('error', (error) => {
    console.error(JSON.stringify({ event: 'setup_server_error', code: error.code }));
    process.exitCode = 1;
  });
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}

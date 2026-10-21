import express from 'express';
import { createWebhookRouter } from './routes/webhook.js';
import { createAdminRouter } from './routes/admin.js';
import { logFailure } from './lib/http.js';
import { resolve } from 'node:path';
import { serviceDirectory } from './config.js';
import { createSandboxRouter } from './routes/sandbox.js';
import { createAiController } from './services/ai_controller.js';
import { UNDERSTANDING_VERSION } from './services/buyer_turn.js';
import { STOCK_CONFIRMATION_VERSION } from './services/stock_confirmation.js';

export function createApp({ config, store, processor, whatsapp, agents, catalog, checks, logger = console, now = Date.now }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
    next();
  });
  app.get('/health', (req, res) => res.status(processor.accepting ? 200 : 503).json({
    ok: processor.accepting, transport: config.transport || 'cloud',
    understanding_version: UNDERSTANDING_VERSION,
    stock_confirmation_version: STOCK_CONFIRMATION_VERSION,
    whatsapp_connected: whatsapp?.getStatus?.().connected ?? null,
  }));
  app.get('/connect', (req, res) => {
    res.sendFile(resolve(serviceDirectory, 'public/connect.html'));
  });
  app.use('/connect-assets', express.static(resolve(serviceDirectory, 'public'), { index: false }));
  // Jangan letakkan express.json() global sebelum router webhook.
  if (config.transport !== 'baileys') app.use('/webhook', createWebhookRouter(config.wa, processor, now));
  app.use('/admin', createAdminRouter({ token: config.adminToken, store, processor, whatsapp, checks }));
  if (agents) app.use('/agents', agents.router());
  if (catalog) app.use('/sandbox', createSandboxRouter({ config, catalog, ai: createAiController(config.llm), now }));
  app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
    if (status >= 500) logFailure(logger, 'request_failed', error);
    const retryAfter = Number.isFinite(error.retryAfter) ? Math.max(1, Math.min(86400, Math.ceil(error.retryAfter))) : status === 503 ? 10 : null;
    if (retryAfter) res.set('Retry-After', String(retryAfter));
    res.status(status).json({ error: error.code || (status < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR'), ...(retryAfter ? { retry_after_seconds: retryAfter } : {}) });
  });
  return app;
}

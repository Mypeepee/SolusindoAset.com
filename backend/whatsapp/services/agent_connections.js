import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Router } from 'express';
import { MemoryStore } from '../state/memory_store.js';
import { BaileysClient } from './baileys.js';
import { MessageProcessor } from './message_processor.js';
import { createAiController } from './ai_controller.js';
import { createAdminRouter } from '../routes/admin.js';
import { secretsEqual } from '../lib/security.js';
import { ServiceError, logFailure } from '../lib/http.js';
import { StockConfirmation } from './stock_confirmation.js';

const validAgent = (id) => /^AG[0-9]{1,18}$/.test(id);

// Hanya Next.js yang memegang token ini. Identitas agent berasal dari sesi login
// dan diverifikasi ke DB oleh Next.js, tidak diterima dari body/query browser.
export class AgentConnections {
  constructor(config, catalog, { createClient = (options) => new BaileysClient(options), logger = console, assetChecks, clients, controls, notifications } = {}) {
    Object.assign(this, { config, catalog, createClient, logger, assetChecks, clients, controls, notifications });
    this.directory = join(dirname(config.wa.authFile), 'agents');
    this.entries = new Map();
    this.stopping = false;
  }

  get(id) {
    if (!validAgent(id)) throw new ServiceError('INVALID_AGENT', 400);
    if (this.stopping) throw new ServiceError('SHUTTING_DOWN', 503);
    if (this.entries.has(id)) return this.entries.get(id);
    if (this.entries.size >= this.config.maxAgentConnections) throw new ServiceError('CONNECTION_CAPACITY', 503);
    const control = this.controls?.forTenant(id);
    const store = new MemoryStore(this.config, Date.now, control);
    const whatsapp = this.createClient({ ...this.config.wa, control, authFile: join(this.directory, id, 'session.sqlite') });
    const checks = this.assetChecks ? new StockConfirmation({ checks: this.assetChecks.forTenant(id), whatsapp, catalog: this.catalog,
      recipient: this.config.stokerPhone, transport: this.config.transport, logger: this.logger }) : null;
    const processor = new MessageProcessor({ config: this.config, store, whatsapp, checks, clients: this.clients, catalog: this.catalog, agentId: id,
      recommendationPreferences: this.notifications?.forAgent(id),
      ai: createAiController(this.config.llm), logger: this.logger });
    const entry = { store, whatsapp, processor, checks };
    entry.router = createAdminRouter({ token: this.config.adminToken, ...entry, notifications: this.notifications, agentId: id });
    this.entries.set(id, entry);
    return entry;
  }

  restore() {
    if (!existsSync(this.directory)) return;
    for (const item of readdirSync(this.directory, { withFileTypes: true })) {
      if (!item.isDirectory() || !validAgent(item.name) || !existsSync(join(this.directory, item.name, 'session.sqlite'))) continue;
      try {
        const { whatsapp, processor } = this.get(item.name);
        whatsapp.start((messages) => processor.acceptBatch(messages));
      } catch (error) { logFailure(this.logger, 'agent_session_restore_failed', error); }
    }
    void this.notifications?.flush();
  }

  router() {
    const router = Router();
    router.use('/:agentId/admin', (req, res, next) => {
      const header = req.get('Authorization');
      if (!header?.startsWith('Bearer ') || !secretsEqual(header.slice(7), this.config.adminToken)) return res.sendStatus(401);
      try { this.get(req.params.agentId).router(req, res, next); }
      catch (error) { next(error); }
    });
    return router;
  }

  cleanup() {
    for (const [id, { store, processor, whatsapp, checks }] of this.entries) {
      store.cleanup(processor.pendingByPhone);
      // Jangan menahan slot hanya karena agent melihat halaman tanpa memasangkan WA.
      if (!whatsapp.auth && !processor.pending && !store.sessions.size && !checks?.running && !checks?.list().total) {
        this.entries.delete(id);
      }
    }
  }

  flushStockChecks() {
    for (const { checks } of this.entries.values()) void checks?.flush();
  }

  flushManualPauses() {
    for (const { processor } of this.entries.values()) processor.flushManualPauses();
  }

  async shutdown() {
    this.stopping = true;
    for (const { processor } of this.entries.values()) processor.accepting = false;
    await Promise.all([...this.entries.values()].map(async ({ whatsapp, processor, checks }) => {
      await processor.drain();
      await checks?.stop();
      await whatsapp.stop();
      whatsapp.auth?.close();
    }));
  }
}

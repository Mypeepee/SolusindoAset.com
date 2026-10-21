import dotenv from 'dotenv';
import { resolve, dirname, join } from 'node:path';
import { loadConfig, serviceDirectory } from './config.js';
import { createApp } from './app.js';
import { MemoryStore } from './state/memory_store.js';
import { loadCatalog } from './services/catalog.js';
import { createAiController } from './services/ai_controller.js';
import { createWhatsAppClient } from './services/whatsapp.js';
import { MessageProcessor } from './services/message_processor.js';
import { BaileysClient } from './services/baileys.js';
import { AgentConnections } from './services/agent_connections.js';
import { DatabaseCatalog } from './services/property_database.js';
import { AssetCheckStore } from './state/asset_checks.js';
import { ClientOutbox } from './state/client_outbox.js';
import { ConversationControl } from './state/conversation_control.js';
import { RecommendationOutbox } from './state/recommendation_outbox.js';
import { NewPropertyNotifications } from './services/new_property_notifications.js';
import { StockConfirmation } from './services/stock_confirmation.js';
import { logFailure } from './lib/http.js';

// Tidak membaca .env milik aplikasi Next.js/Python di direktori induk.
dotenv.config({ path: resolve(serviceDirectory, '.env'), quiet: true });
// Playground can run without opening or restoring any WhatsApp connections.
const autoConnect = !process.argv.includes('--no-auto-connect');

try {
  process.umask(0o077);
  const config = loadConfig();
  const catalog = config.propertyDatabase ? new DatabaseCatalog(config.propertyDatabase) : await loadCatalog(config);
  const controls = new ConversationControl(join(dirname(config.wa.authFile || resolve(serviceDirectory, '.auth/session.sqlite')), 'conversation-control.sqlite'));
  const control = controls.forTenant('operator');
  const store = new MemoryStore(config, Date.now, control);
  const assetChecks = new AssetCheckStore(join(dirname(config.wa.authFile || resolve(serviceDirectory, '.auth/session.sqlite')), 'asset-checks.sqlite'));
  const clients = config.clientDatabase ? new ClientOutbox(join(dirname(config.wa.authFile || resolve(serviceDirectory, '.auth/session.sqlite')), 'client-outbox.sqlite'), config.clientDatabase) : null;
  const whatsapp = config.transport === 'baileys' ? new BaileysClient({ ...config.wa, control }) : createWhatsAppClient(config.wa);
  const checks = new StockConfirmation({ checks: assetChecks.forTenant('operator'), whatsapp, catalog, recipient: config.stokerPhone, transport: config.transport });
  const processor = new MessageProcessor({
    config, store, catalog, checks, clients, agentId: 'AG108', ai: createAiController(config.llm),
    whatsapp,
  });
  const notificationQueue = config.recommendations ? new RecommendationOutbox(join(dirname(config.wa.authFile), 'recommendations.sqlite')) : null;
  const notifications = notificationQueue ? new NewPropertyNotifications({ queue: notificationQueue, connection: config.recommendations,
    entries: () => agents?.entries || [] }) : null;
  const agents = config.transport === 'baileys' ? new AgentConnections(config, catalog, { assetChecks, clients, controls, notifications }) : null;
  const app = createApp({ config, store, processor, whatsapp, agents, catalog, checks });
  const server = app.listen(config.port, config.host, () => {
    console.info(`Solusindo WhatsApp listening on ${config.host}:${config.port}`);
    // Compile the property endpoint before the first buyer finishes qualifying.
    // An empty lookup reads no listings and never sends a WhatsApp message.
    void catalog.warmup?.().catch((error) => logFailure(console, 'property_warmup_failed', error));
    if (config.transport === 'baileys' && autoConnect) {
      try {
        whatsapp.start((messages) => processor.acceptBatch(messages));
        agents.restore();
        console.info(`Buka halaman pairing dengan: npm run connect`);
      } catch (error) {
        console.error({ event: 'baileys_start_failed', code: error.code || error.message });
        server.close(); process.exitCode = 1;
      }
    }
  });
  server.on('error', (error) => {
    console.error({ event: 'server_error', code: error.code });
    process.exitCode = 1;
  });
  const cleanup = setInterval(() => { store.cleanup(processor.pendingByPhone); agents?.cleanup(); }, 60000);
  cleanup.unref();
  const clientRetry = setInterval(() => { void clients?.flush(); }, 5000);
  clientRetry.unref();
  const recommendationRetry = setInterval(() => { void notifications?.flush(); }, 60000);
  recommendationRetry.unref();
  const stockRetry = setInterval(() => { void checks.flush(); agents?.flushStockChecks(); processor.flushManualPauses(); agents?.flushManualPauses(); }, 5000);
  stockRetry.unref();

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    processor.accepting = false;
    clearInterval(cleanup);
    clearInterval(clientRetry);
    clearInterval(recommendationRetry);
    clearInterval(stockRetry);
    const notificationsStopped = notifications?.stop();
    const hardStop = setTimeout(() => {
      console.error({ event: 'shutdown_timeout', pending: processor.pending });
      process.exit(1);
    }, 95000);
    hardStop.unref();
    const closed = new Promise((resolveClose) => server.close(resolveClose));
    await Promise.all([closed, notificationsStopped, processor.drain(), agents?.shutdown()]);
    await checks.stop();
    await whatsapp.stop?.();
    whatsapp.auth?.close();
    assetChecks.close();
    controls.close();
    await clients?.close();
    notificationQueue?.close();
    clearTimeout(hardStop);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch (error) {
  // Startup hanya membaca konfigurasi lokal; tidak mencetak nilai secret.
  console.error(`Startup gagal: ${error.message}`);
  process.exitCode = 1;
}

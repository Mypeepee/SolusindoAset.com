import { randomUUID } from 'node:crypto';
import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';
import { AssetCheckStore } from '../../state/asset_checks.js';
import { config, noAi } from './single-recommendation-dialogues.js';
import { NOW, interestFixture } from './purchase-interest-dialogues.js';

// No real WhatsApp connection, document uploads, customer identity, or payments.
export function purchaseRuntime({ buffer = Buffer.from('%PDF-simulation'), future = false, verdict = null,
  ai = noAi, control = null, failPdf = false } = {}) {
  const phone = '6280000000001', sent = [], transcript = [], errors = [];
  const catalog = interestFixture({ example: 'pacarkembang', future });
  const db = new AssetCheckStore(':memory:', { now: () => NOW }), checks = db.forTenant('AG108');
  const store = new MemoryStore(config, () => NOW, control);
  const processor = new MessageProcessor({ config, store, catalog, checks, ai, now: () => NOW,
    documents: { async generate(id) {
      if (failPdf) throw new Error('MOU_PDF_UNAVAILABLE');
      return { assetId: id, filename: `Draf_MOU_Aset_${id}.pdf`, mimeType: 'application/pdf', buffer };
    } },
    whatsapp: {
      async sendText(_phone, text) { sent.push({ type: 'text', text }); return randomUUID(); },
      async sendDocument(_phone, file, caption) {
        sent.push({ type: 'pdf', filename: file.filename, bytes: file.buffer.length, caption }); return randomUUID();
      },
    }, logger: { error(event) { errors.push(event); } },
  });
  const send = async (text, type = 'text') => {
    const start = sent.length;
    processor.acceptBatch([{ id: randomUUID(), from: phone, text, type, timestamp: NOW }]);
    await processor.drain();
    const replies = sent.slice(start);
    transcript.push({ client: type === 'text' ? text : `[Lampiran ${type} tiruan; tanpa isi dokumen]`, replies });
    return replies;
  };
  const prepare = async () => {
    await send(catalog.example.opening); await send(catalog.example.choice); await send(catalog.example.cost);
    if (verdict) checks.complete(checks.list().items[0].id, { result: verdict, reference: 'SIMULATION ONLY' });
  };
  return { phone, processor, catalog, store, checks, sent, transcript, errors, send, prepare,
    session: () => store.get(phone), close: () => db.close() };
}

import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';
import { ConversationControl } from '../../state/conversation_control.js';
import { propertyDetailsReply } from '../../services/property_details.js';
import { previewSurveys } from '../../services/survey_booking.js';
import { ServiceError } from '../../lib/http.js';
export const NOW = Date.parse('2026-10-21T09:00:00+07:00'), PHONE = '6280000000001';
export function consultationFixture(type = 'SECONDARY', { named = true, blocked = [], selected = true } = {}) {
  let time = NOW, sequence = 0, loseReceipt = false, processor;
  const bookings = new Map(), sent = [], errors = [], transcript = [], calls = [];
  const asset = { id: '9901101', name: `Rumah Contoh ${type}`, transaction_type: type, category: 'RUMAH', asking_price: type === 'SEWA' ? 50000000 : 1000000000,
    limit_price: type === 'LELANG' ? 1000000000 : null, deposit: 200000000, auction_at: '2026-11-05T03:00:00Z',
    location: 'Surabaya', full_address: 'Jalan Simulasi No. 1, Surabaya', address: { city: 'Surabaya', province: 'Jawa Timur', street: 'Jalan Simulasi No. 1' },
    specifications: { land_area_m2: 120, building_area_m2: 90, has_building: true, certificate_type: 'SHM' }, publication: { status: 'TERSEDIA' },
    ...(type === 'SEWA' ? { rental: { period: 'TAHUNAN' } } : {}), detail_url: `https://example.invalid/${type === 'LELANG' ? 'Lelang' : type === 'SEWA' ? 'Sewa' : 'Jual'}/rumah-simulasi-9901101` };
  const controls = new ConversationControl(':memory:', () => time);
  const config = { transport: 'baileys', replyDelayMs: 0, manualReplyPauseMs: 300000, maxSessions: 50, maxPending: 100, maxPendingPerPhone: 20, maxDedup: 1000, sessionTtlMs: 86400000 };
  const surveys = {
    async availability(agent, property, date) { calls.push({ action: 'availability', agent, property, date }); const r = await previewSurveys.availability(agent, property, date); return { ...r, blockedSlots: r.blockedSlots.map(s => ({ ...s, blocked: blocked.includes(s.label) })) }; },
    async book(body) { calls.push({ action: 'book', ...body });
      if (!bookings.has(body.request_id)) bookings.set(body.request_id, { booking_id: String(100 + bookings.size + 1), agent_id: body.agent_id, property_id: body.property_id, date: body.date, time: body.time, status: 'PENDING', simulated: true });
      if (loseReceipt) { loseReceipt = false; throw new ServiceError('UPSTREAM_TIMEOUT', 504); }
      return bookings.get(body.request_id);
    },
  };
  const whatsapp = { getStatus: () => ({ connected: true, phone: '6280000000099' }), getContactPhone: from => from,
    async sendText(to, text) { sent.push({ to, text }); return `out-${sent.length}`; } };
  const catalog = { async resolve(text, previousId) { const id = /\b(?:Kode|kode)\s+(\d+)/.exec(text)?.[1] || previousId;
    return { status: id === asset.id ? 'matched' : 'needs_property', asset: id === asset.id ? structuredClone(asset) : null, catalog: [], source: 'database_listing_publik' }; } };
  const build = () => new MessageProcessor({ config, store: new MemoryStore(config, () => time, controls.forTenant('AG108')), whatsapp, catalog, surveys, agentId: 'AG108',
    ai: { async generate() { throw new Error('Known consultation must use deterministic listing/policy data'); } }, now: () => time, logger: { error(e) { errors.push(e); } } });
  processor = build();
  const session = processor.store.create(PHONE); session.client_identity = named ? { name: 'Koko', salutation: null, asked: true } : { name: null, salutation: null, asked: true };
  if (selected) { session.asset_id = asset.id; processor.store.append(session, 'user', `Kode ${asset.id}`); processor.store.append(session, 'assistant', propertyDetailsReply(asset, { now: time })); }
  return { asset, sent, bookings, calls, errors, transcript, surveys,
    get processor() { return processor; },
    loseNextReceipt() { loseReceipt = true; },
    restart() { processor = build(); }, advance(ms) { time += ms; },
    async send(text) { const before = sent.length; transcript.push({ speaker: 'Klien', text }); processor.acceptBatch([{ id: `in-${++sequence}`, from: PHONE, text, type: 'text', timestamp: time }]); await processor.drain();
      const replies = sent.slice(before).map(x => x.text); transcript.push(...replies.map(reply => ({ speaker: 'Bot', text: reply }))); return replies.join('\n\n'); },
    close() { controls.close(); },
  };
}

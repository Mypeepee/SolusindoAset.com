import assert from 'node:assert/strict';
import { MemoryStore } from '../../state/memory_store.js';
import { ConversationControl } from '../../state/conversation_control.js';
import { MessageProcessor } from '../../services/message_processor.js';
import { NewPropertyNotifications } from '../../services/new_property_notifications.js';
import { RecommendationOutbox } from '../../state/recommendation_outbox.js';

export const NOW = Date.parse('2026-10-20T10:00:00+07:00');
export const PHONE = '6280000000001', AGENT = 'AG108';
export const SAVED_CRITERIA = { location: 'Surabaya', city: 'Surabaya', category: 'TANAH', transaction_type: 'LELANG', max_price: 1000000000, min_land_area_m2: 100 };
const districts = ['Wiyung', 'Rungkut', 'Tandes', 'Sukolilo', 'Lakarsantri', 'Sambikerep', 'Gunung Anyar', 'Benowo'];
const prices = [850, 900, 780, 950, 600, 710, 820, 990], land = [120, 150, 100, 180, 110, 130, 140, 160];
export const assets = districts.map((district, i) => ({
  id: String(9001001 + i), name: `Tanah ${district}`, transaction_type: 'LELANG', category: 'TANAH',
  limit_price: prices[i] * 1000000, price_display: `Rp ${prices[i]}.000.000`, asking_price: null,
  deposit: prices[i] * 200000, auction_at: new Date(NOW + 14 * 86400000).toISOString(),
  full_address: `Jalan Contoh ${district} No. ${i + 1}, Kota Surabaya`, location: `${district}, Kota Surabaya`,
  address: { street: `Jalan Contoh ${district} No. ${i + 1}`, district, city: 'Surabaya', province: 'Jawa Timur', village: null },
  specifications: { land_area_m2: land[i], building_area_m2: null, certificate_type: 'SHM' },
  publication: { status: 'TERSEDIA' }, detail_url: `https://example.invalid/Lelang/tanah-${district.toLowerCase().replaceAll(' ', '-')}-${9001001 + i}`,
}));
const initialText = `Halo Koko, saya ada 4 tanah baru yang sepertinya cocok dengan kriteria yang Bapak/Ibu cari untuk dibeli:\n\n${assets.slice(0, 4).map((a, i) => `${i + 1}. *${a.name}*\n   ${a.price_display} (harga limit lelang)\n   📍 ${a.location}\n   LT ${a.specifications.land_area_m2} m²\n   ${a.detail_url}/AG108`).join('\n\n')}\n\nKalau ada yang menarik, saya bisa aturkan jadwal survei. Ada yang ingin dilihat lebih dulu?\n\n— Jason Christopher Liendo`;

// Runs the production queue, delivery, processor, search parser and templates.
// Only property data, the internal API and the WhatsApp transport are mocked.
export async function notificationFollowupFixture({ previousIds = [], queuedCount = 4 } = {}) {
  let time = NOW, sequence = 0, processor;
  const config = { transport: 'baileys', replyDelayMs: 0, manualReplyPauseMs: 300000, maxSessions: 100, maxPending: 100,
    maxPendingPerPhone: 20, maxDedup: 1000, sessionTtlMs: 86400000, sessionIdleMs: 45 * 60000 };
  const control = new ConversationControl(':memory:', () => time), queue = new RecommendationOutbox(':memory:', () => time);
  const sent = [], queries = [], errors = [];
  const whatsapp = { auth: {}, getStatus: () => ({ connected: true, phone: '6280000000099' }), getContactPhone: p => p === 'lid:987654321' ? PHONE : p,
    getContactAliases: p => [PHONE, 'lid:987654321'].includes(p) ? [PHONE, 'lid:987654321'] : [p],
    async sendText(phone, text) { sent.push({ role: 'assistant', phone, text }); return `out-${sent.length}`; } };
  const catalog = { async resolve(text, previousId, criteria) {
    queries.push({ text, previousId, criteria: criteria ? structuredClone(criteria) : null });
    if (!criteria) {
      const id = /\b(?:Kode|kode)\s+(\d+)/.exec(text)?.[1] || previousId;
      const asset = assets.find(a => a.id === id);
      // The selected third asset has a newer limit than the initial message.
      const fresh = asset ? { ...asset, ...(id === '9001003' ? { limit_price: 785000000, price_display: 'Rp 785.000.000' } : {}) } : null;
      return { status: fresh ? 'matched' : 'not_found', asset: fresh, catalog: [], source: 'database_listing_publik' };
    }
    const excluded = new Set(criteria.exclude_ids || []);
    const found = assets.filter(a => !excluded.has(a.id) && a.limit_price <= criteria.max_price && a.specifications.land_area_m2 >= (criteria.min_land_area_m2 || 0) &&
      (!criteria.category || a.category === criteria.category) && (!criteria.city || /surabaya/i.test(criteria.city)) &&
      (!criteria.district || criteria.district.toLowerCase() === a.address.district.toLowerCase()));
    return { status: found.length ? 'recommendations' : 'not_found', asset: null, catalog: found.slice(0, 5), source: 'database_listing_publik', selection: { schedule_priority: 'upcoming' } };
  } };
  const ai = { generate() { assert.fail('Known follow-ups must be answered using current catalog data and templates'); } };
  const build = () => new MessageProcessor({ config, store: new MemoryStore(config, () => time, control.forTenant(AGENT)), whatsapp, catalog, ai,
    now: () => time, logger: { error(e) { errors.push(e); } } });
  processor = build();
  queue.initialize(AGENT, '9001000');
  queue.page(AGENT, '9001000', String(9001000 + queuedCount), assets.slice(0, queuedCount).map(a => ({ client_id: 'KL00001', property_id: a.id })));
  const notifier = new NewPropertyNotifications({ queue, connection: { url: 'https://example.invalid/api/mock-recommendations', token: 'x'.repeat(32), timeoutMs: 1000 },
    entries: () => [[AGENT, { processor, whatsapp }]], now: () => time, logger: { error(e) { errors.push(e); } },
    fetchImpl: async (_url, options) => {
      const input = JSON.parse(options.body);
      if (input.action === 'scan') return Response.json({ cursor: input.cursor, candidates: [], more: false });
      if (input.action === 'daily') return Response.json({ after_client: input.after_client, more: false, candidates: [], checked: 0, matched: 0 });
      if (input.action === 'acknowledge') return Response.json({ acknowledged: true });
      assert.equal(input.action, 'prepare');
      return Response.json({ phone: PHONE, text: initialText, receipt: 'fixture-only-receipt', name: 'Koko', search_criteria: SAVED_CRITERIA,
        previous_property_ids: previousIds, property_ids: input.property_ids });
    } });
  await notifier.flush();
  const transcript = [{ speaker: 'Bot', text: sent[0]?.text || '' }];
  return { assets, sent, transcript, queries, errors, queue, notifier,
    get processor() { return processor; },
    restart() { processor = build(); },
    advance(ms) { time += ms; },
    async send(text, from = PHONE) {
      const start = sent.length; transcript.push({ speaker: 'Klien', text });
      processor.acceptBatch([{ id: `in-${++sequence}`, from, type: 'text', text, timestamp: time }]); await processor.drain();
      const replies = sent.slice(start).map(item => item.text); for (const reply of replies) transcript.push({ speaker: 'Bot', text: reply });
      return replies.join('\n\n');
    },
    async close() { await notifier.stop(); control.close(); queue.close(); },
  };
}

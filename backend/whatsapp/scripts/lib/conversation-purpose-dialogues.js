import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';

export const LEGAL_CONVERSATION = [
  'Selamat siang Pak jaswan Christopher... Saya kuasa hukum dr pak darlan dan bu Ratna... Mau minta waktu bpak utk komunikasi atas aset yang telah dibeli oleh bapak untuk kita komunikasi kan dibeli kembali oleh klien kami....',
  'Sy muhamad Takim dr kantor ARN law firm',
  'Beli kembali rmh lelang atas nm bu Ratna',
  'Kutisari', 'Surabaya', '7,5 x 15', '425 juta', '7,5 x 15',
  '7,5 meter dikalikan 15 meter', '120 meter persegi', '+/- 120 meter persegi', 'Batas minimal',
];
export const PROPERTY_OPENING = 'Halo Jason Christopher Liendo 👋\n\nSaya tertarik dengan properti lelang berikut, apakah masih tersedia?\n\nRumah lelang di Surabaya\nKode: 31551\n\nDetail lengkap:\nhttps://solusindoaset.com/Lelang/rumah-simulasi-31551\n\nMohon infonya, terima kasih!';
export const PURPOSE_PHONE = '6281234567890';

export function purposeFixture({ control = null, ai: overrideAi = {}, config: overrides = {}, whatsapp: overrideWhatsapp = {} } = {}) {
  let now = Date.parse('2026-11-06T13:07:02+07:00'), sequence = 0;
  const config = { transport: 'baileys', requirePropertyInquiry: true, handoffNonBuyerMessages: true,
    replyDelayMs: 0, maxSessions: 100, maxPending: 100, maxPendingPerPhone: 30,
    maxDedup: 1000, sessionTtlMs: 86400000, sessionIdleMs: 2700000, ...overrides };
  const sent = [], reads = [], generated = [], captures = [], errors = [], transcript = [];
  const ai = { async generate(input) { generated.push(input); return { reply: 'Jawaban properti dari provider tiruan.', qualification: {} }; }, ...overrideAi };
  const whatsapp = { async sendText(to, text) { sent.push({ to, text }); return `sent-${sent.length}`; }, ...overrideWhatsapp };
  const f = { config, sent, reads, generated, captures, errors, transcript, ai, whatsapp,
    message(text, from = PURPOSE_PHONE) { return { id: `purpose-${++sequence}`, from, type: 'text', text, timestamp: now }; },
    async send(text, from = PURPOSE_PHONE) {
      const before = sent.length, accepted = f.processor.acceptBatch([f.message(text, from)]);
      await f.processor.drain();
      const replies = sent.slice(before).map(item => item.text);
      transcript.push({ user: text, replies }); return { accepted, replies };
    },
    advance(ms) { now += ms; },
    session(phone = PURPOSE_PHONE) { return f.store.get(phone); },
    restart() {
      f.store = new MemoryStore(config, () => now, control);
      f.processor = new MessageProcessor({ config, store: f.store, ai, whatsapp, now: () => now,
        logger: { error: error => errors.push(error) },
        clients: { setName(...input) { captures.push(input); }, enqueue(...input) { captures.push(input); }, async flush() {} },
        catalog: { async resolve(text, previousId, criteria) {
          reads.push({ text, previousId, criteria });
          const id = /Kode\s+(\d+)/i.exec(text)?.[1] || previousId;
          return { asset: id ? { id, name: 'Rumah sumber simulasi', transaction_type: 'LELANG', category: 'RUMAH',
            limit_price: 401000000, deposit: 110000000, publication: { status: 'TERSEDIA' }, auction_at: '2026-11-10T03:00:00Z',
            address: { city: 'Surabaya', district: 'Benowo' }, specifications: { land_area_m2: 120 },
            detail_url: `https://solusindoaset.com/Lelang/rumah-simulasi-${id}` } : null,
            catalog: [], status: id ? 'matched' : 'not_found', source: 'synthetic_fixture' };
        } },
      });
    },
  };
  f.restart(); return f;
}

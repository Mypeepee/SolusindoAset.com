import dotenv from 'dotenv';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, serviceDirectory } from '../config.js';
import { createAiController } from '../services/ai_controller.js';
import { planClosingTurn } from '../services/closing_state.js';
import { replyFromClosingPlan } from '../services/closing_controller.js';

const live = process.argv.includes('--live');
let ai = {};
if (live) {
  dotenv.config({ path: resolve(serviceDirectory, '.env'), quiet: true });
  const config = loadConfig();
  ai = createAiController({ ...config.llm, timeoutMs: 15000, fallbackModel: null });
}
const now = Date.now(), asset = { id: '121820', transaction_type: 'LELANG', limit_price: 417128521,
  auction_at: '2026-07-03T10:00:00+07:00', publication: { status: 'TERSEDIA' } };
const check = { status: 'completed', external_check_performed: true, stock_confirmation: {
  asset_id: asset.id, auction_at: asset.auction_at, result: 'available', confirmed_at: now - 1000,
} };
const serious = 'Baik pak, saya serius untuk aset ini, langkah selanjutnya bagaimana ya?';
const pending = planClosingTurn({ asset, text: serious, now });
const dp = planClosingTurn({ asset, conversion: pending.conversion, text: 'boleh', now });
const oldDpQuestion = 'Ada ketentuan DP yang ingin ditanyakan sambil menunggu konfirmasi asetnya?';
const cases = [
  { label: 'Jadwal lewat, stok belum terkonfirmasi', text: serious, plan: pending },
  { label: 'Menjawab boleh pada undangan mengajukan pertanyaan', text: 'boleh',
    previous: 'Ada yang ingin ditanyakan tentang pengecekan jadwalnya?',
    plan: planClosingTurn({ asset, conversion: { ...pending.conversion, pending_action: 'ask_question' }, text: 'boleh', now }) },
  { label: 'Nominal DP dihitung backend, stok belum terkonfirmasi', text: 'DP-nya berapa?', plan: dp },
  { label: 'Tidak ada pertanyaan DP; lanjut ke informasi akun tanpa mengulang DP', text: 'tidak ada', previous: oldDpQuestion,
    plan: planClosingTurn({ asset, conversion: { ...dp.conversion, pending_action: 'ask_question', pending_question: oldDpQuestion }, text: 'tidak ada', now }) },
  { label: 'Stok diasumsikan telah dikonfirmasi tersedia; klien bertanya data akun', text: 'Akunnya atas nama siapa, perlu data apa?',
    plan: planClosingTurn({ asset, conversion: pending.conversion, check, text: 'Akunnya atas nama siapa, perlu data apa?', now }) },
  { label: 'Stok diasumsikan tersedia; klien bertanya bidding dan batas harga', text: 'Harga mentok saya 900 juta, proses biddingnya gimana?',
    plan: planClosingTurn({ asset, conversion: pending.conversion, check, text: 'Harga mentok saya 900 juta, proses biddingnya gimana?', now }) },
];
const lines = ['# Simulasi percakapan pembelian', '',
  'Data sintetis untuk meninjau bahasa bot. Tidak membaca stok nyata, membuat akun, menjalankan bidding, atau mengirim WhatsApp.',
  `Mode: ${live ? 'provider LLM terkonfigurasi, dengan fallback lokal jika gagal' : 'respons cadangan lokal'}.`, ''];
for (const item of cases) {
  const history = [...(item.previous ? [{ role: 'assistant', content: item.previous }] : []), { role: 'user', content: item.text }];
  const result = await replyFromClosingPlan({ plan: item.plan, ai, history, now });
  lines.push(`## ${item.label}`, '', ...(item.previous ? [`Pertanyaan sebelumnya: ${item.previous}`, ''] : []),
    `Klien: ${item.text}`, '', `Bot: ${(result.replies || [result.reply]).join('\n\n')}`, '',
    `Validasi: topic=${item.plan.topic}, phase=${result.conversion.phase}, pending_action=${result.conversion.pending_action}, generation=${result.generation.mode}${result.generation.reason ? ` (${result.generation.reason})` : ''}.`, '');
  console.log(JSON.stringify({ topic: item.plan.topic, mode: result.generation.mode, reason: result.generation.reason || null }));
}
writeFileSync(resolve(serviceDirectory, 'docs/simulasi-purchase-journey.md'), lines.join('\n'));

import { CLOSING_STATE, CLOSING_FLOW_VERSION, closingDp, closingStockStatus, detectClosingIntent, requestsClosingExit } from './closing_state.js';

const normalize = (text = '') => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const money = value => `Rp ${value.toLocaleString('id-ID')}`;
const sensitive = /\d{8,}|\b(?:nik|otp|password|pin|saldo|tampilkan|bocorkan|semua klien|orang lain)\b/i;
const affirmative = /^(?:(?:ya|iya|oke|ok|baik|siap|boleh|lanjut|setuju|silakan|silahkan|mau)(?:\s+(?:pak|bu|kak|ya|lanjut|dibantu|proses))?[\s,.!]*)+$/i;
const documents = /\b(?:ktp(?:nya)?|cover(?:nya)?|buku tabungan(?:nya)?|berkas(?:nya)?|dokumen(?:nya)?)\b/i;

// Only preparation status/requirements may bypass the broad privacy detector.
// Identifiers and document contents never become LLM context.
export function isPurchasePreparationText(text, conversion) {
  return !!conversion?.purchase_intake && !sensitive.test(text) &&
    documents.test(text) &&
    /\b(?:siap|ada|belum|sudah|udah|perlu|kirim|lampirkan|mana|bagaimana|gimana|apa|boleh|bisa)\b/i.test(text);
}

export function isPurchaseDocumentSubmission({ text = '', type, conversion }) {
  return !!conversion?.purchase_intake &&
    (['image', 'document'].includes(type) || /\d{8,}|\b(?:nik|nomor rekening)\b/i.test(text));
}

export function purchaseHandoffText({ stockStatus, paymentClaimed = false } = {}) {
  return `${paymentClaimed ? 'Informasi pembayaran Anda akan diperiksa oleh tim. ' : 'Baik, saya teruskan persiapan pembelian ini ke tim Solusindo Premier. '}Tim akan membantu melengkapi MOU, mengarahkan pengiriman KTP dan cover buku tabungan atas nama Anda, serta memeriksa kelengkapan berkas.${stockStatus === 'pending' ? ' Kepastian aset dan jadwal lelang tetap dikonfirmasi lebih dahulu; pembayaran tanda jadi menunggu konfirmasi tersebut dan persetujuan MOU.' : ' Pembayaran tanda jadi dilakukan setelah ketentuan MOU disetujui dan instruksi pembayaran dikonfirmasi tim.'}`;
}

/** A buyer-preparation path alongside the existing on-demand SOP explanations. */
export function planPurchaseIntake({ conversion, asset, text, history = [], selectedAssetId = null, searching = false, check, now = Date.now() }) {
  if (!asset || asset.transaction_type !== 'LELANG' || searching || requestsClosingExit(text) || conversion?.outcome) return null;
  const active = conversion?.mode === CLOSING_STATE && conversion.asset_id === asset.id;
  const informed = selectedAssetId === asset.id || history.some(item => item.role === 'assistant' &&
    /DETAIL ASET|ESTIMASI BIAYA PEMBELIAN LELANG/.test(item.content) &&
    (item.content.includes(`Kode ${asset.id}`) || asset.detail_url && item.content.includes(asset.detail_url)));
  const interested = detectClosingIntent(text, { selectedAssetId: asset.id, history });
  const current = active ? conversion.purchase_intake : null;
  if (!current && !(informed && interested)) return null;
  const stock = closingStockStatus(asset, check, now);
  if (stock === 'sold') return null;
  const value = normalize(text);
  const pending = conversion?.pending_action?.startsWith('purchase_');
  const reportsPayment = /\b(?:sudah|udah|telah)\b.{0,30}\b(?:bayar|transfer|setor)\b/.test(value);
  const mentionsDocs = documents.test(value);
  const notReady = mentionsDocs && /\b(?:belum|tidak ada|gak ada|nggak ada|ga ada|nanti|menyiapkan|siapkan dulu)\b/.test(value) ||
    conversion?.pending_action === 'purchase_prepare' && /^(?:belum(?: ada| siap)?|tidak ada|gak ada|nggak ada|ga ada)(?:\s+(?:pak|bu|kak))?$/.test(value);
  const ready = !notReady && (mentionsDocs && /\b(?:siap|sudah ada|udah ada|lengkap)\b/.test(value) || pending && /^(?:sudah|udah|dua duanya|ada|lengkap)(?:\s+(?:ada|siap|lengkap))?(?:\s+(?:pak|bu|kak))?$/.test(value));
  const preparing = (pending || current && conversion.pending_action === 'explain_readiness') && affirmative.test(text.trim());
  if (current && !preparing && !ready && !notReady && !reportsPayment && !interested && !isPurchasePreparationText(text, conversion)) return null;
  if (current && /\b(?:refund|kalah|biaya|balik nama|dp berapa|jaminan|jadwal|bidding|akun|mou)\b/.test(value) && !ready && !notReady && !reportsPayment && !preparing) return null;
  const next = { ...(active ? conversion : {}), mode: CLOSING_STATE, asset_id: asset.id,
    flow_version: CLOSING_FLOW_VERSION, version: (conversion?.version || 0) + 1,
    stock_status: stock, max_bid: active ? conversion.max_bid || null : null,
    outcome: null, process_understood: active ? conversion.process_understood === true : false,
    explained_topics: active ? conversion.explained_topics || [] : [],
    purchase_intake: { ...(current || {}), stage: 'preparation', documents_verified: false, payment_verified: false },
  };
  // Bare acknowledgement advances to a practical assistance offer, never to
  // "documents received", agreement signed, or a verified payment.
  if (current && (ready || reportsPayment || pending && conversion.pending_action === 'purchase_handoff' && preparing)) {
    next.purchase_intake = { ...next.purchase_intake, stage: 'agent_review',
      documents_reported_ready: ready || current.documents_reported_ready === true,
      payment_reported: reportsPayment || current.payment_reported === true };
    next.topic = 'purchase_preparation'; next.phase = 'purchasing_handoff'; next.stage = 1;
    return { asset, topic: next.topic, stage: 1, action: 'handoff', conversion: next,
      reply: purchaseHandoffText({ stockStatus: stock, paymentClaimed: reportsPayment }) };
  }
  const dp = closingDp(asset.limit_price);
  const dpText = dp == null ? 'uang tanda jadi yang nominalnya dikonfirmasi tim' : `uang tanda jadi ${money(dp)}`;
  const paymentGate = stock === 'pending'
    ? 'Pembayaran tanda jadi menunggu kepastian aset dari tim dan persetujuan ketentuan MOU.'
    : 'Pembayaran tanda jadi dilakukan setelah ketentuan MOU disetujui dan instruksi pembayaran dikonfirmasi tim.';
  next.topic = 'purchase_preparation'; next.phase = 'purchase_preparation'; next.stage = 1;
  let body, question, action;
  if (!current) {
    body = `Baik, saya bantu lanjutkan persiapan pembelian aset kode ${asset.id}. Kelengkapan untuk prosesnya adalah KTP dan cover buku tabungan atas nama Anda, serta ${dpText}. Silakan pelajari ketentuannya di draf MOU. ${paymentGate}`;
    question = 'Dari draf MOU ini, ada yang ingin ditanyakan?'; action = 'ask_question';
  } else if (notReady) {
    next.purchase_intake.documents_reported_ready = false;
    body = `Boleh disiapkan dulu. Tim memerlukan KTP dan cover buku tabungan atas nama Anda untuk melengkapi data pembelian, akun lelang, dan rekening pengembalian. Untuk ${dpText}, silakan pelajari ketentuannya di draf MOU. ${paymentGate}`;
    question = 'Mau dibantu tim mengecek kelengkapan berkas yang perlu disiapkan?'; action = 'purchase_handoff';
  } else {
    body = `Baik. Langkah berikutnya tim membantu melengkapi data pada MOU dan memeriksa KTP serta cover buku tabungan atas nama Anda. Komitmen tanda jadinya ${dp == null ? 'dikonfirmasi tim' : money(dp)}. ${paymentGate}`;
    question = 'Mau saya teruskan ke tim untuk persiapan berkas dan kesepakatannya?'; action = 'purchase_handoff';
  }
  next.pending_action = action; next.pending_question = question; next.last_topic = next.topic;
  return { asset, topic: next.topic, stage: 1, conversion: next, purchase_copy: { body, ctas: [{ text: question, action }] } };
}

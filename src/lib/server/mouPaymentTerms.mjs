import { closingDp } from '../../../backend/whatsapp/services/closing_state.js';
import { PERSEN_BALIK_NAMA, formatPersen } from '../../../backend/whatsapp/services/auction_cost_policy.js';

export const MOU_COMMISSION_PERCENT = 5;
export const MOU_DOCUMENT_FEE = 10_000_000;
export const MOU_REFUND_DAYS = 5;
export const MOU_DRAFT_WATERMARK = 'Draft - untuk dipelajari';
export const MOU_UNKNOWN_AMOUNT = '[DIKONFIRMASI TIM]';
const amount = (n) => Number.isSafeInteger(n) && n > 0 && n <= 1e15 ? n : null;
export const formatMouAmount = (n) => amount(n) == null ? MOU_UNKNOWN_AMOUNT : n.toLocaleString('id-ID');
const words = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
export function terbilangDraft(n) {
  if (amount(n) == null) return MOU_UNKNOWN_AMOUNT;
  const spell = (v) => {
    if (v < 12) return words[v];
    if (v < 20) return `${spell(v - 10)} belas`;
    if (v < 100) return `${spell(Math.floor(v / 10))} puluh ${spell(v % 10)}`.trim();
    if (v < 200) return `seratus ${spell(v - 100)}`.trim();
    if (v < 1000) return `${spell(Math.floor(v / 100))} ratus ${spell(v % 100)}`.trim();
    if (v < 2000) return `seribu ${spell(v - 1000)}`.trim();
    for (const [unit, name] of [[1e12, 'triliun'], [1e9, 'miliar'], [1e6, 'juta'], [1000, 'ribu']]) {
      if (v >= unit) return `${spell(Math.floor(v / unit))} ${name} ${spell(v % unit)}`.trim();
    }
  };
  return `${spell(n)} rupiah`;
}

// The tanda jadi is independent of the organizer's auction guarantee. Both
// draft and transaction generators use the same limit-based capped amount.
export function mouPaymentFields(limitPrice) {
  const tandaJadi = closingDp(limitPrice);
  return { komisi_persen: String(MOU_COMMISSION_PERCENT),
    ketentuan_baliknama: `${formatPersen(PERSEN_BALIK_NAMA)} dari Harga Menang Lelang + Rp ${formatMouAmount(MOU_DOCUMENT_FEE)} (${terbilangDraft(MOU_DOCUMENT_FEE)})`,
    biaya_pengurusan_dokumen: formatMouAmount(MOU_DOCUMENT_FEE),
    terbilang_biaya_pengurusan_dokumen: terbilangDraft(MOU_DOCUMENT_FEE),
    uang_tanda_jadi: formatMouAmount(tandaJadi), terbilang_uang_tanda_jadi: terbilangDraft(tandaJadi) };
}

import { normalizeBuyerLanguage } from './buyer_language.js';

export const NON_BUYER_HANDOVER_MESSAGE = 'Baik, saya asisten virtual Pak Jason. Pesan Bapak/Ibu akan ditangani langsung oleh Pak Jason. Mohon ditunggu ya.';

// A profession, property noun or purchase verb does not establish a new lead.
// Read the requested task first, including when a buyer conversation is active.
export function hasExplicitBuyerRequest(text = '') {
  const clean = normalizeBuyerLanguage(text);
  if (/\b(?:cari(?:kan)?|mencari)\s+(?:data|dokumen|informasi|info|pemilik|debitur|alamat|nomor|berkas|status)\b/i.test(clean)) return false;
  return /\b(?:cari(?:kan)?|mencari|nyari|looking\s+for)\b[^.!?;\n]{0,100}\b(?:rumah|ruko|tanah|lahan|gudang|apartemen|apartment|house|land|office|properti|property|aset|kos|pabrik|kantor|vila|villa)\b/i.test(clean) &&
    !/\b(?:bukan|tidak|nggak|gak|ga|enggak)\s+(?:sedang\s+|lagi\s+)?(?:cari|mencari|nyari)\b/i.test(clean) ||
    /\b(?:ingin|mau|berminat|tertarik|butuh|need)\s+(?:(?:membeli|beli|menyewa|sewa|buy|rent)\s+)?(?:rumah|ruko|tanah|lahan|gudang|apartemen|properti|property|kos|pabrik|kantor|vila|villa)\b/i.test(clean) &&
    !/\b(?:tidak|nggak|gak|ga|enggak|bukan)\s+(?:ingin|mau|berminat|tertarik|butuh)\b/i.test(clean);
}

export function nonBuyerHandoffReason(text = '') {
  if (typeof text !== 'string' || !text.trim()) return null;
  const clean = normalizeBuyerLanguage(text);
  if (/\b(?:beli|membeli|dibeli|pembelian|tebus|menebus|ditebus)\s*(?:di\s*)?(?:kembali|balik)|\bbuy\s*back\b|\brepurchase\b/i.test(clean)) return 'existing_asset_repurchase';
  if (/\b(?:mau|ingin|hendak|bermaksud)\s+(?:jual|menjual|menyewakan|sewakan|titip\s+(?:jual|sewa))\b[^.!?;\n]{0,70}\b(?:rumah|tanah|ruko|gudang|apartemen|properti|aset)\b/i.test(clean) ||
      /\b(?:titip\s+jual|titip\s+sewa|pasarkan)\s+(?:rumah|tanah|ruko|gudang|apartemen|properti|aset)\b/i.test(clean)) return 'owner_listing_request';
  if (/\b(?:salah\s+(?:nomor|sambung|orang)|wrong\s+number|urusan\s+pribadi|pesan\s+pribadi)\b/i.test(clean) ||
      /\b(?:bukan|tidak|nggak|gak|ga|enggak)\s+(?:sedang\s+|lagi\s+)?(?:cari|mencari|nyari)\s+(?:properti|property|aset|rumah|tanah)\b/i.test(clean) ||
      /\b(?:bukan|tidak)\s+(?:soal|tentang|urusan)\s+(?:properti|property|aset|rumah|lelang)\b/i.test(clean)) return 'non_buyer_contact';
  if (/\b(?:somasi|gugatan|menggugat|digugat|litigasi|laporan\s+polisi|pembatalan\s+lelang|membatalkan\s+lelang|keberatan\s+(?:atas\s+)?(?:hasil|pelaksanaan)\s+lelang)\b/i.test(clean)) return 'legal_matter';
  if (/\b(?:bicara|berbicara|komunikasi|berkomunikasi|hubungkan|menghubungi|ketemu|bertemu)\b[^.!?\n]{0,55}\b(?:pak\s+|bapak\s+)?jason\b/i.test(clean) &&
      !hasExplicitBuyerRequest(clean)) return 'contact_jason';
  const representative = /\b(?:kuasa\s+hukum|penasihat\s+hukum|penasehat\s+hukum|pengacara|advokat|law\s*firm|kantor\s+hukum|legal\s+counsel|attorney|lawyer)\b/i.test(clean);
  if (representative && !hasExplicitBuyerRequest(clean)) return 'legal_representative';
  const existingParty = /\b(?:saya|kami|klien\s+(?:saya|kami))\s+(?:(?:adalah|ini|selaku|sebagai)\s+)?(?:debitur|tereksekusi|pemilik\s+(?:lama|sebelumnya)|ahli\s+waris|penghuni)\b/i.test(clean);
  const completion = /\b(?:sudah|telah|sudh|sdh)\s+(?:(?:saya|kami|bapak|ibu|anda)\s+)?(?:beli|membeli|dibeli|menang\s+lelang|lunas|dilunasi)\b|\balready\s+(?:bought|purchased)\b/i.exec(clean);
  const completedPurchase = completion && !/\b(?:kalau|jika|bila|apabila|seandainya|if|when)\b[^.!?;\n]*$/i.test(clean.slice(0, completion.index));
  if ((existingParty || completedPurchase) && !hasExplicitBuyerRequest(clean)) return 'existing_asset_matter';
  return null;
}

// Check the purpose even if these messages contain familiar property words.
export function needsConversationPurposeReview(text = '') {
  const clean = normalizeBuyerLanguage(text);
  return !hasExplicitBuyerRequest(clean) && /\b(?:mewakili|klien\s+(?:saya|kami)|minta\s+waktu|berkomunikasi|komunikasi\s+(?:atas|mengenai|terkait)|pemilik\s+lama|debitur|tereksekusi)\b/i.test(clean);
}

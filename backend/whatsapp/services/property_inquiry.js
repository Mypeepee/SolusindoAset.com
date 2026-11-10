// Admission for live WhatsApp conversations. Emoji and the recipient's name
// are presentation only; the opening and a real Solusindo listing link matter.
export const PROPERTY_INQUIRY_IDLE_MS = 7 * 86400000;

export function hasActivePropertyInquiry(state, config = {}, now = Date.now()) {
  return !!state?.property_inquiry_entry && Number.isFinite(state.last_user_received_at) &&
    now - state.last_user_received_at <= (config.propertyInquiryIdleMs ?? PROPERTY_INQUIRY_IDLE_MS);
}

export function propertyInquiryEntry(text) {
  if (typeof text !== 'string' || text.length > 4096) return null;
  const plain = text.replace(/\*/g, '').trim();
  if (!/^halo\b[^\r\n]{0,160}?\s+saya\s+tertarik\s+dengan\s+properti(?:\s+lelang)?\s+berikut\s*,\s*apakah\s+masih\s+tersedia\s*\?/i.test(plain)) return null;
  const listings = new Map();
  for (const match of plain.matchAll(/https?:\/\/[^\s<>]+/gi)) {
    try {
      const url = new URL(match[0].replace(/[).,!?]+$/, ''));
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          !['solusindoaset.com', 'www.solusindoaset.com'].includes(url.hostname)) continue;
      const id = /^\/(?:Lelang|Jual|Sewa)\/(?:[a-z0-9-]+-)?([1-9]\d{0,17})(?:\/AG\d{1,18})?\/?$/i.exec(url.pathname)?.[1];
      if (id) {
        // Query/hash text must not introduce another property reference.
        url.search = ''; url.hash = '';
        listings.set(id, { asset_id: id, url: url.href });
      }
    } catch { /* Malformed links never open a conversation. */ }
  }
  return listings.size === 1 ? listings.values().next().value : null;
}

// Hanya mengekstrak konteks pesan, bukan memverifikasi harga/status listing.
export function parsePropertyInquiry(text) {
  if (typeof text === 'string') text = text.replace(/\*/g, '');
  if (typeof text !== 'string' || text.length > 4096 ||
      !/tertarik[\s\S]{0,100}(?:properti|aset)[\s\S]{0,60}lelang/i.test(text) ||
      !/(?:masih tersedia|ketersediaan)/i.test(text)) return null;
  const field = (pattern) => text.match(pattern)?.[1]?.replace(/\*/g, '').trim() || null;
  const codes = [...new Set([...text.matchAll(/\bKode\s*:\s*\**\s*([A-Z0-9][A-Z0-9-]{2,39})(?![A-Z0-9-])/gi)]
    .map((match) => match[1].toUpperCase()))];
  return {
    source: 'user_message', verified: false,
    code: codes.length === 1 ? codes[0] : null, codes,
    description: field(/🔨\s*([^\n📍💰🔖🔗]{1,220})/u),
    location: field(/📍\s*([^\n💰🔖🔗]{1,180})/u),
    price_text: field(/💰\s*([^\n🔖🔗]{1,100})/u),
  };
}

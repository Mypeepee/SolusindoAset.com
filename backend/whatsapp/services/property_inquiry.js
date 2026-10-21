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

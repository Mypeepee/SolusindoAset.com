// Shared with the website search: a directional area is a complete scope,
// not an administrative district whose village must still be collected.
export const SURABAYA_REGIONS = {
  barat: ['Asem Rowo', 'Benowo', 'Lakarsantri', 'Pakal', 'Sambikerep', 'Sukomanunggal', 'Tandes'],
  selatan: ['Dukuh Pakis', 'Gayungan', 'Jambangan', 'Karang Pilang', 'Sawahan', 'Wiyung', 'Wonocolo', 'Wonokromo'],
  timur: ['Gubeng', 'Gunung Anyar', 'Mulyorejo', 'Rungkut', 'Sukolilo', 'Tambaksari', 'Tenggilis Mejoyo'],
  pusat: ['Bubutan', 'Genteng', 'Simokerto', 'Tegalsari'],
  utara: ['Bulak', 'Kenjeran', 'Krembangan', 'Pabean Cantian', 'Semampir'],
};

export const regionGroupLabel = (key) => `Surabaya ${key[0].toUpperCase()}${key.slice(1)}`;
const facility = /^(?:rumah sakit|rs(?:ud|u|up|ia)?\b|sekolah|sd\b|smp\b|sma\b|smk\b|kampus|universitas|unesa|unair|its\b|mall|mal\b|plaza|plasa|stasiun|pintu tol|gerbang tol|akses tol|exit tol|tol\b|gt\b|terminal|bandara|halte|pasar|minimarket|indomaret|alfamart|tempat makan|restoran|kuliner|masjid|gereja|tempat ibadah|klinik|puskesmas|gym|hotel|laundry)/i;
const genericFacility = /^(?:rumah sakit|rs(?:ud|u|up|ia)?|sekolah|sd|smp|sma|smk|kampus|universitas|mall|mal|plaza|plasa|stasiun|pintu tol|gerbang tol|akses tol|exit tol|tol|gt|terminal|bandara|halte|pasar|minimarket|tempat makan|restoran|kuliner|masjid|gereja|tempat ibadah|klinik|puskesmas|gym|hotel|laundry)$/i;
const questionParticles = 'kah|adakah|bisakah|bolehkah|ya|yah|dong|donk|deh|nih|sih|kok|lho|loh|kan|saja|aja|juga|gitu|nggak|ngga|enggak|engga|gak|ga|gk|tidak';
const addressWords = 'pak|bu|bapak|ibu|kak|mas|mbak';
const conversationTail = new RegExp(`\\s+(?:(?:bisa|boleh|ada)(?:kah)?\\s+)?(?:${questionParticles})(?:\\s+(?:${questionParticles}|${addressWords}))*$`, 'i');

function cleanNearbyName(input) {
  const name = input.replace(/[,;.!?？…\s]+$/g, '').trim();
  const clean = name.replace(conversationTail, '').trim();
  // Stop at the first conversational suffix. Repeated trimming would corrupt
  // "SD Harapan Ibu bisa nggak pak" by treating Ibu in its name as a salutation.
  if (clean !== name) return clean || name;
  const addressed = /\s+(pak|bu|bapak|ibu|kak|mas|mbak)$/i.exec(name);
  if (!addressed) return name;
  const before = name.slice(0, addressed.index).trim();
  if (/^(?:ibu|bapak)$/i.test(addressed[1]) && !genericFacility.test(before)) return name;
  return before || name;
}

export function nearbyQueryParts(query) {
  // Split only an explicit connector followed by another facility. "Rumah
  // Sakit Ibu dan Anak" remains one name; "sekolah dan rumah sakit" is AND.
  // Only split attached -kah on complete generic facility terms, never on a
  // name such as Al Barokah / Berkah. Clean each AND/OR operand separately.
  const parts = query.replace(/\b(sekolah|rumah\s+sakit|rs(?:ud|u|up|ia)?|kampus|universitas|mall|mal|stasiun|pintu\s+tol|gerbang\s+tol|tol|terminal|bandara|halte|pasar|minimarket|masjid|gereja|klinik|puskesmas|hotel)-?kah\b/gi, '$1 kah')
    .split(/\s+(dan|serta|atau)\s+/i);
  const groups = [[parts[0]]];
  for (let i = 1; i < parts.length; i += 2) {
    if (facility.test(parts[i + 1])) {
      if (/^atau$/i.test(parts[i])) groups.push([parts[i + 1]]);
      else groups.at(-1).push(parts[i + 1]);
    } else groups.at(-1)[groups.at(-1).length - 1] += ` ${parts[i]} ${parts[i + 1]}`;
  }
  return groups.map((group) => group.map(cleanNearbyName));
}

export const cleanNearbyQuery = (query) => nearbyQueryParts(query).map((group) => group.join(' dan ')).join(' atau ');

// Only user text enters this parser. POI names are masked before budget,
// category and geography extraction ("Hotel ..." is not an asset type).
export function searchScopeTurn(input, { city = null, nearby = null, landExpected = false } = {}) {
  let text = input.replace(/\bperluas(?:kan)?\s+(?:ke|menjadi)\s+/gi, 'di '), place = null, placeChanged = false, radiusError = false;
  const remove = /\b(?:(?:tidak|nggak|enggak|gak|ga)\s+(?:harus|perlu|usah)|bukan|bebas|tanpa)\s+(?:syarat\s+)?(?:dekat|deket)(?:\s+dengan)?\s+[^,;!?]+|\b(?:hapus|hilangkan|abaikan|lepas|lepaskan)\s+(?:syarat|filter|kriteria)\s+(?:landmark|tempat terdekat|kedekatan|dekat(?:\s+(?:dengan\s+)?tempat\s+(?:itu|tadi))?)\b/gi;
  text = text.replace(remove, () => { placeChanged = true; return ' '; });
  const marker = /\b(?:dekat(?:\s+(?:dengan|sama))?|deket(?:\s+(?:dengan|sama))?|dket|dkt|near(?:by)?|di\s+sekitar(?:an)?|sekitar(?:an)?)\s+/gi;
  const matches = [...text.matchAll(marker)];
  for (const match of matches) {
    const body = text.slice(match.index + match[0].length);
    if (/sekitar/i.test(match[0]) && !facility.test(body)) continue;
    const boundary = /\s+\b(?:di|daerah|wilayah|kawasan|area|budget|bujet|anggaran|harga|dana|plafon|mentok|luas|lt|lb|radius|jarak|maksimal|maksimum|minimal|maks|untuk|jenis|tipe)\b|[,;!?\n]|\s+\d[\d.,]*\s*(?:km|meter|kilometer|m(?![²2])|juta|jt|miliar)\b/i.exec(body);
    const name = cleanNearbyQuery(body.slice(0, boundary?.index).replace(/\b(dan|serta|atau)\s+(?:dekat|deket)(?:\s+dengan)?\s+/gi, '$1 '));
    if (!name || name.length > 100 || /^(?:apa|mana|sana|situ|sini|itu|ini|tersebut)\b/i.test(name)) continue;
    place = { ...(nearby?.query.toLowerCase() === name.toLowerCase() ? nearby : {}), query: name }; placeChanged = true;
    if (nearby && /\b(?:tambah(?:kan)?|juga|sekalian)\b/i.test(input) && !/\b(?:ganti|bukan|ubah)\b/i.test(input) && nearby.query.toLowerCase() !== name.toLowerCase()) {
      place = { ...nearby, query: `${nearby.query} dan ${name}` };
    }
    text = text.slice(0, match.index) + ' ' + body.slice(boundary?.index ?? body.length);
    break;
  }
  // A radius correction retains the previously selected landmark. Distance
  // units are removed before the budget/land parsers can mistake them for m²/M.
  const newPlace = !!place;
  if (place || nearby) text = text.replace(/\b(?:(?:dalam\s+)?radius\s*|jarak\s*|maksimal\s*|maksimum\s*|maks\s*|max\s*)?(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(kilometer|meter|km|m)\b(?!\s*[²2])/gi,
    (all, raw, unit, offset) => {
      const prefix = text.slice(0, offset);
      if (landExpected && !place && !/radius|jarak/i.test(all)) return all;
      if (/\b(?:budget|bujet|anggaran|harga|luas(?:nya)?|lt|lb|tanah(?:nya)?)\s*(?:(?:saya|nya|di|angka|jadi|sampai|maksimal|maksimum|minimal|minimum|maks|min|max|sebesar|sekitar)\s*)*$/i.test(prefix)) return all;
      // Bare "m" after a financial clause is miliar; only an explicit radius
      // or an immediately adjacent near phrase can establish distance.
      if (unit.toLowerCase() === 'm' && !newPlace && !/radius|jarak/i.test(all)) return all;
      const n = Number(/^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw.replace(',', '.')) * (/^k/i.test(unit) ? 1000 : 1);
      if (n < 1 || n > 20000) { radiusError = true; return ' '; }
      place = { ...(place || nearby), radius_m: Math.round(n) }; placeChanged = true;
      return ' ';
    });
  let region = /\b(?:surabaya|sby)\s+(?:bagian\s+)?(barat|timur|selatan|utara|pusat)\b/i.exec(text);
  if (!region && /surabaya/i.test(city || '')) region = /^(?:(?:di|daerah|wilayah|kawasan|area|bagian|ganti|pindah|ke|jadi)\s+)*(barat|timur|selatan|utara|pusat)(?:\s+(?:saja|aja|pak|bu|ya))?(?=[,.!\s]*$|[,;]|\s+(?:budget|bujet|anggaran|luas)\b)/i.exec(text.trim());
  const group = region?.[1]?.toLowerCase() || null;
  if (group) text = text.replace(region[0], 'Surabaya');
  return { text: text.replace(/\s+/g, ' ').trim(), region: group, nearby: place, nearbyChanged: placeChanged, radiusError };
}

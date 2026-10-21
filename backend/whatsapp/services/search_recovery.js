const money = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
export const uncertainLocation = (text) => /\b(?:waduh|gatau|gaktau|gak tau|ga tau|nggak tau|ngga tau|enggak tau|tidak tahu|kurang tahu|belum tahu|nggak tahu|gak tahu|ga tahu|nggak paham|tidak paham|gak ngerti|kurang paham)\b/i.test(text);

// A recovery choice changes one constraint at a time. A vague yes never grants
// permission to raise the budget or discard a landmark.
export function searchRecovery(text, preceding, profile) {
  const previous = preceding || '';
  const offered = /Belum ketemu|Mau coba|pilih dulu|radius.*berapa|budget.*nyaman/i.test(previous);
  const plain = text.trim().replace(/[.!?…]+$/g, '');
  if (offered && /^(?:(?:ya|iya|boleh|oke|ok|sip|silakan|lanjut|coba)(?:\s+(?:ya|pak|bu|dong|aja|saja))*)$/i.test(plain)) {
    return { reply: `Boleh. Kita pilih dulu yang paling nyaman: ${profile.nearby ? 'perlebar radius dari tempat tadi, ' : ''}perluas area${profile.city ? ` di ${profile.city}` : ''}, atau ubah budget? Budget dan kriteria lainnya tetap saya pegang sampai Anda menentukan perubahan.` };
  }
  if (/\b(?:sesuaikan|ubah|ganti|naikkan|naikin|tambah)\s+(?:batas\s+)?(?:budget|bujet|anggaran)(?:nya)?\b|\b(?:budget|bujet|anggaran)(?:nya)?\s+(?:di)?(?:sesuaikan|ubah|ganti|naikkan|naikin|tambah)\b/i.test(plain) && !/\d/.test(plain)) {
    return { reply: `Budget sebelumnya${profile.max_price ? ` maksimal ${money(profile.max_price)}` : ' belum ditentukan'}. Batas budget baru yang masih nyaman sampai berapa? Boleh sebut angka maksimal atau rentangnya. Area dan kebutuhan lainnya tetap sama.` };
  }
  if (/\b(?:ubah|perlebar|perluas|tambah|naikkan|ganti)\s+(?:batas\s+)?(?:radius|jarak)(?:nya)?\b|\b(?:radius|jarak)(?:nya)?\s+(?:di)?(?:ubah|perlebar|perluas|tambah|naikkan|ganti)\b/i.test(plain) && !/\d/.test(plain)) {
    return { reply: profile.nearby ? `Mau radius berapa dari ${profile.nearby.query}? Misalnya 2 km atau 5 km, maksimal 20 km. Budget dan kebutuhan lainnya tetap sama.` : 'Belum ada patokan tempatnya. Mau dekat tempat apa, dan di kota mana?' };
  }
  if (/\b(?:di)?(?:perluas|luaskan|lebarkan|perlebar)\s+(?:(?:dulu|aja|saja)\s+)*(?:area|daerah|wilayah|lokasi)(?:nya)?\b|\b(?:area|daerah|wilayah|lokasi)(?:nya)?\s+(?:di)?(?:perluas|luaskan|lebarkan|perlebar)\b/i.test(plain)) {
    if (!profile.city) return { reply: 'Mau perluas pencarian di kota atau kabupaten mana? Budget dan kebutuhan lainnya tetap saya simpan.' };
    if (profile.village) {
      profile.village = null;
      return { changed: true, note: `Saya perluas ke seluruh ${profile.location || profile.district || profile.city}.` };
    }
    if (profile.location?.toLowerCase() !== profile.city.toLowerCase() || profile.district || profile.region_group) {
      profile.location = profile.city; profile.district = null; profile.village = null; delete profile.region_group; delete profile.locations;
      return { changed: true, note: `Saya perluas ke seluruh ${profile.city}.${profile.nearby ? ` Patokan dekat ${profile.nearby.query} tetap dipakai.` : ''} Budget dan kebutuhan lainnya tetap sama.` };
    }
    return { reply: profile.nearby ? `Area sudah mencakup seluruh ${profile.city}, tetapi masih mengikuti kedekatan dengan ${profile.nearby.query}. Mau perlebar radiusnya menjadi berapa km, atau lepas syarat dekat tempat itu? Budget tetap sama.` : `Pencarian sudah mencakup seluruh ${profile.city}. Kalau ingin lebih luas lagi, kota atau kabupaten mana yang juga boleh? Budget tetap sama.` };
  }
  return null;
}

// Search preferences only. Listing transaction types always come from the DB.
import { preferenceAnswerText, unrestrictedPreferenceAnswer } from './buyer_language.js';
export const TRANSACTION_TYPES = ['LELANG', 'PRIMARY', 'SECONDARY', 'SEWA'];
export const TRANSACTION_LABELS = { LELANG: 'lelang', PRIMARY: 'primary (baru dari developer)', SECONDARY: 'secondary (jual beli non-developer)', SEWA: 'sewa' };
export const TRANSACTION_QUESTION = 'Mau beli atau sewa? Pilihannya lelang, primary (baru dari developer), secondary, atau sewa. Boleh pilih beberapa atau jawab “bebas” untuk semua jenis transaksi.';
export const isTransactionQuestion = (text = '') => /ingin membeli atau menyewa\?|mau (?:lihat pilihan )?beli atau sewa(?: dulu)?\?|(?:jenis|pilihan) transaksi[^?]*\?/i.test(text);
export const transactionValues = (profile = {}) => profile.transaction_types || (profile.transaction_type ? [profile.transaction_type] : []);
const normalize = (text) => text.normalize('NFKC').toLowerCase().replace(/\*/g, '')
  .replace(/\b(?:gk|tdk|ngga|nggak|enggak|gak|ga|g|gakkk)\b/g, 'tidak')
  .replace(/\b(?:rmh|rmah)\b/g, 'rumah').replace(/\b(?:sekondari|seken|second|secondari|secodnary|seceondary)\b/g, 'secondary')
  .replace(/\b(?:primer|primari)\b/g, 'primary').replace(/\b(?:developer|developper|develover|pengembang)\b/g, 'developer')
  .replace(/\b(?:ngontrak|kontrak(?:an)?|menyewa|nyewa|disewa|rental|rent)\b/g, 'sewa')
  .replace(/\b(lelang|primary|secondary|sewa)nya\b/g, '$1');
const mentions = /\b(non[ -]?lelang|tanpa\s+lelang|jual\s+beli\s+biasa|beli\s+(?:biasa|normal)|(?:rumah|unit|bangunan|properti)\s+(?:yang\s+)?(?:baru(?:\s+dibangun)?|bekas)|baru\s+dibangun|belum\s+pernah\s+(?:dihuni|ditempati)|(?:langsung\s+)?(?:dari\s+)?(?:pemilik|owner)(?:\s+langsung)?|(?:dari\s+)?developer|lelang|primary|secondary|sewa|beli|membeli)\b/g;
const negative = /\b(?:bukan|jangan|hindari|ogah|gak|tidak|tak|gamau|gakmau|skip|coret|hapus|batal(?:kan)?|belum(?:\s+(?:mau|ingin|jadi)))\b/;
const uncertain = /\b(?:belum\s+(?:tahu|yakin|pasti|memutuskan)|bingung|mungkin|barangkali|belum tentu)\b/;
const exclusion = /\b(?:kecuali(?:kan)?|dikecualikan|selain|tanpa|exclude|keluarkan|dikeluarkan|dicoret|dihapus)\b/;
const cancelExclusion = /\b(?:jangan|tidak(?:\s+(?:usah|perlu))?)\s+(?:kecualikan|dikecualikan|exclude|keluarkan|dikeluarkan|coret|dicoret|hapus|dihapus)\b/;
const exclusionAfter = /^\s*(?:(?:sih|saya|aku|pak|bu|ya)\s+)*(?:kecualikan|dikecualikan|exclude|keluarkan|dikeluarkan|dicoret|dihapus)\b/;
const keepAfter = /^\s*(?:(?:sih|saya|aku|pak|bu|ya)\s+)*(?:jangan|tidak(?:\s+(?:usah|perlu))?)\s+(?:kecualikan|dikecualikan|exclude|keluarkan|dikeluarkan|coret|dicoret|hapus|dihapus)\b/;

export function transactionExplanation(text) {
  const clean = normalize(text);
  return /\b(?:lelang|primary|secondary|developer|sewa|transaksi)\b/.test(clean) &&
    /\b(?:apa\s+(?:itu|beda(?:nya)?|perbedaan|maksud(?:nya)?)|(?:itu|maksudnya)\s+apa|beda(?:nya)?.*apa|jelas(?:kan|in))\b/.test(clean);
}

// Resolve a short answer against the question that was actually asked.
// "Jenisnya bebas" after a transaction question must not clear property type.
export function transactionAnswerText(text, { expected = false } = {}) {
  return text.split(/([,;.!…\n]+|\b(?:tapi|tetapi|melainkan|asal(?:kan)?|yang penting)\b|\s+(?=(?:kecuali|selain|tanpa)\b))/i).map((clause) => {
    const clean = preferenceAnswerText(clause);
    const labelled = /^(?:(?:untuk|kalau|soal)\s+)?(?:(?:jenis|tipe)\s+)?transaksi(?:nya)?\s+(?:(?:sih|mah|itu)\s+)*(.+)$/i.exec(clean) ||
      expected && /^(?:(?:untuk|kalau|soal)\s+)?(?:jenis|tipe)(?:nya)?\s+(?:(?:sih|mah|itu)\s+)*(.+)$/i.exec(clean);
    if (labelled && unrestrictedPreferenceAnswer(labelled[1], { allowUndecided: false })) return 'transaksi bebas';
    if (expected && /^(?:beli\s*(?:atau|dan|\/)\s*sewa|sewa\s*(?:atau|dan|\/)\s*beli)\s+(?:sama\s+(?:aja|saja)|bebas|terserah|semua(?:nya)?\s+boleh|dua[- ]?duanya\s+boleh)$/i.test(clean)) return 'transaksi bebas';
    return clause;
  }).join('');
}

export function transactionPreference(text, { previous = [], excluded = [], expected = false } = {}) {
  let clean = transactionAnswerText(normalize(text), { expected });
  if (transactionExplanation(clean)) return null;
  if (/[?？]/.test(clean) && exclusion.test(clean) && !/\b(?:tolong|mohon|boleh|jangan)\b/.test(clean) &&
      (/\b(?:apakah|kenapa|mengapa|bagaimana|gimana|apa lagi)\b/.test(clean) || !/\bya\s*[?？]\s*$/.test(clean))) return null;
  // Negating "beli lelang" rejects the auction channel, not all purchases.
  clean = clean.replace(/\b(?:beli|membeli)\s+(?=(?:(?:rumah|unit|properti)\s+(?:yang\s+)?)?(?:lelang|primary|secondary|baru|bekas|(?:dari\s+)?developer)\b)/g, '');
  if (expected && /^\s*(?:yang\s+)?baru(?:\s+(?:aja|saja|pak|bu|ya))*[.!]?\s*$/.test(clean)) clean = 'primary';
  if (/\b(?:mau|ingin|pengen)\s+(?:tahu|nanya|tanya|lihat|cek)\b/.test(clean) && !/\b(?:cari(?:kan)?|mencari|ganti|pilih)\b/.test(clean)) return null;
  if (/\b(?:berapa|kapan|bagaimana|gimana|kenapa|aman|berisiko|resiko|risiko)\b/.test(clean) &&
      !/\b(?:cari(?:kan)?|mencari|mau|ingin|pilih|jangan|bukan|ogah|ganti|boleh)\b/.test(clean)) return null;
  if (/\b(?:jadwal|kapan|biaya|jaminan|pelunasan|proses|prosedur|syarat|hasil|status|harga|limit)\b/.test(clean) &&
      !/\b(?:cari|carikan|mencari|mau|ingin|pilih|ogah|jangan|bukan|ganti|boleh|budget|anggaran)\b/.test(clean)) return null;
  const freeChoice = clean.split(/[;.!…\n]+|\b(?:tapi|tetapi|melainkan|asal(?:kan)?|yang penting)\b|\b(?=(?:kecuali|selain|tanpa)\b)/).some((clause) => {
    const labelled = /\b(?:jenis\s+)?transaksi(?:nya)?\s+(.+)/i.exec(clause);
    return labelled && !negative.test(clause.slice(0, labelled.index)) && unrestrictedPreferenceAnswer(labelled[1], { allowUndecided: false }) ||
      expected && clause.split(/,/).some((part) => unrestrictedPreferenceAnswer(part, { allowUndecided: false }));
  });
  // A replacement source is not a fresh choice ("ganti dari lelang ke sewa").
  clean = clean.replace(/\b(?:ganti|ubah|beralih|pindah)\b[^.!?\n]*?\b(?:ke|jadi|menjadi|dengan)\b/g, 'pilih ');
  const initialException = expected && !previous.length && /\b(?:kecuali(?:kan)?|dikecualikan|selain|exclude)\b/.test(clean) && !cancelExclusion.test(clean) && !uncertain.test(clean);
  let values = freeChoice || initialException ? TRANSACTION_TYPES.filter((type) => !excluded.includes(type)) : [...previous];
  let rejected = new Set(excluded), touched = freeChoice, selected = false, buyOnly = false;
  let inferredPrimary = false, explicitPurchase = false;
  const clauses = clean.split(/([,;.!?\n]+|\b(?:tapi|tetapi|melainkan|lalu|kemudian)\b)/);
  let carryException = false;
  for (let clauseIndex = 0; clauseIndex < clauses.length; clauseIndex += 2) {
    const clause = clauses[clauseIndex], separator = clauses[clauseIndex - 1] || '';
    if (uncertain.test(clause)) { carryException = false; continue; }
    // Process negation locally; positive alternatives in the same sentence
    // must not inherit "tidak mau" from the preceding transaction.
    const found = [...clause.matchAll(mentions)];
    const last = found.at(-1);
    const tail = last ? clause.slice(last.index + last[0].length) : '';
    const linkedList = found.length > 1 && found.slice(0, -1).every((match, index) => /^\s*(?:(?:dan|atau|serta)\s*|[&/\s])*$/.test(clause.slice(match.index + match[0].length, found[index + 1].index)));
    const groupRemoval = linkedList && exclusionAfter.test(tail);
    const groupKeep = linkedList && keepAfter.test(tail);
    const continuesException = carryException && /^,+$/.test(separator) && !/\b(?:mau(?:nya)?|ingin|pilih|cari|boleh|oke|juga|saja|aja)\b/.test(clause);
    let denyingList = continuesException, exceptionList = continuesException;
    for (let i = 0; i < found.length; i++) {
      const match = found[i], word = match[0];
      const prefix = clause.slice(i ? found[i - 1].index + found[i - 1][0].length : 0, match.index);
      const suffix = clause.slice(match.index + word.length, found[i + 1]?.index ?? clause.length);
      if (/baru$/.test(word) && /^\s*(?:di)?renovasi\b/.test(suffix)) continue;
      const keep = groupKeep || cancelExclusion.test(prefix) || keepAfter.test(suffix);
      const auctionException = word === 'tanpa lelang' && (previous.length > 0 || freeChoice);
      const remove = !keep && (groupRemoval || exclusion.test(prefix) || auctionException || exclusionAfter.test(suffix));
      const allowed = keep || /\b(?:tidak\s+(?:apa[ -]?apa|masalah|keberatan)|boleh|oke|gapapa|gpp)\b/.test(prefix + ' ' + suffix) &&
        !/\b(?:tidak|jangan|belum)\s+(?:boleh|mau|ingin|usah)\b/.test(prefix + ' ' + suffix);
      const denied = remove || !allowed && (denyingList && !/\b(?:mau(?:nya)?|ingin|pilih|cari)\b/.test(prefix) || negative.test(prefix) || /^\s*(?:(?:sih|saya|aku)\s+)*(?:jangan|ogah|skip|tidak\s+(?:mau|ingin|usah)|belum\s+mau)\b/.test(suffix));
      const nonAuction = /^(?:non[ -]?lelang|tanpa lelang|jual beli biasa|beli (?:biasa|normal))$/.test(word);
      const types = auctionException ? ['LELANG'] : nonAuction ? ['PRIMARY', 'SECONDARY'] : word === 'lelang' ? ['LELANG'] : word === 'sewa' ? ['SEWA'] :
        /^(?:beli|membeli)$/.test(word) ? ['LELANG', 'PRIMARY', 'SECONDARY'] :
        /secondary|bekas|pemilik|owner/.test(word) ? ['SECONDARY'] : ['PRIMARY'];
      if (denied) {
        denyingList = true;
        exceptionList ||= remove;
        for (const type of types) rejected.add(type);
        values = values.filter((type) => !types.includes(type));
        if (!values.length && !selected && !exceptionList) values = types.includes('SEWA') ? ['PRIMARY', 'SECONDARY'] : types.length === 3 ? ['SEWA'] : ['PRIMARY', 'SECONDARY'].filter((type) => !rejected.has(type));
        touched = true;
      } else {
        denyingList = false;
        // Just "beli" doesn't consent to auctions. Ask which purchase channel.
        if (/^(?:beli|membeli)$/.test(word)) { buyOnly = true; continue; }
        if (/\b(?:pernah|dulu|sekarang\s+masih)\b/.test(prefix) && !/\b(?:mau|ingin|cari|pilih)\b/.test(prefix)) continue;
        const additive = keep || /\b(?:juga|tambah(?:kan)?|sekalian)\b/.test(prefix + ' ' + suffix);
        if (!selected && !additive) values = [];
        for (const type of types) {
          // A prior refusal persists through generic "semua/bebas". Explicit
          // acceptance of the same type is the way to change one's mind.
          rejected.delete(type); if (!values.includes(type)) values.push(type);
        }
        if (nonAuction) rejected.add('LELANG');
        if (types.includes('PRIMARY') && !nonAuction && word !== 'primary') inferredPrimary = true;
        else if (types.some((type) => type !== 'SEWA')) explicitPurchase = true;
        selected = true; touched = true;
      }
    }
    carryException = exceptionList && denyingList;
  }
  if (buyOnly) { values = values.filter((type) => type !== 'SEWA'); rejected.add('SEWA'); touched = true; }
  // "Sewa rumah baru" describes the desired rental's condition, not consent
  // to buy a developer unit as well.
  if (values.includes('SEWA') && inferredPrimary && !explicitPurchase) values = values.filter((type) => type !== 'PRIMARY');
  values = values.filter((type) => !rejected.has(type));
  const residual = preferenceAnswerText(clean.replace(new RegExp(mentions.source, 'g'), ' ').replace(/[?？]+$/g, ''))
    .replace(/\b(?:kecuali(?:kan)?|dikecualikan|selain|tanpa|exclude|keluarkan|dikeluarkan|coret|dicoret|hapus|dihapus|masukkan|dimasukkan|skip|batal(?:kan)?|bukan|jangan|tidak|tak|mau|ingin|usah|perlu|tolong|mohon|bisa|boleh|oke|juga|tambah(?:kan)?|sekalian|dan|atau|tapi|tetapi|melainkan|asal(?:kan)?|transaksi|jenis|bebas|semua(?:nya)?|saya|aku|yang|itu)\b/g, '')
    .replace(/[\s\p{P}]/gu, '');
  return touched ? { values, excluded: [...rejected], touched, only_transaction: !residual } : null;
}

// Remove transaction language before location extraction; "dari developer"
// or "secondary saja" is never a district. Retain property categories.
export function transactionGeographyText(text) {
  return text.replace(/\b(?:ganti|ubah|beralih|pindah)\s+(?:dari\s+)?(?:lelang|primary|secondary|sewa)\s+(?:ke|jadi|menjadi|dengan)\b/gi, ' ')
    .replace(new RegExp(mentions.source, 'gi'), (word) => /^(?:rumah|unit|bangunan|properti)\s/i.test(word) ? word.split(' ')[0] : ' ')
    .replace(/\b(?:ngontrak|kontrakan|nyewa|menyewa|pengembang|primer|seken|second|secodnary|seceondary)\b/gi, ' ')
    .replace(/\b(?:transaksi(?:nya)?|jenis transaksi)\s+(?:bebas|terserah|apa saja)\b/g, ' ')
    .replace(/\b(?:tidak|bukan|jangan|ogah)\s+(?:(?:mau|ingin|usah|ambil|ikut|yang)\s+)*(?=[,;.!?]|$)/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export const isRentalPeriodQuestion = (text = '') => /\b(?:budget\s+sewa|pilihan\s+sewa)\b[^?]*\bper\s+bulan\b[^?]*\bper\s+tahun\b[^?]*\?/i.test(text);
export function rentalPeriodAnswer(text) {
  const clean = preferenceAnswerText(text).replace(/\bbln\b/gi, 'bulan').replace(/\bthn\b/gi, 'tahun');
  const match = /^(?:(?:untuk|yang|maunya|pilih)\s+)?(?:(?:per|tiap|setiap|se)\s*)?(hari|minggu|bulan|tahun|harian|mingguan|bulanan|tahunan)$/.exec(clean);
  return match ? ({ hari: 'HARIAN', harian: 'HARIAN', minggu: 'MINGGUAN', mingguan: 'MINGGUAN', bulan: 'BULANAN', bulanan: 'BULANAN', tahun: 'TAHUNAN', tahunan: 'TAHUNAN' }[match[1]]) : null;
}
export function rentalPeriod(text, { expected = false } = {}) {
  text = text.replace(/\bbln\b/gi, 'bulan').replace(/\bthn\b/gi, 'tahun').replace(/\/\s*(?=hari|minggu|bulan|tahun)/gi, ' per ');
  const match = /\b(harian|mingguan|bulanan|tahunan|(?:per|tiap|setiap|se)\s*(hari|minggu|bulan|tahun))\b/i.exec(text);
  return match ? ({ harian: 'HARIAN', mingguan: 'MINGGUAN', bulanan: 'BULANAN', tahunan: 'TAHUNAN', hari: 'HARIAN', minggu: 'MINGGUAN', bulan: 'BULANAN', tahun: 'TAHUNAN' }[match[2]?.toLowerCase() || match[1].toLowerCase()]) : expected ? rentalPeriodAnswer(text) : null;
}

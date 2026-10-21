import { normalizeBuyerQuantities, unrestrictedPreferenceAnswer, assistantQuestions } from './buyer_language.js';
import { PROPERTY_CATEGORY_LABELS } from './property_category.js';
import { transactionExplanation, transactionAnswerText, isTransactionQuestion, TRANSACTION_QUESTION } from './property_transaction.js';

export const UNDERSTANDING_VERSION = '2026-10-20-smart-multi-location-search-v28';
export const CONFIRM_PREFIX = 'Apakah maksud Bapak/Ibu: ';
const affirmative = /^(?:(?:iya|ya|betul|benar|oke|ok|setuju|sip|lanjut)(?:\s+(?:betul|benar|itu|sudah|sesuai|pak|bu|bapak|ibu|kak|ya|saja|aja))*)[.!\s]*$/i;

// Confirmations use a bounded grammar rendered by the server, not arbitrary
// assistant prose. A short "yes" cannot adopt all options in a questionnaire.
export function confirmedPreferenceText(text, preceding = '') {
  const [answer, ...remainder] = text.split(/[,;\n]/);
  if (!affirmative.test(answer.trim()) || remainder.some((part) => /\b(?:tapi|tetapi|bukan|jangan)\b/i.test(part)) || !preceding.startsWith(CONFIRM_PREFIX) || !preceding.endsWith('?')) return null;
  const body = preceding.slice(CONFIRM_PREFIX.length, -1);
  const clauses = body.split('; ');
  if (!clauses.length || clauses.length > 2) return null;
  const labels = new Set(Object.values(PROPERTY_CATEGORY_LABELS));
  for (const clause of clauses) {
    if (clause === 'luas tanah bebas' || clause === 'jenis bebas') continue;
    if (!clause.startsWith('jenis ') || !clause.slice(6).split(' atau ').every((label) => labels.has(label))) return null;
  }
  return [...clauses, ...remainder].join(', ');
}

export function buyerTurn(text, { preceding = '', landClarification = null, categoryExpected = false, landExpected = false } = {}) {
  let content = normalizeBuyerQuantities(text);
  const confirmed = confirmedPreferenceText(content, preceding);
  if (confirmed) return { content: confirmed, confirmed: true };
  if (affirmative.test(content.trim()) && preceding.endsWith('Apakah Bapak/Ibu ingin luas tanah bebas?')) return { content: 'luas tanah bebas', confirmed: true };
  const question = content.split(/[?？]/)[0], trailingAnswer = /[?？]/.test(content) ? content.slice(question.length + 1).trim() : '';
  if (transactionExplanation(question)) return { content: trailingAnswer, kind: 'explain', reply:
    `Primary adalah properti baru dari developer. Secondary adalah jual beli properti di luar penjualan perdana developer; kondisinya bisa bekas atau masih baru. Lelang memakai proses penawaran lelang, sedangkan sewa untuk penggunaan properti selama periode tertentu. ${TRANSACTION_QUESTION}` };
  const asksMeaning = /\b(?:apa\s+(?:beda(?:nya)?|perbedaan|itu|maksud(?:nya)?)|(?:itu|maksudnya)\s+apa|beda(?:nya)?\b.*\bapa)\b/i.test(question);
  if (asksMeaning && /\b(?:luas(?:nya)?|lt|ukuran)\b/i.test(question)) return { content: trailingAnswer, kind: 'explain', reply:
    /\bbebas\b/i.test(question) ? 'Luas bebas berarti pencarian tanpa batas minimal atau maksimal luas tanah. Kriteria sebelumnya tetap saya simpan. Apakah Bapak/Ibu ingin luas tanah bebas?' :
      'Luas tanah adalah ukuran seluruh bidang tanah properti, berbeda dari luas bangunannya. Bapak/Ibu bisa menyebut batas minimal, maksimal, rentang m², atau memilih luas bebas. Apakah ada batas luas tanah yang diinginkan?' };
  if (asksMeaning && /\b(?:rumah|ruko|toko|jenis)\b/i.test(question)) return { content: trailingAnswer, kind: 'explain', reply:
    'Rumah digunakan sebagai hunian; toko untuk kegiatan usaha; ruko menggabungkan ruang usaha dan hunian dalam satu bangunan. Pilihan beberapa jenis juga boleh. Jenis properti apa yang Bapak/Ibu pilih?' };
  content = transactionAnswerText(content, { expected: isTransactionQuestion(assistantQuestions(preceding)[0]) });
  content = content.split(/([,;.!…\n]+)/).map((clause) => {
    const labelled = /^(?:untuk\s+)?(?:(?:jenis|tipe)(?:nya)?\s+(?:sama|dan|&)\s+luas(?:nya)?|luas(?:nya)?\s+(?:sama|dan|&)\s+(?:jenis|tipe)(?:nya)?)\s+/i.exec(clause.trim());
    const both = labelled ? unrestrictedPreferenceAnswer(clause.trim().slice(labelled[0].length)) :
      categoryExpected && landExpected && unrestrictedPreferenceAnswer(clause, { collectiveOnly: true });
    // Preserve other clauses such as a budget correction or a new location.
    return both ? 'jenis bebas, luas tanah bebas' : clause;
  }).join('');
  if (landClarification && /batas minimal, batas maksimal, atau luas persis/i.test(preceding) &&
      /^\s*(?:yang\s+)?(?:minimal|minimum|min|maksimal|maksimum|max|maks|persis|pas|tepat)(?:\s+(?:saja|aja|pak|bu|ya))*[.!]?\s*$/i.test(content)) {
    const value = normalizeBuyerQuantities(landClarification).match(/\d+(?:[.,]\d+)*\s*(?:m\s*[2²]|meter(?:\s+(?:persegi|kuadrat))?|hektar|ha|are)(?![\p{L}\p{N}])/giu);
    if (value?.length === 1) content = `luas tanah ${content.replace(/\b(?:yang|saja|aja|pak|bu|ya)\b|[.!]/gi, '').trim()} ${value[0]}`;
  }
  return { content };
}

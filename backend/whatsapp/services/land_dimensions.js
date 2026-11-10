// Rectangular measurements are land area only in a land-preference context.
// Never infer an area from three dimensions, money or a building-only label.
export function normalizeLandDimensions(text = '') {
  if (typeof text !== 'string' || /\b(?:lb|luas\s+bangunan|juta|jt|miliar|milyar|rupiah|rp)\b/i.test(text)) return text;
  const number = '(\\d+(?:[.,]\\d+)?)';
  const unit = '(?:meter|m)';
  const multiply = '(?:[x×*]|dikalikan|kali)';
  const pattern = new RegExp(`(?<![\\d.,])${number}\\s*${unit}?\\s*${multiply}\\s*${number}\\s*${unit}?(?![\\p{L}\\p{N}.,])`, 'giu');
  const matches = [...text.matchAll(pattern)];
  if (matches.length !== 1 || new RegExp(`${multiply}\\s*\\d`, 'iu').test(text.slice(matches[0].index + matches[0][0].length))) return text;
  const match = matches[0], area = Number(match[1].replace(',', '.')) * Number(match[2].replace(',', '.'));
  if (!Number.isFinite(area) || area <= 0 || area > 1e9) return text;
  return text.slice(0, match.index) + `${Math.round(area * 1e6) / 1e6} m2` + text.slice(match.index + match[0].length);
}

import { KELAS_TEMPAT, kelasDariKata, normalNama, tebakKelasDariNama, RADIUS_JANGKAUAN } from "./tempat/normalisasi";
export function labelPreferensiTempat(token: string) {
  const raw = token.replace(/^(?:kueri|nama|kelas|cocok|brand):/i, "").replace(/@/g, " di ").replace(/[-_]/g, " ");
  return raw.replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase("id-ID"));
}
export function radiusPreferensiTempat(token: string) {
  const label = labelPreferensiTempat(token).split(/\s+di\s+/i)[0];
  const kelas = kelasDariKata(normalNama(label)) || tebakKelasDariNama(label)?.kelas;
  return kelas ? RADIUS_JANGKAUAN[KELAS_TEMPAT[kelas].jangkauan] : RADIUS_JANGKAUAN.HARIAN;
}

export const SURVEY_HOURS = [8, 9, 10, 11, 13, 14, 15, 16, 17];
const DAY = 86400000, WIB = 7 * 3600000;
const names = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const words = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, 'dua belas': 12 };
export const wibDate = now => new Date(now + WIB).toISOString().slice(0, 10);
export function surveyInstant(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '')) return null;
  const n = Date.parse(`${date}T${time}:00+07:00`);
  return Number.isFinite(n) && new Date(n + WIB).toISOString().slice(0, 16) === `${date}T${time}` ? n : null;
}
export function surveyLabel(date, time) {
  const n = surveyInstant(date, time);
  return n == null ? '' : `${new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(n)} pukul ${time.replace(':', '.')} WIB`;
}
export function parseSurveyTime(text = '', now = Date.now()) {
  const value = text.toLowerCase().replace(/jum['’]at/g, 'jumat').replace(/\bsesuk\b/g, 'besok').replace(/\b(?:isuk|esuk)\b/g, 'pagi').replace(/\bsenen\b/g, 'senin');
  const start = Date.parse(`${wibDate(now)}T00:00:00+07:00`), today = new Date(now + WIB);
  let date = null, time = null, error = null;
  const iso = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(value);
  const numeric = /\b(?:tgl\.?\s*|tanggal\s*)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](20\d{2}))?\b/.exec(value);
  const dayOfMonth = /\b(?:tanggal|tgl\.?)\s*(\d{1,2})\b/.exec(value);
  if (iso) date = iso[1];
  else if (numeric) date = `${numeric[3] || today.getUTCFullYear()}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
  else if (dayOfMonth) {
    const day = Number(dayOfMonth[1]);
    const candidate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), day));
    if (day < today.getUTCDate()) candidate.setUTCMonth(candidate.getUTCMonth() + 1);
    date = candidate.toISOString().slice(0, 10);
    if (Number(date.slice(-2)) !== day) error = 'invalid_date';
  } else if (/\b(?:lusa|besoknya\s+besok)\b/.test(value)) date = wibDate(start + 2 * DAY);
  else if (/\b(?:besok|bsk|tomorrow)\b/.test(value)) date = wibDate(start + DAY);
  else if (/\b(?:hari ini|nanti|today)\b/.test(value)) date = wibDate(now);
  const weekday = names.findIndex(name => new RegExp(`\\b${name}\\b`).test(value) && (name !== 'minggu' || !/\bminggu depan\b/.test(value) || /\bhari minggu\b/.test(value)));
  if (weekday >= 0) {
    if (date && new Date(Date.parse(`${date}T00:00:00+07:00`) + WIB).getUTCDay() !== weekday) error = 'conflicting_date';
    else if (!date) {
      let delta = (weekday - today.getUTCDay() + 7) % 7;
      if (/\b(?:minggu depan|pekan depan|next week)\b/.test(value)) delta = ((8 - today.getUTCDay()) % 7 || 7) + (weekday + 6) % 7;
      else if (!delta) delta = 7;
      date = wibDate(start + delta * DAY);
    }
  }
  const clock = /\b(?:jam|pukul|pk\.?|at)\s*(\d{1,2})(?:[.:](\d{2}))?\b/.exec(value) || /\b(\d{1,2})[.:](\d{2})\b/.exec(value) || /\b(\d{1,2})\s*(?:pagi|siang|sore|malam)\b/.exec(value);
  const wordClock = new RegExp(`\\b(?:jam|pukul)\\s+(${Object.keys(words).sort((a,b)=>b.length-a.length).join('|')})\\b`).exec(value);
  const half = /\b(?:jam\s*)?(?:setengah|stgh)\s*(\d{1,2}|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua belas)\b/.exec(value);
  let hour = clock ? Number(clock[1]) : wordClock ? words[wordClock[1]] : null;
  let minute = clock?.[2] ? Number(clock[2]) : 0;
  if (half) { hour = (Number(half[1]) || words[half[1]]) - 1; minute = 30; }
  if (hour != null) {
    if (/\b(?:siang|sore|malam|pm)\b/.test(value) && hour < 12) hour += 12;
    if (hour < 0 || hour > 23 || minute > 59) error ||= 'invalid_time';
    else time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (!error && (minute !== 0 || !SURVEY_HOURS.includes(hour))) error = 'outside_slots';
  }
  if (/\b(?:pagi|siang|sore|malam)\b/.test(value) && hour == null) error ||= 'needs_time';
  if (date && surveyInstant(date, '00:00') == null) error = 'invalid_date';
  const instant = date && time ? surveyInstant(date, time) : null;
  if (instant != null && (instant <= now || instant > now + 92 * DAY)) error ||= 'outside_dates';
  return { date, time, error };
}

import { ServiceError } from '../lib/http.js';
import { TRANSACTION_LABELS } from './property_transaction.js';

// Links in history are pointers only. The caller always re-fetches their IDs
// through the available-only property API; no URL from chat is ever fetched.
export function recommendationIds(text) {
  const pointers = [...text.matchAll(/https?:\/\/[^\s<>*]+\/(?:Lelang|Jual|Sewa)\/(?:[a-z0-9-]+-)([1-9]\d{0,17})(?=[/?#\s)*.,]|$)|\bkode\s*[:#-]?\s*\*?([1-9]\d{0,17})\b/gi)];
  return [...new Set(pointers.map((match) => match[1] || match[2]))];
}

export function hasDetailLink(asset) {
  try {
    const url = new URL(asset.detail_url);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash &&
      new RegExp(`^/(?:Lelang|Jual|Sewa)/[a-z0-9-]+-${asset.id}(?:/AG\\d{1,18})?$`, 'i').test(url.pathname);
  } catch { return false; }
}

export function withPresentingAgent(asset, agentId) {
  if (!asset || !/^AG\d{1,18}$/.test(agentId || '') || !hasDetailLink(asset)) return asset;
  const url = new URL(asset.detail_url);
  if (url.pathname.startsWith('/Sewa/')) return asset;
  url.pathname = url.pathname.replace(/\/AG\d+$/i, '') + '/' + agentId;
  return { ...asset, detail_url: url.href };
}

const plain = (value) => String(value || '').replace(/[\r\n*]/g, ' ').replace(/\s+/g, ' ').trim();
const dateLabel = (date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(date));

function propertyCard(asset, now, index) {
  const address = plain(asset.full_address || asset.address?.street || asset.location || asset.name);
  const specs = asset.specifications || {};
  const details = [specs.land_area_m2 > 0 ? `LT ${specs.land_area_m2} m²` : null,
    specs.building_area_m2 > 0 ? `LB ${specs.building_area_m2} m²` : null, plain(specs.certificate_type)].filter(Boolean);
  const label = asset.transaction_type === 'LELANG' ? 'Harga limit' : asset.transaction_type === 'SEWA' ? 'Harga sewa' : 'Harga penawaran';
  const price = asset.price_display ? `${label}: *${plain(asset.price_display)}*` : 'Harga perlu dikonfirmasi';
  const auction = Date.parse(asset.auction_at);
  const schedule = asset.transaction_type !== 'LELANG' ? '' : Number.isFinite(auction)
    ? `\n  Lelang tercatat: ${dateLabel(auction)} WIB${auction <= now ? ' (sudah lewat)' : ''}.`
    : '\n  Jadwal lelang belum tercatat; perlu konfirmasi.';
  const incomplete = !asset.address?.street ? '\n  Alamat rinci belum tercatat.' : '';
  const transaction = TRANSACTION_LABELS[asset.transaction_type];
  const period = asset.transaction_type === 'SEWA' && asset.rental?.period ? ` (${plain(asset.rental.period).toLowerCase()})` : '';
  return `${index + 1}. *${address}*${transaction ? `\n  Transaksi: ${transaction}` : ''}\n  ${price}${period}${details.length ? ` · ${details.join(' · ')}` : ''}${incomplete}${schedule}\n  Lihat detail: ${asset.detail_url}`;
}

// The model chooses IDs and writes the opening/CTA. Addresses, prices, dates
// and clickable URLs are rendered from fresh public data, never invented text.
export function renderRecommendations(reply, options, selection, now = Date.now(), introduction = '') {
  const markers = [...reply.matchAll(/^[ \t]*(?:[•*-]\s*)?\[\[PROPERTY:([1-9]\d{0,17})\]\][ \t]*$/gm)];
  const ids = markers.map((match) => match[1]), byId = new Map(options.map((asset) => [asset.id, asset]));
  if (!ids.length || ids.length > 5 || new Set(ids).size !== ids.length || ids.some((id) => !byId.has(id) || !hasDetailLink(byId.get(id)))) {
    throw new ServiceError('UNSUPPORTED_RECOMMENDATION', 502);
  }
  const first = markers[0], last = markers.at(-1);
  const middle = reply.slice(first.index, last.index + last[0].length).replace(/^[ \t]*(?:[•*-]\s*)?\[\[PROPERTY:[1-9]\d{0,17}\]\][ \t]*$/gm, '').trim();
  const prefix = reply.slice(0, first.index).trim(), suffix = reply.slice(last.index + last[0].length).trim();
  if (middle || /https?:\/\/|\[\[PROPERTY:|\bkode\s*[:#-]?\s*\*?\d/i.test(prefix + suffix)) throw new ServiceError('UNSUPPORTED_RECOMMENDATION', 502);
  const opening = selection?.schedule_priority === 'needs_confirmation'
    ? `Belum ada jadwal lelang mendatang yang sesuai kriteria Bapak/Ibu. Berikut pilihan yang masih ditayangkan sebagai *Tersedia*, diurutkan dari ${selection.sort_by === 'price_asc' ? 'harga limit terendah' : 'jadwal tercatat terbaru'}; hasil lelang atau jadwal ulang perlu dikonfirmasi tim.`
    : prefix.replace(/\n\s*\n/g, ' ') + (selection?.sort_by === 'price_asc' ? ' Saya urutkan dari harga terendah.' : '');
  const cards = ids.map((id, index) => propertyCard(byId.get(id), now, index));
  return [introduction, opening, cards.join('\n'), suffix.replace(/\n\s*\n/g, ' ')].filter(Boolean).join('\n\n');
}

// Preserve every card and its complete address/link. Each part fits both the
// WhatsApp transport and Playground history limits. The final CTA stays with
// the last card so a numbered follow-up still refers to the delivered list.
export function recommendationMessages(reply) {
  if (reply.length <= 4000) return [reply];
  const headings = [...reply.matchAll(/^(?:•|\d+[.)]) \*[^\n]+\*$/gm)];
  if (!headings.length || headings.length > 5) throw new ServiceError('INVALID_AI_OUTPUT', 502);
  const blocks = [reply.slice(0, headings[0].index).trim(), ...headings.map((heading, i) =>
    reply.slice(heading.index, headings[i + 1]?.index ?? reply.length).trim())].filter(Boolean);
  const messages = [];
  let current = '';
  for (const block of blocks) {
    if (block.length > 4000) throw new ServiceError('INVALID_AI_OUTPUT', 502);
    if (current && current.length + block.length + 2 > 4000) { messages.push(current); current = ''; }
    current = current ? `${current}\n\n${block}` : block;
  }
  if (current) messages.push(current);
  return messages;
}

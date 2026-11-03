import { BACKUP_AREA_QUESTION } from './buyer_profile.js';
import { propertyDetailsReply } from './property_details.js';
import { propertyTransactionType } from './property_costs.js';
import { auctionTimeline } from './auction_timeline.js';

export const AUCTION_COST_QUESTION = 'Mau saya hitungkan rincian estimasi biaya pembeliannya?';

// Only trusted catalog data can trigger this workflow. A client's template,
// the AI's previous claims, and an expired deadline alone are not sufficient.
export function needsAuctionCheck(asset, now = Date.now()) {
  if (!asset || asset.is_demo || ['sold', 'withdrawn'].includes(asset.availability_status)) return false;
  const published = asset.publication?.status === 'TERSEDIA' ||
    (!asset.publication && ['available', 'scheduled'].includes(asset.availability_status));
  const auction = asset.transaction_type === 'LELANG' || (!asset.transaction_type && asset.limit_price > 0);
  return published && auction && auctionTimeline(asset, now).status === 'elapsed';
}

export function auctionCheckExplained(history, assetId) {
  return history.some((item) => item.role === 'assistant' && /\blelang ulang\b/i.test(item.content) &&
    [...item.content.matchAll(/\bkode\s*[:#-]?\s*\*?([A-Z0-9]+(?:-[A-Z0-9]+)*)\b/gi)].some((m) => m[1] === assetId));
}

export async function requestAuctionCheck({ asset, checks, contact, sandbox = false, now = Date.now() }) {
  if (!needsAuctionCheck(asset, now)) return null;
  if (sandbox) return { status: 'simulated', external_check_performed: false };
  if (!checks) return { status: 'unavailable', external_check_performed: false };
  const confirmation = checks.stockResult?.(asset);
  if (confirmation) return { status: 'completed', external_check_performed: true, stock_confirmation: confirmation };
  const task = await checks.enqueue({ contact, asset });
  // Contacts / task IDs stay in the admin queue, never in the LLM context.
  return { status: task.status, notification_status: task.notification_status || null, external_check_performed: false };
}

function auctionCheckProgress(check) {
  return check?.status === 'pending'
    ? check.notification_status === 'sent'
      ? 'Permintaan konfirmasi stok sudah saya kirim ke bagian stoker melalui WhatsApp. Kita menunggu jawaban mengenai ketersediaannya; tim internal kami akan menindaklanjuti, termasuk konfirmasi ke KPKNL bila diperlukan.'
      : check.notification_status === 'uncertain'
        ? 'Permintaan cross-check sudah saya catat, tetapi pengiriman pesan ke bagian stoker belum dapat dipastikan. Tim internal kami perlu memeriksanya dan menindaklanjuti konfirmasi stok.'
        : check.notification_status === 'failed'
          ? 'Permintaan cross-check sudah saya catat, tetapi pesan ke bagian stoker belum berhasil dikirim. Tim internal kami perlu menindaklanjuti konfirmasi stok.'
          : 'Permintaan cross-check sudah saya catat untuk ditindaklanjuti tim internal kami, termasuk konfirmasi ke KPKNL bila diperlukan. Pesan konfirmasi ke bagian stoker menunggu pengiriman.'
    : check?.status === 'simulated'
      ? 'Status terbarunya perlu dikonfirmasi oleh tim internal kami, termasuk kepada KPKNL bila diperlukan.'
      : check?.status === 'completed'
        ? 'Catatan tindak lanjut sebelumnya sudah ditandai selesai oleh agent, tetapi data publik masih perlu diperbarui atau dikonfirmasi kembali oleh tim internal/KPKNL.'
        : 'Status terbarunya perlu di-cross-check oleh tim internal kami dan dikonfirmasi ke KPKNL bila diperlukan. Permintaan pengecekan belum tercatat otomatis; Senior Agent dapat membantu menindaklanjutinya.';
}

export function isAuctionScheduleQuestion(text) {
  if (!/\b(?:kapan|jadwal(?:nya)?|tanggal(?:nya)?|jam|waktu)\b/i.test(text)) return false;
  if (/\b(?:survei|survey|viewing|bayar|membayar|pembayaran|pelunasan|melunasi|jaminan|transfer|akad)\b/i.test(text)) return false;
  return /\b(?:lelang(?:nya)?|retender)\b/i.test(text) ||
    /\b(?:jadwal|tanggal)(?:nya)?\b/i.test(text);
}

// Dates come only from the freshly resolved listing. An expired date never
// establishes either a retender date or a completed operational check.
export function auctionScheduleReply(asset, check, now = Date.now()) {
  if (!asset || ['sold', 'withdrawn'].includes(asset.availability_status) || ['TERJUAL', 'TARIK_LISTING'].includes(asset.publication?.status)) return 'Unit yang tadi dibahas belum ditemukan dalam listing publik terbaru. Jadwal lelang berikutnya belum dapat saya pastikan; tim internal perlu mengonfirmasi kembali unit tersebut.';
  if (asset.transaction_type && asset.transaction_type !== 'LELANG') return null;
  const timestamp = Date.parse(asset.auction_at);
  const subject = `*aset kode ${asset.id}*`;
  if (!Number.isFinite(timestamp)) return `Jadwal lelang untuk ${subject} belum tercatat dalam data terbaru yang saya terima. Saya belum dapat memastikan tanggalnya; tim internal perlu mengonfirmasi kepada pihak penyelenggara/KPKNL.`;
  const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(timestamp);
  if (timestamp > now) return `Jadwal lelang terbaru yang tercatat untuk ${subject} adalah *${date}*.`;
  return `Untuk ${subject}, jadwal terakhir yang tercatat adalah *${date}* dan sudah lewat. Jadwal lelang ulang belum tersedia dalam data terbaru yang saya terima, jadi tanggal berikutnya belum bisa saya pastikan.\n\n${auctionCheckProgress(check)}`;
}

export function auctionCheckReply(asset, check, { offerBackup = false, offerCosts = !offerBackup } = {}) {
  const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(asset.auction_at));
  // Reuse the public listing renderer, leaving schedule/status and the single
  // CTA to this response. Chat templates never supply prices/specifications.
  const details = propertyDetailsReply(asset, { includeIntroduction: false, includeSchedule: false, includeCta: false });
  const progress = auctionCheckProgress(check);
  return [
    'Halo Bapak/Ibu, saya asisten virtual Bapak Jason di Solusindo Aset. Berikut detail aset yang diminati berdasarkan listing terbaru. 🙏',
    details,
    `Di database kami, aset ini masih tercatat *Tersedia*, tetapi jadwal lelang pada *${date}* sudah terlewat. ${progress}`,
    'Pengecekan ini untuk memastikan apakah aset sudah dimenangkan pihak lain sementara data belum diperbarui, atau akan dijadwalkan lelang ulang (retender). Hasil lelang maupun jadwal baru belum dapat saya pastikan.',
    ...(offerBackup ? [BACKUP_AREA_QUESTION] : []),
    ...(offerCosts ? [AUCTION_COST_QUESTION] : []),
  ].filter(Boolean).join('\n\n');
}

export function upcomingAuctionReply(asset, now = Date.now()) {
  if (!asset || asset.is_demo || propertyTransactionType(asset) !== 'LELANG' ||
      ['sold', 'withdrawn'].includes(asset.availability_status) || ['TERJUAL', 'TARIK_LISTING'].includes(asset.publication?.status)) return null;
  const timeline = auctionTimeline(asset, now);
  if (timeline.status !== 'upcoming') return null;
  const details = propertyDetailsReply(asset, { now, includeIntroduction: false, includeSchedule: false, includeCta: false });
  const remaining = timeline.days_until === 0 ? '*hari ini*' : timeline.days_until === 1 ? '*besok (1 hari lagi)*' : `tinggal *${timeline.days_until} hari lagi*`;
  const closed = [['pendaftaran', asset.registration_closes_at], ['setoran jaminan', asset.deposit_due_at]]
    .filter(([, date]) => Number.isFinite(Date.parse(date)) && Date.parse(date) <= now).map(([label]) => label);
  return [details,
    asset.publication?.status === 'TERSEDIA' ? '🟢 Aset ini masih tercatat *Tersedia* di website.' : 'Status ketersediaan aktual perlu dikonfirmasi kepada tim.',
    `🗓️ Jadwal lelang: *${timeline.date} WIB* — ${remaining}${timeline.days_until === 0 ? '.' : ' menuju jadwal lelang.'}`,
    closed.length ? `Batas ${closed.join(' dan ')} yang tercatat sudah lewat. Tim perlu memastikan apakah Bapak/Ibu masih dapat mengikuti jadwal ini sebelum melanjutkan persiapan.`
      : 'Jika unit ini sesuai kebutuhan Bapak/Ibu, sebaiknya cek kondisi dari luar dan siapkan dokumen serta kebutuhan dananya sejak sekarang, agar siap mengikuti jadwal ini. Batas pendaftaran, jaminan, dan penawaran mengikuti pengumuman resmi.',
    AUCTION_COST_QUESTION,
  ].filter(Boolean).join('\n\n');
}

// Protect the customer from an LLM repeating a false expiry claim in history.
// Registration/deposit deadlines and conditional explanations are separate.
export function contradictsUpcomingAuction(reply, asset, now = Date.now()) {
  if (!asset || asset.is_demo || ['sold', 'withdrawn'].includes(asset.availability_status) || ['TERJUAL', 'TARIK_LISTING'].includes(asset.publication?.status) ||
      propertyTransactionType(asset) !== 'LELANG' || auctionTimeline(asset, now).status !== 'upcoming') return false;
  return reply.split(/[.!?\n]|\b(?:namun|tetapi|tapi)\b/i).some(clause =>
    !/\b(?:kalau|jika|apabila|seandainya)\b/i.test(clause) &&
    /\b(?:jadwal(?:nya| tersebut)?|tanggal(?:nya)?|lelang(?:nya)?)\b[^.!?\n]{0,100}\b(?:(?:sudah|telah)\s+(?:terlewat(?:i)?|lewat|berakhir|kedaluwarsa)|expired)\b/i.test(clause));
}

export function unsupportedAuctionCheckClaim(reply, check) {
  if (/\btidak siap\b|\b(?:sudah|telah|sedang)\s+(?:(?:saya|kami|tim(?: internal)?(?: kami)?|selesai)\s+)?(?:menghubungi|mengontak|mengecek|memeriksa|melakukan pengecekan|berkonsultasi|cross[- ]?check)\b|\b(?:pasti|dipastikan)\b[^.!?\n]{0,40}\b(?:terjual|lelang ulang|retender)\b/i.test(reply)) return true;
  if (check?.notification_status !== 'sent' && /\b(?:sudah|telah)\b[^.!?\n]{0,35}\b(?:kirim|dikirim|mengirim)\b|\b(?:pesan|permintaan)\b[^.!?\n]{0,40}\bterkirim\b/i.test(reply)) return true;
  return check?.status !== 'pending' && /\b(?:permintaan|pengecekan|cross[- ]?check)\b[^.!?\n]{0,60}\b(?:sudah|telah)\b[^.!?\n]{0,30}\b(?:dicatat|tercatat|diajukan|dikirim)\b|\b(?:sudah|telah) saya (?:catat|kirim|ajukan)\b/i.test(reply);
}

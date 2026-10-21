import { randomUUID } from 'node:crypto';
import { propertyTransactionType, isPurchaseCostQuestion, purchaseCostReply } from './property_costs.js';
import { parseSurveyTime, surveyInstant, surveyLabel } from './survey_time.js';
import { clientLabel } from './client_identity.js';
import { validPhone } from '../lib/security.js';

const clean = value => String(value || '').replace(/[\x00-\x1f*_~`]/g, ' ').replace(/\s+/g,' ').trim();
export const isConditionQuestion = text => /\b(?:kondisi(?:nya)?|keadaan(?:nya)?|kahanane|kondisine|bangunane|interior|eksterior|daleme|dalem(?:nya)?|dalamnya|bagian dalam|bocor|retak|rusak|terawat|akses jalan|lingkungan|boleh masuk|bisa masuk|masuk ke dalam|(?:iso|oleh|entuk) mlebu|(?:bangunan(?:nya)?|rumah(?:nya)?|ruko(?:nya)?) (?:gimana|bagaimana|gmn|piye|seperti apa|kayak apa))\b/i.test(text || '');
export const isVisitRequest = text => /\b(?:viewing|survei|survey|site visit|visit|tinjau|nengok|tilik|lihat langsung|liat langsung|lihat lokasi|liat lokasi|cek lokasi|cek langsung|mampir|appointment|janjian)\b/i.test(text || '');
const agrees = text => /^(?:(?:iya|ya|yap|yup|iyo|nggih|oke|ok|okeh|baik|boleh|monggo|silakan|silahkan|gas|lanjut|setuju|bisa|sip|siap)(?:kan)?\s*)+(?:(?:pak|bu|ko|koko|kak|mas|mbak|ya|dong|aja|saja|dulu|tolong|catat|ajukan)\s*)*[.!🙏\s]*$/i.test((text || '').trim());
const declines = text => /\b(?:batal(?:kan)?|(?:tidak|nggak|ngga|gak|ga|g|enggak|belum|jangan)\s+(?:jadi|mau|usah|dulu|survei|survey|viewing|ajukan))\b/i.test(text || '');

export function conditionReply(asset) {
  if (propertyTransactionType(asset) === 'LELANG') return 'Untuk aset lelang, viewing dilakukan sendiri dari luar saja, Bapak/Ibu; tidak diperkenankan masuk ke dalam. Tujuannya untuk melihat kondisi bangunan dari luar, akses jalan, serta lingkungan sekitar. Kondisi bagian dalam belum bisa saya pastikan dari listing.';
  const interior = asset.specifications?.interior;
  const type = propertyTransactionType(asset)?.toLowerCase() || 'jual';
  return `${interior ? `Keterangan kondisi interior pada listing: ${clean(interior)}. ` : 'Kondisi rinci bagian dalam belum bisa saya pastikan dari listing saja. '}Untuk aset ${type} ini, kami bisa membantu mengajukan jadwal survei ke lokasi dengan pendampingan agen, supaya Bapak/Ibu dapat melihat kondisi bangunan, akses jalan, dan lingkungan secara langsung. Jadwal dan akses masuk mengikuti konfirmasi agen serta pemilik/pengelola.`;
}
function nextQuestion(state, type, visit) {
  if (!state.costs_explained) return { last_offer: 'costs', text: type === 'SEWA' ? 'Mau saya bantu jelaskan rincian biaya sewanya juga?' : 'Mau sekalian saya bantu hitungkan rincian biaya pembeliannya?' };
  if (!state.condition_explained) return { last_offer: 'condition', text: type === 'LELANG' ? 'Mau saya jelaskan kondisi aset dan cara melihatnya dari luar?' : 'Mau saya jelaskan kondisi aset dan cara viewing-nya juga?' };
  if (visit?.phase === 'booked') return { last_offer: null, text: 'Pengajuan survei tetap tercatat dan mengikuti konfirmasi agen. Jika ada bagian rincian tadi yang ingin ditanyakan, boleh sampaikan.' };
  return type === 'LELANG' ? { last_offer: null, text: 'Kalau setelah melihat dari luar ada bagian kondisi, akses jalan, atau lingkungan yang ingin dibahas, boleh kabari saya.' }
    : { last_offer: 'survey', text: 'Kalau ingin melihat langsung, mau saya pandu pengajuan survei bersama agen?' };
}
const slotQuestion = state => !state.date ? 'Bapak/Ibu ingin survei hari atau tanggal berapa? Boleh jawab misalnya “besok jam 10 pagi”.' : !state.time ? 'Pukul berapa WIB yang nyaman? Pilihan jam survei pukul 08.00–11.00 dan 13.00–17.00.' : 'Boleh tahu nama untuk pengajuan surveinya?';

export async function assetConsultationTurn({ asset, text = '', consultation, surveyState, identity, phone, agentId, surveys, history, now = Date.now(), persistSurvey = () => {} }) {
  let state = consultation && asset?.id && consultation.asset_id === asset.id ? { ...consultation } : { asset_id: asset?.id, costs_explained: false, condition_explained: false, last_offer: null };
  let visit = surveyState && asset?.id && surveyState.asset_id === asset.id ? { ...surveyState } : null;
  const lastAnswer = history?.findLast(item => item.role === 'assistant')?.content;
  const offer = nextQuestion(state, propertyTransactionType(asset), visit);
  // A short acknowledgement follows the question actually delivered. A later
  // MOU, address, or refund answer must not revive an older condition CTA.
  const follow = agrees(text) && (!lastAnswer || offer.last_offer === state.last_offer && lastAnswer.trim().endsWith(offer.text)) ? state.last_offer : null;
  const costs = isPurchaseCostQuestion(text) || follow === 'costs';
  const condition = isConditionQuestion(text) || follow === 'condition';
  const wantsVisit = isVisitRequest(text) || follow === 'survey';
  if (!costs && !condition && !wantsVisit && (!visit || visit.phase === 'booked' && !agrees(text))) return null;
  const label = clientLabel(identity);
  let prefix = '';
  const finish = (reply, extra = {}) => ({ reply: label ? (prefix + reply).replace(/\bBapak\/Ibu\b/g, label) : prefix + reply,
    consultation: state, survey_state: visit, qualification: {}, asset, knowledge: { status: 'asset_consultation', source: 'verified_listing_and_visit_policy' }, ...extra });
  if (!asset || ['TERJUAL','TARIK_LISTING'].includes(asset.publication?.status) || ['sold','withdrawn'].includes(asset.availability_status)) return finish('Boleh pilih satu aset atau kirim kode/link-nya dahulu? Saya perlu memeriksa jenis transaksi dan listing terbaru sebelum menjelaskan kondisi atau membuat pengajuan survei.');
  const type = propertyTransactionType(asset);
  if (costs) {
    state.costs_explained = true;
    let reply = purchaseCostReply(asset, isPurchaseCostQuestion(text) ? text : 'rincian biaya', { now });
    // The calculation remains the existing auction policy. Replace its final
    // CTA only, so the condition/cost branches do not endlessly cross-sell.
    reply = reply.replace(/\n\n[^\n]*\?\s*$/, '');
    if (visit?.phase === 'confirming') visit.phase = 'collecting';
    if (wantsVisit && type !== 'LELANG') { prefix = reply + '\n\n'; state.last_offer = null; }
    else {
      if (condition || wantsVisit) { state.condition_explained = true; reply += '\n\n' + conditionReply(asset); }
      const next = nextQuestion(state, type, visit); state.last_offer = next.last_offer;
      return finish(reply + '\n\n' + next.text);
    }
  }
  if (type === 'LELANG' && (condition || wantsVisit || visit)) {
    visit = null; state.condition_explained = true;
    const next = nextQuestion(state, type, visit); state.last_offer = next.last_offer;
    return finish(conditionReply(asset) + '\n\n' + next.text);
  }
  if (condition && !wantsVisit) {
    state.condition_explained = true;
    const next = nextQuestion(state, type, visit); state.last_offer = next.last_offer;
    if (visit?.phase === 'confirming') visit.phase = 'collecting';
    return finish(conditionReply(asset) + '\n\n' + next.text);
  }
  if (!['PRIMARY','SECONDARY','JUAL','SEWA'].includes(type)) return finish('Jenis transaksi aset ini belum jelas di listing. Saya perlu konfirmasi agen sebelum menawarkan pendampingan atau pengajuan survei.');
  if (!surveys || !/^AG\d{1,18}$/.test(agentId || '')) return finish('Saya bisa menjelaskan alur surveinya, tetapi pengajuan jadwal dari layanan ini belum tersedia. Saya bantu hubungkan dengan agen untuk mencatat permintaannya.', { action: 'handoff' });
  if (declines(text)) {
    if (visit?.phase === 'booked') return finish('Pengajuan survei sebelumnya sudah tercatat. Saya bantu hubungkan agen untuk menindaklanjuti pembatalannya; jadwal belum saya batalkan.', { action: 'handoff' });
    visit = null; state.last_offer = null;
    return finish('Baik, pengajuan survei belum saya kirim. Kalau ingin melanjutkan nanti, boleh sebutkan hari dan jam yang nyaman.');
  }
  if (visit?.phase === 'booked' && agrees(text)) return finish(`Permohonan survei #${visit.booking_id} sudah tercatat untuk ${surveyLabel(visit.date, visit.time)} dan masih mengikuti konfirmasi agen. Tidak saya buat pengajuan baru.`);
  const parsed = parseSurveyTime(text, now);
  const oldDate = visit?.date, oldTime = visit?.time;
  visit ||= { asset_id: asset.id, phase: 'collecting', date: null, time: null, name: identity?.name || null, request_id: randomUUID() };
  if (parsed.date) visit.date = parsed.date;
  if (parsed.time) visit.time = parsed.time;
  if (visit.date && !visit.time && /^\d{1,2}$/.test(text.trim())) visit.time = `${text.trim().padStart(2,'0')}:00`;
  const newName = /\b(?:nama(?:\s+saya)?|atas\s+nama|a\.?n\.?)\s*[:=]?\s+([\p{L}][\p{L}'’ -]{1,59})$/iu.exec(text)?.[1]?.trim();
  if (newName) visit.name = newName;
  else if (!visit.name && /^[\p{L}][\p{L}'’ -]{1,59}$/u.test(text.trim()) && !agrees(text) && !wantsVisit && !parsed.date && !parsed.time) visit.name = text.trim();
  visit.name ||= identity?.name || null;
  if (parsed.error && parsed.error !== 'needs_time') {
    visit.phase = 'collecting';
    if (['invalid_date','conflicting_date','outside_dates'].includes(parsed.error)) visit.date = null;
    else visit.time = null;
    const messages = { conflicting_date: 'Nama hari dan tanggalnya belum cocok. Yang dimaksud hari/tanggal yang mana ya?', invalid_date: 'Tanggalnya belum valid. Boleh sebutkan tanggal yang dimaksud?',
      outside_dates: 'Jadwal perlu berada di waktu mendatang, maksimal tiga bulan ke depan. Mau pilih tanggal berapa?',
      outside_slots: 'Jam survei tersedia per satu jam: 08.00–11.00 dan 13.00–17.00 WIB. Mau pilih jam berapa?', invalid_time: 'Jamnya belum terbaca dengan pasti. Boleh tulis misalnya “jam 10 pagi”?' };
    return finish(messages[parsed.error] || slotQuestion(visit));
  }
  if (visit.date !== oldDate || visit.time !== oldTime) { visit.phase = 'collecting'; visit.request_id = randomUUID(); }
  if (!visit.date || !visit.time || !visit.name) return finish(slotQuestion(visit));
  const instant = surveyInstant(visit.date, visit.time);
  if (instant == null || instant <= now || instant > now + 92 * 86400000) { visit.phase = 'collecting'; visit.date = null; return finish('Waktunya perlu di masa mendatang dan maksimal tiga bulan ke depan. Mau pilih tanggal berapa?'); }
  if (!validPhone(phone)) return finish('Nomor WhatsApp percakapan belum terbaca dengan pasti oleh layanan. Saya bantu hubungkan agen agar pengajuan dicatat ke kontak yang benar.', { action: 'handoff' });
  if ((visit.phase === 'confirming' && agrees(text)) || ['submitting','retry'].includes(visit.phase) && (agrees(text) || /\b(?:coba lagi|ulangi|retry)\b/i.test(text))) {
    visit.phase = 'submitting'; persistSurvey(visit);
    try {
      const result = await surveys.book({ agent_id: agentId, property_id: asset.id, phone, name: visit.name, date: visit.date, time: visit.time, request_id: visit.request_id });
      if (!['PENDING','CONFIRMED'].includes(result.status)) { visit = null; return finish('Pengajuan sebelumnya tidak lagi aktif. Boleh pilih ulang tanggal dan jam untuk pengajuan baru.'); }
      visit.phase = 'booked'; visit.booking_id = result.booking_id; persistSurvey(visit);
      state.condition_explained = true; const next = nextQuestion(state, type, visit); state.last_offer = next.last_offer;
      return finish(`${result.simulated ? '*SIMULASI — tidak membuat booking nyata.*\n\n' : ''}Permohonan survei #${result.booking_id} untuk *${clean(asset.name) || `aset ${asset.id}`}* atas nama ${clean(visit.name)} sudah ${result.simulated ? 'disimulasikan' : 'tersimpan di jadwal dan daftar pengajuan agen'}: ${surveyLabel(visit.date, visit.time)}. Statusnya ${result.status === 'CONFIRMED' ? 'sudah dikonfirmasi agen' : 'menunggu konfirmasi agen; jadwal pendampingan belum final'}.${state.last_offer ? '\n\n' + next.text : ''}`);
    } catch (error) {
      if (error.code === 'SURVEY_SLOT_TAKEN') { visit.phase = 'collecting'; visit.time = null; return finish('Jam tersebut baru saja terisi. Boleh pilih jam lain? Saya cek jadwalnya kembali sebelum mengajukan.'); }
      if (['SURVEY_PROPERTY_UNAVAILABLE','AUCTION_EXTERIOR_ONLY','INVALID_SURVEY_TIME'].includes(error.code)) { visit = null; return finish('Pengajuan belum bisa dilanjutkan karena status aset atau waktunya berubah. Saya perlu memeriksa ulang aset dan jadwal sebelum membuat pengajuan baru.'); }
      visit.phase = 'retry'; persistSurvey(visit);
      return finish('Saya belum mendapat kepastian hasil penyimpanan. Saya tidak akan mengklaim jadwal sudah tercatat. Ketik “coba lagi” untuk mengecek atau melanjutkan pengajuan yang sama tanpa membuat booking ganda.');
    }
  }
  try {
    const availability = await surveys.availability(agentId, asset.id, visit.date);
    const available = availability.blockedSlots.filter(s => !s.blocked).map(s => s.label);
    if (!available.includes(visit.time)) {
      visit.phase = 'collecting'; visit.time = null;
      return finish(available.length ? `Jam tersebut belum tersedia. Pada tanggal yang sama, slot yang masih kosong: ${available.join(', ')} WIB. Mau pilih yang mana?` : 'Jadwal pada hari tersebut sudah terisi. Boleh pilih hari lain?');
    }
  } catch { visit.phase = 'collecting'; return finish('Jadwal agen belum bisa diperiksa sekarang. Permintaan belum saya simpan. Boleh coba lagi sebentar?'); }
  visit.phase = 'confirming'; state.last_offer = null;
  return finish(`Saya ajukan survei bersama agen untuk *${clean(asset.name) || `aset ${asset.id}`}*, atas nama ${clean(visit.name)}, pada ${surveyLabel(visit.date, visit.time)}. Pengajuan ini masih perlu konfirmasi agen.\n\nBoleh saya catat dan ajukan jadwal tersebut?`);
}

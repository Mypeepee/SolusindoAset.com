import type { Prisma, PrismaClient } from "@prisma/client";
import { SURVEY_HOURS, surveyInstant, wibDate } from "../../../backend/whatsapp/services/survey_time.js";
export class SurveyBookingError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
type Tx = Prisma.TransactionClient;
export async function lockSurveyAgent(tx: Tx, agentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`survei-agent:${agentId}`}))`;
}
export function validateSurveySlot(date: string, time: string, now = Date.now()) {
  const start = surveyInstant(date, time);
  if (start == null || start <= now || start > now + 92 * 86400000 || !SURVEY_HOURS.includes(Number(time.slice(0, 2))) || !time.endsWith(":00")) throw new SurveyBookingError("INVALID_SURVEY_TIME", 400);
  return { start: new Date(start), end: new Date(start + 3600000) };
}
export async function ensureSurveyAvailable(tx: Tx, agentId: string, start: Date, now = Date.now()) {
  const date = wibDate(start.getTime()), time = new Date(start.getTime() + 7 * 3600000).toISOString().slice(11, 16);
  const slot = validateSurveySlot(date, time, now);
  if (slot.start.getTime() !== start.getTime()) throw new SurveyBookingError("INVALID_SURVEY_TIME", 400);
  const conflict = await tx.acara.findFirst({ where: { id_agent: agentId, status_acara: { notIn: ["CANCELLED", "DRAFT"] },
    tanggal_mulai: { lt: slot.end }, tanggal_selesai: { gt: slot.start } }, select: { id_acara: true } });
  if (conflict) throw new SurveyBookingError("SURVEY_SLOT_TAKEN");
  return slot;
}
export async function surveyAvailability(db: Pick<PrismaClient, "acara">, agentId: string, date: string, now = Date.now()) {
  if (!/^AG\d{1,18}$/.test(agentId) || surveyInstant(date, "00:00") == null) throw new SurveyBookingError("INVALID_SURVEY_DATE", 400);
  const start = surveyInstant(date, "00:00")!;
  if (start + 86400000 <= now || start > now + 92 * 86400000) throw new SurveyBookingError("INVALID_SURVEY_DATE", 400);
  const busy = await db.acara.findMany({ where: { id_agent: agentId, status_acara: { notIn: ["CANCELLED", "DRAFT"] },
    tanggal_mulai: { lt: new Date(start + 86400000) }, tanggal_selesai: { gt: new Date(start) } }, select: { tanggal_mulai: true, tanggal_selesai: true } });
  return { date, blockedSlots: SURVEY_HOURS.map(hour => {
    const from = start + hour * 3600000, end = from + 3600000;
    return { label: `${String(hour).padStart(2, "0")}:00`, hour, blocked: from <= now || busy.some(a => a.tanggal_mulai.getTime() < end && a.tanggal_selesai.getTime() > from) };
  }) };
}
export function validSurveyRequest(v: any): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v) || typeof v.agent_id !== "string" || typeof v.property_id !== "string" || !/^AG\d{1,18}$/.test(v.agent_id) || !/^[1-9]\d{0,17}$/.test(v.property_id)) return false;
  if (v.action === "availability") return Object.keys(v).every(k => ["action", "agent_id", "property_id", "date"].includes(k)) && typeof v.date === "string";
  if (v.action !== "book" || Object.keys(v).some(k => !["action", "agent_id", "property_id", "date", "time", "phone", "name", "request_id"].includes(k))) return false;
  return typeof v.date === "string" && typeof v.time === "string" && typeof v.name === "string" && !!v.name.trim() && v.name.length <= 100 && !/[\x00-\x1f]/.test(v.name) &&
    typeof v.phone === "string" && /^62\d{7,13}$/.test(v.phone) && typeof v.request_id === "string" && /^[a-f0-9-]{36}$/.test(v.request_id);
}
type BookingRow = { id_booking: bigint; id_agent: string; id_property: bigint; nomor_telepon: string; tanggal_survei: Date; status: string };
export async function chatbotSurveyWithinTransaction(tx: Tx, input: any, now = Date.now()) {
  if (!validSurveyRequest(input)) throw new SurveyBookingError("INVALID_REQUEST", 400);
  const agent = await tx.agent.findUnique({ where: { id_agent: input.agent_id }, select: { status_keanggotaan: true, pengguna: { select: { status_akun: true, nama_lengkap: true } } } });
  if (!agent || agent.status_keanggotaan !== "AKTIF" || agent.pengguna.status_akun !== "AKTIF") throw new SurveyBookingError("SURVEY_AGENT_UNAVAILABLE", 503);
  const property = await tx.listing.findUnique({ where: { id_property: BigInt(input.property_id) }, select: { judul: true, jenis_transaksi: true, status_tayang: true, bukan_properti: true } });
  if (!property || property.status_tayang !== "TERSEDIA" || property.bukan_properti) throw new SurveyBookingError("SURVEY_PROPERTY_UNAVAILABLE");
  if (!["PRIMARY", "SECONDARY", "SEWA"].includes(property.jenis_transaksi)) throw new SurveyBookingError("AUCTION_EXTERIOR_ONLY");
  if (input.action === "availability") return surveyAvailability(tx, input.agent_id, input.date, now);
  await lockSurveyAgent(tx, input.agent_id);
  const previous = await tx.$queryRaw<BookingRow[]>`SELECT id_booking,id_agent,id_property,nomor_telepon,tanggal_survei,status FROM public.booking_survei WHERE chatbot_request_id=${input.request_id} LIMIT 1`;
  const instant = surveyInstant(input.date, input.time);
  if (previous[0]) {
    const row = previous[0];
    if (row.id_agent !== input.agent_id || String(row.id_property) !== input.property_id || row.nomor_telepon !== `+${input.phone}` || row.tanggal_survei.getTime() !== instant) throw new SurveyBookingError("SURVEY_REQUEST_CONFLICT");
    return { booking_id: String(row.id_booking), agent_id: input.agent_id, property_id: input.property_id, date: input.date, time: input.time, status: row.status, created: false };
  }
  const slot = validateSurveySlot(input.date, input.time, now);
  await ensureSurveyAvailable(tx, input.agent_id, slot.start, now);
  const client = await tx.klien.findFirst({ where: { id_agent: input.agent_id, OR: [{ chatbot_nomor_whatsapp: input.phone }, { nomor_whatsapp: { in: [input.phone, `+${input.phone}`, `0${input.phone.slice(2)}`] } }] }, select: { id_klien: true } });
  const note = "Diajukan melalui asisten WhatsApp; pendampingan dan jadwal menunggu konfirmasi agen.";
  const rows = await tx.$queryRaw<{ id_booking: bigint }[]>`INSERT INTO public.booking_survei
    (id_property,id_agent,nama_klien,nomor_telepon,tanggal_survei,status,catatan,tanggal_dibuat,chatbot_request_id)
    VALUES (${BigInt(input.property_id)},${input.agent_id},${input.name.trim()},${`+${input.phone}`},${slot.start},'PENDING',${note},now(),${input.request_id}) RETURNING id_booking`;
  await tx.acara.create({ data: { id_agent: input.agent_id, id_property: BigInt(input.property_id), id_klien_ref: client?.id_klien || null,
    judul_acara: `Survei: ${property.judul} (${input.name.trim()})`.slice(0, 255), deskripsi: `${note} Booking #${rows[0].id_booking}.`,
    tipe_acara: "SITE_VISIT", tanggal_mulai: slot.start, tanggal_selesai: slot.end, status_acara: "SCHEDULED" } });
  return { booking_id: String(rows[0].id_booking), agent_id: input.agent_id, property_id: input.property_id, date: input.date, time: input.time, status: "PENDING", created: true };
}
export async function chatbotSurvey(db: PrismaClient, input: any, now = Date.now()) {
  return db.$transaction(tx => chatbotSurveyWithinTransaction(tx, input, now), { maxWait: 5000, timeout: 15000 });
}

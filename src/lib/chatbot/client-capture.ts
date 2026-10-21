import { Prisma, type PrismaClient } from "@prisma/client";
import { isBuyerCriteria, type BuyerCriteria } from "./property-knowledge.ts";
import { CHATBOT_AGENT_ID, validClientCapture } from "../../../backend/whatsapp/services/client_capture.js";
import { syncClientPreferences } from "./client-preferences.ts";

export type ClientCapture = { phone: string; name: string | null; criteria: BuyerCriteria; captured_at: number };
export function isClientCapture(value: unknown, now = Date.now()): value is ClientCapture {
  if (!validClientCapture(value)) return false;
  const input = value as ClientCapture;
  return input.captured_at <= now + 300000 && isBuyerCriteria(input.criteria) && !!input.criteria.city &&
    !!input.criteria.max_price && !!(input.criteria.transaction_type || input.criteria.transaction_types?.length);
}

// An advisory lock also covers legacy phone spellings, before the unique
// chatbot identity is attached. No merges, reassignment or deletion of clients.
export async function captureClientWithinTransaction(tx: Prisma.TransactionClient, input: ClientCapture, now = Date.now()) {
  if (!isClientCapture(input, now)) throw new TypeError("INVALID_CLIENT_CAPTURE");
  const { phone, name, criteria, captured_at } = input;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`chatbot-klien:${CHATBOT_AGENT_ID}:${phone}`}))`;
  const agent = await tx.agent.findUnique({ where: { id_agent: CHATBOT_AGENT_ID },
    select: { status_keanggotaan: true, pengguna: { select: { status_akun: true } } } });
  if (!agent || agent.status_keanggotaan !== "AKTIF" || agent.pengguna.status_akun !== "AKTIF") throw new Error("CHATBOT_AGENT_UNAVAILABLE");
  let existing = await tx.klien.findUnique({ where: { id_agent_chatbot_nomor_whatsapp: { id_agent: CHATBOT_AGENT_ID, chatbot_nomor_whatsapp: phone } } });
  if (!existing) {
    const variants = phone.startsWith("62") ? [phone, `0${phone.slice(2)}`, phone.slice(2)] : [phone];
    const legacy = await tx.$queryRaw<Array<{ id_klien: string }>>`SELECT id_klien FROM public.klien
      WHERE id_agent = ${CHATBOT_AGENT_ID} AND regexp_replace(coalesce(nomor_whatsapp, ''), '[^0-9]', '', 'g') IN (${Prisma.join(variants)})
      ORDER BY dibuat_pada ASC, id_klien ASC LIMIT 1`;
    if (legacy[0]) existing = await tx.klien.findUnique({ where: { id_klien: legacy[0].id_klien } });
  }
  if (existing?.chatbot_terakhir_pada && existing.chatbot_terakhir_pada.getTime() > captured_at) {
    return { id_klien: existing.id_klien, id_agent: CHATBOT_AGENT_ID, status: "stale" as const };
  }
  const timestamp = new Date(captured_at);
  const data = {
    ...(existing && !existing.chatbot_nomor_whatsapp ? { nomor_whatsapp: phone } : {}),
    chatbot_nomor_whatsapp: phone, chatbot_lokasi: criteria.location, chatbot_kota: criteria.city,
    chatbot_wilayah: criteria.region_group || null,
    chatbot_budget_min: criteria.min_price ?? null, chatbot_budget_max: criteria.max_price ?? null,
    chatbot_jenis_aset: criteria.categories || (criteria.category ? [criteria.category] : []),
    chatbot_jenis_transaksi: criteria.transaction_types || (criteria.transaction_type ? [criteria.transaction_type] : []),
    chatbot_luas_tanah_min: criteria.min_land_area_m2 ?? null, chatbot_luas_tanah_max: criteria.max_land_area_m2 ?? null,
    chatbot_kriteria: JSON.parse(JSON.stringify(criteria)) as Prisma.InputJsonValue,
    chatbot_terakhir_pada: timestamp,
    tanggal_kontak_terakhir: existing?.tanggal_kontak_terakhir && existing.tanggal_kontak_terakhir.getTime() > captured_at ? existing.tanggal_kontak_terakhir : timestamp,
    diperbarui_pada: new Date(now),
  };
  const client = existing ? await tx.klien.update({ where: { id_klien: existing.id_klien }, data: { ...data, ...(name ? { nama: name.trim() } : {}) }, select: { id_klien: true } }) :
    await tx.klien.create({ data: { ...data, id_agent: CHATBOT_AGENT_ID, nama: name?.trim() || `Kontak WhatsApp ${phone}`,
      nomor_whatsapp: phone, sumber: "wa_organik", status: "lead_baru" }, select: { id_klien: true } });
  await syncClientPreferences(tx, client.id_klien, criteria, existing?.chatbot_preferensi_meta);
  return { id_klien: client.id_klien, id_agent: CHATBOT_AGENT_ID, status: existing ? "updated" as const : "created" as const };
}

export async function captureClient(db: PrismaClient, input: ClientCapture, now = Date.now()) {
  return db.$transaction((tx) => captureClientWithinTransaction(tx, input, now), { maxWait: 5000, timeout: 15000 });
}

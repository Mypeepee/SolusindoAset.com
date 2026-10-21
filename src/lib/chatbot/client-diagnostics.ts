import { randomInt } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Prisma, type PrismaClient } from "@prisma/client";
import { captureClientWithinTransaction } from "./client-capture.ts";
import { CHATBOT_AGENT_ID } from "../../../backend/whatsapp/services/client_capture.js";

// Uses the production persistence function in an outer transaction that must
// always roll back. Never enqueue this synthetic contact in the real outbox.
export async function checkClientDatabase(db: PrismaClient, now = Date.now()) {
  const rollback = new Error("CLIENT_CHECK_ROLLBACK");
  let clientId: string | null = null;
  const verify = (ok: unknown) => { if (!ok) throw new Error("CLIENT_CHECK_FAILED"); };
  try {
    await db.$transaction(async (tx) => {
      let phone = "";
      for (let i = 0; i < 5; i++) {
        const candidate = `628000${randomInt(10000000, 99999999)}`;
        const variants = [candidate, `0${candidate.slice(2)}`, candidate.slice(2)];
        const existing = await tx.$queryRaw<Array<{ id_klien: string }>>`SELECT id_klien FROM public.klien
          WHERE regexp_replace(coalesce(nomor_whatsapp, ''), '[^0-9]', '', 'g') IN (${Prisma.join(variants)})
            OR chatbot_nomor_whatsapp = ${candidate} LIMIT 1`;
        if (!existing.length) { phone = candidate; break; }
      }
      verify(phone);
      const criteria = { location: "Surabaya Barat", city: "Surabaya", region_group: "barat" as const,
        max_price: 500000000, category: "RUMAH" as const, transaction_type: "LELANG" as const,
        min_land_area_m2: 150, nearby: { query: "sekolah", radius_m: 500 } };
      const input = { phone, name: "Uji Penyimpanan Chatbot", criteria, captured_at: now };
      const created = await captureClientWithinTransaction(tx, input, now);
      verify(created.status === "created" && created.id_agent === CHATBOT_AGENT_ID);
      clientId = created.id_klien;
      const row = await tx.klien.findUniqueOrThrow({ where: { id_klien: clientId } });
      verify(row.nomor_whatsapp === phone && row.nama === input.name && row.id_agent === CHATBOT_AGENT_ID &&
        Number(row.chatbot_budget_max) === 500000000 && Number(row.chatbot_luas_tanah_min) === 150 &&
        row.chatbot_jenis_aset.includes("RUMAH") && isDeepStrictEqual(row.chatbot_kriteria, criteria));
      const updated = await captureClientWithinTransaction(tx, { ...input, criteria: { ...criteria, max_price: 600000000 }, captured_at: now + 1 }, now + 1);
      verify(updated.id_klien === clientId && updated.status === "updated");
      const revised = await tx.klien.findUniqueOrThrow({ where: { id_klien: clientId } });
      verify(Number(revised.chatbot_budget_max) === 600000000 && revised.chatbot_wilayah === "barat");
      const preferences = await tx.preferensiKlien.findMany({ where: { id_klien: clientId } });
      verify(preferences.length === 7 && preferences.every((p) => p.loc_kecamatan && Number(p.budget_max) === 600000000 && Number(p.luas_min) === 150 && p.dekat_nilai === "kelas:SEKOLAH@surabaya"));
      verify(await tx.klien.count({ where: { id_agent: CHATBOT_AGENT_ID, chatbot_nomor_whatsapp: phone } }) === 1);
      throw rollback;
    }, { maxWait: 5000, timeout: 15000 });
  } catch (error) { if (error !== rollback) throw error; }
  if (!clientId) throw new Error("CLIENT_CHECK_FAILED");
  verify(!await db.klien.findUnique({ where: { id_klien: clientId }, select: { id_klien: true } }));
  return { status: "passed" as const, id_agent: CHATBOT_AGENT_ID, checked_at: now,
    checks: { write: true, read: true, update: true, deduplication: true, cleanup: true } };
}

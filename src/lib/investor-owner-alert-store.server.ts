import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  INVESTOR_ALERT_COOLDOWN_MS,
  INVESTOR_ALERT_MAX_ATTEMPTS,
  ownerAlertAssetKey,
} from "./investor-owner-alerts";
import { jakartaDayStart, type InvestorListing } from "./investor-deals";

export type AlertOwner = { id: string; name: string; email: string };
export type AlertClaim = { deliveryId: string; keys: string[] };

export const investorAlertStore = {
  async ready() {
    const rows = await prisma.$queryRaw<{ ready: boolean }[]>`
      SELECT to_regclass('investor_owner_alerts') IS NOT NULL AS ready`;
    return rows[0]?.ready === true;
  },
  async owners(): Promise<AlertOwner[]> {
    const rows = await prisma.agent.findMany({
      where: { jabatan: "OWNER", status_keanggotaan: "AKTIF", pengguna: { peran: "AGENT", status_akun: "AKTIF", email: { not: null } } },
      select: { id_agent: true, pengguna: { select: { nama_lengkap: true, email: true } } },
      orderBy: { id_agent: "asc" },
    });
    return rows.flatMap((row) => {
      const email = row.pengguna.email?.trim() || "";
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? [{ id: row.id_agent, name: row.pengguna.nama_lengkap, email }]
        : [];
    });
  },
  async excluded(ownerId: string) {
    const rows = await prisma.$queryRaw<{ asset_key: string }[]>`
      SELECT asset_key FROM investor_owner_alerts WHERE owner_id=${ownerId}
      AND (state IN ('sent','uncertain','failed') OR attempts >= ${INVESTOR_ALERT_MAX_ATTEMPTS})`;
    return new Set(rows.map((row) => row.asset_key));
  },
  /** Short transaction only: SMTP and source-photo fetches never hold DB locks. */
  async claim(owner: AlertOwner, items: readonly InvestorListing[], now: Date): Promise<AlertClaim | null> {
    if (!items.length) return null;
    return prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${'investor-alert:' + owner.id},0)) AS acquired`;
      if (!lock.acquired) return null;
      const stale = new Date(now.getTime() - 5 * 60_000);
      await tx.$executeRaw`
        UPDATE investor_owner_alerts SET state=CASE WHEN state='sending' THEN 'uncertain' ELSE 'retry' END,
          error_code=CASE WHEN state='sending' THEN 'DELIVERY_UNCERTAIN' ELSE 'PREPARATION_INTERRUPTED' END,
          updated_at=${now},next_attempt_at=${now}
        WHERE owner_id=${owner.id} AND state IN ('preparing','sending') AND claimed_at < ${stale}`;
      const [guard] = await tx.$queryRaw<{ busy: boolean; recent: boolean }[]>`
        SELECT EXISTS(SELECT 1 FROM investor_owner_alerts WHERE owner_id=${owner.id} AND state IN ('preparing','sending')) AS busy,
          EXISTS(SELECT 1 FROM investor_owner_alerts WHERE owner_id=${owner.id} AND last_attempt_at > ${new Date(now.getTime() - INVESTOR_ALERT_COOLDOWN_MS)}) AS recent`;
      if (guard.busy || guard.recent) return null;
      const deliveryId = randomUUID();
      const values = items.map((item) => ({
        id: randomUUID(), key: ownerAlertAssetKey(item), listing: item.id,
        initial: item.initialAuctionPrice, current: item.currentAuctionPrice, drop: item.metricAuctionDropPct,
      }));
      const rows = await tx.$queryRaw<{ asset_key: string }[]>(Prisma.sql`
        INSERT INTO investor_owner_alerts(id,owner_id,asset_key,listing_id,recipient,initial_price,current_price,drop_pct,state,delivery_id,claimed_at,updated_at)
        SELECT v.id,${owner.id},v.key,v.listing::bigint,${owner.email},v.initial,v.current,v.drop,'preparing',${deliveryId},${now},${now}
        FROM jsonb_to_recordset(${JSON.stringify(values)}::jsonb) AS v(id text,key text,listing text,initial numeric,current numeric,drop numeric)
        ON CONFLICT(owner_id,asset_key) DO UPDATE SET listing_id=EXCLUDED.listing_id,recipient=EXCLUDED.recipient,
          initial_price=EXCLUDED.initial_price,current_price=EXCLUDED.current_price,drop_pct=EXCLUDED.drop_pct,
          state='preparing',delivery_id=EXCLUDED.delivery_id,claimed_at=EXCLUDED.claimed_at,updated_at=EXCLUDED.updated_at,error_code=NULL
        WHERE investor_owner_alerts.state='retry' AND investor_owner_alerts.attempts < ${INVESTOR_ALERT_MAX_ATTEMPTS}
          AND (investor_owner_alerts.next_attempt_at IS NULL OR investor_owner_alerts.next_attempt_at <= ${now})
        RETURNING asset_key`);
      return rows.length ? { deliveryId, keys: rows.map((row) => row.asset_key) } : null;
    });
  },
  async current(owner: AlertOwner, items: readonly InvestorListing[], now: Date) {
    const active = await prisma.agent.findFirst({
      where: { id_agent: owner.id, jabatan: "OWNER", status_keanggotaan: "AKTIF", pengguna: { peran: "AGENT", status_akun: "AKTIF", email: owner.email } },
      select: { id_agent: true },
    });
    if (!active) return false;
    const rows = await prisma.$queryRaw<{ id: string; price: Prisma.Decimal; auction_date: Date | null }[]>(Prisma.sql`
      SELECT id_property::text id,coalesce(nullif(nilai_limit_lelang,0),harga) price,tanggal_lelang auction_date
      FROM listing WHERE id_property IN (${Prisma.join(items.map((item) => BigInt(item.id)))})
      AND status_tayang='TERSEDIA' AND jenis_transaksi='LELANG' AND NOT bukan_properti
      AND upper(judul) !~ '^[[:space:]]*(SEWA|DISEWAKAN|PENYEWAAN)([[:space:]:-]|$)'`);
    const byId = new Map(rows.map((row) => [row.id, row]));
    // No stale prices or newly sold/withdrawn sources may enter an outgoing email.
    return items.every((item) => {
      const row = byId.get(item.id);
      return row && Number(row.price) === item.currentAuctionPrice &&
        row.auction_date && new Date(row.auction_date).toISOString() === item.auctionDate &&
        new Date(row.auction_date).getTime() >= jakartaDayStart(now);
    });
  },
  async release(claim: AlertClaim, reason: string, now: Date) {
    await prisma.$executeRaw`
      UPDATE investor_owner_alerts SET state='retry',error_code=${reason},updated_at=${now},
        next_attempt_at=${new Date(now.getTime() + 15 * 60_000)},claimed_at=NULL
      WHERE delivery_id=${claim.deliveryId} AND state='preparing'`;
  },
  async begin(claim: AlertClaim, now: Date) {
    const rows = await prisma.$queryRaw<{ asset_key: string }[]>`
      UPDATE investor_owner_alerts SET state='sending',attempts=attempts+1,last_attempt_at=${now},claimed_at=${now},updated_at=${now}
      WHERE delivery_id=${claim.deliveryId} AND state='preparing' RETURNING asset_key`;
    return rows.length === claim.keys.length;
  },
  async finish(claim: AlertClaim, delivery: { state: string; messageId?: string; errorCode?: string }, now: Date) {
    await prisma.$executeRaw`
      UPDATE investor_owner_alerts SET state=CASE WHEN ${delivery.state}='retry' AND attempts >= ${INVESTOR_ALERT_MAX_ATTEMPTS} THEN 'failed' ELSE ${delivery.state} END,
        message_id=${delivery.messageId || null},error_code=${delivery.errorCode || null},updated_at=${now},claimed_at=NULL,
        sent_at=${delivery.state === 'sent' ? now : null},
        next_attempt_at=${delivery.state === 'retry' ? new Date(now.getTime() + INVESTOR_ALERT_COOLDOWN_MS) : null}
      WHERE delivery_id=${claim.deliveryId} AND state='sending'`;
  },
};

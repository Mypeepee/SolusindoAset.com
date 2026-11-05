import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { ListingStatus } from "@/lib/listingStatusPermission";
import { cariIdAsetSama } from "@/lib/auctionMatch";
import {
  buildRiwayatStatus,
  pesanErrorStatus,
  revalidateListingDetail,
  resolveStatusActor,
} from "@/app/api/listings/_lib/status-guard";
import {
  investorPrivateHeaders,
  requireInvestorOwner,
} from "@/lib/investor-owner.server";
import { invalidateInvestorCache } from "@/lib/investor-cma-legacy.server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  try {
    return BigInt(raw.trim());
  } catch {
    return null;
  }
}

/** Tandai aset Investor beserta seluruh listing historis yang cocok persis. */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const denied = await requireInvestorOwner();
    if (denied) return denied;

    const idProperty = parseId(params.id);
    if (idProperty === null)
      return NextResponse.json(
        { error: "Id listing tidak valid." },
        { status: 400, headers: investorPrivateHeaders },
      );

    const resolved = await resolveStatusActor();
    if (!resolved.ok) return resolved.response;
    if (resolved.actor.jabatan !== "OWNER")
      return NextResponse.json(
        { error: "Aksi ini hanya dapat dilakukan oleh owner." },
        { status: 403, headers: investorPrivateHeaders },
      );

    const outcome = await prisma.$transaction(async (tx) => {
      const source = await tx.listing.findUnique({
        where: { id_property: idProperty },
        select: {
          id_property: true,
          id_agent: true,
          jenis_transaksi: true,
          status_tayang: true,
          slug: true,
          kota: true,
          kelurahan: true,
          kecamatan: true,
          legalitas: true,
          nomor_legalitas: true,
        },
      });
      if (!source) return { kind: "missing" as const };
      if (source.status_tayang === "TERJUAL")
        return { kind: "already-sold" as const };
      if (source.status_tayang !== "TERSEDIA")
        return { kind: "unavailable" as const };

      const relatedIds = await cariIdAsetSama(tx, source);
      const ids = [...new Set([idProperty, ...relatedIds])];
      await tx.$queryRaw<Array<{ id_property: bigint }>>(Prisma.sql`
        SELECT id_property FROM listing
        WHERE id_property IN (${Prisma.join(ids)})
        ORDER BY id_property
        FOR UPDATE`);
      const targets = await tx.listing.findMany({
        where: { id_property: { in: ids } },
        select: {
          id_property: true,
          id_agent: true,
          jenis_transaksi: true,
          status_tayang: true,
          slug: true,
        },
      });
      const lockedSource = targets.find(
        (target) => target.id_property === idProperty,
      );
      if (!lockedSource) return { kind: "missing" as const };
      if (lockedSource.status_tayang === "TERJUAL")
        return { kind: "already-sold" as const };
      if (lockedSource.status_tayang !== "TERSEDIA")
        return { kind: "unavailable" as const };

      const changed = targets.filter(
        (target) => target.status_tayang !== "TERJUAL",
      );
      const now = new Date();

      if (changed.length) {
        await tx.listing.updateMany({
          where: {
            id_property: { in: changed.map((target) => target.id_property) },
            status_tayang: { not: "TERJUAL" },
          },
          data: { status_tayang: "TERJUAL", tanggal_diupdate: now },
        });
        await tx.riwayatStatusListing.createMany({
          data: changed.map((target) =>
            buildRiwayatStatus({
              idProperty: target.id_property,
              actor: resolved.actor,
              basis: "OWNER",
              idAgentPemilik: target.id_agent,
              statusLama: target.status_tayang as ListingStatus,
              statusBaru: "TERJUAL",
              sumber: "DASHBOARD",
            }),
          ),
        });
      }

      return { kind: "saved" as const, changed };
    });

    if (outcome.kind === "missing")
      return NextResponse.json(
        { error: "Listing tidak ditemukan." },
        { status: 404, headers: investorPrivateHeaders },
      );
    if (outcome.kind === "unavailable")
      return NextResponse.json(
        { error: "Listing ini tidak tersedia untuk ditandai terjual." },
        { status: 409, headers: investorPrivateHeaders },
      );
    if (outcome.kind === "already-sold")
      return NextResponse.json(
        { success: true, changedCount: 0, message: "Aset ini sudah terjual." },
        { headers: investorPrivateHeaders },
      );

    if (outcome.changed.length) {
      invalidateInvestorCache();
      for (const listing of outcome.changed)
        revalidateListingDetail(
          listing.jenis_transaksi,
          listing.slug,
          listing.id_property.toString(),
        );
    }

    return NextResponse.json(
      {
        success: true,
        changedCount: outcome.changed.length,
        listingIds: outcome.changed.map((listing) =>
          listing.id_property.toString(),
        ),
        message: `${outcome.changed.length} listing aset dan riwayatnya berhasil ditandai terjual.`,
      },
      { headers: investorPrivateHeaders },
    );
  } catch (error) {
    console.error(
      "[Investor mark sold]",
      error instanceof Error ? error.name : "Database error",
    );
    return NextResponse.json(
      { error: pesanErrorStatus(error) },
      { status: 500, headers: investorPrivateHeaders },
    );
  }
}
"use client";
import Link from "next/link";
import type { CampaignInventory } from "@/lib/marketing/campaign";
import { number } from "./ui";

/** The same source/eligibility explanation in the editor and stock preview. */
export default function CampaignInventoryStatus({
  data,
}: {
  data: Pick<CampaignInventory, "diagnostics"> & {
    recommendation?: { target: number };
  };
}) {
  const stats = data.diagnostics;
  const noSlots = data.recommendation?.target === 0;
  const latestAuction = stats?.latestAuctionDate
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(new Date(stats.latestAuctionDate))
    : null;
  if (!stats && !noSlots) return null;
  const reasons = stats
    ? ([
        [stats.expired, "lelang sudah lewat sebelum waktu tayang"],
        [stats.closingSoon, "lelang kurang dari 5 hari dari waktu posting"],
        [stats.missingAuctionDate, "tanggal lelang belum tersedia"],
        [stats.unverified, "kelurahan belum terverifikasi"],
        [stats.missingEvidence, "data pembanding belum tersedia"],
        [stats.belowThreshold, "belum memenuhi ambang persen"],
        [stats.missingPhotos, "belum memiliki foto"],
        [
          stats.alreadyMarketed || 0,
          "sudah pernah tayang atau pengiriman masih diperiksa",
        ],
        [stats.reserved || 0, "sudah terikat jadwal lain"],
        [stats.unavailable, "sudah tidak tersedia atau harga tidak valid"],
      ] as const)
    : [];
  return (
    <div className="campaign-inventory-status" role="status">
      {stats && (
        <>
          <strong>
            {number(stats.total)} aset di sumber · {number(stats.ready)} siap
            tayang
          </strong>
          {stats.total === 0 && (
            <p>
              Belum ada listing untuk kombinasi wilayah, jenis, kategori, dan
              rentang harga ini.
            </p>
          )}
          <ul>
            {reasons
              .filter(([count]) => count > 0)
              .map(([count, label]) => (
                <li key={label}>
                  {number(count)} {label}
                </li>
              ))}
          </ul>
          {stats.ready === 0 && stats.expired > 0 && (
            <p>
              {latestAuction ? (
                <>Tanggal lelang terakhir di sumber: {latestAuction}. </>
              ) : null}
              Perbarui data lelang untuk mendapatkan jadwal terbaru.{" "}
              <Link
                href="/dashboard/scrape"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buka pengambilan data lelang di tab baru"
              >
                Buka pengambilan data lelang
              </Link>
            </p>
          )}
        </>
      )}
      {noSlots && (
        <p>
          Tidak ada jam tayang mendatang dalam periode ini. Stok tetap
          ditampilkan; ubah periode atau jam untuk menyusun jadwal.
        </p>
      )}
    </div>
  );
}

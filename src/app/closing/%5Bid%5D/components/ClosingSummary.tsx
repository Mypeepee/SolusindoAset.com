import Money from "./ui/Money";
import type { Listing } from "../page";

export default function ClosingSummary({ listing }: { listing: Listing }) {
  const price = listing.harga_promo ?? listing.harga;

  return (
    <div className="sticky top-[120px] space-y-3">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <div className="text-xs text-zinc-400">Ringkasan</div>
        <div className="mt-2 text-lg font-semibold text-white">
          <Money value={price} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Mini label="ID" value={String(listing.id_property)} />
          <Mini label="Kota" value={listing.kota} />
          <Mini label="Jenis" value={listing.jenis_transaksi} />
          <Mini label="Kategori" value={listing.kategori} />
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5">
        <div className="text-sm font-semibold text-white">Estimation Engine</div>
        <div className="mt-1 text-xs text-zinc-400">
          Nanti ini auto-calc: komisi total, split agent/TL, selisih dari limit, profit kantor.
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/30 p-3">
      <div className="text-[11px] text-zinc-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white truncate">{value || "-"}</div>
    </div>
  );
}
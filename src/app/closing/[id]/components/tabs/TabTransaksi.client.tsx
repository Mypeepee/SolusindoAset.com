"use client";

import { useMemo, useState } from "react";
import type { Listing } from "../../page";
import SectionCard from "../ui/SectionCard";
import Field from "../ui/Field";
import Money from "../ui/Money";

export default function TabTransaksi({ listing }: { listing: Listing }) {
  // nanti kamu bilang "ini nanti dulu" → aku bikin minimal, tapi sudah siap berkembang
  const [biayaBalikNama, setBiayaBalikNama] = useState<number>(0);
  const [catatan, setCatatan] = useState("");

  const limit = listing.nilai_limit_lelang ? Number(listing.nilai_limit_lelang) : null;

  const totalEstimasi = useMemo(() => {
    // contoh placeholder: total = biaya balik nama (nanti tambah pajak dll)
    return biayaBalikNama || 0;
  }, [biayaBalikNama]);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-7 space-y-4">
        <SectionCard title="Ringkasan transaksi" subtitle="Isi pelan-pelan, auto-save bisa nyusul nanti">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jenis transaksi" value={listing.jenis_transaksi} />
            <Field label="Kategori" value={listing.kategori} />
            <Field
              label="Harga listing"
              value={<Money value={listing.harga} />}
            />
            <Field
              label="Harga promo"
              value={listing.harga_promo ? <Money value={listing.harga_promo} /> : "-"}
            />
            <Field
              label="Limit lelang"
              value={limit ? <Money value={limit} /> : "-"}
            />
          </div>
        </SectionCard>

        <SectionCard title="Biaya-biaya (sementara)" subtitle="Nanti bisa kamu tambah BPHTB, PPh, notaris, dll">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-zinc-300">Biaya balik nama</label>
              <input
                type="number"
                value={biayaBalikNama}
                onChange={(e) => setBiayaBalikNama(Number(e.target.value))}
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-emerald-500/40"
                placeholder="contoh: 5000000"
              />
              <div className="mt-1 text-xs text-zinc-500">
                <Money value={biayaBalikNama || 0} />
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-300">Catatan transaksi</label>
              <input
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-emerald-500/40"
                placeholder="opsional"
              />
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="lg:col-span-5 space-y-4">
        <SectionCard title="Estimasi" subtitle="Placeholder dulu">
          <div className="text-sm text-zinc-400">Total biaya tambahan</div>
          <div className="mt-1 text-2xl font-semibold text-white">
            <Money value={totalEstimasi} />
          </div>
          <div className="mt-3 text-xs text-zinc-500">
            Nanti tab ini bisa jadi “wizard”: data buyer/seller, termin pembayaran, pajak, dll.
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
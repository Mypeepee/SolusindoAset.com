"use client";

import { useMemo, useState } from "react";
import SectionCard from "../ui/SectionCard";
import Money from "../ui/Money";
import type { Listing, Agent } from "../../page";

type Mode = "PERSEN" | "NOMINAL";

export default function TabPembagian({
  listing,
  agent,
}: {
  listing: Listing;
  agent: Agent | null;
}) {
  const basePrice = Number(listing.harga_promo ?? listing.harga ?? 0);

  const [dealPrice, setDealPrice] = useState<number>(basePrice);
  const [mode, setMode] = useState<Mode>("PERSEN");
  const [percent, setPercent] = useState<number>(2);
  const [nominalKomisi, setNominalKomisi] = useState<number>(0);

  // split
  const [agentShare, setAgentShare] = useState<number>(70);
  const [tlShare, setTlShare] = useState<number>(30);

  const komisiTotal = useMemo(() => {
    if (!dealPrice || dealPrice <= 0) return 0;
    if (mode === "PERSEN") return dealPrice * (percent / 100);
    return Math.max(0, nominalKomisi);
  }, [dealPrice, mode, percent, nominalKomisi]);

  const { agentNominal, tlNominal } = useMemo(() => {
    const total = komisiTotal;
    const a = (total * (agentShare / 100)) || 0;
    const t = Math.max(0, total - a);
    return { agentNominal: a, tlNominal: t };
  }, [komisiTotal, agentShare]);

  // jaga biar total 100
  const setAgent = (v: number) => {
    const x = Math.max(0, Math.min(100, v));
    setAgentShare(x);
    setTlShare(100 - x);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-7 space-y-4">
        <SectionCard title="Komisi" subtitle="Hitung cepat & jelas">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-zinc-300">Harga closing (deal)</label>
              <input
                type="number"
                value={dealPrice}
                onChange={(e) => setDealPrice(Number(e.target.value))}
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-emerald-500/40"
              />
              <div className="mt-1 text-xs text-zinc-500">
                <Money value={dealPrice || 0} />
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-300">Mode komisi</label>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("PERSEN")}
                  className={[
                    "h-11 flex-1 rounded-2xl border px-4 text-sm font-semibold",
                    mode === "PERSEN"
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                      : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
                  ].join(" ")}
                >
                  Persen
                </button>
                <button
                  type="button"
                  onClick={() => setMode("NOMINAL")}
                  className={[
                    "h-11 flex-1 rounded-2xl border px-4 text-sm font-semibold",
                    mode === "NOMINAL"
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                      : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
                  ].join(" ")}
                >
                  Nominal
                </button>
              </div>
            </div>

            {mode === "PERSEN" ? (
              <div>
                <label className="text-sm text-zinc-300">Persentase komisi (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value))}
                  className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-emerald-500/40"
                />
              </div>
            ) : (
              <div>
                <label className="text-sm text-zinc-300">Nominal komisi</label>
                <input
                  type="number"
                  value={nominalKomisi}
                  onChange={(e) => setNominalKomisi(Number(e.target.value))}
                  className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-emerald-500/40"
                />
                <div className="mt-1 text-xs text-zinc-500">
                  <Money value={nominalKomisi || 0} />
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-zinc-400">Total komisi</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              <Money value={komisiTotal} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Split pembagian" subtitle="Agent vs Team Leader">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-zinc-300">Bagian Agent (%)</label>
              <input
                type="number"
                value={agentShare}
                onChange={(e) => setAgent(Number(e.target.value))}
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-emerald-500/40"
              />
              <div className="mt-1 text-xs text-zinc-500">
                Nominal: <Money value={agentNominal} />
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-300">Bagian TL (%)</label>
              <input
                type="number"
                value={tlShare}
                onChange={(e) => setTlShare(Number(e.target.value))}
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-emerald-500/40"
                disabled
              />
              <div className="mt-1 text-xs text-zinc-500">
                Nominal: <Money value={tlNominal} />
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            Agent: {agent?.nama ?? "-"} • Split otomatis jaga total 100%.
          </div>
        </SectionCard>
      </div>

      <div className="lg:col-span-5 space-y-4">
        <SectionCard title="Ringkasan pembagian" subtitle="Biar kebaca jelas sebelum submit">
          <div className="space-y-3">
            <Row label="Harga closing" value={<Money value={dealPrice || 0} />} />
            <Row label="Komisi total" value={<Money value={komisiTotal} />} />
            <div className="h-px bg-white/10" />
            <Row label={`Agent (${agentShare}%)`} value={<Money value={agentNominal} />} />
            <Row label={`Team Leader (${tlShare}%)`} value={<Money value={tlNominal} />} />
          </div>

          <button
            type="button"
            className="mt-4 h-11 w-full rounded-2xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
            onClick={() => alert("Nanti disambung ke API /api/closing (save transaksi)")}
          >
            Simpan Pembagian
          </button>
        </SectionCard>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
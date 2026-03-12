"use client";

import { useMemo, useState } from "react";
import type { Listing, Agent, TeamLeader } from "../page";

import TabTransaksi, { type SkemaPenjualan } from "./tabs/TabTransaksi.client";
import TabProperty from "./tabs/TabProperty";
import TabAgent from "./tabs/TabAgent";
import TabPembagian from "./tabs/TabPembagian.client";

type StepKey = "TRANSAKSI" | "PROPERTY" | "AGENT" | "BAGI";

export default function ClosingTabs({
  listing,
  agent,
  leader,
  skemaPenjualan,
}: {
  listing: Listing;
  agent: Agent | null;
  leader: TeamLeader | null;
  skemaPenjualan: SkemaPenjualan; // ✅ dari ClosingShell
}) {
  const [step, setStep] = useState<StepKey>("TRANSAKSI");

  const content = useMemo(() => {
    if (step === "TRANSAKSI")
      return <TabTransaksi listing={listing} skemaPenjualan={skemaPenjualan} />;
    if (step === "PROPERTY") return <TabProperty listing={listing} />;
    if (step === "AGENT") return <TabAgent agent={agent} leader={leader} />;
    return <TabPembagian listing={listing} agent={agent} />;
  }, [step, listing, agent, leader, skemaPenjualan]);

  return (
    <div className="space-y-4">
      {/* tab header kamu bebas, ini minimal */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStep("TRANSAKSI")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            step === "TRANSAKSI"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
              : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          }`}
        >
          Informasi Transaksi
        </button>

        <button
          onClick={() => setStep("PROPERTY")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            step === "PROPERTY"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
              : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          }`}
        >
          Informasi Properti
        </button>

        <button
          onClick={() => setStep("AGENT")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            step === "AGENT"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
              : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          }`}
        >
          Informasi Agent
        </button>

        <button
          onClick={() => setStep("BAGI")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            step === "BAGI"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
              : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          }`}
        >
          Detail Pembagian
        </button>
      </div>

      {content}
    </div>
  );
}
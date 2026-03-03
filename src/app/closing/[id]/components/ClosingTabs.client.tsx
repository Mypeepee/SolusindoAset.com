"use client";

import { useMemo, useState } from "react";
import type { Listing, Agent, TeamLeader } from "../page";

import TabTransaksi from "./tabs/TabTransaksi.client";
import TabProperty from "./tabs/TabProperty";
import TabAgent from "./tabs/TabAgent";
import TabPembagian from "./tabs/TabPembagian.client";

type TabKey = "TRANSAKSI" | "PROPERTY" | "AGENT" | "BAGI";

export default function ClosingTabs({
  listing,
  agent,
  leader,
}: {
  listing: Listing;
  agent: Agent | null;
  leader: TeamLeader | null;
}) {
  const [tab, setTab] = useState<TabKey>("TRANSAKSI");

  const content = useMemo(() => {
    if (tab === "TRANSAKSI") return <TabTransaksi listing={listing} />;
    if (tab === "PROPERTY") return <TabProperty listing={listing} />;
    if (tab === "AGENT") return <TabAgent agent={agent} leader={leader} />;
    return <TabPembagian listing={listing} agent={agent} />;
  }, [tab, listing, agent, leader]);

  return (
    <div className="space-y-4">
      {/* Tab pills */}
      <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-2 backdrop-blur-xl">
        <div className="flex flex-wrap gap-2">
          <Pill active={tab === "TRANSAKSI"} onClick={() => setTab("TRANSAKSI")}>
            Informasi Transaksi
          </Pill>
          <Pill active={tab === "PROPERTY"} onClick={() => setTab("PROPERTY")}>
            Informasi Properti
          </Pill>
          <Pill active={tab === "AGENT"} onClick={() => setTab("AGENT")}>
            Informasi Agent
          </Pill>
          <Pill active={tab === "BAGI"} onClick={() => setTab("BAGI")}>
            Detail Pembagian
          </Pill>
        </div>
      </div>

      {/* Content */}
      {content}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
        active
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
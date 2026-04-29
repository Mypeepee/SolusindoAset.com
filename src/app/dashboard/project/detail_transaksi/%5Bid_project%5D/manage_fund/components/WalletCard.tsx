import {
    FileText,
    Hammer,
    Landmark,
    PiggyBank,
    Shield,
    WalletCards,
  } from "lucide-react";
  
  import type { WalletSummary } from "./types";
  import { formatIDR } from "./utils";
  
  const ICONS = {
    main: Landmark,
    documents: FileText,
    execution: Shield,
    renovation: Hammer,
    reserve: PiggyBank,
  };
  
  const STYLES = {
    main: {
      ring: "border-sky-400/20",
      bg: "from-sky-500/10 to-transparent",
      icon: "text-sky-300",
      bar: "bg-sky-400",
    },
    documents: {
      ring: "border-violet-400/20",
      bg: "from-violet-500/10 to-transparent",
      icon: "text-violet-300",
      bar: "bg-violet-400",
    },
    execution: {
      ring: "border-amber-400/20",
      bg: "from-amber-500/10 to-transparent",
      icon: "text-amber-300",
      bar: "bg-amber-400",
    },
    renovation: {
      ring: "border-emerald-400/20",
      bg: "from-emerald-500/10 to-transparent",
      icon: "text-emerald-300",
      bar: "bg-emerald-400",
    },
    reserve: {
      ring: "border-fuchsia-400/20",
      bg: "from-fuchsia-500/10 to-transparent",
      icon: "text-fuchsia-300",
      bar: "bg-fuchsia-400",
    },
  };
  
  export default function WalletCard({ wallet }: { wallet: WalletSummary }) {
    const Icon = ICONS[wallet.key] ?? WalletCards;
    const style = STYLES[wallet.key];
    const usagePercent = Math.max(0, Math.min(wallet.usageRatio * 100, 100));
  
    return (
      <div
        className={`rounded-3xl border ${style.ring} bg-gradient-to-b ${style.bg} bg-[#0b1220] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-white">{wallet.label}</div>
            <div className="mt-1 text-xs leading-5 text-white/55">
              {wallet.description}
            </div>
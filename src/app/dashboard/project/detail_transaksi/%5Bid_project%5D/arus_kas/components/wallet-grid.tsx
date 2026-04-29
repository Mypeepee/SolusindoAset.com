import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { WalletKey, WalletSummary } from "../types";
import WalletCard from "./wallet-card";

export default function WalletGrid({
  wallets,
  selectedWallet,
  onSelectWallet,
}: {
  wallets: WalletSummary[];
  selectedWallet: WalletKey | "all";
  onSelectWallet: (value: WalletKey | "all") => void;
}) {
  const backButtonClasses =
    "inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-slate-200 transition hover:bg-white/[0.08]";

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard/project"
            className={backButtonClasses}
            aria-label="Kembali ke daftar project"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Kembali</span>
          </Link>

          <div>
            <h2 className="text-base font-semibold text-white">
              Dompet Operasional
            </h2>
            <p className="text-sm text-slate-400">
              Pilih dompet untuk fokus ke pos dana tertentu.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectWallet("all")}
          className={[
            "self-start rounded-full border px-3 py-1.5 text-xs font-medium transition sm:self-auto",
            selectedWallet === "all"
              ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.06]",
          ].join(" ")}
        >
          Semua Dompet
        </button>
      </div>

      <div className="-mx-1 overflow-x-auto pb-2 scroll-smooth overscroll-x-contain snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid min-w-full grid-flow-col auto-cols-[min(92vw,430px)] gap-4 px-1 sm:auto-cols-[450px] xl:auto-cols-[470px]">
          {wallets.map((wallet) => (
            <WalletCard
              key={wallet.walletKey}
              wallet={wallet}
              active={selectedWallet === wallet.walletKey}
              onClick={() => onSelectWallet(wallet.walletKey)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
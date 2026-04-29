import type { WalletKey, WalletOption } from "../types";

export default function CashflowFilterBar({
  wallets,
  kindOptions,
  selectedWallet,
  selectedKind,
  onChangeWallet,
  onChangeKind,
}: {
  wallets: WalletOption[];
  kindOptions: string[];
  selectedWallet: WalletKey | "all";
  selectedKind: string;
  onChangeWallet: (value: WalletKey | "all") => void;
  onChangeKind: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:flex-row">
      <select
        value={selectedWallet}
        onChange={(e) => onChangeWallet(e.target.value as WalletKey | "all")}
        className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
      >
        <option value="all">Semua Dompet</option>
        {wallets.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <select
        value={selectedKind}
        onChange={(e) => onChangeKind(e.target.value)}
        className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
      >
        <option value="all">Semua Jenis</option>
        {kindOptions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}
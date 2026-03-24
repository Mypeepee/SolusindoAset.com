export default function EmptyWalletState() {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="text-base font-medium">Belum ada transaksi</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Silakan input transaksi pertama untuk dompet ini.
        </div>
      </div>
    );
  }
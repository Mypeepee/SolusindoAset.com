"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

export default function InvestorError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="my-8 flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950 p-6 text-center"
    >
      <TriangleAlert size={28} className="text-amber-200" />
      <h2 className="mt-4 text-xl text-white">
        Halaman Investor belum dapat dimuat
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Coba muat ulang. Filter pada alamat halaman tetap tersimpan.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-300"
      >
        <RefreshCw size={15} />
        Coba lagi
      </button>
    </div>
  );
}

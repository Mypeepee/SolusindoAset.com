import { FilePlus2, Search, SlidersHorizontal } from "lucide-react";

export function SuratSearchBar() {
  return (
    <section className="rounded-[28px] border border-slate-800 bg-slate-950/80 p-3 shadow-[0_18px_50px_-30px_rgba(16,185,129,0.16)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            type="text"
            placeholder="Cari template surat, kode surat, atau kategori..."
            className="w-full border-0 bg-transparent p-0 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/25 hover:text-emerald-300"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </button>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_-20px_rgba(16,185,129,0.72)] transition hover:bg-emerald-400"
          >
            <FilePlus2 className="h-4 w-4" />
            Buat Surat Baru
          </button>
        </div>
      </div>
    </section>
  );
}
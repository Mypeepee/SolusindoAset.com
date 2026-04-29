import { Grid2X2, LayoutList, Search, SlidersHorizontal } from "lucide-react";
import type { SuratCategory } from "./data";

type Props = {
  categories: SuratCategory[];
};

export function SuratToolbar({ categories }: Props) {
  return (
    <section className="mt-6 rounded-[28px] border border-white/60 bg-white/75 p-4 shadow-[0_20px_70px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="text"
            placeholder="Cari template surat, kode, atau kategori..."
            className="w-full border-0 bg-transparent p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  item.active
                    ? "bg-slate-950 text-white shadow-[0_12px_30px_-18px_rgba(15,23,42,0.75)]"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:shadow-sm"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </button>

            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:text-slate-800"
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
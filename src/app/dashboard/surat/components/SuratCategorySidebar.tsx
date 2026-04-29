import { ChevronRight, Plus } from "lucide-react";
import type { SuratCategory } from "./data";

type Props = {
  categories: SuratCategory[];
};

export function SuratCategorySidebar({ categories }: Props) {
  return (
    <div className="sticky top-6 overflow-hidden rounded-[30px] border border-white/60 bg-white/75 p-4 shadow-[0_20px_70px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Folder Surat
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            Kategori Template
          </h2>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {categories.map((category) => {
          const Icon = category.icon;

          return (
            <button
              key={category.id}
              type="button"
              className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                category.active
                  ? "bg-slate-950 text-white shadow-[0_18px_40px_-20px_rgba(15,23,42,0.75)]"
                  : "border border-transparent bg-white/60 text-slate-700 hover:border-slate-200 hover:bg-white"
              }`}
            >
              <div
                className={`rounded-2xl p-2 ${
                  category.active
                    ? "bg-white/10 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{category.label}</p>
                <p
                  className={`text-xs ${
                    category.active ? "text-white/70" : "text-slate-500"
                  }`}
                >
                  {category.count} template
                </p>
              </div>

              <ChevronRight
                className={`h-4 w-4 transition ${
                  category.active
                    ? "text-white/70"
                    : "text-slate-400 group-hover:text-slate-600"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[24px] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Premium Workspace
        </p>
        <h3 className="mt-2 text-base font-semibold text-slate-900">
          Semua template siap disesuaikan
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Cocok untuk surat investor, legal, transaksi, hingga kebutuhan internal.
        </p>
      </div>
    </div>
  );
}
import type { SuratCategory } from "./data";

type Props = {
  categories: SuratCategory[];
};

export function SuratCategoryTabs({ categories }: Props) {
  return (
    <section className="rounded-[28px] border border-slate-800 bg-slate-950/80 p-3 shadow-[0_18px_50px_-30px_rgba(16,185,129,0.16)] backdrop-blur-xl">
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              className={`group inline-flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                item.active
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700"
              }`}
            >
              <div
                className={`rounded-xl p-2 ${
                  item.active
                    ? "bg-emerald-500/12 text-emerald-300"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-slate-500">{item.total} template</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
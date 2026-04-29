import type { SuratStat } from "./data";

type Props = {
  stats: SuratStat[];
};

export function SuratQuickStats({ stats }: Props) {
  return (
    <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      {stats.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.id}
            className="group rounded-[26px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl transition hover:-translate-y-1"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  {item.label}
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                  {item.value}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{item.note}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-slate-700 transition group-hover:scale-105">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
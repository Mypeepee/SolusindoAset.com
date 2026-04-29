import type { SuratStat } from "./data";

type Props = {
  stats: SuratStat[];
};

export function SuratStats({ stats }: Props) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      {stats.map((item) => {
        const Icon = item.icon;

        return (
          <article
            key={item.id}
            className="group rounded-[28px] border border-slate-800 bg-slate-950/70 p-4 shadow-[0_18px_55px_-35px_rgba(16,185,129,0.18)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-emerald-500/20 hover:shadow-[0_28px_70px_-35px_rgba(16,185,129,0.28)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {item.label}
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {item.value}
                </h3>
                <p className="mt-2 text-sm text-slate-400">{item.note}</p>
              </div>

              <div className="rounded-2xl border border-emerald-500/12 bg-emerald-500/10 p-3 text-emerald-300 transition group-hover:scale-105">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
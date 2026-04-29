export default function ProjectPortfolioCard({
    title,
    value,
    helper,
    badge,
  }: {
    title: string;
    value: string;
    helper: string;
    badge: string;
  }) {
    return (
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">
            {badge}
          </span>
          <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.04]" />
        </div>
  
        <p className="mt-4 text-sm font-semibold text-slate-400">{title}</p>
        <p className="mt-2 text-2xl font-black tracking-tight text-white">
          {value}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-400">{helper}</p>
      </section>
    );
  }
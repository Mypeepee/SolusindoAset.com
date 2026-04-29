type Props = {
    totalProject: number;
    totalInvestor: number;
    totalDana: number;
  };
  
  function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  }
  
  export default function ProjectBottomSummary({
    totalProject,
    totalInvestor,
    totalDana,
  }: Props) {
    return (
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Summary semua project
          </p>
          <h3 className="mt-2 text-xl font-black text-white">
            Ringkasan portfolio project
          </h3>
        </div>
  
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Total Project
            </p>
            <p className="mt-2 text-2xl font-black text-white">{totalProject}</p>
          </div>
  
          <div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Total Investor
            </p>
            <p className="mt-2 text-2xl font-black text-white">{totalInvestor}</p>
          </div>
  
          <div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Dana Masuk
            </p>
            <p className="mt-2 text-sm font-black text-white">
              {formatCurrency(totalDana)}
            </p>
          </div>
        </div>
      </section>
    );
  }
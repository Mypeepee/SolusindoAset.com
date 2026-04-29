import { ArrowUpRight, FileStack, Sparkles } from "lucide-react";

export function SuratHero() {
  return (
    <section className="relative overflow-hidden rounded-[34px] border border-emerald-500/12 bg-slate-950/75 p-6 shadow-[0_30px_120px_-45px_rgba(16,185,129,0.28)] backdrop-blur-2xl sm:p-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.12),_transparent_18%)]" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            Ultra Premium Letter Workspace
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Template surat yang terasa seperti
            <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
              {" "}
              file manager modern kelas dunia
            </span>
            .
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-[15px]">
            Pilih template, buka draft terakhir, susun folder surat, dan siapkan dokumen formal
            dengan tampilan yang clean, mewah, dan siap operasional untuk kebutuhan bisnis properti.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-3.5 text-sm font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:border-emerald-500/25 hover:text-emerald-300"
          >
            <FileStack className="h-4 w-4" />
            Lihat Semua Template
          </button>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_20px_45px_-20px_rgba(16,185,129,0.72)] transition hover:-translate-y-0.5 hover:bg-emerald-400"
          >
            Gunakan Template
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
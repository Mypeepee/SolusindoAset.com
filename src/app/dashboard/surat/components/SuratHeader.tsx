import { FilePlus2, Sparkles } from "lucide-react";

export function SuratHeader() {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/60 bg-white/70 p-5 shadow-[0_20px_70px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.14),_transparent_22%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" />
            Workspace Surat
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Template surat yang editable,
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-600 bg-clip-text text-transparent">
              {" "}
              premium
            </span>
            , dan siap operasional.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
            Halaman ini dirancang seperti file manager modern agar proses memilih,
            mengedit, dan mengelola template surat terasa cepat, profesional,
            dan elegan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            Lihat Draft
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_-16px_rgba(15,23,42,0.75)] transition hover:-translate-y-0.5"
          >
            <FilePlus2 className="h-4 w-4" />
            Buat Surat Baru
          </button>
        </div>
      </div>
    </section>
  );
}
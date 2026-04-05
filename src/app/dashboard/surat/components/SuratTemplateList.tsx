import { ArrowUpRight, Eye, FilePenLine, Layers3 } from "lucide-react";
import type { SuratTemplate } from "./data";

type Props = {
  templates: SuratTemplate[];
  onUseTemplate?: (template: SuratTemplate) => void;
  onPreviewTemplate?: (template: SuratTemplate) => void;
};

function getStatusClass(status: SuratTemplate["status"]) {
  switch (status) {
    case "Populer":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "Baru":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
    default:
      return "border-slate-700 bg-slate-800/80 text-slate-300";
  }
}

export function SuratTemplateList({
  templates,
  onUseTemplate,
  onPreviewTemplate,
}: Props) {
  return (
    <section className="rounded-[30px] border border-slate-800 bg-slate-950/80 p-5 shadow-[0_20px_70px_-30px_rgba(16,185,129,0.16)] backdrop-blur-xl">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Template Surat
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
            List template yang siap digunakan
          </h2>
        </div>

        <div className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-400">
          {templates.length} template
        </div>
      </div>

      <div className="space-y-4">
        {templates.map((template) => {
          const Icon = template.icon;

          return (
            <article
              key={template.id}
              className="group rounded-[26px] border border-slate-800 bg-slate-900/80 p-5 transition hover:border-emerald-500/20 hover:shadow-[0_24px_60px_-32px_rgba(16,185,129,0.22)]"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="rounded-[20px] border border-emerald-500/12 bg-emerald-500/10 p-3 text-emerald-300">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                          <Layers3 className="h-3.5 w-3.5" />
                          {template.code}
                        </span>

                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${getStatusClass(
                            template.status
                          )}`}
                        >
                          {template.status}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-semibold text-white">
                        {template.title}
                      </h3>

                      <p className="mt-1 text-sm font-medium text-emerald-300/80">
                        {template.category}
                      </p>

                      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                        {template.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:w-[220px]">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Update
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {template.updatedAt}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Dipakai
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {template.usedCount}x
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onUseTemplate?.(template)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_-20px_rgba(16,185,129,0.72)] transition hover:bg-emerald-400"
                  >
                    <FilePenLine className="h-4 w-4" />
                    Gunakan Template
                  </button>

                  <button
                    type="button"
                    onClick={() => onPreviewTemplate?.(template)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/25 hover:text-emerald-300"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>

                  <button
                    type="button"
                    onClick={() => onUseTemplate?.(template)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/80 text-slate-300 transition hover:border-emerald-500/25 hover:text-emerald-300"
                    aria-label={`Buka template ${template.title}`}
                  >
                    <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
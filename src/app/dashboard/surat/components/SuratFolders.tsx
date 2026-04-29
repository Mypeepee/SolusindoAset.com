import { ArrowRight, FolderKanban } from "lucide-react";
import type { SuratFolder } from "./data";

type Props = {
  folders: SuratFolder[];
};

export function SuratFolders({ folders }: Props) {
  return (
    <section className="rounded-[32px] border border-slate-800 bg-slate-950/70 p-5 shadow-[0_24px_70px_-35px_rgba(16,185,129,0.18)] backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Folder Surat
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
            Kategori template yang rapi dan mudah dipindai
          </h2>
        </div>

        <button
          type="button"
          className="hidden rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/25 hover:text-emerald-300 md:inline-flex"
        >
          Kelola Folder
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {folders.map((folder) => {
          const Icon = folder.icon;

          return (
            <article
              key={folder.id}
              className="group relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 transition hover:-translate-y-1 hover:border-emerald-500/20 hover:shadow-[0_26px_60px_-35px_rgba(16,185,129,0.28)]"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${folder.tone}`} />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-[20px] border border-white/10 bg-slate-950/75 p-3 text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    <FolderKanban className="h-3.5 w-3.5" />
                    {folder.total} file
                  </div>
                </div>

                <h3 className="mt-5 text-lg font-semibold text-white">
                  {folder.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {folder.description}
                </p>

                <button
                  type="button"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
                >
                  Buka folder
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
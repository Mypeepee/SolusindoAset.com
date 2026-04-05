import { CheckCircle2, Clock3, FileSearch, PencilLine } from "lucide-react";
import type { SuratRecentDocument } from "./data";

type Props = {
  documents: SuratRecentDocument[];
};

function getBadge(status: SuratRecentDocument["status"]) {
  switch (status) {
    case "Final":
      return {
        icon: CheckCircle2,
        className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      };
    case "Review":
      return {
        icon: FileSearch,
        className: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
      };
    default:
      return {
        icon: PencilLine,
        className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
      };
  }
}

export function SuratRecentDocuments({ documents }: Props) {
  return (
    <section className="rounded-[30px] border border-slate-800 bg-slate-950/80 p-5 shadow-[0_20px_70px_-30px_rgba(16,185,129,0.16)] backdrop-blur-xl">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Recent Documents
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
          Dokumen terakhir
        </h2>
      </div>

      <div className="space-y-3">
        {documents.map((doc) => {
          const Icon = doc.icon;
          const badge = getBadge(doc.status);
          const BadgeIcon = badge.icon;

          return (
            <article
              key={doc.id}
              className="rounded-[22px] border border-slate-800 bg-slate-900/80 p-4 transition hover:border-emerald-500/20"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-[18px] border border-emerald-500/12 bg-emerald-500/10 p-3 text-emerald-300">
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold text-white">
                        {doc.title}
                      </h3>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                      >
                        <BadgeIcon className="h-3.5 w-3.5" />
                        {doc.status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-400">{doc.category}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        {doc.editedAt}
                      </span>
                      <span>Editor: {doc.editor}</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
import { CalendarDays, CheckCircle2 } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import { STATUS_LABEL, STATUS_ORDER } from "./utils";
import { SectionCard } from "./shared";

export default function LifecycleCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const currentStepIndex = STATUS_ORDER.indexOf(project.status);

  return (
    <SectionCard
      eyebrow="Lifecycle"
      title="Status eksekusi project"
      icon={<CalendarDays className="h-5 w-5" />}
    >
      <div className="space-y-4">
        {STATUS_ORDER.map((status, index) => {
          const isDone = currentStepIndex >= 0 && index < currentStepIndex;
          const isActive = status === project.status;
          const isFuture = currentStepIndex >= 0 && index > currentStepIndex;

          return (
            <div key={status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border text-xs",
                    isActive
                      ? "border-amber-400/40 bg-amber-400/12 text-amber-200"
                      : isDone
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.03] text-slate-500",
                  ].join(" ")}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>

                {index !== STATUS_ORDER.length - 1 ? (
                  <div className="mt-2 h-8 w-px bg-white/10" />
                ) : null}
              </div>

              <div className="min-w-0 pb-3">
                <div className="font-medium text-white">{STATUS_LABEL[status]}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {isActive
                    ? "Fase aktif saat ini"
                    : isDone
                    ? "Tahapan telah terlewati"
                    : isFuture
                    ? "Tahapan berikutnya"
                    : "—"}
                </div>
              </div>
            </div>
          );
        })}

        {project.status === "dibatalkan" ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            Project berstatus dibatalkan. Pastikan seluruh komunikasi investor dan penanganan dana terdokumentasi dengan sangat jelas.
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
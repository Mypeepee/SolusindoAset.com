import type { WizardStep } from "./types";
import { Check } from "lucide-react";

type Props = {
  step: WizardStep;
  currentStep: WizardStep;
  title: string;
  subtitle: string;
  accentText: string;
};

export default function StepPill({
  step,
  currentStep,
  title,
  subtitle,
  accentText,
}: Props) {
  const isActive = currentStep === step;
  const isDone = currentStep > step;

  return (
    <div
      className={`rounded-[24px] border p-4 transition ${
        isActive
          ? "border-white/20 bg-white/[0.08]"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${
            isActive || isDone
              ? "border-white/20 bg-white/[0.10] text-white"
              : "border-white/10 bg-white/[0.04] text-slate-400"
          }`}
        >
          {isDone ? <Check className="h-4 w-4" /> : step}
        </div>

        <div className="min-w-0">
          <p
            className={`text-sm font-bold ${
              isActive ? "text-white" : "text-slate-300"
            }`}
          >
            {title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>
          {isActive ? (
            <p
              className={`mt-2 text-[11px] font-bold uppercase tracking-[0.18em] ${accentText}`}
            >
              Aktif
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
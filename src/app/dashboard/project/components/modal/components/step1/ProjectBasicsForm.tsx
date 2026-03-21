"use client";

import type { CreateProjectFormValues } from "../../types";

type Props = {
  form: CreateProjectFormValues;
  updateField: <K extends keyof CreateProjectFormValues>(
    key: K,
    value: CreateProjectFormValues[K]
  ) => void;
  inputClassName: string;
  textareaClassName: string;
};

export default function ProjectBasicsForm({
  form,
  updateField,
  inputClassName,
  textareaClassName,
}: Props) {
  const titleLength = form.nama_project?.length ?? 0;
  const descriptionLength = form.deskripsi_project?.length ?? 0;

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(14,22,36,0.96),rgba(20,30,46,0.88)_45%,rgba(13,21,34,0.94))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.10),transparent_22%),radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.04),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[31px] border border-white/[0.04]" />
      <div className="pointer-events-none absolute -right-10 top-0 h-28 w-28 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="pointer-events-none absolute left-8 bottom-0 h-24 w-24 rounded-full bg-indigo-400/10 blur-3xl" />

      <div className="relative">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              Project Identity
            </div>

            <h3 className="mt-4 text-[20px] font-semibold tracking-tight text-white sm:text-[22px]">
              Informasi Project
            </h3>

            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
              Tulis identitas project dengan singkat, presisi, dan meyakinkan
              agar langsung terasa profesional saat dilihat investor.
            </p>
          </div>

          <div className="hidden shrink-0 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:block">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Step 1
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              Project Basics
            </p>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-100">
                Judul Project
              </label>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-400">
                {titleLength}/120
              </div>
            </div>

            <input
              type="text"
              value={form.nama_project || ""}
              onChange={(e) =>
                updateField("nama_project", e.target.value.slice(0, 120))
              }
              placeholder="Contoh: Cluster Adelaide JF2 Surabaya Opportunity"
              className={`${inputClassName} border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-slate-500`}
            />

            <p className="mt-3 text-xs leading-6 text-slate-400">
              Gunakan judul yang singkat, elegan, dan mudah dipahami investor
              dalam sekali lihat.
            </p>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-100">
                Deskripsi Project
              </label>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-400">
                {descriptionLength}/1000
              </div>
            </div>

            <textarea
              value={form.deskripsi_project}
              onChange={(e) =>
                updateField("deskripsi_project", e.target.value.slice(0, 1000))
              }
              rows={6}
              placeholder="Jelaskan posisi aset, alasan opportunity ini menarik, kondisi property, strategi exit, dan hal penting lain yang perlu diketahui investor..."
              className={`${textareaClassName} min-h-[170px] resize-none border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-slate-500`}
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Fokus 1
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  Highlight lokasi dan positioning aset.
                </p>
              </div>

              <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Fokus 2
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  Jelaskan potensi value creation dan exit.
                </p>
              </div>

              <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Fokus 3
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  Tulis dengan bahasa tenang dan meyakinkan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
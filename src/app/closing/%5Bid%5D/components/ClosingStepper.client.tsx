"use client";

import { Icon } from "@iconify/react";

export type StepKey = "TRANSAKSI" | "PROPERTY" | "AGENT" | "BAGI";

export const STEPS: Array<{ key: StepKey; label: string; desc: string; icon: string }> = [
  { key: "TRANSAKSI", label: "Transaksi", desc: "Harga deal & biaya", icon: "solar:bill-list-linear" },
  { key: "PROPERTY", label: "Properti", desc: "Detail objek", icon: "solar:home-linear" },
  { key: "AGENT", label: "Pihak", desc: "Agent & TL", icon: "solar:users-group-rounded-linear" },
  { key: "BAGI", label: "Pembagian", desc: "Komisi & split", icon: "solar:hand-money-linear" },
];

export default function ClosingStepper({
  value,
  onChange,
}: {
  value: StepKey;
  onChange: (k: StepKey) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-2 backdrop-blur-xl">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s) => {
          const active = s.key === value;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onChange(s.key)}
              className={[
                "group relative overflow-hidden rounded-2xl border px-3 py-3 text-left transition",
                active
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "grid h-9 w-9 place-items-center rounded-2xl border",
                    active
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                      : "border-white/10 bg-zinc-950/40 text-zinc-200",
                  ].join(" ")}
                >
                  <Icon icon={s.icon} className="text-xl" />
                </div>

                <div className="min-w-0">
                  <div className={active ? "text-sm font-semibold text-emerald-200" : "text-sm font-semibold text-white"}>
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400 truncate">{s.desc}</div>
                </div>
              </div>

              {active ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
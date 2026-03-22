import { Users2 } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import { formatIDR, formatPercent, toNumber } from "./utils";
import {
  EmptyState,
  InvestorAvatar,
  PaymentStatusPill,
  SectionCard,
} from "./shared";

export default function InvestorBookCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const investors = [...project.investors].sort(
    (a, b) => toNumber(b.paid) - toNumber(a.paid)
  );

  return (
    <SectionCard
      eyebrow="Investor Book"
      title="Partisipasi investor dan kualitas pembayaran"
      icon={<Users2 className="h-5 w-5" />}
      right={
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
          {investors.length} investor terdaftar
        </span>
      }
    >
      {investors.length > 0 ? (
        <div className="overflow-hidden rounded-[24px] border border-white/10">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr_0.9fr] gap-4 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-500">
            <div>Investor</div>
            <div>Komitmen</div>
            <div>Terbayar</div>
            <div>Kepemilikan</div>
            <div>Status</div>
          </div>

          <div className="divide-y divide-white/10">
            {investors.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr_0.9fr] gap-4 px-4 py-4 text-sm text-slate-200"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <InvestorAvatar name={item.name} avatar={item.avatar} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-white">
                        {item.name}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {item.note || "Investor tercatat di project"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="font-mono">
                  {formatIDR(toNumber(item.committed))}
                </div>

                <div className="font-mono text-emerald-300">
                  {formatIDR(toNumber(item.paid))}
                </div>

                <div>
                  {item.ownership != null
                    ? formatPercent(toNumber(item.ownership))
                    : "—"}
                </div>

                <div>
                  <PaymentStatusPill status={item.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState text="Belum ada investor pada project ini." />
      )}
    </SectionCard>
  );
}
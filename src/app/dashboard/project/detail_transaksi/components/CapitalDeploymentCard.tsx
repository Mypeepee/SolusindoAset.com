import { Layers3 } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import { formatIDR, formatPercent, safeDivide, toNumber } from "./utils";
import { EmptyState, ProgressBar, SectionCard } from "./shared";

function AllocationRow({
  label,
  value,
  ratio,
  strong,
}: {
  label: string;
  value: number;
  ratio: number;
  strong?: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0a0e14] px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className={strong ? "font-semibold text-white" : "text-slate-300"}>
          {label}
        </div>
        <div className="text-right">
          <div className={strong ? "font-mono text-white" : "font-mono text-slate-200"}>
            {formatIDR(value)}
          </div>
          <div className="text-xs text-slate-500">
            {formatPercent(ratio)} dari target
          </div>
        </div>
      </div>
      <ProgressBar value={ratio} />
    </div>
  );
}

export default function CapitalDeploymentCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const fundingTarget = toNumber(project.fundingTarget);

  const capitalStack = [
    { label: "Nilai limit lelang", value: toNumber(project.auctionLimitValue) },
    { label: "Spare bidding", value: toNumber(project.spareBidding) },
    { label: "Biaya eksekusi", value: toNumber(project.executionCost) },
    { label: "Biaya renovasi", value: toNumber(project.renovationCost) },
    { label: "Biaya balik nama", value: toNumber(project.transferCost) },
    { label: "Dana cadangan", value: toNumber(project.reserveFund) },
    {
      label: "Total biaya akuisisi",
      value: toNumber(project.totalAcquisitionCost),
      strong: true,
    },
  ].filter((item) => item.value > 0);

  return (
    <SectionCard
      eyebrow="Capital Deployment"
      title="Kemana dana investor dialokasikan"
      icon={<Layers3 className="h-5 w-5" />}
      right={
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
          Target {formatIDR(fundingTarget)}
        </span>
      }
    >
      <div className="space-y-3">
        {capitalStack.length > 0 ? (
          capitalStack.map((item) => (
            <AllocationRow
              key={item.label}
              label={item.label}
              value={item.value}
              ratio={safeDivide(item.value, fundingTarget)}
              strong={item.strong}
            />
          ))
        ) : (
          <EmptyState text="Komponen capital stack belum diisi, jadi investor belum bisa melihat deployment dana secara lengkap." />
        )}
      </div>
    </SectionCard>
  );
}
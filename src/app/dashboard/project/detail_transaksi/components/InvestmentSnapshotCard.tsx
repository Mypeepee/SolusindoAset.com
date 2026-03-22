import { Gauge } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import { compactIDR, formatIDR, formatPercent, safeDivide, toNumber } from "./utils";
import { ProgressBar, SectionCard } from "./shared";

function MetricTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0a0f16] p-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

export default function InvestmentSnapshotCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const fundingTarget = toNumber(project.fundingTarget);
  const totalFunded = toNumber(project.totalFunded);
  const estimatedSellPrice = toNumber(project.estimatedSellPrice);
  const estimatedNetProfit = toNumber(project.estimatedNetProfit);
  const purchasePrice = toNumber(project.purchasePrice);
  const totalAcquisitionCost = toNumber(project.totalAcquisitionCost) || purchasePrice;

  const investors = project.investors;
  const totalCommitted = investors.reduce(
    (sum, item) => sum + toNumber(item.committed),
    0
  );
  const totalPaid = investors.reduce((sum, item) => sum + toNumber(item.paid), 0);
  const ownershipAllocated = investors.reduce(
    (sum, item) => sum + toNumber(item.ownership),
    0
  );
  const fullyPaidCount = investors.filter((item) => item.status === "lunas").length;

  const fundingProgress = safeDivide(totalFunded, fundingTarget);
  const remainingFunding = Math.max(0, fundingTarget - totalFunded);
  const paidCommitmentProgress = safeDivide(totalPaid, totalCommitted);

  return (
    <SectionCard
      eyebrow="Investment Snapshot"
      title="Ringkas, padat, dan investor-first"
      icon={<Gauge className="h-5 w-5" />}
    >
      <div className="space-y-4">
        <MetricTile
          label="Funding progress"
          value={formatPercent(fundingProgress)}
          helper={`${compactIDR(totalFunded)} / ${compactIDR(fundingTarget)}`}
        />
        <ProgressBar value={fundingProgress} />

        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            label="Remaining room"
            value={compactIDR(remainingFunding)}
            helper="Kapasitas pendanaan tersisa"
          />
          <MetricTile
            label="Paid commitments"
            value={formatPercent(paidCommitmentProgress)}
            helper={`${compactIDR(totalPaid)} paid`}
          />
          <MetricTile
            label="Allocated equity"
            value={formatPercent(ownershipAllocated)}
            helper={`${investors.length} investor`}
          />
          <MetricTile
            label="Fully paid investors"
            value={String(fullyPaidCount)}
            helper="Investor dengan status lunas"
          />
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#0a0e14] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Exit value</span>
            <span className="font-mono text-white">
              {formatIDR(estimatedSellPrice)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-400">Acquisition basis</span>
            <span className="font-mono text-white">
              {formatIDR(totalAcquisitionCost)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-400">Net profit</span>
            <span className="font-mono text-emerald-300">
              {formatIDR(estimatedNetProfit)}
            </span>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
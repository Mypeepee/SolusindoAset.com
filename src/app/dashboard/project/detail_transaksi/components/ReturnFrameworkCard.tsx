import { TrendingUp } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import {
  formatIDR,
  formatMultiple,
  formatPercent,
  safeDivide,
  toNumber,
} from "./utils";
import { DataRow, SectionCard } from "./shared";

export default function ReturnFrameworkCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const fundingTarget = toNumber(project.fundingTarget);
  const purchasePrice = toNumber(project.purchasePrice);
  const totalAcquisitionCost = toNumber(project.totalAcquisitionCost) || purchasePrice;
  const estimatedSellPrice = toNumber(project.estimatedSellPrice);
  const estimatedNetProfit = toNumber(project.estimatedNetProfit);

  const roi = safeDivide(estimatedNetProfit, fundingTarget);
  const multiple =
    fundingTarget > 0
      ? (fundingTarget + estimatedNetProfit) / fundingTarget
      : 0;
  const profitMargin = safeDivide(estimatedNetProfit, estimatedSellPrice);

  return (
    <SectionCard
      eyebrow="Return Framework"
      title="Model hasil investasi"
      icon={<TrendingUp className="h-5 w-5" />}
    >
      <DataRow label="Target pendanaan" value={formatIDR(fundingTarget)} />
      <DataRow
        label="Total biaya akuisisi"
        value={formatIDR(totalAcquisitionCost)}
      />
      <DataRow
        label="Estimasi harga jual"
        value={formatIDR(estimatedSellPrice)}
      />
      <DataRow
        label="Estimasi profit bersih"
        value={formatIDR(estimatedNetProfit)}
        valueClassName="text-emerald-300"
      />

      <div className="my-4 border-t border-white/10" />

      <DataRow
        label="ROI terhadap dana investor"
        value={formatPercent(roi)}
      />
      <DataRow label="Equity multiple" value={formatMultiple(multiple)} />
      <DataRow label="Profit margin" value={formatPercent(profitMargin)} />
    </SectionCard>
  );
}
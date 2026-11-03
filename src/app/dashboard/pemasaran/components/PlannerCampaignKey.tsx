"use client";

import type { CampaignPeriod } from "@/lib/marketing/campaign";
import { monthDays } from "@/lib/marketing/planner";
import { campaignDate } from "./ui";
import { plannerCampaignAppearance } from "./planner-campaign-appearance";

export default function PlannerCampaignKey({ periods, month, disabled, onDate }: {
  periods: CampaignPeriod[];
  month: string;
  disabled: boolean;
  onDate: (day: string) => void;
}) {
  const days = monthDays(month);
  const campaigns = new Map<string, CampaignPeriod & { plan: NonNullable<CampaignPeriod["plan"]> }>();
  for (const period of periods) {
    if (!period.plan || period.endDate < days[0] || period.startDate > days[days.length - 1]) continue;
    const existing = campaigns.get(period.plan.id);
    if (!existing || existing.plan.state === "draft") campaigns.set(period.plan.id, { ...period, plan: period.plan });
  }
  const entries = [...campaigns.values()].sort((a, b) =>
    (a.plan.appearanceIndex ?? Number.MAX_SAFE_INTEGER) - (b.plan.appearanceIndex ?? Number.MAX_SAFE_INTEGER) || a.plan.id.localeCompare(b.plan.id),
  );
  if (!entries.length) return null;
  return <div className="marketing-planner-campaign-key">
    <p><strong>Campaign bulan ini</strong><span>{entries.length} campaign</span></p>
    <div className="marketing-planner-campaign-key-list" role="group" aria-label="Warna dan periode campaign">
      {entries.map((period) => {
        const identity = plannerCampaignAppearance(period.plan);
        const range = `${campaignDate(period.startDate)} sampai ${campaignDate(period.endDate)}`;
        const state = period.plan.state === "draft" ? " · Draf" : period.plan.state === "paused" ? " · Dijeda" : "";
        return <button
          key={period.plan.id}
          type="button"
          disabled={disabled}
          data-campaign-id={period.plan.id}
          data-pattern={identity.pattern}
          style={identity.style}
          title={`${identity.code} · ${period.plan.name}${state} · ${range}`}
          aria-label={`Lihat jadwal ${identity.code}, ${period.plan.name}${state}, ${range}`}
          onClick={() => onDate(period.startDate < days[0] ? days[0] : period.startDate)}
        >
          <span className="marketing-campaign-code">{identity.code}</span>
          <span><strong>{period.plan.name}{state}</strong><small>{range}</small></span>
        </button>;
      })}
    </div>
  </div>;
}

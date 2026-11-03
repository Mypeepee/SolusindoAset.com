"use client";
import {
  calendarDays,
  plannerSlotState,
  plannerStateLabels,
  plannerCampaignsOnDay,
  type PlannerSlot,
} from "@/lib/marketing/planner";
import { jakartaDate, type AssetSnapshot } from "@/lib/marketing/domain";
import type { CampaignPeriod } from "@/lib/marketing/campaign";
import { campaignDate, date, type Job } from "./ui";
import { plannerCampaignAppearance } from "./planner-campaign-appearance";
export default function PlannerCalendar({
  month,
  selectedDate,
  today,
  slots,
  editable,
  onDate,
  onKeyboardDate,
  now,
  simulation = false,
  campaignPeriods = [],
}: {
  now?: Date;
  simulation?: boolean;
  campaignPeriods?: CampaignPeriod[];
  month: string;
  selectedDate: string;
  today: string;
  slots: PlannerSlot<Job>[];
  editable: boolean;
  onDate: (day: string) => void;
  onKeyboardDate: (day: string) => void;
}) {
  const byDay = new Map<string, PlannerSlot<Job>[]>();
  for (const slot of slots)
    byDay.set(slot.date, [...(byDay.get(slot.date) || []), slot]);
  return (
    <div
      className="marketing-calendar"
      role="group"
      aria-labelledby="marketing-calendar-title"
    >
      <div
        className="marketing-calendar-weekdays grid grid-cols-7 border-b border-[var(--marketing-line)]"
        aria-hidden="true"
      >
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
          <span
            key={day}
            className="px-2 py-3 text-center text-[11px] font-medium text-[var(--marketing-muted)]"
          >
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {calendarDays(month).map((day, index) => {
          if (!day)
            return (
              <div
                key={"blank" + index}
                className="marketing-calendar-blank border-b border-r border-[var(--marketing-line)]"
              />
            );
          const content = byDay.get(day) || [];
          const count = content.filter((slot) => !!slot.job?.listingId).length;
          const campaigns = plannerCampaignsOnDay(campaignPeriods, day);
          const primary = campaigns[0];
          const appearance = primary ? plannerCampaignAppearance(primary.plan) : undefined;
          const campaignLabel = campaigns.map((period) => {
            const state = period.plan.state === "draft" ? " · Draf" : period.plan.state === "paused" ? " · Dijeda" : "";
            return `${plannerCampaignAppearance(period.plan).code} · ${period.plan.name} · ${campaignDate(period.startDate)} sampai ${campaignDate(period.endDate)}${state}`;
          }).join("; ");
          return (
            <button
              key={day}
              type="button"
              data-day={day}
              data-has-content={content.length > 0}
              data-past={day < today}
              data-campaign={primary ? "true" : undefined}
              data-campaign-start={primary?.startDate === day || undefined}
              data-campaign-end={primary?.endDate === day || undefined}
              data-campaign-state={primary?.plan.state}
              data-campaign-multiple={campaigns.length > 1 || undefined}
              style={appearance?.style}
              title={campaignLabel || undefined}
              disabled={!editable}
              aria-pressed={selectedDate === day}
              aria-current={day === today ? "date" : undefined}
              aria-label={
                new Intl.DateTimeFormat("id-ID", {
                  timeZone: "Asia/Jakarta",
                  dateStyle: "full",
                }).format(new Date(day + "T12:00:00+07:00")) +
                ", " +
                content.length +
                " slot, " +
                count +
                " materi" + (campaignLabel ? ", Campaign: " + campaignLabel : "")
              }
              tabIndex={day === selectedDate ? 0 : -1}
              onClick={() => onDate(day)}
              onKeyDown={(event) => {
                const step = (
                  {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  } as Record<string, number>
                )[event.key];
                if (!step || !editable) return;
                event.preventDefault();

                const target = new Date(
                  new Date(day + "T12:00:00+07:00").getTime() + step * 86400000,
                );
                onKeyboardDate(jakartaDate(target));
              }}
              className="marketing-calendar-day relative min-w-0 border-b border-r border-[var(--marketing-line)] p-1.5 text-left md:p-2"
            >
              <span className="mb-1 flex items-center justify-between gap-1">
                <span className="marketing-calendar-number flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium tabular-nums">
                  {Number(day.slice(-2))}
                </span>
                {count > 0 && (
                  <span className="marketing-calendar-ready-count hidden text-[10px] md:block">
                    {count} siap
                  </span>
                )}
              </span>
              {!!campaigns.length && (
                <span className="marketing-calendar-campaigns" aria-hidden="true">
                  {campaigns.slice(0, 3).map((period) => {
                    const identity = plannerCampaignAppearance(period.plan);
                    return <span
                      className="marketing-calendar-campaign"
                      key={period.plan.id}
                      data-campaign-id={period.plan.id}
                      data-campaign-code={identity.code}
                      data-pattern={identity.pattern}
                      data-start={period.startDate === day || undefined}
                      data-end={period.endDate === day || undefined}
                      data-state={period.plan.state}
                      style={identity.style}
                    >
                      <span className="marketing-campaign-code">{identity.code}</span>
                      <span className="marketing-calendar-campaign-name">
                        {period.plan.name}{period.plan.state === "draft" ? " · Draf" : period.plan.state === "paused" ? " · Dijeda" : ""}
                      </span>
                    </span>;
                  })}
                  {campaigns.length > 3 && <span className="marketing-calendar-campaign-more">+{campaigns.length - 3} lainnya</span>}
                </span>
              )}
              <span className="marketing-calendar-sessions space-y-1">
                {content.map((slot) => {
                  const asset = slot.job?.snapshot as AssetSnapshot | undefined;
                  return (
                    <span
                      key={slot.key}
                      data-session={slot.scheduledFor}
                      title={
                        date(slot.scheduledFor, true) +
                        " WIB · " +
                        (asset?.address ||
                          slot.campaign?.name ||
                          plannerStateLabels[plannerSlotState(slot, now)])
                      }
                      className={
                        "marketing-calendar-content marketing-event-" +
                        plannerSlotState(slot, now)
                      }
                    >
                      <span className="marketing-event-dot" />
                      <span className="min-w-0">
                        <span className="block text-[10px] tabular-nums">
                          {date(slot.scheduledFor, true)}
                        </span>
                        <span className="block truncate text-[10px] font-normal">
                          {asset?.city
                            ? simulation
                              ? asset.title
                              : asset.propertyType + " · " + asset.city
                            : slot.job || slot.campaign
                              ? plannerStateLabels[
                                  plannerSlotState(slot, now)
                                ] || "Belum terisi"
                              : "Slot otomatis"}
                        </span>
                      </span>
                    </span>
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

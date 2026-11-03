"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  plannerSlots,
  shiftMonth,
  plannerSlotState,
  type PlannerSlot,
} from "@/lib/marketing/planner";
import { jakartaDate, type Channel } from "@/lib/marketing/domain";
import { Action, number, type PlannerData, type Job } from "./ui";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Instagram,
  Today,
  WhatsApp,
  Send,
} from "./MarketingIcons";
import PlannerDay from "./PlannerDay";
import PlannerCalendar from "./PlannerCalendar";
import PlannerCampaignKey from "./PlannerCampaignKey";
import useMarketingClock from "./useMarketingClock";

export default function MarketingPlanner({
  data,
  month,
  selectedDate,
  loading,
  loadError,
  editable,
  preparing,
  focusToken,
  onDate,
  onPrepare,
  onPreview,
  onSettings,
  onCampaign,
  onReload,
  onEdit,
  simulation = false,
  photoSource = "example",
}: {
  data: PlannerData;
  simulation?: boolean;
  photoSource?: "example" | "listing";
  month: string;
  selectedDate: string;
  loading: boolean;
  loadError: string;
  editable: boolean;
  preparing: string | null;
  focusToken: number;
  onDate: (day: string) => void;
  onPrepare: (when: string) => void;
  onPreview: (job: Job) => void;
  onSettings: () => void;
  onCampaign?: (id: string) => void;
  onReload: () => void;
  onEdit: (slot: PlannerSlot<Job>) => void;
}) {
  const now = useMarketingClock(simulation ? data.planner.now : undefined);
  const [channel, setChannel] = useState<"all" | Channel>(() => {
    const value =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("plannerChannel");
    return value === "instagram" || value === "whatsapp" ? value : "all";
  });
  const keyboard = useRef(false);
  const today = jakartaDate(now);
  const available = data.planner.month === month;
  const slots = useMemo(
    () =>
      available
        ? plannerSlots(
            data.config,
            data.planner.jobs,
            month,
            now,
            data.planner.campaignPeriods || [],
          ).filter(
            (slot) =>
              (!simulation || !!slot.job) &&
              (channel === "all" || slot.channels.includes(channel)),
          )
        : [],
    [data, month, channel, available, simulation, now],
  );
  const selected = slots.filter((slot) => slot.date === selectedDate);
  const title = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "long",
    year: "numeric",
  }).format(new Date(month + "-01T12:00:00+07:00"));
  const compactTitle = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "short",
    year: "numeric",
  }).format(new Date(month + "-01T12:00:00+07:00"));
  const filled = slots.filter((slot) =>
    ["ready", "planned"].includes(plannerSlotState(slot, now)),
  ).length;
  const published = slots.filter((slot) =>
    slot.job?.publications.some((item) => item.state === "published"),
  ).length;
  const review = slots.filter(
    (slot) =>
      ["review", "missed"].includes(plannerSlotState(slot, now)) ||
      slot.job?.publications.some((item) =>
        ["failed", "uncertain"].includes(item.state),
      ),
  ).length;
  useEffect(() => {
    if (keyboard.current && !loading) {
      document
        .querySelector<HTMLButtonElement>(`button[data-day="${selectedDate}"]`)
        ?.focus();
      keyboard.current = false;
    }
  }, [selectedDate, loading]);
  useEffect(() => {
    if (!focusToken) return;
    const heading = document.getElementById("marketing-day-heading");
    heading?.scrollIntoView({ block: "center" });
    heading?.focus({ preventScroll: true });
  }, [focusToken]);
  const dayPanel = loading ? (
    <div
      className="marketing-skeleton h-96 rounded-2xl"
      aria-label="Memuat rencana tanggal terpilih"
    />
  ) : available && !loadError ? (
    <PlannerDay
      now={now}
      simulation={simulation}
      photoSource={photoSource}
      selectedDate={selectedDate}
      slots={selected}
      data={data}
      editable={editable}
      preparing={preparing}
      onPrepare={onPrepare}
      onPreview={onPreview}
      onSettings={onSettings}
      onEdit={onEdit}
      onCampaign={onCampaign}
    />
  ) : null;
  const moveMonth = (delta: number) => onDate(shiftMonth(month, delta) + "-01");
  return (
    <div className="marketing-planner">
      {!simulation &&
        (data.planner.pendingCampaigns || []).slice(0, 3).map((campaign) => (
          <section
            className="marketing-campaign-notice"
            key={campaign.id}
            aria-label="Status sinkronisasi campaign"
          >
            <div>
              <strong>
                {campaign.applied
                  ? "Perubahan campaign belum masuk Planner"
                  : "Jadwal campaign menunggu aset"}
              </strong>
              <p>
                {campaign.name} · {number(campaign.assets)} aset di draf ·{" "}
                {campaign.period?.plan.schedules.length || 0} sesi/hari.
              </p>
              <p>
                {campaign.applied
                  ? "Planner masih memakai versi yang sudah diterapkan."
                  : campaign.assets
                    ? "Simpan ke Planner untuk menetapkan properti pada jam campaign."
                    : "Jam draf sudah ditampilkan. Periksa ketersediaan aset lalu simpan ke Planner untuk menetapkan properti."}
              </p>
            </div>
            {onCampaign && (
              <Action
                disabled={!editable}
                onClick={() => onCampaign(campaign.id)}
              >
                Buka campaign
              </Action>
            )}
          </section>
        ))}
      <div className="marketing-planner-summary mb-7">
        <dl className="marketing-planner-totals grid grid-cols-4 gap-2">
          {[
            {
              value: filled,
              label: "Jadwal terisi",
              shortLabel: "Terisi",
              tone: "ready",
              icon: Check,
            },
            {
              value: slots.filter((slot) =>
                ["automatic", "draft", "unfilled"].includes(
                  plannerSlotState(slot, now),
                ),
              ).length,
              label: "Slot belum terisi",
              shortLabel: "Kosong",
              tone: "automatic",
              icon: CalendarClock,
            },
            {
              value: published,
              label: "Konten terbit",
              shortLabel: "Terbit",
              tone: "completed",
              icon: Send,
            },
            {
              value: review,
              label: "Perlu ditangani",
              shortLabel: "Perhatian",
              tone: "review",
              icon: CircleAlert,
            },
          ].map(({ value, label, shortLabel, tone, icon: Icon }) => (
            <div
              key={tone}
              className="marketing-planner-metric min-w-0"
              data-planner-tone={tone}
            >
              <dt className="flex items-center justify-between gap-2 text-xs">
                <span>
                  <span className="sr-only lg:not-sr-only">{label}</span>
                  <span className="lg:hidden" aria-hidden="true">
                    {shortLabel}
                  </span>
                </span>
                <span className="marketing-planner-metric-icon">
                  <Icon size={15} />
                </span>
              </dt>
              <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                {available ? number(value) : "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="marketing-planner-layout grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
        {simulation && dayPanel}
        <div className="min-w-0">
          <div className="marketing-planner-toolbar">
            <div className="marketing-planner-month">
              <h2
                id="marketing-calendar-title"
                className="capitalize"
                aria-label={title}
                title={title}
              >
                <span className="marketing-planner-control-label">{title}</span>
                <span
                  className="marketing-planner-compact-label"
                  aria-hidden="true"
                >
                  {compactTitle}
                </span>
              </h2>
              <div className="marketing-planner-date-controls">
                <Action
                  aria-label="Bulan sebelumnya"
                  title="Bulan sebelumnya"
                  disabled={!editable || month === "2000-01"}
                  onClick={() => moveMonth(-1)}
                >
                  <ChevronLeft size={17} />
                </Action>
                <Action
                  aria-label="Bulan berikutnya"
                  title="Bulan berikutnya"
                  disabled={!editable || month === "2100-12"}
                  onClick={() => moveMonth(1)}
                >
                  <ChevronRight size={17} />
                </Action>
                <Action
                  aria-label="Hari ini"
                  title="Hari ini"
                  disabled={!editable}
                  onClick={() => onDate(today)}
                >
                  <Today size={17} className="marketing-planner-compact-icon" />
                  <span className="marketing-planner-control-label">
                    Hari ini
                  </span>
                </Action>
              </div>
            </div>
            <div
              className="marketing-planner-channels"
              aria-label="Filter kanal planner"
            >
              {(
                [
                  { id: "all", label: "Semua kanal", icon: CalendarClock },
                  { id: "instagram", label: "Instagram", icon: Instagram },
                  { id: "whatsapp", label: "Status WA", icon: WhatsApp },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-pressed={channel === id}
                  onClick={() => {
                    setChannel(id);
                    const url = new URL(window.location.href);
                    url.searchParams.set("plannerChannel", id);
                    window.history.replaceState(null, "", url);
                  }}
                  data-channel={id}
                  className="marketing-channel-filter inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs"
                >
                  <Icon size={14} />
                  <span className="marketing-planner-control-label">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {available && !loading && !loadError && <PlannerCampaignKey
            periods={data.planner.campaignPeriods || []}
            month={month}
            disabled={!editable}
            onDate={onDate}
          />}
          <span className="sr-only" role="status">
            {loading ? "Memuat kalender " + title : ""}
          </span>
          <div
            className="marketing-planner-calendar-region"
            aria-busy={loading}
          >
            {loadError ? (
              <div className="marketing-empty" role="alert">
                <CalendarClock size={28} />
                <h2>Planner bulan ini belum dapat dimuat</h2>
                <p>{loadError}</p>
                <Action onClick={onReload}>Coba kembali</Action>
              </div>
            ) : loading || !available ? (
              <PlannerSkeleton />
            ) : (
              <div className="marketing-calendar-shell">
                <PlannerCalendar
                  simulation={simulation}
                  now={now}
                  month={month}
                  selectedDate={selectedDate}
                  today={today}
                  slots={slots}
                  campaignPeriods={data.planner.campaignPeriods || []}
                  editable={editable}
                  onDate={onDate}
                  onKeyboardDate={(day) => {
                    keyboard.current = true;
                    onDate(day);
                  }}
                />
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[var(--marketing-muted)]">
            <span className="flex items-center gap-2">
              <i className="marketing-legend-dot marketing-event-automatic" />
              Slot otomatis
            </span>
            <span className="flex items-center gap-2">
              <i className="marketing-legend-dot marketing-event-ready" />
              Materi siap
            </span>
            <span className="flex items-center gap-2">
              <i className="marketing-legend-dot marketing-event-completed" />
              Terbit
            </span>
          </div>
        </div>
        {!simulation && dayPanel}
      </div>
    </div>
  );
}
export function PlannerSkeleton() {
  return (
    <div
      className="marketing-planner-skeleton rounded-2xl border border-[var(--marketing-line)] p-4"
      role="status"
      aria-label="Memuat kalender konten"
    >
      <div className="mb-5 grid grid-cols-7 gap-3">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} className="marketing-skeleton h-4 rounded" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }, (_, index) => (
          <span
            key={index}
            className="marketing-skeleton h-14 rounded-lg md:h-28"
          />
        ))}
      </div>
    </div>
  );
}

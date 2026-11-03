"use client";

import {
  canPrepareSlot,
  plannerStateLabels,
  plannerSlotState,
  plannerCampaignsOnDay,
  type PlannerSlot,
} from "@/lib/marketing/planner";
import { errorLabels, type AssetSnapshot } from "@/lib/marketing/domain";
import { editablePlan, manualPlan, validPlanTime } from "@/lib/marketing/plan";
import { campaignPlan, campaignErrors } from "@/lib/marketing/campaign";
import { campaignAssetAvailable } from "@/lib/marketing/campaign-selection";
import {
  Action,
  date,
  campaignDate,
  imageUrl,
  number,
  Pill,
  stateLabels,
  type PlannerData,
  type Job,
} from "./ui";
import {
  Clock,
  Eye,
  ImageIcon,
  Instagram,
  Loader2,
  WhatsApp,
  Plus,
  Settings2,
  Layers,
} from "./MarketingIcons";
import { plannerCampaignAppearance } from "./planner-campaign-appearance";

export default function PlannerDay({
  selectedDate,
  slots,
  data,
  editable,
  preparing,
  onPrepare,
  onPreview,
  onSettings,
  onEdit,
  onCampaign,
  simulation = false,
  photoSource = "example",
  now: clock,
}: {
  selectedDate: string;
  slots: PlannerSlot<Job>[];
  data: PlannerData;
  simulation?: boolean;
  photoSource?: "example" | "listing";
  now?: Date;
  editable: boolean;
  preparing: string | null;
  onPrepare: (when: string) => void;
  onPreview: (job: Job) => void;
  onSettings: () => void;
  onEdit: (slot: PlannerSlot<Job>) => void;
  onCampaign?: (id: string) => void;
}) {
  const now = clock || (simulation ? new Date(data.planner.now) : new Date());
  const selected = new Date(selectedDate + "T12:00:00+07:00");
  const label = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(selected);
  const campaigns = plannerCampaignsOnDay(data.planner.campaignPeriods || [], selectedDate);
  return (
    <aside
      className="marketing-day-panel min-w-0"
      aria-label="Konten tanggal terpilih"
    >
      <div className="marketing-day-panel-heading mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs text-[var(--marketing-muted)]">
            Rencana konten
          </p>
          <h2
            id="marketing-day-heading"
            tabIndex={-1}
            className="!text-base !font-semibold"
          >
            {label}
          </h2>
        </div>
        <span className="marketing-pill">{slots.length} slot</span>
      </div>
      {!!campaigns.length && (
        <div className="marketing-day-campaigns" aria-label="Campaign pada tanggal ini">
          {campaigns.map((period) => {
            const identity = plannerCampaignAppearance(period.plan);
            return <div className="marketing-day-campaign" key={period.plan.id} data-campaign-id={period.plan.id} data-pattern={identity.pattern} style={identity.style}>
              <div className="marketing-day-campaign-label"><span className="marketing-campaign-code">{identity.code}</span><Layers size={14} /><span>{period.plan.state === "draft" ? "Campaign · Draf" : period.plan.state === "paused" ? "Campaign · Dijeda" : "Periode campaign"}</span></div>
              <strong>{period.plan.name}</strong>
              <p><time dateTime={period.startDate}>{campaignDate(period.startDate)}</time> sampai <time dateTime={period.endDate}>{campaignDate(period.endDate)}</time></p>
              {onCampaign && <Action disabled={!editable} onClick={() => onCampaign(period.plan.id)}>Buka campaign</Action>}
            </div>;
          })}
        </div>
      )}
      <div className="space-y-3">
        {!slots.length && (
          <div className="marketing-day-empty py-10 text-center">
            <CalendarEmpty />
            <h3 className="mt-4">{campaigns.length ? "Tidak ada slot pada kanal ini" : "Tidak ada jadwal"}</h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--marketing-muted)]">
              {campaigns.length
                ? "Periode campaign tetap ditandai. Pilih Semua kanal untuk melihat jadwalnya."
                : "Pilih tanggal mendatang untuk melihat slot otomatis, atau atur jadwal publikasi."}
            </p>
            {!campaigns.length && <Action className="mt-5" onClick={onSettings}>
              Atur jadwal
            </Action>}
          </div>
        )}
        {slots.map((slot) => {
          const job = slot.job,
            asset = job?.snapshot as AssetSnapshot | undefined;
          const state = plannerSlotState(slot, now);
          const campaign = campaignPlan(job);
          const expired =
            !!campaign &&
            !!asset?.id &&
            !campaignAssetAvailable(
              asset,
              new Date(Math.max(now.getTime(), Date.parse(slot.scheduledFor))),
            );
          const chosenId =
            job?.listingId || campaign?.listingId || manualPlan(job)?.listingId;
          const allowed =
            !slot.campaign &&
            (manualPlan(job) || campaign
              ? validPlanTime(new Date(slot.scheduledFor), now)
              : canPrepareSlot(
                  data.config,
                  new Date(slot.scheduledFor),
                  now,
                )) &&
            !expired &&
            (!job || job.status === "queued") &&
            !job?.publications.some(
              (publication) => publication.attemptCount > 0,
            );
          const emptyPast =
            ["skipped", "missed"].includes(state) &&
            Date.parse(slot.scheduledFor) <= now.getTime();
          const working = preparing === slot.scheduledFor;
          return (
            <article
              key={slot.key}
              data-planner-tone={state}
              className="marketing-day-content rounded-2xl border border-[var(--marketing-line)] bg-[var(--marketing-surface)] p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <time
                  className="flex items-center gap-1.5 text-xs font-semibold tabular-nums"
                  dateTime={slot.scheduledFor}
                >
                  <Clock size={14} />
                  {date(slot.scheduledFor, true)}{" "}
                  <span className="font-normal text-[var(--marketing-muted)]">
                    WIB
                  </span>
                </time>
                <Pill state={state} />
              </div>
              {state === "missed" && (
                <p className="marketing-warning mb-3">
                  Waktu tayang sudah lewat. Slot ini tidak lagi dihitung sebagai
                  rencana siap tayang.
                </p>
              )}
              {expired && state !== "missed" && (
                <p className="marketing-warning mb-3">
                  Aset tidak layak pada waktu tayang atau sudah mendekati
                  lelang. Perbarui pilihan di Campaign dan terapkan ulang
                  jadwal.
                </p>
              )}
              {chosenId && asset?.id ? (
                <div className="flex items-start gap-3">
                  <img
                    className="h-20 w-14 shrink-0 rounded-lg bg-[var(--marketing-line)] object-cover object-top"
                    src={
                      simulation
                        ? photoSource === "listing"
                          ? `/api/foto/${asset.id}?view=card&w=236&index=0`
                          : asset.images[0]
                        : job?.listingId
                          ? imageUrl(job.id)
                          : "/api/foto/" + chosenId + "?view=card&index=0&w=118"
                    }
                    alt={asset.propertyType + " di " + asset.city}
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] text-[var(--marketing-muted)]">
                      {asset.propertyType} · {asset.city}
                    </p>
                    <h3 className="line-clamp-2 !text-xs !leading-relaxed">
                      {asset.address}
                    </h3>
                    <p className="mt-2 text-xs font-semibold">
                      Rp {number(asset.price)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <span className="marketing-day-placeholder flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-[var(--marketing-line)] text-[var(--marketing-muted)]">
                    <ImageIcon size={18} />
                  </span>
                  <div>
                    <h3 className="!text-xs">
                      {slot.campaign
                        ? "Sesi " +
                          (slot.campaign.schedules.indexOf(
                            new Date(
                              Date.parse(slot.scheduledFor) + 7 * 3600000,
                            )
                              .toISOString()
                              .slice(11, 16),
                          ) +
                            1) +
                          " · belum terisi"
                        : emptyPast
                          ? "Tidak ada properti yang ditayangkan"
                          : "Belum ada properti dijadwalkan"}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--marketing-muted)]">
                      {slot.campaign
                        ? state === "awaiting"
                          ? "Properti akan dicari otomatis untuk batch dua hari berikutnya, sehari sebelum batch berjalan selesai."
                          : state === "elapsed"
                            ? "Jam sesi ini sudah lewat. Ini tampilan jadwal, bukan riwayat publikasi."
                            : slot.campaign.state === "draft"
                              ? "Mengikuti jam campaign. Properti akan ditetapkan setelah tersedia aset yang sesuai dan campaign disimpan ke Planner."
                              : "Stok belum dapat mengisi sesi campaign ini. Periksa kriteria, batas H−5, dan jeda tayang."
                        : emptyPast
                          ? "Slot ini lewat tanpa penetapan properti. Riwayat tidak diisi ulang secara otomatis."
                          : campaign
                            ? "Stok belum dapat mengisi slot campaign ini. Periksa batas H−5, kriteria, dan jeda tayang."
                            : "Slot otomatis belum memiliki rencana campaign. Simpan campaign ke Planner atau atur slot ini."}
                    </p>
                  </div>
                </div>
              )}
              <div
                className="mt-4 flex flex-wrap gap-2"
                aria-label="Kanal publikasi"
              >
                {slot.channels.map((channel) => (
                  <span
                    key={channel}
                    data-channel={channel}
                    className="marketing-day-channel inline-flex items-center gap-1.5 text-[11px] text-[var(--marketing-muted)]"
                  >
                    {channel === "instagram" ? (
                      <Instagram size={13} />
                    ) : (
                      <WhatsApp size={13} />
                    )}
                    {channel === "instagram" ? "Feed Instagram" : "Status WA"}
                    {job?.publications.find(
                      (publication) => publication.channel === channel,
                    ) &&
                      " · " +
                        stateLabels(
                          job.publications.find(
                            (publication) => publication.channel === channel,
                          )!.state,
                          job.publications.find(
                            (publication) => publication.channel === channel,
                          )?.errorCode,
                        )}
                  </span>
                ))}
                {!slot.channels.length && (
                  <span className="text-xs text-[var(--marketing-muted)]">
                    Kanal belum dipilih
                  </span>
                )}
              </div>
              {job?.reason && (
                <p className="marketing-warning mt-3 text-xs leading-relaxed">
                  {campaignErrors[job.reason] ||
                    errorLabels[job.reason] ||
                    "Materi belum dapat disiapkan. Coba kembali."}
                </p>
              )}
              {campaign?.selectionReason && chosenId && (
                <p className="marketing-footnote mt-3">
                  {campaign.selectionReason}
                </p>
              )}
              {campaign && (
                <p className="marketing-footnote mt-3">
                  Campaign:{" "}
                  <a
                    onClick={
                      simulation
                        ? (event) => {
                            event.preventDefault();
                            onSettings();
                          }
                        : undefined
                    }
                    className="underline"
                    href={
                      simulation
                        ? "?tab=campaign&simulation=campaign"
                        : "?tab=campaign&campaign=" + campaign.campaignId
                    }
                  >
                    {campaign.campaignName}
                  </a>
                </p>
              )}
              {slot.campaign ? (
                <Action
                  className="mt-4 !w-full"
                  disabled={!editable || !onCampaign}
                  onClick={() => onCampaign?.(slot.campaign!.id)}
                >
                  <Settings2 size={15} />
                  Buka campaign
                </Action>
              ) : job?.listingId ? (
                <Action
                  className="mt-4 !w-full"
                  disabled={!editable}
                  onClick={() => onPreview(job)}
                >
                  <Eye size={15} />
                  Lihat materi
                </Action>
              ) : allowed ? (
                <Action
                  className="mt-4 !w-full"
                  disabled={!editable}
                  onClick={() => onPrepare(slot.scheduledFor)}
                >
                  {working ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Plus size={15} />
                  )}
                  {working ? "Menyiapkan materi…" : "Siapkan materi"}
                </Action>
              ) : (
                !job && (
                  <p className="mt-4 text-[11px] leading-relaxed text-[var(--marketing-muted)]">
                    Materi dapat disiapkan hingga 90 hari ke depan.
                  </p>
                )
              )}
              {!slot.campaign && editablePlan(job) && (
                <Action
                  className="mt-2 !w-full"
                  disabled={!editable}
                  onClick={() => onEdit(slot)}
                >
                  <Settings2 size={15} />
                  Atur rencana
                </Action>
              )}
            </article>
          );
        })}
      </div>
      <p className="mt-5 text-[11px] leading-relaxed text-[var(--marketing-muted)]">
        Atur properti, kanal, dan jam pada setiap slot. Menyimpan rencana atau
        menyiapkan materi tidak langsung menerbitkan konten.
      </p>
    </aside>
  );
}
function CalendarEmpty() {
  return <Clock size={28} className="mx-auto text-[var(--marketing-muted)]" />;
}

"use client";

import { useMemo, useRef, useState } from "react";
import { DialogFrame } from "@/components/ui/dialog";
import { type AssetSnapshot } from "@/lib/marketing/domain";
import {
  projectSimulation,
  simulationBrief,
  simulationCovers,
} from "@/lib/marketing/campaign-simulation";
import type {
  CampaignBrief,
  CampaignArchiveScenario,
} from "@/lib/marketing/campaign";
import type { InstagramMedia } from "@/lib/marketing/instagram-content";
import { Action, date, type Job, type PlannerData } from "./ui";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Layers,
  Play,
  RefreshCw,
} from "./MarketingIcons";
import { CampaignSectionHeading, CampaignSurface } from "./CampaignVisual";
import CampaignRhythm from "./CampaignRhythm";
import CampaignStockCards, { stockDate } from "./CampaignStockCards";
import { archiveCampaignBrief } from "@/lib/marketing/campaign-archive";
import CampaignDateRange from "./CampaignDateRange";
import MarketingPlanner from "./MarketingPlanner";
import InstagramCarousel from "./InstagramCarousel";
import "./campaigns.css";
import "./instagram-workspace.css";

function previewSlides(
  job: { id: string; snapshot: unknown; caption: string },
  archive = false,
): InstagramMedia[] {
  const asset = job.snapshot as AssetSnapshot;
  const cover = simulationCovers[Number(asset.id) - 900000001];
  const photos = archive
    ? asset.images.map(
        (_, index) => `/api/foto/${asset.id}?view=card&index=${index}&w=640`,
      )
    : ["/images/instagram-examples/" + cover, ...asset.images];
  return photos.map((url, i) => ({
    id: job.id + ":" + i,
    caption: job.caption,
    type: "IMAGE",
    product: "FEED",
    mediaUrl: url,
    thumbnailUrl: url,
    permalink: null,
    timestamp: null,
    likes: null,
    comments: null,
    commentsEnabled: null,
  }));
}

/** A local scenario shared by both tabs. No real listing or dispatch API is used. */
export default function CampaignSimulation({
  tab,
  onTab,
  onExit,
  archiveScenario,
}: {
  tab: "campaign" | "planner";
  onTab: (tab: "campaign" | "planner") => void;
  onExit: () => void;
  archiveScenario?: CampaignArchiveScenario;
}) {
  const archive = archiveScenario?.archive;
  const initial = () =>
    archiveScenario
      ? archiveCampaignBrief(archiveScenario.brief, archiveScenario.archive)
      : simulationBrief();
  const [brief, setBrief] = useState(initial);
  const remembered = useRef([...brief.schedules]);
  const [selected, setSelected] = useState(brief.startDate);
  const [preview, setPreview] = useState<Job | null>(null);
  const projection = useMemo(
    () =>
      projectSimulation(
        brief,
        archive?.assets,
        archive ? "archive" : "example",
      ),
    [brief, archive],
  );
  const month = selected.slice(0, 7);
  const plannerData: PlannerData = {
    config: projection.config,
    planner: {
      month,
      jobs: projection.jobs,
      now: projection.now,
      pendingCampaigns: [],
      campaignPeriods: [{ startDate: brief.startDate, endDate: brief.endDate }],
    },
  };
  const filled = projection.assignments.filter((slot) => slot.asset).length;
  const gaps = projection.assignments.length - filled;
  const slides = preview ? previewSlides(preview, !!archive) : [];
  const showPlanner = () => {
    setSelected(brief.startDate);
    onTab("planner");
  };
  function reset() {
    const seed = initial();
    remembered.current = [...seed.schedules];
    setBrief(seed);
    setSelected(seed.startDate);
    setPreview(null);
  }
  function update<K extends keyof CampaignBrief>(
    key: K,
    value: CampaignBrief[K],
  ) {
    setBrief((current) => ({ ...current, [key]: value }));
  }
  return (
    <div
      className="campaign-theme campaign-simulation"
      data-simulation="campaign"
    >
      <div className="campaign-simulation-banner" role="status">
        <span className="campaign-simulation-mark">
          <Play size={18} />
        </span>
        <div>
          <strong>
            {archive
              ? "Pratinjau arsip · properti database"
              : "Simulasi · data contoh"}
          </strong>
          <p>
            {archive
              ? "Data historis asli, jadwal uji mengikuti campaign."
              : "Ubah campaign, Planner ikut terisi."}
          </p>
          <small>
            Jam uji{" "}
            {new Intl.DateTimeFormat("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "Asia/Jakarta",
            }).format(projection.now)}{" "}
            · 00:00 WIB. Tanpa pengiriman.
          </small>
        </div>
        <div className="campaign-actions">
          <Action onClick={reset} aria-label="Reset simulasi">
            <RefreshCw size={16} />
            Reset
          </Action>
          <Action onClick={onExit}>Keluar simulasi</Action>
        </div>
      </div>
      {tab === "planner" && Object.keys(projection.errors).length > 0 && (
        <p role="alert" className="marketing-banner marketing-error">
          Jadwal contoh belum valid.{" "}
          <Action onClick={() => onTab("campaign")}>
            Perbaiki di Campaign
          </Action>
        </p>
      )}
      {tab === "campaign" ? (
        <>
          <header className="marketing-panel-heading campaign-simulation-heading">
            <div>
              <h2>
                {archiveScenario?.brief.name || "Campaign contoh A, B, C"}
              </h2>
              <p>
                {archive
                  ? "Properti arsip terbaru yang sesuai filter campaign."
                  : "Tiga aset contoh mengikuti batas H−5 dan pembagian giliran yang sama dengan Planner."}
              </p>
            </div>
            <Action
              primary
              onClick={showPlanner}
              disabled={!!Object.keys(projection.errors).length}
            >
              Lihat di Planner
              <ArrowRight size={16} />
            </Action>
          </header>
          <div className="campaign-simulation-layout">
            <CampaignSurface
              className="campaign-ready-assets campaign-simulation-stock"
              tone="mint"
            >
              <CampaignSectionHeading
                icon={<Layers size={20} />}
                title={
                  archive
                    ? `${projection.assets.length} properti dari database`
                    : "3 aset contoh siap tayang"
                }
              >
                {archive
                  ? `Lelang terbaru ${stockDate(archive.latestAuctionDate)}. Harga dan foto mengikuti data sumber.`
                  : "Foto, harga, dan tanggal lelang hanya contoh."}
              </CampaignSectionHeading>
              <CampaignStockCards
                assets={projection.assets}
                source={archive ? "listing" : "example"}
                archive={!!archive}
                assignments={projection.assignments.flatMap((slot) =>
                  slot.asset
                    ? [
                        {
                          assetId: slot.asset.id,
                          when: slot.when.toISOString(),
                        },
                      ]
                    : [],
                )}
                now={projection.now}
              />
            </CampaignSurface>
            <CampaignSurface
              className="campaign-form-section campaign-schedule-section"
              tone="teal"
            >
              <CampaignSectionHeading
                icon={<Clock size={20} />}
                title="Ritme tayang"
              >
                Ubah intensitas atau jam untuk mencoba pembagiannya.
              </CampaignSectionHeading>
              <CampaignRhythm
                schedules={brief.schedules}
                remembered={remembered}
                onChange={(times) => update("schedules", times)}
                error={projection.errors.schedules}
              />
              <p className="marketing-footnote">
                Instagram & Status WhatsApp · jeda aset{" "}
                {projection.config.cooldownDays} hari. Stok tidak diulang untuk
                memaksakan slot penuh.
              </p>
            </CampaignSurface>
          </div>
          <CampaignSurface className="campaign-simulation-agenda" tone="blue">
            <div className="marketing-panel-heading">
              <div>
                <h3>
                  <CalendarClock size={19} />
                  Jadwal langsung di Planner
                </h3>
                <p>
                  {archive
                    ? "Jadwal uji memakai properti arsip terbaru dan intensitas campaign."
                    : "Periode awal hari ini. Perluas tanggal untuk mencoba rotasi aset."}
                </p>
              </div>
              <span className="marketing-pill" aria-live="polite">
                {filled} terisi · {gaps} kosong
              </span>
            </div>
            {archive ? (
              <p className="campaign-archive-date">
                Hari uji {stockDate(archive.asOf)} · sebelum tenggat lelang
                properti yang ditampilkan.
              </p>
            ) : (
              <CampaignDateRange
                startDate={brief.startDate}
                endDate={brief.endDate}
                errors={projection.errors}
                onChange={(startDate, endDate) => {
                  setBrief((current) => ({ ...current, startDate, endDate }));
                  setSelected(startDate);
                }}
              />
            )}
            {!projection.errors.schedules && (
              <ol
                className="campaign-simulation-slots"
                aria-label="Pembagian aset ke Planner"
                aria-live="polite"
              >
                {projection.assignments.map((slot) => (
                  <li key={slot.when.toISOString()} data-filled={!!slot.asset}>
                    <time dateTime={slot.when.toISOString()}>
                      {date(slot.when, true)}
                      <small>WIB</small>
                    </time>
                    <div>
                      <strong>
                        {slot.asset?.address || "Stok belum cukup"}
                      </strong>
                      <span>
                        {date(slot.when)} ·{" "}
                        {slot.asset
                          ? "Contoh materi siap · Instagram & WhatsApp"
                          : "Menunggu aset fresh lain yang sesuai"}
                      </span>
                    </div>
                    {slot.asset && (
                      <Action
                        onClick={() =>
                          setPreview(
                            projection.jobs.find(
                              (job) =>
                                job.scheduledFor.getTime() ===
                                slot.when.getTime(),
                            )!,
                          )
                        }
                      >
                        Lihat materi
                      </Action>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {Object.entries(projection.errors)
              .filter(([key]) => key !== "schedules")
              .map(([key, error]) => (
                <p key={key} role="alert" className="marketing-error">
                  {error}
                </p>
              ))}
            {gaps > 0 && (
              <p className="marketing-warning">
                {gaps} slot menunggu stok. Aset yang sama mengikuti jeda tayang
                dan batas waktu lelang.
              </p>
            )}
          </CampaignSurface>
        </>
      ) : (
        <MarketingPlanner
          simulation
          photoSource={archive ? "listing" : "example"}
          data={plannerData}
          month={month}
          selectedDate={selected}
          loading={false}
          loadError=""
          editable
          preparing={null}
          focusToken={0}
          onDate={setSelected}
          onPrepare={() => onTab("campaign")}
          onPreview={setPreview}
          onSettings={() => onTab("campaign")}
          onReload={reset}
          onEdit={() => onTab("campaign")}
        />
      )}
      <DialogFrame
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null);
          }
        }}
        title={archive ? "Foto properti arsip" : "Pratinjau materi contoh"}
        description={
          archive
            ? "Foto asli properti dari arsip database. Jadwal ini hanya pratinjau."
            : "Simulasi carousel; cover ilustrasi tidak mewakili penawaran aset aktif."
        }
        contentClassName="marketing-modal marketing-preview-modal campaign-theme"
      >
        {preview && (
          <>
            <h3>
              {archive ? "Foto properti · arsip" : "Materi contoh · simulasi"}
            </h3>
            <InstagramCarousel
              key={preview.id}
              media={slides[0]}
              slides={slides}
              labels={
                archive
                  ? slides.map((_, index) => "Foto properti " + (index + 1))
                  : ["Cover contoh", "Foto properti 1", "Foto properti 2"]
              }
            />
            <pre className="marketing-caption">{preview.caption}</pre>
          </>
        )}
      </DialogFrame>
    </div>
  );
}

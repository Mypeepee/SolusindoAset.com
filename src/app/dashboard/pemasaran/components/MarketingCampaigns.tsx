"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DialogFrame } from "@/components/ui/dialog";
import {
  campaignErrors,
  campaignStatus,
  campaignAppliedBrief,
  campaignPeriodEnded,
  campaignSchedule,
  type CampaignBrief,
  type CampaignDetail,
  type CampaignRecord,
  type CampaignSlot,
  type CampaignGap,
} from "@/lib/marketing/campaign";
import {
  errorLabels,
  jakartaDate,
  type MarketingConfig,
} from "@/lib/marketing/domain";
import type { MarketingMedia } from "@/lib/marketing/media.server";
import type { InstagramMedia } from "@/lib/marketing/instagram-content";
import { Action, date, imageUrl, number, stateLabels } from "./ui";
import {
  CalendarClock,
  Clock,
  Layers,
  ImageIcon,
  Chart,
  Coins,
  Instagram,
  WhatsApp,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings2,
} from "./MarketingIcons";
import CampaignForm from "./CampaignForm";
import CampaignReadyAssets from "./CampaignReadyAssets";
import useMarketingClock from "./useMarketingClock";
import { CAMPAIGN_POLICY_VERSION } from "@/lib/marketing/campaign-selection";
import {
  CampaignSurface,
  CampaignStatus,
  CampaignButtonIcon,
} from "./CampaignVisual";
import CampaignSlotDialog from "./CampaignSlotDialog";
import InstagramCarousel from "./InstagramCarousel";
import "./instagram-workspace.css";
import "./campaigns.css";

import { campaignApi as api } from "./campaign-api";
import { TYPE_DB_TO_DISPLAY } from "@/lib/propertyType";
const campaignDateFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});
const dayLabel = (day: string) =>
  campaignDateFormat.format(new Date(day + "T12:00:00+07:00"));
const periodLabel = (start: string, end: string) =>
  campaignDateFormat.formatRange(
    new Date(start + "T12:00:00+07:00"),
    new Date(end + "T12:00:00+07:00"),
  );
function focusLabel(c: CampaignRecord) {
  return [
    c.brief.locations.map((r) => r.name).join(", ") ||
      c.brief.city ||
      "Semua wilayah",
    c.brief.propertyTypes.map((t) => TYPE_DB_TO_DISPLAY[t] || t).join(", ") ||
      "Semua jenis",
  ].join(" · ");
}
export default function MarketingCampaigns({
  config,
  onApplied,
  onDirtyChange,
  onBusyChange,
  onPlanner,
}: {
  config: MarketingConfig;
  onApplied: (firstScheduledFor?: string) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onPlanner: (when?: string) => void;
}) {
  const now = useMarketingClock();
  const [items, setItems] = useState<CampaignRecord[]>([]),
    [total, setTotal] = useState(0),
    [currentTotal, setCurrentTotal] = useState(0),
    [endedItems, setEndedItems] = useState<CampaignRecord[]>([]),
    [endedTotal, setEndedTotal] = useState(0),
    [endedPage, setEndedPage] = useState(1),
    [page, setPage] = useState(1),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null),
    [form, setForm] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [refresh, setRefresh] = useState(0),
    [booted, setBooted] = useState(false);
  const [inlineCampaign, setInlineCampaign] = useState<CampaignRecord | null>(
    null,
  );
  const saveBase = useRef<CampaignDetail | null>(null);
  const [editingSlot, setEditingSlot] = useState<
      CampaignSlot | CampaignGap | null
    >(null),
    [confirm, setConfirm] = useState(false),
    [preview, setPreview] = useState<{
      id: string;
      caption: string;
      media: MarketingMedia[];
    } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const p = new URLSearchParams(window.location.search);
    const id = p.get("campaign");
    if (id && /^[a-f0-9-]{36}$/.test(id)) setSelectedId(id);
    const n = Number(p.get("campaignPage"));
    if (Number.isSafeInteger(n) && n > 0) setPage(n);
    const e = Number(p.get("endedCampaignPage"));
    if (Number.isSafeInteger(e) && e > 0) setEndedPage(e);
    setBooted(true);
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onBusyChange(!!busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);
  const today = jakartaDate(now);
  useEffect(() => {
    if (!booted || inlineCampaign) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void api(
      undefined,
      selectedId
        ? "?id=" + selectedId
        : `?view=grouped&page=${page}&endedPage=${endedPage}`,
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (selectedId) setDetail(result);
        else {
          setItems(result.current.items);
          setCurrentTotal(result.current.total);
          setPage(result.current.page);
          setEndedItems(result.ended.items);
          setEndedTotal(result.ended.total);
          setEndedPage(result.ended.page);
          setTotal(result.current.total + result.ended.total);
        }
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    const url = new URL(window.location.href);
    selectedId
      ? url.searchParams.set("campaign", selectedId)
      : url.searchParams.delete("campaign");
    url.searchParams.set("campaignPage", String(page));
    url.searchParams.set("endedCampaignPage", String(endedPage));
    window.history.replaceState(null, "", url);
    return () => controller.abort();
  }, [booted, selectedId, page, endedPage, refresh, today, inlineCampaign]);
  const choose = useCallback((id: string | null) => {
    saveBase.current = null;
    setInlineCampaign(null);
    setDetail(null);
    setSelectedId(id);
    setForm(false);
  }, []);
  async function transact(
    action: string,
    extra: Record<string, unknown> = {},
    base = detail,
    quiet = false,
  ) {
    if (busy) throw new Error("Tunggu proses yang sedang berjalan.");
    setBusy(action);
    setError("");
    try {
      let result: CampaignDetail = await api({
        action,
        ...(["generate", "approve"].includes(action) ? { queue: true } : {}),
        ...(base
          ? { id: base.campaign.id, revision: base.campaign.revision }
          : {}),
        ...extra,
      });
      if (!mounted.current) return result;
      if (action !== "save") setDetail(result);
      if (action === "approve" || action === "pause")
        await onApplied(
          action === "approve"
            ? result.proposal?.data.slots.find(
                (slot) => Date.parse(slot.scheduledFor) > Date.now(),
              )?.scheduledFor
            : undefined,
        );
      if (mounted.current && !quiet) {
        if (action === "approve")
          toast.success("Campaign diterapkan ke Planner.");
        else if (action === "save") toast.success("Campaign tersimpan.");
        else if (action === "edit-slot")
          toast.success("Jadwal tayang tersimpan.");
        else if (action === "pause")
          toast.success(
            result.campaign.state === "paused"
              ? "Campaign dijeda."
              : "Campaign dilanjutkan untuk slot mendatang.",
          );
      }
      return result;
    } catch (failure) {
      if (mounted.current) setError((failure as Error).message);
      throw failure;
    } finally {
      if (mounted.current) setBusy("");
    }
  }
  const perform = (action: string, extra?: Record<string, unknown>) => {
    void transact(action, extra).catch(() => {});
  };
  const ready = !loading && !busy && !inlineCampaign;
  const proposal = detail?.proposal;
  const [slotPage, setSlotPage] = useState(1);
  useEffect(() => setSlotPage(1), [proposal?.id]);
  const stale =
    !!detail &&
    !!proposal &&
    (proposal.data.briefKey !== JSON.stringify(detail.campaign.brief) ||
      proposal.data.settingsRevision !== config.revision);
  const canApprove =
    !!detail &&
    !campaignPeriodEnded(detail.campaign.brief, now) &&
    !!proposal &&
    !proposal.approvedAt &&
    proposal.data.policyVersion === CAMPAIGN_POLICY_VERSION &&
    !stale &&
    proposal.data.slots.some(
      (slot) => new Date(slot.scheduledFor).getTime() > now.getTime(),
    );
  const focusCampaign =
    items.find((item) => campaignStatus(item, now) === "Aktif") ||
    items.find(
      (item) => !campaignPeriodEnded(campaignAppliedBrief(item), now),
    ) ||
    items[0] ||
    endedItems[0];
  const expiredDraft =
    !!detail && campaignPeriodEnded(detail.campaign.brief, now);
  const canGenerate =
    !!detail &&
    !expiredDraft &&
    campaignSchedule(detail.campaign.brief, now).length > 0;
  const newCampaign = () => {
    saveBase.current = null;
    setInlineCampaign(null);
    setDetail(null);
    setSelectedId(null);
    setForm(true);
  };
  const saveForm = async (brief: CampaignBrief, generate: boolean) => {
    const base =
      saveBase.current ||
      (inlineCampaign
        ? { campaign: inlineCampaign, proposal: null, jobs: [], jobsTotal: 0 }
        : detail);
    const saved = await transact("save", { brief }, base, generate);
    saveBase.current = saved;
    let result = saved;
    if (generate) {
      try {
        result = await transact("generate", {}, saved, true);
        saveBase.current = result;
        if (
          !result.proposal ||
          (!result.proposal.data.slots.length &&
            !result.proposal.data.unfilled.length)
        )
          throw new Error(
            "Tidak ada slot yang dapat diisi. Periksa benturan, batas H−5, dan stok aset.",
          );
        result = await transact(
          "approve",
          { proposalId: result.proposal.id },
          result,
          true,
        );
        toast.success("Campaign dan Planner diperbarui.");
      } catch (failure) {
        throw new Error(
          "Draf campaign sudah tersimpan. Planner belum berhasil diperbarui. " +
            (failure as Error).message,
        );
      }
    }
    if (!generate) {
      // Saved empty drafts also change the visible rhythm, without creating jobs.
      await onApplied(
        result.campaign.state === "draft"
          ? campaignSchedule(brief)[0]?.toISOString() ||
              brief.startDate + "T" + brief.schedules[0] + ":00+07:00"
          : undefined,
      );
    }
    saveBase.current = null;
    setInlineCampaign(null);
    setDetail(result);
    setSelectedId(result.campaign.id);
    setForm(false);
    onDirtyChange(false);
  };
  const editInline = (campaign: CampaignRecord) => {
    saveBase.current = null;
    setInlineCampaign(campaign);
    setForm(true);
  };
  if (form && !inlineCampaign)
    return (
      <CampaignForm
        initial={detail?.campaign || null}
        config={config}
        onDirtyChange={onDirtyChange}
        onCancel={() => {
          if (saveBase.current) setSelectedId(saveBase.current.campaign.id);
          saveBase.current = null;
          setForm(false);
          setRefresh((n) => n + 1);
        }}
        onSave={saveForm}
      />
    );
  const timeline = proposal
    ? [...proposal.data.slots, ...proposal.data.unfilled].sort((a, b) =>
        a.scheduledFor.localeCompare(b.scheduledFor),
      )
    : [];
  return (
    <div className="campaign-workspace campaign-theme">
      <header className="campaign-heading">
        <span className="campaign-heading-icon" aria-hidden="true">
          <CalendarClock size={25} />
        </span>
        <div>
          {detail ? (
            <Action
              className="campaign-back"
              disabled={!ready}
              onClick={() => choose(null)}
            >
              <ChevronLeft size={16} />
              Semua campaign
            </Action>
          ) : null}
          <h2>{detail?.campaign.brief.name || "Campaign"}</h2>
          <p className="marketing-muted">
            {detail
              ? focusLabel(detail.campaign)
              : "Atur aset yang tampil, rentang tanggal, dan jam tayangnya."}
          </p>
        </div>
        <div className="campaign-actions">
          {!detail && total > 0 && (
            <Action primary disabled={!ready} onClick={newCampaign}>
              <Plus size={16} />
              Campaign baru
            </Action>
          )}
          <Action
            aria-label="Perbarui campaign"
            disabled={!ready}
            onClick={() => setRefresh((n) => n + 1)}
          >
            <RefreshCw size={16} />
          </Action>
        </div>
      </header>
      {error && (
        <div role="alert" className="marketing-banner marketing-error">
          <CircleAlert size={18} />
          <span>{error}</span>
          <Action disabled={!!busy} onClick={() => setRefresh((n) => n + 1)}>
            Muat ulang
          </Action>
        </div>
      )}
      {busy && (
        <p role="status" className="campaign-progress">
          <Loader2 size={16} className="animate-spin" />
          {busy === "generate"
            ? "Membagi aset ke jadwal harian…"
            : busy === "preview"
              ? "Menyiapkan pratinjau carousel…"
              : "Menyimpan pengaturan tayang…"}
        </p>
      )}
      {loading && (
        <p className="campaign-loading" role="status">
          <Loader2 size={18} className="animate-spin" />
          Memuat campaign…
        </p>
      )}
      {!detail && !loading && (!error || total > 0) && (
        <>
          {focusCampaign && !inlineCampaign && (
            <CampaignReadyAssets
              key={focusCampaign.id + ":" + focusCampaign.revision}
              campaign={focusCampaign}
              onQueueChange={async () => {
                await onApplied();
                setRefresh((n) => n + 1);
              }}
              onPlanner={onPlanner}
              disabled={!ready}
              onEdit={() => editInline(focusCampaign)}
            />
          )}
          {!total ? (
            <CampaignSurface className="campaign-empty">
              <div className="campaign-empty-art" aria-hidden="true">
                <span>
                  <Layers size={25} />
                </span>
                <span>
                  <CalendarClock size={36} />
                </span>
                <span>
                  <Clock size={25} />
                </span>
              </div>
              <h3>Belum ada campaign</h3>
              <p>
                Tentukan aset yang ingin ditampilkan, periode tayang, serta
                berapa kali dan jam berapa aset ditayangkan setiap hari.
              </p>
              <Action primary onClick={newCampaign}>
                Buat campaign pertama
                <CampaignButtonIcon>
                  <Plus size={16} />
                </CampaignButtonIcon>
              </Action>
              <div className="campaign-empty-steps">
                <span>
                  <CalendarClock size={16} />
                  Tentukan periode
                </span>
                <span>
                  <ImageIcon size={16} />
                  Pilih aset
                </span>
                <span>
                  <Clock size={16} />
                  Atur jam tayang
                </span>
              </div>
            </CampaignSurface>
          ) : (
            <div className="campaign-list-groups">
              {[
                {
                  key: "current",
                  title: "Campaign berjalan",
                  description:
                    "Aktif, terjadwal, draf, dan dijeda dalam periode tayang.",
                  items,
                  total: currentTotal,
                  page,
                  setPage,
                },
                {
                  key: "ended",
                  title: "Campaign usai",
                  description:
                    "Periode tayang berakhir. Tersimpan sebagai riwayat.",
                  items: endedItems,
                  total: endedTotal,
                  page: endedPage,
                  setPage: setEndedPage,
                },
              ].map((group) => (
                <section
                  className="campaign-list"
                  data-lifecycle={group.key}
                  aria-labelledby={`campaign-list-${group.key}`}
                  key={group.key}
                >
                  <div className="campaign-list-heading">
                    <div>
                      <h3 id={`campaign-list-${group.key}`}>{group.title}</h3>
                      <p>{group.description}</p>
                    </div>
                    <span className="campaign-list-total">
                      {number(group.total)} campaign
                    </span>
                  </div>
                  {!group.total && (
                    <p className="campaign-list-empty">
                      {group.key === "current"
                        ? "Belum ada campaign dalam periode tayang."
                        : "Belum ada campaign yang usai."}
                    </p>
                  )}
                  {group.total > 20 && (
                    <p className="marketing-footnote">
                      Menampilkan {number((group.page - 1) * 20 + 1)}–
                      {number(Math.min(group.page * 20, group.total))} dari{" "}
                      {number(group.total)} campaign
                    </p>
                  )}
                  {group.items.map((c) => (
                    <CampaignSurface
                      className={
                        "campaign-list-entry" +
                        (campaignStatus(c, now) === "Berakhir"
                          ? " campaign-list-entry-expired"
                          : "")
                      }
                      tone={
                        campaignStatus(c, now) === "Dijeda"
                          ? "amber"
                          : campaignStatus(c, now) === "Terjadwal"
                            ? "blue"
                            : "mint"
                      }
                      key={c.id}
                    >
                      <article className="campaign-list-row">
                        <div className="campaign-list-identity">
                          <div className="campaign-list-title">
                            <CampaignStatus campaign={c} now={now} />
                            <h3>{c.brief.name}</h3>
                          </div>
                          <p>{focusLabel(c)}</p>
                        </div>
                        <div className="campaign-list-schedule">
                          <p
                            className="campaign-list-period"
                            title={
                              dayLabel(campaignAppliedBrief(c).startDate) +
                              " – " +
                              dayLabel(campaignAppliedBrief(c).endDate)
                            }
                          >
                            <CalendarClock size={14} />
                            {periodLabel(
                              campaignAppliedBrief(c).startDate,
                              campaignAppliedBrief(c).endDate,
                            )}
                          </p>
                          <div className="campaign-list-settings">
                            <span>
                              <Layers size={14} />
                              {number(c.brief.listingIds.length)} dipilih
                            </span>
                            <span
                              title={
                                number(c.brief.schedules.length) +
                                " tayangan per hari"
                              }
                            >
                              <Clock size={14} />
                              <span className="campaign-list-daily-label">
                                {number(c.brief.schedules.length)} tayangan/hari
                              </span>
                              <span className="campaign-list-daily-compact">
                                {number(c.brief.schedules.length)}×/hari
                              </span>
                            </span>
                          </div>
                          <div className="campaign-time-chips">
                            {c.brief.schedules.map((time) => (
                              <span
                                key={time}
                                data-period={
                                  Number(time.slice(0, 2)) < 12
                                    ? "morning"
                                    : Number(time.slice(0, 2)) < 17
                                      ? "afternoon"
                                      : "evening"
                                }
                              >
                                {time}
                                <small>WIB</small>
                              </span>
                            ))}
                          </div>
                        </div>
                        <dl>
                          <div>
                            <dt>Terjadwal</dt>
                            <dd>{number(c.planned)}</dd>
                          </div>
                          <div>
                            <dt>Terbit</dt>
                            <dd>{number(c.published)}</dd>
                          </div>
                        </dl>
                        <div className="campaign-actions">
                          <Action
                            primary={campaignStatus(c, now) !== "Berakhir"}
                            disabled={!ready || !!inlineCampaign}
                            onClick={() => editInline(c)}
                            aria-label={"Edit campaign " + c.brief.name}
                          >
                            <Settings2 size={16} />
                            Edit
                          </Action>
                          <Action
                            disabled={!ready || !!inlineCampaign}
                            onClick={() => choose(c.id)}
                            aria-label={"Buka campaign " + c.brief.name}
                          >
                            Buka
                            <CampaignButtonIcon>
                              <ArrowRight size={16} />
                            </CampaignButtonIcon>
                          </Action>
                        </div>
                      </article>
                      {inlineCampaign?.id === c.id && (
                        <div className="campaign-inline-editor">
                          <CampaignForm
                            initial={inlineCampaign}
                            config={config}
                            onDirtyChange={onDirtyChange}
                            onSave={saveForm}
                            onCancel={() => {
                              setForm(false);
                              setInlineCampaign(null);
                              saveBase.current = null;
                              setDetail(null);
                              setRefresh((n) => n + 1);
                            }}
                          />
                        </div>
                      )}
                    </CampaignSurface>
                  ))}
                  {group.total > 20 && (
                    <nav
                      className="campaign-pagination"
                      aria-label={`Halaman ${group.title.toLowerCase()}`}
                    >
                      <Action
                        disabled={!ready || group.page === 1}
                        onClick={() => group.setPage((n) => n - 1)}
                      >
                        Sebelumnya
                      </Action>
                      <span>
                        Halaman {number(group.page)} dari{" "}
                        {number(Math.ceil(group.total / 20))}
                      </span>
                      <Action
                        disabled={!ready || group.page * 20 >= group.total}
                        onClick={() => group.setPage((n) => n + 1)}
                      >
                        Berikutnya
                      </Action>
                    </nav>
                  )}
                </section>
              ))}
            </div>
          )}
        </>
      )}
      {detail && (
        <>
          <CampaignSurface className="campaign-brief" tone="blue">
            <div className="marketing-panel-heading">
              <div>
                <CampaignStatus campaign={detail.campaign} now={now} />
                <h3>Pengaturan campaign</h3>
              </div>
              <div className="campaign-actions">
                <Action disabled={!ready} onClick={() => setForm(true)}>
                  <Settings2 size={16} />
                  Edit campaign
                </Action>
                {detail.campaign.state !== "draft" &&
                  campaignStatus(detail.campaign, now) !== "Berakhir" && (
                    <Action
                      disabled={!ready}
                      onClick={() =>
                        perform("pause", {
                          paused: detail.campaign.state !== "paused",
                        })
                      }
                    >
                      {detail.campaign.state === "paused" ? (
                        <Play size={16} />
                      ) : (
                        <Pause size={16} />
                      )}
                      {detail.campaign.state === "paused"
                        ? "Lanjutkan"
                        : "Jeda campaign"}
                    </Action>
                  )}
              </div>
            </div>
            <dl className="campaign-brief-grid">
              <div data-tone="blue">
                <dt>
                  <CalendarClock size={15} />
                  Periode tayang
                </dt>
                <dd>
                  {dayLabel(detail.campaign.brief.startDate)} –{" "}
                  {dayLabel(detail.campaign.brief.endDate)}
                </dd>
              </div>
              <div data-tone="mint">
                <dt>
                  <Layers size={15} />
                  Aset pilihan
                </dt>
                <dd>{number(detail.campaign.brief.listingIds.length)} aset</dd>
              </div>
              <div data-tone="mint">
                <dt>
                  <Chart size={15} />
                  Intensitas per hari
                </dt>
                <dd>
                  {number(detail.campaign.brief.schedules.length)} tayangan
                </dd>
              </div>
              <div data-tone="blue">
                <dt>
                  <Clock size={15} />
                  Jam tayang · WIB
                </dt>
                <dd className="campaign-time-chips">
                  {detail.campaign.brief.schedules.map((time) => (
                    <span key={time}>
                      {time}
                      <small>WIB</small>
                    </span>
                  ))}
                </dd>
              </div>
              <div data-tone="amber">
                <dt>
                  <Coins size={15} />
                  Rentang harga
                </dt>
                <dd>
                  {detail.campaign.brief.minPrice === null
                    ? "Tanpa minimum"
                    : "Rp " + number(detail.campaign.brief.minPrice)}{" "}
                  –{" "}
                  {detail.campaign.brief.maxPrice === null
                    ? "tanpa maksimum"
                    : "Rp " + number(detail.campaign.brief.maxPrice)}
                </dd>
              </div>
              <div data-tone="mint">
                <dt>
                  <Instagram size={15} />
                  Kanal tayang
                </dt>
                <dd>
                  <span className="campaign-channel-tags">
                    {detail.campaign.brief.channels.map((channel) => (
                      <span key={channel} data-channel={channel}>
                        {channel === "instagram" ? (
                          <Instagram size={15} />
                        ) : (
                          <WhatsApp size={15} />
                        )}
                        <span>
                          {channel === "instagram"
                            ? "Instagram"
                            : "Status WhatsApp"}
                        </span>
                      </span>
                    ))}
                  </span>
                </dd>
              </div>
            </dl>
            {detail.campaign.activeBrief &&
              JSON.stringify(detail.campaign.activeBrief) !==
                JSON.stringify(detail.campaign.brief) && (
                <p className="marketing-warning">
                  Perubahan draf belum diterapkan. Planner masih memakai periode{" "}
                  {dayLabel(detail.campaign.activeBrief.startDate)} –{" "}
                  {dayLabel(detail.campaign.activeBrief.endDate)}. Tinjau dan
                  terapkan jadwal untuk menggunakan perubahan ini.
                </p>
              )}
            <p className="marketing-footnote">
              Properti dipilih per batch dua hari, mengikuti filter dan
              prioritas tanggal lelang. Batch berikutnya disiapkan sehari
              sebelumnya. Minimal H−5; properti yang sudah terbit tidak dipilih
              ulang.
            </p>
          </CampaignSurface>
          <CampaignSurface className="campaign-proposal" tone="mint">
            {(!expiredDraft || proposal) && !proposal?.approvedAt && (
              <div className="marketing-panel-heading">
                <div>
                  <p className="marketing-eyebrow">Aset dan waktu tayang</p>
                  <h3>
                    {expiredDraft
                      ? "Riwayat jadwal campaign"
                      : "Jadwal campaign"}
                  </h3>
                  <p>
                    {proposal
                      ? "Versi " +
                        proposal.version +
                        (proposal.approvedAt
                          ? " · diterapkan " +
                            date(proposal.approvedAt) +
                            " WIB"
                          : " · belum diterapkan")
                      : "Pilih aset dan jam tayang untuk menyusun jadwal."}
                  </p>
                </div>
                {!expiredDraft && (
                  <Action
                    disabled={
                      !ready ||
                      !canGenerate ||
                      !detail.campaign.brief.listingIds.length
                    }
                    onClick={() => perform("generate")}
                  >
                    <RefreshCw size={16} />
                    {proposal ? "Susun ulang jadwal" : "Susun jadwal"}
                  </Action>
                )}
              </div>
            )}
            {expiredDraft && proposal && (
              <p className="marketing-warning" role="status">
                Periode campaign sudah berakhir. Jadwal di bawah adalah riwayat;
                ubah periode sebelum menyusun atau menerapkan jadwal baru.
              </p>
            )}
            {proposal &&
              !proposal.approvedAt &&
              proposal.data.policyVersion !== CAMPAIGN_POLICY_VERSION &&
              !expiredDraft && (
                <p className="marketing-warning" role="status">
                  Aturan jadwal berubah. Susun ulang dengan batas H−5 dan
                  pemerataan tayang sebelum diterapkan.
                </p>
              )}
            {stale && !expiredDraft && (
              <p role="status" className="marketing-warning">
                Pengaturan campaign berubah. Susun ulang jadwal sebelum
                menerapkannya. Jadwal yang sudah diterapkan tetap mengikuti
                versi sebelumnya.
              </p>
            )}
            {proposal && !proposal.approvedAt ? (
              <>
                {proposal.data.coverage && (
                  <p className="marketing-footnote campaign-coverage-summary">
                    {number(proposal.data.coverage.scheduled)} dari{" "}
                    {number(proposal.data.coverage.eligible)} properti mendapat
                    jadwal.
                    {proposal.data.coverage.remaining > 0 &&
                      ` ${number(proposal.data.coverage.remaining)} belum mendapat slot; tambah intensitas atau periode untuk memperluas cakupan.`}
                  </p>
                )}
                <dl className="campaign-stock">
                  <div data-tone="blue">
                    <dt>
                      <Layers size={17} />
                      Aset tersedia
                    </dt>
                    <dd>{number(proposal.data.stock)}</dd>
                  </div>
                  <div data-tone="mint">
                    <dt>
                      <Check size={17} />
                      Jadwal terisi
                    </dt>
                    <dd>
                      {number(proposal.data.slots.length)}
                      <small> / {number(proposal.data.target)} slot</small>
                    </dd>
                  </div>
                  <div data-tone="amber">
                    <dt>
                      <CircleAlert size={17} />
                      Slot kosong
                    </dt>
                    <dd>{number(proposal.data.unfilled.length)}</dd>
                  </div>
                </dl>
                {!!proposal.data.unfilled.length && (
                  <p className="marketing-warning">
                    {number(proposal.data.unfilled.length)} slot belum terisi
                    karena aset kurang, jeda pengulangan, atau benturan jam.
                    Tambah pilihan aset atau ubah intensitas dan jam campaign.
                  </p>
                )}
                <div className="campaign-slots">
                  {timeline
                    .slice((slotPage - 1) * 12, slotPage * 12)
                    .map((slot) => {
                      const asset =
                        "asset" in slot ? (slot as CampaignSlot).asset : null;
                      return (
                        <article
                          className={
                            "campaign-slot " +
                            (!asset ? "campaign-slot-empty" : "")
                          }
                          key={slot.id}
                        >
                          <div className="campaign-slot-photo">
                            {asset ? (
                              <img
                                src={
                                  "/api/foto/" +
                                  asset.id +
                                  "?view=card&index=0&w=236"
                                }
                                alt={asset.propertyType + " di " + asset.city}
                                loading="lazy"
                              />
                            ) : (
                              <span className="campaign-slot-placeholder">
                                <CircleAlert size={25} />
                              </span>
                            )}
                          </div>
                          <div className="campaign-slot-body">
                            <div className="campaign-slot-meta">
                              <time dateTime={slot.scheduledFor}>
                                <Clock size={13} />
                                {date(slot.scheduledFor)} WIB
                              </time>
                              <span className="campaign-slot-state">
                                {asset ? (
                                  <Check size={12} />
                                ) : (
                                  <CircleAlert size={12} />
                                )}
                                {new Date(slot.scheduledFor) <= now
                                  ? "Jadwal berlalu"
                                  : asset
                                    ? "Aset dipilih"
                                    : "Perlu diisi"}
                              </span>
                            </div>
                            <h4>{asset ? asset.address : "Belum ada aset"}</h4>
                            {asset ? (
                              <p>
                                {asset.city} · {asset.propertyType} · Rp{" "}
                                {number(asset.price)}
                              </p>
                            ) : (
                              <p className="marketing-warning">
                                {campaignErrors[slot.reason] || slot.reason}
                              </p>
                            )}
                          </div>
                          <div className="campaign-slot-actions">
                            {asset && (
                              <Action
                                disabled={
                                  !ready ||
                                  stale ||
                                  expiredDraft ||
                                  new Date(slot.scheduledFor) <= now
                                }
                                onClick={() => {
                                  setBusy("preview");
                                  setError("");
                                  void api({
                                    action: "preview",
                                    id: detail.campaign.id,
                                    revision: detail.campaign.revision,
                                    proposalId: proposal.id,
                                    slotId: slot.id,
                                  })
                                    .then((r) => {
                                      if (mounted.current) setPreview(r);
                                    })
                                    .catch((e: Error) => {
                                      if (mounted.current) setError(e.message);
                                    })
                                    .finally(() => {
                                      if (mounted.current) setBusy("");
                                    });
                                }}
                              >
                                <Eye size={15} />
                                Pratinjau
                              </Action>
                            )}
                            {!proposal.approvedAt && (
                              <Action
                                disabled={
                                  !ready ||
                                  stale ||
                                  expiredDraft ||
                                  new Date(slot.scheduledFor) <= now ||
                                  (!asset &&
                                    slot.reason === "CAMPAIGN_SLOT_CONFLICT")
                                }
                                onClick={() => setEditingSlot(slot)}
                              >
                                <Settings2 size={15} />
                                {asset ? "Atur aset & waktu" : "Pilih aset"}
                              </Action>
                            )}
                          </div>
                        </article>
                      );
                    })}
                </div>
                {timeline.length > 12 && (
                  <nav
                    className="campaign-pagination"
                    aria-label="Halaman jadwal campaign"
                  >
                    <Action
                      disabled={!ready || slotPage === 1}
                      onClick={() => setSlotPage((n) => n - 1)}
                    >
                      Sebelumnya
                    </Action>
                    <span>
                      Slot {(slotPage - 1) * 12 + 1}–
                      {Math.min(slotPage * 12, timeline.length)} dari{" "}
                      {timeline.length}
                    </span>
                    <Action
                      disabled={!ready || slotPage * 12 >= timeline.length}
                      onClick={() => setSlotPage((n) => n + 1)}
                    >
                      Berikutnya
                    </Action>
                  </nav>
                )}
                {!timeline.length && (
                  <p className="campaign-no-slots">
                    Tidak ada jam tayang mendatang pada periode ini.
                  </p>
                )}
                <footer className="campaign-apply">
                  <p className="marketing-footnote">
                    {proposal.approvedAt
                      ? "Jadwal sudah masuk ke Planner. Edit campaign untuk mengubah rencana mendatang."
                      : "Template carousel dan caption properti tetap dipakai. Penerapan jadwal tidak mengaktifkan otomatisasi global."}
                  </p>
                  {proposal.approvedAt ? (
                    <Action
                      onClick={() =>
                        onPlanner(proposal.data.slots[0]?.scheduledFor)
                      }
                    >
                      Buka Planner
                      <CampaignButtonIcon>
                        <ArrowRight size={16} />
                      </CampaignButtonIcon>
                    </Action>
                  ) : (
                    <Action
                      primary
                      disabled={!ready || !canApprove}
                      onClick={() => setConfirm(true)}
                    >
                      <Check size={16} />
                      Terapkan jadwal
                    </Action>
                  )}
                </footer>
              </>
            ) : (
              <CampaignReadyAssets
                key={detail.campaign.id + ":" + detail.campaign.revision}
                campaign={detail.campaign}
                onQueueChange={async () => {
                  await onApplied();
                  setRefresh((n) => n + 1);
                }}
                onPlanner={onPlanner}
                disabled={!ready}
                onEdit={() => setForm(true)}
              />
            )}
          </CampaignSurface>
          <CampaignSurface
            className={
              "campaign-results" +
              (!detail.jobs.length ? " campaign-results-empty" : "")
            }
            tone="blue"
          >
            <div className="marketing-panel-heading">
              <div>
                <h3 className="campaign-history-title">
                  <Chart size={20} />
                  Riwayat tayang
                </h3>
                {!!detail.jobs.length && (
                  <p>
                    {number(detail.campaign.published)} terbit dari{" "}
                    {number(detail.campaign.planned)} jadwal terisi.
                  </p>
                )}
              </div>
            </div>
            {detail.jobs.length ? (
              <>
                <p className="marketing-footnote">
                  {number(detail.jobs.length)} catatan terbaru dari{" "}
                  {number(detail.jobsTotal)} riwayat.
                </p>
                <div className="campaign-results-list">
                  {detail.jobs.map((job) => (
                    <article key={job.id}>
                      <div>
                        <time dateTime={job.scheduledFor}>
                          {date(job.scheduledFor)} WIB
                        </time>
                        <h4>{job.address || "Slot tanpa aset"}</h4>
                        <p>
                          {stateLabels(job.status)}
                          {job.reason
                            ? " · " +
                              (campaignErrors[job.reason] ||
                                errorLabels[job.reason] ||
                                job.reason)
                            : ""}
                        </p>
                      </div>
                      <div>
                        {job.publications.length ? (
                          job.publications.map((p) => (
                            <p key={p.id}>
                              {p.channel === "instagram"
                                ? "Instagram"
                                : "Status WA"}{" "}
                              · {stateLabels(p.state, p.errorCode)}
                              <br />
                              <small>
                                Tayangan: {number(p.metrics?.views)} · Suka:{" "}
                                {number(p.metrics?.likes)} · Komentar:{" "}
                                {number(p.metrics?.comments)}
                              </small>
                            </p>
                          ))
                        ) : (
                          <p className="marketing-muted">Belum ada publikasi</p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="marketing-footnote">
                Belum ada publikasi pada periode ini.
              </p>
            )}
          </CampaignSurface>
        </>
      )}
      {editingSlot && detail && proposal && (
        <CampaignSlotDialog
          key={editingSlot.id}
          slot={editingSlot}
          campaignId={detail.campaign.id}
          proposalId={proposal.id}
          schedules={detail.campaign.brief.schedules}
          onClose={() => setEditingSlot(null)}
          onSave={async (slot) => {
            await transact("edit-slot", { proposalId: proposal.id, slot });
          }}
        />
      )}
      <DialogFrame
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open);
        }}
        title="Terapkan jadwal campaign?"
        description="Konfirmasi periode, aset, dan jumlah jadwal tayang."
        contentClassName="marketing-modal marketing-small-modal campaign-theme campaign-dialog"
      >
        <h2>Terapkan {number(proposal?.data.slots.length)} jadwal terisi?</h2>
        <p>
          {detail?.campaign.brief.name}. Jadwal otomatis reguler pada periode
          ini digantikan oleh jadwal campaign.
        </p>
        {!!proposal?.data.unfilled.length && (
          <p>
            {number(proposal.data.unfilled.length)} slot kosong tetap dibiarkan
            kosong.
          </p>
        )}
        <p>
          Otomatisasi global saat ini{" "}
          {config.enabled
            ? "aktif; aset tayang mengikuti jadwal"
            : "dijeda; jadwal menunggu aktivasi di Pengaturan"}
          .
        </p>
        {detail?.campaign.state === "paused" && (
          <p>Campaign tetap dijeda sampai Anda memilih Lanjutkan.</p>
        )}
        <div className="marketing-modal-actions">
          <Action autoFocus disabled={!!busy} onClick={() => setConfirm(false)}>
            Kembali
          </Action>
          <Action
            primary
            disabled={!!busy || !canApprove}
            onClick={() => {
              void transact("approve", { proposalId: proposal?.id })
                .then(() => setConfirm(false))
                .catch(() => {});
            }}
          >
            Terapkan {number(proposal?.data.slots.length)} jadwal
          </Action>
        </div>
        {error && (
          <p role="alert" className="marketing-error">
            {error}
          </p>
        )}
      </DialogFrame>
      <DialogFrame
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title="Pratinjau carousel campaign"
        description="Template carousel dan caption properti tanpa publikasi."
        closeClassName="campaign-preview-close"
        contentClassName="marketing-modal campaign-preview-modal campaign-theme campaign-dialog"
      >
        {preview && (
          <>
            <h2>Pratinjau tayangan</h2>
            <div className="campaign-preview-grid">
              <div className="instagram-studio-dialog">
                <InstagramCarousel
                  media={previewSlides(preview)[0]}
                  slides={previewSlides(preview)}
                  labels={preview.media
                    .filter((m) => m.channel === "instagram")
                    .map((m) =>
                      m.name === "feed.jpg"
                        ? "Sampul carousel"
                        : "Foto properti",
                    )}
                />
              </div>
              <div>
                <h3>Caption properti</h3>
                <pre className="marketing-caption">{preview.caption}</pre>
              </div>
            </div>
          </>
        )}
      </DialogFrame>
    </div>
  );
}
function previewSlides(preview: {
  id: string;
  media: MarketingMedia[];
}): InstagramMedia[] {
  return preview.media
    .filter((m) => m.channel === "instagram")
    .map((m) => ({
      id: preview.id + m.name,
      type: "IMAGE",
      product: "FEED",
      mediaUrl: imageUrl(preview.id, m.name),
      thumbnailUrl: null,
      caption: "",
      permalink: null,
      timestamp: null,
      likes: null,
      comments: null,
      commentsEnabled: null,
    }));
}

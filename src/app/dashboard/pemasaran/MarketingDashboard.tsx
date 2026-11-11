"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  ImageIcon,
  Instagram,
  Loader2,
  WhatsApp,
  Play,
} from "./components/MarketingIcons";
import { toast } from "sonner";
import { DialogFrame } from "@/components/ui/dialog";
import {
  DEFAULT_CONFIG,
  jakartaDate,
  errorLabels,
  settingsSchema,
  statusLabels,
  type AssetSnapshot,
  type MarketingConfig,
} from "@/lib/marketing/domain";
import {
  Action,
  Pill,
  date,
  number,
  imageUrl,
  stateLabels,
  type Data,
  type Job,
  type Publication,
} from "./components/ui";
import {
  tabs,
  type MarketingTab as Tab,
} from "./components/MarketingNavigation";
import MarketingPlanner, {
  PlannerSkeleton,
} from "./components/MarketingPlanner";
import MarketingAnalytics from "./components/MarketingAnalytics";
import dynamic from "next/dynamic";
const InstagramWorkspace = dynamic(
  () => import("./components/InstagramWorkspace"),
  {
    loading: () => (
      <div className="instagram-loading" role="status">
        Memuat pengelola Instagram…
      </div>
    ),
  },
);
import InstagramSetupDialog from "./components/InstagramSetupDialog";
import MarketingPreviewDialog from "./components/MarketingPreviewDialog";
import { monthBounds, type PlannerSlot } from "@/lib/marketing/planner";
import type { ConfigurePlan } from "@/lib/marketing/plan";
import MarketingPlanDialog from "./components/MarketingPlanDialog";
import usePlannerMonth from "./components/usePlannerMonth";
import { campaignErrors } from "@/lib/marketing/campaign";
const MarketingCampaigns = dynamic(
  () => import("./components/MarketingCampaigns"),
  { loading: () => <p role="status">Memuat Campaign…</p> },
);
import "./pemasaran.css";
import "./components/marketing-plan.css";
import MarketingHeader from "./components/MarketingHeader";
import MarketingSettings from "./components/MarketingSettings";
import {
  instagramConnectionHref,
  instagramOAuthIssue,
  instagramOAuthMessages,
} from "@/lib/marketing/instagram-oauth";
const explanations: Record<string, string> = {
  ...errorLabels,
  ...campaignErrors,
  ENCRYPTION_NOT_CONFIGURED: "Koneksi Instagram belum dikonfigurasi.",
  PUBLIC_ORIGIN_NOT_CONFIGURED: "Domain publik Pemasaran belum dikonfigurasi.",
  INSTAGRAM_NOT_CONFIGURED: "Koneksi Instagram belum dikonfigurasi.",
  OAUTH_DOMAIN_MISMATCH:
    "Buka Pemasaran melalui domain HTTPS yang didaftarkan sebelum menghubungkan Instagram.",
  INVALID_PLANNING_SLOT:
    "Pilih slot pada jadwal tersimpan, mulai sekarang hingga 90 hari ke depan.",
  PLANNING_SLOT_LOCKED: "Slot ini sudah diproses dan tidak dapat diganti.",
  PREVIEW_REQUIRED:
    "Belum ada materi yang bisa dipakai. Siapkan pratinjau di Planner atau pastikan campaign berjalan punya aset terjadwal.",
  COMPANY_PHONE_REQUIRED: "Isi nomor WhatsApp perusahaan terlebih dahulu.",
  WORKER_BUSY: "Sistem sedang memproses publikasi. Coba kembali sebentar lagi.",
  SETTINGS_CONFLICT:
    "Pengaturan telah berubah di sesi lain. Perbarui halaman lalu simpan kembali.",
  INVALID_SETTINGS: "Periksa pengaturan yang ditandai.",
  INVALID_AUDIENCE:
    "Pilih kontak Status WhatsApp atau isi nomor uji yang valid.",
  SERVICE_UNAVAILABLE:
    "Pemasaran belum dapat dimuat. Coba perbarui beberapa saat lagi.",
  UNAUTHENTICATED: "Sesi berakhir. Silakan masuk kembali.",
  FORBIDDEN: "Menu ini hanya tersedia untuk owner aktif.",
  PROFESSIONAL_ACCOUNT_REQUIRED:
    "Gunakan akun Instagram Business atau Creator.",
};
const explain = (code: string | null | undefined) =>
  code
    ? explanations[code] ||
      "Permintaan belum berhasil. Coba kembali atau periksa koneksi."
    : "";
async function requestApi(body?: unknown, query = "", signal?: AbortSignal) {
  const response = await fetch("/api/dashboard/pemasaran" + query, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    signal,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(explain(data.error)), {
      code: data.error,
      fields: data.fields,
    });
  return data;
}
const readPlannerMonth = (month: string, signal: AbortSignal) =>
  requestApi(undefined, "?mode=planner&month=" + month, signal) as Promise<
    Data["planner"]
  >;
export default function MarketingDashboard() {
  const [data, setData] = useState<Data | null>(null),
    [draft, setDraft] = useState<MarketingConfig>(DEFAULT_CONFIG);
  const [tab, setTab] = useState<Tab>("planner"),
    [page, setPage] = useState(1);
  const [campaignDirty, setCampaignDirty] = useState(false),
    [campaignBusy, setCampaignBusy] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const [month, setMonth] = useState(jakartaDate().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(jakartaDate());
  const currentMonth = useRef(month);
  currentMonth.current = month;
  const planner = usePlannerMonth(month, data?.planner, readPlannerMonth);
  const monthlyData = useMemo(
    () => data && { ...data, planner: planner.value || data.planner },
    [data, planner.value],
  );
  const [booted, setBooted] = useState(false);
  const [instagramIssue, setInstagramIssue] = useState("");
  const [preparingSlot, setPreparingSlot] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlannerSlot<Job> | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Job | null>(null),
    [instagramSetupOpen, setInstagramSetupOpen] = useState(false),
    [activate, setActivate] = useState(false),
    [leave, setLeave] = useState<Tab | null>(null);
  const [testPhone, setTestPhone] = useState(""),
    [testConfirm, setTestConfirm] = useState(false);
  const [commentPublication, setCommentPublication] = useState<Pick<
      Publication,
      "id"
    > | null>(null),
    [commentData, setCommentData] = useState<{
      items: {
        id: string;
        text: string;
        username: string;
        timestamp: string;
      }[];
      after: string | null;
    }>({ items: [], after: null });
  const [commentLoading, setCommentLoading] = useState(false),
    [commentError, setCommentError] = useState("");
  const fetchSequence = useRef(0),
    commentSequence = useRef(0),
    loadController = useRef<AbortController | null>(null);
  const settingsDirty =
    !!data && JSON.stringify(draft) !== JSON.stringify(data.config);
  const dirty = settingsDirty || campaignDirty;
  const load = useCallback(
    async (nextPage = page) => {
      const sequence = ++fetchSequence.current;
      loadController.current?.abort();
      const controller = new AbortController();
      loadController.current = controller;
      setLoading(true);
      try {
        const response: Data = await requestApi(
          undefined,
          "?page=" + nextPage + "&month=" + currentMonth.current,
          controller.signal,
        );
        if (sequence !== fetchSequence.current) return;
        setData(response);
        setDraft(response.config);
        setError("");
        setFieldErrors({});
      } catch (e) {
        if (
          (e as Error).name !== "AbortError" &&
          sequence === fetchSequence.current
        )
          setError((e as Error).message);
      } finally {
        if (sequence === fetchSequence.current) setLoading(false);
      }
    },
    [page],
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("tab");
    if (params.has("simulation") || params.has("archiveCampaign")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("simulation");
      url.searchParams.delete("archiveCampaign");
      window.history.replaceState(null, "", url);
    }
    if (value === "antrean") {
      setTab("planner");
      setHistoryOpen(true);
    } else if (value === "ringkasan") setTab("planner");
    else if (tabs.some((item) => item.id === value)) setTab(value as Tab);
    const chosenMonth = params.get("month"),
      chosenDate = params.get("date");
    try {
      if (chosenMonth) {
        monthBounds(chosenMonth);
        let day = chosenMonth + "-01";
        try {
          if (
            chosenDate?.startsWith(chosenMonth + "-") &&
            /^\d{4}-\d{2}-\d{2}$/.test(chosenDate) &&
            jakartaDate(new Date(chosenDate + "T12:00:00+07:00")) === chosenDate
          )
            day = chosenDate;
        } catch {}
        setMonth(chosenMonth);
        setSelectedDate(day);
      }
    } catch {}
    if (params.get("instagram") === "success")
      toast.success("Instagram perusahaan terhubung.");
    if (params.get("instagram") === "error") {
      const message =
        instagramOAuthMessages[
          instagramOAuthIssue(params.get("instagramError"))
        ];
      setInstagramIssue(message);
      toast.error(message);
    }
    setBooted(true);
  }, []);
  useEffect(() => {
    if (booted) void load();
    return () => {
      loadController.current?.abort();
      commentSequence.current++;
    };
  }, [load, booted]);
  function chooseDate(day: string) {
    try {
      monthBounds(day.slice(0, 7));
    } catch {
      return;
    }
    setSelectedDate(day);
    currentMonth.current = day.slice(0, 7);
    setMonth(day.slice(0, 7));
    const url = new URL(window.location.href);
    url.searchParams.set("month", day.slice(0, 7));
    url.searchParams.set("date", day);
    window.history.replaceState(null, "", url);
  }
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  function selectTab(next: Tab, force = false) {
    if (campaignBusy) return;
    if (dirty && !force) {
      setLeave(next);
      return;
    }
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }
  function update<K extends keyof MarketingConfig>(
    key: K,
    value: MarketingConfig[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((fields) => ({ ...fields, [key]: "" }));
  }
  async function perform(action: string, extra: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(action);
    setError("");
    try {
      const result = await requestApi({ action, ...extra });
      if (action === "preview" || action === "plan") {
        setPreview({ ...result.job, publications: [] });
        toast.success(
          action === "plan"
            ? "Materi ditambahkan ke planner."
            : "Materi siap ditinjau.",
        );
      } else if (action === "settings")
        toast.success(
          result.config.enabled
            ? "Otomatisasi aktif."
            : "Pengaturan tersimpan. Otomatisasi dijeda.",
        );
      else if (action === "test-whatsapp") toast.success(result.message);
      else if (action === "reconcile")
        toast.success(
          result.state === "published"
            ? "Publikasi telah dikonfirmasi."
            : "Hasil belum dapat dipastikan. Sistem tidak mengirim ulang.",
        );
      else toast.success("Analitik diperbarui.");
      await load();
      return result;
    } catch (e) {
      const failure = e as Error & { fields?: Record<string, string[]> };
      if (action === "plan") await load();
      setError(failure.message);
      if (failure.fields)
        setFieldErrors(
          Object.fromEntries(
            Object.entries(failure.fields).map(([key, values]) => [
              key,
              values[0],
            ]),
          ),
        );
    } finally {
      setBusy("");
    }
  }
  async function saveContentPlan(plan: ConfigurePlan) {
    if (busy)
      throw new Error(
        "Proses lain sedang berjalan. Coba kembali sebentar lagi.",
      );
    setBusy("configure-plan");
    try {
      const result = await requestApi({ action: "configure-plan", plan });
      chooseDate(jakartaDate(new Date(result.job.scheduledFor)));
      await load();
      toast.success("Rencana konten tersimpan.");
      setEditingPlan(null);
    } finally {
      setBusy("");
    }
  }
  async function save(config = draft) {
    const parsed = settingsSchema.safeParse(config);
    if (!parsed.success) {
      const errors = Object.fromEntries(
        parsed.error.issues.map((issue) => [
          String(issue.path[0]),
          issue.message,
        ]),
      );
      setFieldErrors(errors);
      selectTab("pengaturan", true);
      requestAnimationFrame(() =>
        document
          .getElementById(
            Object.keys(errors)[0] === "schedules"
              ? "marketing-schedule-0"
              : "marketing-" + Object.keys(errors)[0],
          )
          ?.focus(),
      );
      return;
    }
    return perform("settings", { config: parsed.data });
  }
  async function loadComments(
    publication: Pick<Publication, "id">,
    after?: string,
  ) {
    const sequence = ++commentSequence.current;
    setCommentLoading(true);
    setCommentError("");
    if (!after) {
      setCommentPublication(publication);
      setCommentData({ items: [], after: null });
    }
    try {
      const response = await requestApi(
        undefined,
        "?mode=comments&publication=" +
          publication.id +
          (after ? "&after=" + encodeURIComponent(after) : ""),
      );
      if (sequence === commentSequence.current)
        setCommentData((previous) => ({
          ...response,
          items: after
            ? [...previous.items, ...response.items]
            : response.items,
        }));
    } catch (e) {
      if (sequence === commentSequence.current)
        setCommentError((e as Error).message);
    } finally {
      if (sequence === commentSequence.current) setCommentLoading(false);
    }
  }
  const editable = !busy && !loading && !campaignBusy,
    config = data?.config || DEFAULT_CONFIG;
  return (
    <section
      className="marketing-workspace"
      data-section={tab}
      aria-busy={loading}
    >
      <MarketingHeader
        data={data}
        loading={loading}
        editable={editable}
        dirty={dirty}
        navigation={{
          tab,
          dirty: settingsDirty,
          campaignDirty,
          disabled: !!busy || campaignBusy,
          onChange: selectTab,
        }}
        onRefresh={() => void load()}
        onAccount={() => {
          if (data?.connection.instagram.connected) selectTab("pengaturan");
          else if (data?.connection.instagram.configured)
            window.location.assign(
              instagramConnectionHref(
                data.connection.instagram.setup.origin,
                window.location.origin,
              ),
            );
          else setInstagramSetupOpen(true);
        }}
      />
      {error && (
        <div className="marketing-banner marketing-error" role="alert">
          <CircleAlert size={18} />
          <div>
            {error}
            {!data && (
              <Action disabled={loading} onClick={() => void load()}>
                Coba kembali
              </Action>
            )}
          </div>
        </div>
      )}
      {data && (data.summary.needsReview > 0 || data.summary.lastError) && (
        <div className="marketing-banner" role="status">
          <CircleAlert size={18} />
          <span>
            {data.summary.lastError
              ? explain(data.summary.lastError)
              : `${data.summary.needsReview} pengiriman perlu diperiksa. Lihat Riwayat konten dan pengiriman di Planner.`}
          </span>
        </div>
      )}
      {busy && (
        <div className="marketing-progress" role="status">
          <Loader2 size={17} className="animate-spin" />
          {busy === "preview" || busy === "plan"
            ? "Menyiapkan foto, poster, dan caption…"
            : busy === "test-whatsapp"
              ? "Mengirim Status ke kontak uji…"
              : busy === "sync"
                ? "Mengambil analitik…"
                : busy === "configure-plan"
                  ? "Menyimpan rencana konten…"
                  : "Menyimpan pengaturan…"}
        </div>
      )}
      {loading && !data && <PlannerSkeleton />}
      {monthlyData && tab === "planner" && (
        <MarketingPlanner
          data={monthlyData}
          month={month}
          selectedDate={selectedDate}
          loading={loading || planner.loading}
          loadError={planner.error}
          editable={editable && !dirty}
          preparing={preparingSlot}
          focusToken={0}
          onDate={chooseDate}
          onPrepare={(when) => {
            setPreparingSlot(when);
            void perform("plan", { scheduledFor: when }).finally(() =>
              setPreparingSlot(null),
            );
          }}
          onPreview={setPreview}
          onSettings={() => selectTab("pengaturan")}
          onCampaign={(id) => {
            const url = new URL(window.location.href);
            url.searchParams.set("campaign", id);
            window.history.replaceState(null, "", url);
            selectTab("campaign");
          }}
          onReload={planner.reload}
          onEdit={setEditingPlan}
        />
      )}
      {data && tab === "campaign" && (
        <MarketingCampaigns
          config={data.config}
          onDirtyChange={setCampaignDirty}
          onBusyChange={setCampaignBusy}
          onApplied={async (firstScheduledFor) => {
            await load();
            if (firstScheduledFor)
              chooseDate(jakartaDate(new Date(firstScheduledFor)));
          }}
          onPlanner={(when) => {
            if (when) chooseDate(jakartaDate(new Date(when)));
            selectTab("planner");
          }}
        />
      )}
      {data && tab === "planner" && (
        <details
          className="marketing-history"
          open={historyOpen}
          onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
        >
          <summary>Riwayat konten dan pengiriman</summary>
          <div className="marketing-panel">
            <div className="marketing-panel-heading">
              <div>
                <h2>Riwayat dan antrean konten</h2>
                <p>
                  {number(data.jobs.total)} slot · hasil Instagram dan WhatsApp
                  dicatat terpisah.
                </p>
              </div>
              <Action
                disabled={!editable || dirty}
                onClick={() => void perform("preview")}
              >
                <ImageIcon size={16} />
                Buat pratinjau
              </Action>
            </div>
            {!data.jobs.items.length && (
              <Empty
                title="Belum ada jadwal"
                text="Simpan jam publikasi di Pengaturan untuk menyiapkan antrean."
              />
            )}
            <div className="marketing-job-list">
              {data.jobs.items.map((job) => {
                const asset = job.snapshot as AssetSnapshot;
                return (
                  <article className="marketing-job" key={job.id}>
                    <div className="marketing-job-photo">
                      {job.listingId ? (
                        <img
                          src={imageUrl(job.id, "feed.jpg")}
                          alt={asset.propertyType + " di " + asset.city}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.visibility = "hidden";
                          }}
                        />
                      ) : (
                        <ImageIcon size={24} />
                      )}
                    </div>
                    <div className="marketing-job-info">
                      <div className="marketing-job-meta">
                        <time>{date(job.scheduledFor)} WIB</time>
                        <Pill state={job.status} />
                      </div>
                      <h3>{asset.address || "Aset belum dipilih"}</h3>
                      <p>
                        {asset.price
                          ? "Rp " +
                            number(asset.price) +
                            " · " +
                            asset.propertyType
                          : "Pemilihan mengikuti kriteria yang tersimpan."}
                      </p>
                      <div className="marketing-channel-status">
                        {job.publications.map((publication) => (
                          <span key={publication.id}>
                            {publication.channel === "instagram" ? (
                              <Instagram size={14} />
                            ) : (
                              <WhatsApp size={14} />
                            )}
                            {publication.channel === "instagram"
                              ? "Instagram"
                              : "Status WA"}
                            :{" "}
                            {stateLabels(
                              publication.state,
                              publication.errorCode,
                            )}
                            {publication.errorCode && (
                              <small>{explain(publication.errorCode)}</small>
                            )}
                            {publication.state === "uncertain" && (
                              <Action
                                disabled={!editable}
                                onClick={() =>
                                  void perform("reconcile", {
                                    publicationId: publication.id,
                                  })
                                }
                              >
                                Periksa pengiriman
                              </Action>
                            )}
                          </span>
                        ))}
                      </div>
                      {job.reason && (
                        <p className="marketing-warning">
                          {explain(job.reason)}
                        </p>
                      )}
                    </div>
                    {job.listingId && (
                      <Action
                        disabled={!editable}
                        onClick={() => setPreview(job)}
                      >
                        <Eye size={16} />
                        Materi
                      </Action>
                    )}
                  </article>
                );
              })}
            </div>
            <Pagination
              page={page}
              total={data.jobs.total}
              busy={!editable}
              onChange={setPage}
            />
          </div>
        </details>
      )}
      {tab === "instagram" && (
        <InstagramWorkspace onSettings={() => selectTab("pengaturan")} />
      )}
      {monthlyData && tab === "analitik" && (
        <MarketingAnalytics
          data={data!}
          month={month}
          editable={editable}
          onMonth={(value) => chooseDate(value + "-01")}
          onSync={(publicationId) => void perform("sync", { publicationId })}
          onComments={(publication) => void loadComments(publication)}
        />
      )}
      {data && tab === "pengaturan" && (
        <MarketingSettings
          data={data}
          draft={draft}
          editable={editable}
          dirty={settingsDirty}
          saving={busy === "settings"}
          errors={fieldErrors}
          connectionError={instagramIssue}
          testPhone={testPhone}
          onTestPhone={setTestPhone}
          onChange={update}
          onSave={() => void save()}
          onReset={() => {
            setDraft(data.config);
            setFieldErrors({});
          }}
          onAutomation={() =>
            config.enabled
              ? void save({ ...config, enabled: false })
              : setActivate(true)
          }
          onSetup={() => setInstagramSetupOpen(true)}
          onTest={() => setTestConfirm(true)}
        />
      )}
      <InstagramSetupDialog
        open={instagramSetupOpen}
        onOpenChange={setInstagramSetupOpen}
        setup={data?.connection.instagram.setup}
      />
      <MarketingPreviewDialog
        preview={preview}
        onClose={() => setPreview(null)}
      />
      {editingPlan && data && (
        <MarketingPlanDialog
          key={editingPlan.key}
          slot={editingPlan}
          data={data}
          onClose={() => setEditingPlan(null)}
          onSave={saveContentPlan}
        />
      )}
      <DialogFrame
        open={activate}
        onOpenChange={setActivate}
        title="Aktifkan pemasaran otomatis"
        description="Aset akan dipilih dan diterbitkan secara otomatis pada jadwal tersimpan."
        contentClassName="marketing-modal marketing-small-modal"
      >
        <Play size={25} />
        <h2>Aktifkan pemasaran otomatis?</h2>
        <p>
          Sistem akan memilih {config.schedules.length} aset per hari dan
          menerbitkannya ke{" "}
          {[
            config.instagram ? "Instagram" : "",
            config.whatsapp ? "Status WhatsApp" : "",
          ]
            .filter(Boolean)
            .join(" dan ")}
          .
        </p>
        <p className="marketing-muted">
          Jadwal: {config.schedules.join(", ")} WIB. Anda dapat menjedanya kapan
          saja.
        </p>
        <div className="marketing-modal-actions">
          <Action autoFocus onClick={() => setActivate(false)}>
            Kembali
          </Action>
          <Action
            primary
            disabled={!editable}
            onClick={() => {
              setActivate(false);
              void save({ ...draft, enabled: true });
            }}
          >
            Aktifkan otomatisasi
          </Action>
        </div>
      </DialogFrame>
      <DialogFrame
        open={testConfirm}
        onOpenChange={setTestConfirm}
        title="Kirim Status WhatsApp uji"
        description="Konfirmasi nomor kontak yang menerima Status uji."
        contentClassName="marketing-modal marketing-small-modal"
      >
        <h2>Kirim Status uji?</h2>
        <p>
          Satu materi pemasaran akan dikirim sebagai Status untuk kontak{" "}
          <strong>{testPhone}</strong>. Pastikan kontak ini dapat memeriksa
          hasilnya.
        </p>
        <div className="marketing-modal-actions">
          <Action autoFocus onClick={() => setTestConfirm(false)}>
            Kembali
          </Action>
          <Action
            primary
            disabled={!editable}
            onClick={() => {
              setTestConfirm(false);
              void perform("test-whatsapp", { phone: testPhone });
            }}
          >
            Kirim Status uji
          </Action>
        </div>
      </DialogFrame>
      <DialogFrame
        open={!!leave}
        onOpenChange={(open) => {
          if (!open) setLeave(null);
        }}
        title="Perubahan belum disimpan"
        description="Simpan atau buang perubahan sebelum berpindah bagian."
        contentClassName="marketing-modal marketing-small-modal"
      >
        <h2>Perubahan belum disimpan</h2>
        <p>Perubahan yang baru diketik belum disimpan.</p>
        <div className="marketing-modal-actions">
          <Action autoFocus onClick={() => setLeave(null)}>
            Tetap di sini
          </Action>
          <Action
            onClick={() => {
              if (data) setDraft(data.config);
              setCampaignDirty(false);
              const next = leave!;
              setLeave(null);
              selectTab(next, true);
            }}
          >
            Buang perubahan
          </Action>
        </div>
      </DialogFrame>
      <DialogFrame
        open={!!commentPublication}
        onOpenChange={(open) => {
          if (!open) {
            commentSequence.current++;
            setCommentPublication(null);
          }
        }}
        title="Komentar Instagram"
        description="Komentar pada posting yang terhubung."
        contentClassName="marketing-modal marketing-comments-modal"
      >
        <h2>Komentar Instagram</h2>
        {commentError && (
          <p role="alert" className="marketing-error">
            {commentError}
          </p>
        )}
        {!commentLoading && !commentError && !commentData.items.length && (
          <Empty
            title="Belum ada komentar"
            text="Komentar akan tampil ketika tersedia dari Instagram."
          />
        )}
        <ul className="marketing-comments">
          {commentData.items.map((comment) => (
            <li key={comment.id}>
              <strong>
                {comment.username ? "@" + comment.username : "Akun Instagram"}
              </strong>
              <time>{date(comment.timestamp)} WIB</time>
              <p>{comment.text}</p>
            </li>
          ))}
        </ul>
        {commentLoading && (
          <p role="status" className="marketing-progress">
            <Loader2 size={18} className="animate-spin" />
            Mengambil komentar…
          </p>
        )}
        {commentData.after && (
          <Action
            disabled={commentLoading}
            onClick={() =>
              void loadComments(commentPublication!, commentData.after!)
            }
          >
            Muat komentar berikutnya
          </Action>
        )}
      </DialogFrame>
    </section>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="marketing-empty">
      <ImageIcon size={25} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Pagination({
  page,
  total,
  busy,
  onChange,
}: {
  page: number;
  total: number;
  busy: boolean;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 20));
  if (pages <= 1) return null;
  return (
    <nav className="marketing-pagination" aria-label="Halaman publikasi">
      <Action
        disabled={busy || page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Halaman sebelumnya"
      >
        <ChevronLeft size={17} />
      </Action>
      <span aria-live="polite">
        Halaman {page} dari {pages}
      </span>
      <Action
        disabled={busy || page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Halaman berikutnya"
      >
        <ChevronRight size={17} />
      </Action>
    </nav>
  );
}

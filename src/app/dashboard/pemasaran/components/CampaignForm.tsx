"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DialogFrame } from "@/components/ui/dialog";
import LocationPicker from "@/components/search/LocationPicker";
import SearchSelect from "@/components/search/SearchSelect";
import TypePicker from "@/components/search/TypePicker";
import { BUY_TYPES, PROPERTY_ICONS } from "@/lib/searchTabs";
import { TYPE_DB_TO_DISPLAY, typeDisplayToDb } from "@/lib/propertyType";
import { jakartaDate, type MarketingConfig } from "@/lib/marketing/domain";
import {
  campaignBriefSchema,
  campaignSchedule,
  campaignPeriodEnded,
  type CampaignBrief,
  type CampaignRecord,
} from "@/lib/marketing/campaign";
import { Action, number } from "./ui";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Layers,
  Instagram,
  WhatsApp,
  Loader2,
  Settings2,
} from "./MarketingIcons";
import {
  CampaignSurface,
  CampaignSectionHeading,
  CampaignButtonIcon,
} from "./CampaignVisual";
import CampaignAssets from "./CampaignAssets";
import useMarketingClock from "./useMarketingClock";
import CampaignDateRange from "./CampaignDateRange";
import CampaignRhythm from "./CampaignRhythm";
import CampaignPriceInput from "./CampaignPriceInput";
export function CampaignField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="marketing-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p id={id + "-error"} role="alert" className="marketing-error">
          {error}
        </p>
      )}
    </div>
  );
}
export const dateInput = (day: string) => day.split("-").reverse().join("/");
export const inputDate = (text: string) =>
  /^\d{2}\/\d{2}\/\d{4}$/.test(text)
    ? text.split("/").reverse().join("-")
    : text;
export default function CampaignForm({
  initial,
  config,
  onSave,
  onCancel,
  onDirtyChange,
}: {
  initial: CampaignRecord | null;
  config: MarketingConfig;
  onSave: (brief: CampaignBrief, generate: boolean) => Promise<void>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const now = useMarketingClock();
  const [seed] = useState<CampaignBrief>(() => {
    const discounts = {
      minSpread: initial?.brief.minSpread ?? config.minSpread,
      minDrop: initial?.brief.minDrop ?? config.minDrop,
      discountMode: initial?.brief.discountMode ?? ("either" as const),
    };
    if (initial) return { ...initial.brief, ...discounts, assetOrder: "fresh" };
    const today = jakartaDate(),
      end = new Date(today + "T12:00:00+07:00");
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    return {
      name: "",
      startDate: today,
      endDate: jakartaDate(end),
      schedules: [...config.schedules],
      listingIds: [],
      assetOrder: "fresh",
      channels: (["instagram", "whatsapp"] as const).filter((c) => config[c]),
      city: config.city,
      locations: config.locations,
      category: config.category,
      propertyTypes: config.propertyTypes,
      minPrice: config.minPrice,
      maxPrice: config.maxPrice,
      ...discounts,
    };
  });
  const [draft, setDraft] = useState(seed),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [discard, setDiscard] = useState(false),
    [locationOpen, setLocationOpen] = useState(false),
    [categoryOpen, setCategoryOpen] = useState(false),
    [typeOpen, setTypeOpen] = useState(false),
    [discountOpen, setDiscountOpen] = useState(false);
  const dirty = JSON.stringify(seed) !== JSON.stringify(draft);
  const ended = campaignPeriodEnded(draft, now);
  const hasUpcomingSlots = !ended && campaignSchedule(draft, now).length > 0;
  const canSchedule =
    hasUpcomingSlots && campaignBriefSchema.safeParse(draft).success;
  const saveHint = ended
    ? "Periode campaign sudah berakhir. Ubah tanggal sebelum menyimpan jadwal baru."
    : !hasUpcomingSlots
      ? "Tidak ada jam tayang mendatang. Simpan draf, lalu ubah periode atau jam untuk menyusun jadwal."
      : "Antrean dua hari langsung disusun dari filter. Stok kosong ditandai dan dicari ulang otomatis; publikasi mengikuti status otomatisasi.";
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  function update<K extends keyof CampaignBrief>(
    key: K,
    value: CampaignBrief[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }
  const props = (key: keyof CampaignBrief) => ({
    id: "campaign-" + key,
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? "campaign-" + key + "-error" : undefined,
  });
  return (
    <form
      noValidate
      className="campaign-theme campaign-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        if (campaignPeriodEnded(draft, new Date())) {
          setErrors({
            endDate:
              "Periode sudah berakhir. Pilih tanggal akhir hari ini atau setelahnya.",
          });
          document.getElementById("campaign-endDate")?.focus();
          return;
        }
        const parsed = campaignBriefSchema.safeParse(draft);
        if (!parsed.success) {
          const fields = Object.fromEntries(
            parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
          );
          setErrors(fields);
          document
            .getElementById("campaign-" + Object.keys(fields)[0])
            ?.focus();
          return;
        }
        setBusy(true);
        setError("");
        try {
          await onSave(parsed.data, canSchedule);
        } catch (failure) {
          setError((failure as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <header className="marketing-panel-heading campaign-form-heading">
        <div>
          <h2>{initial ? "Edit campaign" : "Campaign baru"}</h2>
          <p>Atur aset, periode, dan jam tayang dalam satu tempat.</p>
        </div>
      </header>
      <div className="campaign-form-summary">
        <span>
          <Layers size={15} />
          Aset otomatis dari filter
        </span>
        <span>
          <Clock size={15} />
          {number(draft.schedules.length)} tayangan per hari
        </span>
      </div>
      {error && (
        <p role="alert" className="marketing-banner marketing-error">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="campaign-form-fields">
        <legend className="sr-only">Pengaturan campaign</legend>
        <CampaignSurface
          className="campaign-form-section campaign-identity-section"
          tone="blue"
        >
          <CampaignSectionHeading
            icon={<CalendarClock size={21} />}
            title="Nama & periode"
          >
            Tentukan rentang tanggal untuk campaign ini.
          </CampaignSectionHeading>
          <div className="campaign-identity-fields">
            <CampaignField
              id="campaign-name"
              label="Nama campaign"
              error={errors.name}
            >
              <Input
                {...props("name")}
                value={draft.name}
                maxLength={120}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Misalnya: Surabaya November"
              />
            </CampaignField>
            <CampaignDateRange
              startDate={draft.startDate}
              endDate={draft.endDate}
              errors={errors}
              onChange={(start, end) => {
                update("startDate", start);
                update("endDate", end);
              }}
            />
          </div>
        </CampaignSurface>
        <CampaignSurface
          className="campaign-form-section campaign-filter-section"
          tone="amber"
        >
          <CampaignSectionHeading
            icon={<Layers size={21} />}
            title="Filter aset"
          >
            Cari aset murah sesuai daerah dan bukti penurunan harga.
          </CampaignSectionHeading>
          <div className="campaign-filter-controls">
            <div className="marketing-picker">
              <LocationPicker
                label="Daerah"
                value={draft.locations}
                onChange={(value) => {
                  update(
                    "locations",
                    value.filter(
                      (r) => r.level === "kota" || r.level === "provinsi",
                    ) as CampaignBrief["locations"],
                  );
                  update("city", "");
                }}
                open={locationOpen}
                onOpenChange={setLocationOpen}
                theme="dark"
                focusTone="neutral"
                presentation="campaign"
                maxLevel="kota"
              />
            </div>
            <p className="marketing-footnote campaign-legacy-location">
              {draft.city && !draft.locations.length ? (
                <>
                  Wilayah tersimpan: {draft.city}.{" "}
                  <Action onClick={() => update("city", "")}>
                    Gunakan semua wilayah
                  </Action>
                </>
              ) : null}
            </p>
            <div className="marketing-picker">
              <SearchSelect
                contentClassName="campaign-theme campaign-category-popover"
                label="Kategori listing"
                icon={<Settings2 size={16} />}
                value={draft.category}
                valueLabel={draft.category === "ALL" ? "Semua" : undefined}
                onChange={(value) =>
                  update("category", value as CampaignBrief["category"])
                }
                open={categoryOpen}
                onOpenChange={setCategoryOpen}
                options={[
                  { value: "ALL", label: "Semua kategori" },
                  { value: "LELANG", label: "Lelang" },
                  { value: "PRIMARY", label: "Primary" },
                  { value: "SECONDARY", label: "Secondary" },
                ]}
              />
            </div>
            <div className="marketing-picker">
              <TypePicker
                id="campaign-propertyTypes"
                variant="campaign"
                label="Jenis aset"
                theme="dark"
                disabled={busy}
                value={draft.propertyTypes.map(
                  (type) => TYPE_DB_TO_DISPLAY[type],
                )}
                onChange={(types) =>
                  update(
                    "propertyTypes",
                    types.map(
                      typeDisplayToDb,
                    ) as CampaignBrief["propertyTypes"],
                  )
                }
                options={BUY_TYPES}
                icons={PROPERTY_ICONS}
                open={typeOpen}
                onOpenChange={setTypeOpen}
              />
            </div>
            <div className="marketing-fields campaign-price-range">
              {(["minPrice", "maxPrice"] as const).map((key) => (
                <CampaignField
                  key={key}
                  id={"campaign-" + key}
                  label={key === "minPrice" ? "Minimum (Rp)" : "Maksimum (Rp)"}
                  error={errors[key]}
                >
                  <CampaignPriceInput
                    {...props(key)}
                    placeholder="Opsional"
                    value={draft[key]}
                    onValueChange={(value) => update(key, value)}
                  />
                </CampaignField>
              ))}
            </div>
            <div className="campaign-discount-controls">
              <div className="marketing-picker">
                <SearchSelect
                  id="campaign-discountMode"
                  contentClassName="campaign-theme campaign-category-popover"
                  label="Dasar harga murah"
                  icon={<Layers size={16} />}
                  value={draft.discountMode || "either"}
                  onChange={(value) => {
                    update(
                      "discountMode",
                      value as CampaignBrief["discountMode"],
                    );
                    if (
                      value === "auction" &&
                      !Number.isFinite(draft.minSpread)
                    )
                      update("minSpread", config.minSpread);
                    if (value === "market" && !Number.isFinite(draft.minDrop))
                      update("minDrop", config.minDrop);
                  }}
                  disabled={busy}
                  open={discountOpen}
                  onOpenChange={setDiscountOpen}
                  options={[
                    { value: "either", label: "Salah satu (atau)" },
                    { value: "market", label: "Diskon kelurahan" },
                    { value: "auction", label: "Penurunan lelang" },
                  ]}
                />
              </div>
              <div className="marketing-fields campaign-discount-thresholds">
                {(["minSpread", "minDrop"] as const)
                  .filter((key) =>
                    draft.discountMode === "market"
                      ? key === "minSpread"
                      : draft.discountMode === "auction"
                        ? key === "minDrop"
                        : true,
                  )
                  .map((key) => (
                    <CampaignField
                      key={key}
                      id={"campaign-" + key}
                      label={
                        key === "minSpread"
                          ? "Diskon kelurahan ≥"
                          : "Turun lelang ≥"
                      }
                      error={errors[key]}
                    >
                      <div className="campaign-percent-input" data-metric={key}>
                        <Input
                          {...props(key)}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step="any"
                          value={Number.isFinite(draft[key]) ? draft[key] : ""}
                          onChange={(e) => {
                            // React preserves equivalent number strings (e.g. 0050).
                            // Normalize the actual field as well as the numeric draft.
                            const input = e.currentTarget;
                            const normalized = input.value.replace(
                              /^(-?)0+(?=\d)/,
                              "$1",
                            );
                            if (input.value !== normalized)
                              input.value = normalized;
                            const value = input.valueAsNumber;
                            update(key, value);
                            const result =
                              campaignBriefSchema.shape[key].safeParse(value);
                            if (!result.success)
                              setErrors((previous) => ({
                                ...previous,
                                [key]: result.error.issues[0].message,
                              }));
                          }}
                          aria-describedby={[
                            "campaign-discount-help",
                            errors[key] ? "campaign-" + key + "-error" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        />
                        <span aria-hidden="true">%</span>
                      </div>
                    </CampaignField>
                  ))}
              </div>
              <p className="marketing-footnote" id="campaign-discount-help">
                {draft.discountMode !== "auction" &&
                  "Diskon kelurahan membandingkan harga/m² tanah dengan rata-rata aset sejenis di kelurahan yang sama. "}
                {draft.discountMode !== "market" &&
                  "Penurunan lelang dihitung dari nilai lelang pertama. "}
                {draft.discountMode === "either" &&
                  "Cukup memenuhi salah satu ambang. "}
                Data pembanding yang belum tersedia tidak dianggap 0%.
              </p>
            </div>
          </div>
        </CampaignSurface>
        <CampaignSurface
          className="campaign-form-section campaign-schedule-section"
          tone="teal"
        >
          <CampaignSectionHeading
            icon={<Clock size={21} />}
            title="Ritme tayang"
          >
            Atur jumlah tayangan dan jamnya setiap hari.
          </CampaignSectionHeading>
          <CampaignRhythm
            schedules={draft.schedules}
            onChange={(times) => update("schedules", times)}
            error={errors.schedules}
          />
          <p className="marketing-footnote">
            Jeda penayangan aset {config.cooldownDays} hari. Slot kosong dan
            benturan ditandai sebelum jadwal diterapkan.
          </p>
          <fieldset
            className="campaign-channels"
            id="campaign-channels"
            tabIndex={-1}
            aria-describedby={
              errors.channels ? "campaign-channels-error" : undefined
            }
          >
            <legend>Kanal tayang</legend>
            <div className="campaign-channel-options">
              {(["instagram", "whatsapp"] as const).map((channel) => (
                <label
                  className="campaign-channel-option"
                  data-channel={channel}
                  data-checked={draft.channels.includes(channel)}
                  key={channel}
                >
                  <span className="campaign-channel-icon">
                    {channel === "instagram" ? (
                      <Instagram size={20} />
                    ) : (
                      <WhatsApp size={20} />
                    )}
                  </span>
                  <span className="campaign-channel-name">
                    <strong>
                      {channel === "instagram" ? "Instagram" : "WhatsApp"}
                    </strong>
                    <small>
                      {!config[channel]
                        ? "Nonaktif di Pengaturan"
                        : channel === "instagram"
                          ? "Carousel"
                          : "Status"}
                    </small>
                  </span>
                  <Switch
                    id={"campaign-channel-" + channel}
                    aria-label={
                      channel === "instagram" ? "Instagram" : "Status WhatsApp"
                    }
                    disabled={
                      !config[channel] && !draft.channels.includes(channel)
                    }
                    checked={draft.channels.includes(channel)}
                    onChange={(e) =>
                      update(
                        "channels",
                        e.target.checked
                          ? [...draft.channels, channel]
                          : draft.channels.filter((c) => c !== channel),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
          {errors.channels && (
            <p
              id="campaign-channels-error"
              role="alert"
              className="marketing-error"
            >
              {errors.channels}
            </p>
          )}
        </CampaignSurface>
        <CampaignSurface
          className="campaign-form-section campaign-assets-section"
          tone="mint"
        >
          <CampaignAssets
            brief={draft}
            campaignId={initial?.id}
            disabled={busy}
            onChange={(ids) => update("listingIds", ids)}
          />
        </CampaignSurface>
      </fieldset>
      <footer className="campaign-form-footer">
        {saveHint && (
          <p
            id="campaign-save-help"
            className="marketing-footnote campaign-save-hint"
            role="status"
          >
            {saveHint}
          </p>
        )}
        <Action
          disabled={busy}
          onClick={() => (dirty ? setDiscard(true) : onCancel())}
        >
          Batal
        </Action>
        <Action
          primary
          type="submit"
          disabled={busy}
          aria-describedby={saveHint ? "campaign-save-help" : undefined}
        >
          {canSchedule ? "Simpan ke Planner" : "Simpan draf"}
          <CampaignButtonIcon>
            {busy ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <ArrowRight size={16} />
            )}
          </CampaignButtonIcon>
        </Action>
      </footer>
      <DialogFrame
        open={discard}
        onOpenChange={setDiscard}
        title="Buang perubahan campaign?"
        description="Isian yang belum disimpan akan dibuang."
        contentClassName="marketing-modal marketing-small-modal campaign-theme campaign-dialog"
      >
        <h2>Perubahan belum disimpan</h2>
        <div className="marketing-modal-actions">
          <Action autoFocus onClick={() => setDiscard(false)}>
            Kembali mengedit
          </Action>
          <Action onClick={onCancel}>Buang perubahan</Action>
        </div>
      </DialogFrame>
    </form>
  );
}

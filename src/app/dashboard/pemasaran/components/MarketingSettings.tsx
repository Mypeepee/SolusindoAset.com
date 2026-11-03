"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import SearchSelect from "@/components/search/SearchSelect";
import LocationPicker from "@/components/search/LocationPicker";
import { normalizePhone, type MarketingConfig } from "@/lib/marketing/domain";
import { BUY_PROPERTY_TYPES, TYPE_DB_TO_DISPLAY } from "@/lib/propertyType";
import { instagramConnectionHref } from "@/lib/marketing/instagram-oauth";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle,
  CircleAlert,
  Close,
  ExternalLink,
  Instagram,
  Layers,
  Loader2,
  Pause,
  Person,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  WhatsApp,
} from "./MarketingIcons";
import { Action, date, number, type Data } from "./ui";
import "./marketing-settings.css";

type Props = {
  data: Data;
  draft: MarketingConfig;
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  errors: Record<string, string>;
  connectionError: string;
  testPhone: string;
  onTestPhone: (value: string) => void;
  onChange: <K extends keyof MarketingConfig>(
    key: K,
    value: MarketingConfig[K],
  ) => void;
  onSave: () => void;
  onReset: () => void;
  onAutomation: () => void;
  onSetup: () => void;
  onTest: () => void;
};

function SettingsPanel({
  id,
  tone,
  icon,
  title,
  description,
  disabled,
  children,
}: {
  id: string;
  tone: string;
  icon: ReactNode;
  title: string;
  description: string;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <section className={"ms-shell ms-tone-" + tone} id={id}>
      <fieldset className="ms-panel" disabled={disabled}>
        <legend className="sr-only">{title}</legend>
        <div className="ms-panel-heading">
          <span className="ms-section-icon">{icon}</span>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
        {children}
      </fieldset>
    </section>
  );
}

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="ms-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {help && <p id={id + "-help"}>{help}</p>}
      {error && (
        <p className="ms-error" id={id + "-error"} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function MarketingSettings({
  data,
  draft,
  editable,
  dirty,
  saving,
  errors,
  connectionError,
  testPhone,
  onTestPhone,
  onChange,
  onSave,
  onReset,
  onAutomation,
  onSetup,
  onTest,
}: Props) {
  const [locationOpen, setLocationOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const root = useRef<HTMLFormElement>(null);
  const contacts = data.connection.whatsapp.contacts;
  const filteredContacts = contacts.filter((contact) =>
    (contact.name + " " + contact.jid)
      .toLowerCase()
      .includes(contactSearch.trim().toLowerCase()),
  );
  const channels = Number(draft.instagram) + Number(draft.whatsapp);
  const channelsReady =
    channels > 0 &&
    (!draft.instagram || data.connection.instagram.connected) &&
    (!draft.whatsapp || data.connection.whatsapp.connected);
  const readiness = [
    {
      label: "Identitas perusahaan",
      ready:
        !!draft.companyName.trim() &&
        /^[1-9]\d{6,14}$/.test(normalizePhone(draft.companyPhone)),
      href: "#ms-accounts",
    },
    { label: "Kanal terhubung", ready: channelsReady, href: "#ms-accounts" },
    ...(draft.whatsapp
      ? [
          {
            label: "Audiens WhatsApp",
            ready: draft.whatsappAudience.length > 0,
            href: "#ms-audience",
          },
          {
            label: "Uji Status WhatsApp",
            ready: data.connection.whatsapp.tested,
            href: "#ms-audience",
          },
        ]
      : []),
  ];
  // Readiness is guidance; activation and its prerequisites remain server-owned.
  const readyCount = readiness.filter((item) => item.ready).length;
  const inputProps = (key: string, help = false) => ({
    id: "marketing-" + key,
    disabled: !editable,
    "aria-invalid": !!errors[key],
    "aria-describedby":
      [
        help && "marketing-" + key + "-help",
        errors[key] && "marketing-" + key + "-error",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
  });

  useEffect(() => {
    const panels = root.current?.querySelectorAll(".ms-shell");
    if (
      !panels ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.animate(
            [
              { opacity: 0, transform: "translateY(12px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            { duration: 800, easing: "cubic-bezier(.22,1,.36,1)" },
          );
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.05 },
    );
    panels.forEach((panel) => observer.observe(panel));
    return () => observer.disconnect();
  }, []);

  function addSchedule() {
    const time = Array.from(
      { length: 24 },
      (_, i) => ((i + 9) % 24).toString().padStart(2, "0") + ":00",
    ).find((value) => !draft.schedules.includes(value));
    if (!time) return;
    onChange("schedules", [...draft.schedules, time]);
    requestAnimationFrame(() =>
      document
        .getElementById("marketing-schedule-" + draft.schedules.length)
        ?.focus(),
    );
  }

  return (
    <form
      ref={root}
      noValidate
      className="marketing-settings ms-workspace"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="ms-shell ms-automation ms-tone-mint">
        <div className="ms-panel">
          <div className="ms-automation-heading">
            <div className="ms-panel-heading">
              <span className="ms-section-icon">
                <Settings2 size={21} />
              </span>
              <div>
                <div className="ms-title-row">
                  <h2>Publikasi otomatis</h2>
                  <span
                    className={
                      "ms-status " +
                      (data.config.enabled
                        ? "ms-status-on"
                        : "ms-status-paused")
                    }
                  >
                    {data.config.enabled ? (
                      <Play size={11} />
                    ) : (
                      <Pause size={11} />
                    )}
                    {data.config.enabled ? "Aktif" : "Dijeda"}
                  </span>
                </div>
                <p>Atur akun, aset, dan ritme publikasi dari satu tempat.</p>
              </div>
            </div>
            <Action
              primary
              className="ms-activate"
              disabled={!editable || dirty}
              onClick={onAutomation}
            >
              {data.config.enabled
                ? "Jeda otomatisasi"
                : "Aktifkan otomatisasi"}
              <span className="ms-button-icon">
                {data.config.enabled ? <Pause size={15} /> : <Play size={15} />}
              </span>
            </Action>
          </div>
          <div className="ms-automation-facts">
            <span>
              <CalendarClock size={15} />
              <strong>{draft.schedules.length} slot</strong> per hari
            </span>
            <span>
              <Layers size={15} />
              <strong>{channels} kanal</strong> dipilih
            </span>
            <span className="ms-tick">
              {data.summary.lastTickAt ? (
                <>Diperiksa {date(data.summary.lastTickAt)} WIB</>
              ) : (
                "Jadwal belum diperiksa"
              )}
            </span>
          </div>
          <div className="ms-readiness">
            <span className="ms-readiness-label">
              Persiapan{" "}
              <strong>
                {readyCount}/{readiness.length}
              </strong>
            </span>
            {readiness.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={item.ready ? "is-ready" : ""}
              >
                {item.ready ? (
                  <CheckCircle size={14} />
                ) : (
                  <CircleAlert size={14} />
                )}
                {item.label}
                {!item.ready && <ArrowRight size={12} />}
              </a>
            ))}
          </div>
          <p className="ms-automation-help">
            {dirty
              ? "Simpan perubahan sebelum mengubah otomatisasi atau mengirim uji."
              : "Siapkan materi di Planner sebelum aktivasi. Publikasi berjalan setelah otomatisasi aktif dan kanal siap."}
          </p>
        </div>
      </div>

      <div className="ms-grid">
        <div className="ms-column">
          <SettingsPanel
            id="ms-accounts"
            tone="mint"
            icon={<Layers size={19} />}
            title="Akun & kanal"
            description="Identitas pada poster dan tujuan publikasi."
            disabled={!editable}
          >
            <div className="ms-connections">
              <ConnectionCard
                instagram
                data={data}
                onSetup={onSetup}
                connectionError={connectionError}
              />
              <ConnectionCard data={data} />
            </div>
            <div className="ms-fields">
              <Field
                id="marketing-companyName"
                label="Nama perusahaan"
                error={errors.companyName}
              >
                <Input
                  {...inputProps("companyName")}
                  value={draft.companyName}
                  onChange={(e) => onChange("companyName", e.target.value)}
                  autoComplete="organization"
                />
              </Field>
              <Field
                id="marketing-companyPhone"
                label="WhatsApp perusahaan"
                error={errors.companyPhone}
                help="Ditampilkan pada poster dan caption."
              >
                <Input
                  {...inputProps("companyPhone", true)}
                  type="tel"
                  value={draft.companyPhone}
                  onChange={(e) => onChange("companyPhone", e.target.value)}
                  placeholder="08…"
                  autoComplete="tel"
                />
              </Field>
            </div>
            <div className="ms-channel-list">
              <label className="ms-channel ms-channel-instagram">
                <span className="ms-channel-icon">
                  <Instagram size={18} />
                </span>
                <span>
                  <strong>Feed Instagram</strong>
                  <small>
                    {draft.instagram
                      ? "Publikasikan ke feed"
                      : "Tidak dipublikasikan"}
                  </small>
                </span>
                <Switch
                  checked={draft.instagram}
                  onChange={(e) => onChange("instagram", e.target.checked)}
                  aria-describedby={
                    errors.instagram ? "marketing-instagram-error" : undefined
                  }
                />
              </label>
              <label className="ms-channel ms-channel-whatsapp">
                <span className="ms-channel-icon">
                  <WhatsApp size={19} />
                </span>
                <span>
                  <strong>Status WhatsApp</strong>
                  <small>
                    {draft.whatsapp
                      ? "Bagikan ke audiens"
                      : "Tidak dipublikasikan"}
                  </small>
                </span>
                <Switch
                  checked={draft.whatsapp}
                  onChange={(e) => onChange("whatsapp", e.target.checked)}
                />
              </label>
            </div>
            {errors.instagram && (
              <p
                className="ms-error"
                id="marketing-instagram-error"
                role="alert"
              >
                {errors.instagram}
              </p>
            )}
          </SettingsPanel>

          <SettingsPanel
            id="ms-selection"
            tone="sky"
            icon={<Layers size={20} />}
            title="Pemilihan aset"
            description="Filter bawaan untuk aset otomatis di Planner."
            disabled={!editable}
          >
            <div className="ms-note ms-selection-note">
              <CheckCircle size={16} />
              <p>
                Aset <strong>BELI · Worth-it Investor</strong>, dimulai dari
                ranking tertinggi.
              </p>
            </div>
            <div className="ms-pickers">
              <div className="ms-picker ms-location-picker">
                <LocationPicker
                  label="Wilayah pemasaran"
                  value={draft.locations}
                  onChange={(value) =>
                    onChange(
                      "locations",
                      value.filter(
                        (item) =>
                          item.level === "kota" || item.level === "provinsi",
                      ) as MarketingConfig["locations"],
                    )
                  }
                  open={locationOpen}
                  onOpenChange={setLocationOpen}
                  theme="dark"
                  focusTone="neutral"
                  maxLevel="kota"
                />
              </div>
              <div className="ms-picker">
                <SearchSelect
                  id="marketing-category"
                  label="Kategori listing"
                  icon={<Layers size={16} />}
                  value={draft.category}
                  contentClassName="ms-category-options"
                  disabled={!editable}
                  onChange={(value) =>
                    onChange("category", value as MarketingConfig["category"])
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
            </div>
            <p className="ms-help">
              Wilayah kosong mencakup seluruh wilayah yang tersedia.
            </p>
            <div className="ms-field ms-property-types">
              <span className="ms-label">Jenis properti</span>
              <div className="ms-chips">
                {BUY_PROPERTY_TYPES.map((type) => (
                  <label
                    key={type}
                    className={
                      draft.propertyTypes.includes(type) ? "is-selected" : ""
                    }
                  >
                    <input
                      type="checkbox"
                      checked={draft.propertyTypes.includes(type)}
                      onChange={(e) =>
                        onChange(
                          "propertyTypes",
                          e.target.checked
                            ? [...draft.propertyTypes, type]
                            : draft.propertyTypes.filter(
                                (value) => value !== type,
                              ),
                        )
                      }
                    />
                    {TYPE_DB_TO_DISPLAY[type]}
                  </label>
                ))}
              </div>
              <p>Tanpa pilihan: semua jenis properti.</p>
            </div>
            <div className="ms-fields">
              {(
                [
                  { key: "minPrice", label: "Harga minimum (Rp)" },
                  { key: "maxPrice", label: "Harga maksimum (Rp)" },
                ] as const
              ).map(({ key, label }) => (
                <Field
                  key={key}
                  id={"marketing-" + key}
                  label={label}
                  error={errors[key]}
                >
                  <Input
                    {...inputProps(key)}
                    type="number"
                    min={0}
                    max={1e15}
                    value={draft[key] ?? ""}
                    placeholder="Tanpa batas"
                    onChange={(e) =>
                      onChange(
                        key,
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="ms-thresholds">
              <div className="ms-fields">
                {(
                  [
                    { key: "minSpread", label: "Diskon pasar min. (%)" },
                    { key: "minDrop", label: "Turun lelang min. (%)" },
                  ] as const
                ).map(({ key, label }) => (
                  <Field
                    key={key}
                    id={"marketing-" + key}
                    label={label}
                    error={errors[key]}
                  >
                    <Input
                      {...inputProps(key)}
                      type="number"
                      min={0}
                      max={100}
                      value={draft[key]}
                      onChange={(e) => onChange(key, Number(e.target.value))}
                    />
                  </Field>
                ))}
              </div>
              <p className="ms-help">
                Cukup salah satu ambang terpenuhi (aturan OR Investor). Data
                yang belum tersedia tidak dianggap nol.
              </p>
            </div>
            <div className="ms-cooldown">
              <Field
                id="marketing-cooldownDays"
                label="Jeda aset yang sama"
                error={errors.cooldownDays}
              >
                <div className="ms-unit-input">
                  <Input
                    {...inputProps("cooldownDays")}
                    type="number"
                    min={1}
                    max={90}
                    value={draft.cooldownDays}
                    onChange={(e) =>
                      onChange("cooldownDays", Number(e.target.value))
                    }
                  />
                  <span>hari</span>
                </div>
              </Field>
              <p>Cegah aset berulang terlalu sering. Pilih 1–90 hari.</p>
            </div>
          </SettingsPanel>
        </div>

        <div className="ms-column">
          <SettingsPanel
            id="ms-schedules"
            tone="amber"
            icon={<CalendarClock size={20} />}
            title="Jadwal publikasi"
            description="Satu aset berbeda per slot, ke kanal terpilih."
            disabled={!editable}
          >
            <div className="ms-schedule-heading">
              <span className="ms-mini-badge">WIB · Asia/Jakarta</span>
              <span>{draft.schedules.length}/12 slot per hari</span>
            </div>
            <div className="ms-time-list">
              {draft.schedules.map((time, index) => (
                <div className="ms-time-slot" key={index}>
                  <Field
                    id={"marketing-schedule-" + index}
                    label={"Slot " + (index + 1)}
                  >
                    <Input
                      id={"marketing-schedule-" + index}
                      type="text"
                      inputMode="numeric"
                      value={time}
                      placeholder="09:00"
                      maxLength={5}
                      aria-describedby="marketing-schedules-help"
                      aria-invalid={!!errors.schedules}
                      onChange={(e) =>
                        onChange(
                          "schedules",
                          draft.schedules.map((value, i) =>
                            i === index ? e.target.value : value,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Action
                    className="ms-remove-slot"
                    disabled={!editable || draft.schedules.length <= 1}
                    aria-label={"Hapus slot " + (index + 1)}
                    onClick={() => {
                      onChange(
                        "schedules",
                        draft.schedules.filter((_, i) => i !== index),
                      );
                      requestAnimationFrame(() =>
                        document
                          .getElementById(
                            "marketing-schedule-" + Math.max(0, index - 1),
                          )
                          ?.focus(),
                      );
                    }}
                  >
                    <Close size={14} />
                  </Action>
                </div>
              ))}
              <Action
                className="ms-add-slot"
                disabled={!editable || draft.schedules.length >= 12}
                onClick={addSchedule}
              >
                <Plus size={16} />
                Tambah slot
              </Action>
            </div>
            <p
              id="marketing-schedules-help"
              className={errors.schedules ? "ms-error" : "ms-help"}
              role={errors.schedules ? "alert" : undefined}
            >
              {errors.schedules ||
                "Format 24 jam (HH:MM). Setiap slot harus memiliki jam berbeda."}
            </p>
            <div className="ms-note">
              <CalendarClock size={16} />
              <p>
                Jadwal ini menjadi ritme bawaan Planner. Periode dan pilihan
                aset khusus diatur melalui <strong>Campaign</strong>.
              </p>
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="ms-audience"
            tone="violet"
            icon={<Person size={20} />}
            title="Audiens WhatsApp"
            description="Pilih kontak yang dapat menerima Status."
            disabled={!editable}
          >
            <div className="ms-audience-summary">
              <span>
                <strong>{number(draft.whatsappAudience.length)}</strong> kontak
                dipilih
              </span>
              <span>{number(contacts.length)} tersinkron</span>
            </div>
            {contacts.length > 0 ? (
              <>
                <div className="ms-contact-search">
                  <Search size={16} />
                  <Input
                    id="marketing-contact-search"
                    aria-label="Cari kontak WhatsApp"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    placeholder="Cari nama atau nomor…"
                  />
                  {contactSearch && (
                    <button
                      type="button"
                      aria-label="Hapus pencarian kontak"
                      onClick={() => {
                        setContactSearch("");
                        document
                          .getElementById("marketing-contact-search")
                          ?.focus();
                      }}
                    >
                      <Close size={15} />
                    </button>
                  )}
                </div>
                <div className="ms-contact-list">
                  {filteredContacts.slice(0, 100).map((contact) => (
                    <label key={contact.jid}>
                      <input
                        type="checkbox"
                        checked={draft.whatsappAudience.includes(contact.jid)}
                        onChange={(e) =>
                          onChange(
                            "whatsappAudience",
                            e.target.checked
                              ? [...draft.whatsappAudience, contact.jid]
                              : draft.whatsappAudience.filter(
                                  (id) => id !== contact.jid,
                                ),
                          )
                        }
                      />
                      <span>
                        <strong>{contact.name || "Kontak WhatsApp"}</strong>
                        <small>
                          {contact.jid.endsWith("@lid")
                            ? "Kontak tersinkron"
                            : "+" + contact.jid.split("@")[0]}
                        </small>
                      </span>
                      {draft.whatsappAudience.includes(contact.jid) && (
                        <Check size={14} />
                      )}
                    </label>
                  ))}
                  {!filteredContacts.length && (
                    <p className="ms-no-results">
                      Kontak tidak ditemukan. Coba nama atau nomor lain.
                    </p>
                  )}
                </div>
                {filteredContacts.length > 100 && (
                  <p className="ms-help">
                    Menampilkan 100 kontak. Cari nama atau nomor untuk kontak
                    lainnya.
                  </p>
                )}
              </>
            ) : (
              <div className="ms-empty-contacts">
                <span className="ms-section-icon">
                  <Person size={20} />
                </span>
                <div>
                  <strong>Kontak belum tersinkron</strong>
                  <p>
                    Hubungkan WhatsApp perusahaan di menu Chatbot, lalu perbarui
                    halaman ini.
                  </p>
                  <a href="/dashboard/chatbot-integration">
                    Atur koneksi WhatsApp <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )}
            {draft.whatsapp && !draft.whatsappAudience.length && (
              <p className="ms-attention">
                <CircleAlert size={14} />
                Pilih minimal satu kontak untuk publikasi Status.
              </p>
            )}
            <p className="ms-help">
              Visibilitas tetap mengikuti privasi dan aturan kontak WhatsApp.
            </p>
            <details className="ms-test">
              <summary>
                <span>
                  <Send size={15} />
                  Uji pengiriman Status
                </span>
                <Plus size={15} />
              </summary>
              <div className="ms-test-body">
                <Field
                  id="marketing-testPhone"
                  label="Nomor kontak uji"
                  help="Satu Status uji benar-benar dikirim ke nomor ini."
                >
                  <Input
                    id="marketing-testPhone"
                    type="tel"
                    value={testPhone}
                    aria-describedby="marketing-testPhone-help"
                    onChange={(e) => onTestPhone(e.target.value)}
                    placeholder="08…"
                  />
                </Field>
                <Action
                  disabled={
                    !editable ||
                    !testPhone ||
                    !data.connection.whatsapp.connected ||
                    dirty
                  }
                  onClick={onTest}
                >
                  <Send size={14} />
                  Kirim Status uji
                </Action>
                <p className="ms-help">
                  {dirty
                    ? "Simpan perubahan sebelum mengirim uji."
                    : !data.connection.whatsapp.connected
                      ? "Hubungkan WhatsApp perusahaan untuk mengirim uji."
                      : "Koneksi Baileys digunakan. Analitik bergantung pada event yang diterima."}
                </p>
              </div>
            </details>
          </SettingsPanel>
        </div>
      </div>
      <div
        className={
          "marketing-savebar ms-savebar " + (dirty ? "has-changes" : "")
        }
      >
        <span className="ms-save-status" role="status">
          {dirty ? <CircleAlert size={17} /> : <CheckCircle size={17} />}
          <span>
            <strong>
              {dirty ? "Perubahan belum disimpan" : "Semua perubahan tersimpan"}
            </strong>
            <small>
              {dirty
                ? "Simpan untuk menerapkan ke Pemasaran."
                : "Pengaturan digunakan oleh Planner dan publikasi otomatis."}
            </small>
          </span>
        </span>
        <div className="ms-save-actions">
          <Action disabled={!editable || !dirty} onClick={onReset}>
            Batalkan
          </Action>
          <Action
            type="submit"
            primary
            disabled={!editable || !dirty}
            aria-busy={saving}
          >
            {saving ? "Menyimpan…" : "Simpan pengaturan"}
            <span className="ms-button-icon">
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
            </span>
          </Action>
        </div>
      </div>
    </form>
  );
}

function ConnectionCard({
  instagram = false,
  data,
  onSetup,
  connectionError,
}: {
  instagram?: boolean;
  data: Data;
  onSetup?: () => void;
  connectionError?: string;
}) {
  const connection = instagram
    ? data.connection.instagram
    : data.connection.whatsapp;
  return (
    <article
      className={
        "ms-connection " +
        (instagram ? "ms-channel-instagram" : "ms-channel-whatsapp")
      }
    >
      <div className="ms-connection-identity">
        <span className="ms-channel-icon">
          {instagram ? <Instagram size={19} /> : <WhatsApp size={20} />}
        </span>
        <div>
          <h3>{instagram ? "Instagram" : "WhatsApp"}</h3>
          <p>
            {instagram
              ? data.connection.instagram.username
                ? "@" + data.connection.instagram.username
                : "Akun belum dihubungkan"
              : data.connection.whatsapp.phone
                ? "+" + data.connection.whatsapp.phone
                : "Koneksi perusahaan di Chatbot"}
          </p>
        </div>
      </div>
      <span
        className={
          "ms-connection-state " + (connection.connected ? "is-connected" : "")
        }
      >
        <span aria-hidden="true" />
        {connection.connected
          ? !instagram && !data.connection.whatsapp.tested
            ? "Terhubung · belum diuji"
            : "Terhubung"
          : "Belum terhubung"}
      </span>
      {instagram && connectionError && !connection.connected && (
        <p className="ms-error" role="alert">
          {connectionError}
        </p>
      )}
      <div className="ms-connection-actions">
        {instagram ? (
          <>
            {data.connection.instagram.configured ? (
              <a
                href={instagramConnectionHref(
                  data.connection.instagram.setup.origin,
                  typeof window === "undefined" ? "" : window.location.origin,
                )}
              >
                {typeof window !== "undefined" &&
                window.location.origin !==
                  data.connection.instagram.setup.origin
                  ? "Buka domain HTTPS"
                  : connection.connected
                    ? "Hubungkan ulang"
                    : "Hubungkan"}
                <ExternalLink size={12} />
              </a>
            ) : (
              <span>
                {
                  data.connection.instagram.setup.checks.filter(
                    (check) => !check.ready,
                  ).length
                }{" "}
                persiapan tersisa
              </span>
            )}
            <Action onClick={onSetup}>
              {data.connection.instagram.configured
                ? "Panduan"
                : "Siapkan Instagram"}
            </Action>
          </>
        ) : (
          <a href="/dashboard/chatbot-integration">
            Atur koneksi
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </article>
  );
}

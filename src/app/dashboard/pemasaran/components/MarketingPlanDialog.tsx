"use client";
import { useEffect, useRef, useState } from "react";
import { DialogFrame } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  jakartaDate,
  PLANNING_DAYS,
  type AssetSnapshot,
  type Channel,
} from "@/lib/marketing/domain";
import {
  localPlanTime,
  manualPlan,
  validPlanTime,
  type ConfigurePlan,
} from "@/lib/marketing/plan";
import type { PlannerSlot } from "@/lib/marketing/planner";
import { campaignTimeInput, completeCampaignTime } from "@/lib/marketing/campaign-time-input";
import { Action, type Data, type Job } from "./ui";
import { ArrowRight, CalendarClock, Check, Clock, ImageIcon, Instagram, Layers, Loader2, WhatsApp } from "./MarketingIcons";
import PlanPropertyPicker from "./PlanPropertyPicker";
import MarketingDatePicker from "./MarketingDatePicker";

export default function MarketingPlanDialog({
  slot,
  data,
  onClose,
  onSave,
}: {
  slot: PlannerSlot<Job>;
  data: Data;
  onClose: () => void;
  onSave: (plan: ConfigurePlan) => Promise<void>;
}) {
  const stored = manualPlan(slot.job);
  const initialId = stored ? stored.listingId : slot.job?.listingId || null;
  const initialDate = jakartaDate(new Date(slot.scheduledFor));
  const initialTime = new Date(
    new Date(slot.scheduledFor).getTime() + 7 * 3600000,
  )
    .toISOString()
    .slice(11, 16);
  const initialChannels = slot.channels.filter(
    (channel) => data.config[channel],
  );
  const [day, setDay] = useState(initialDate),
    [time, setTime] = useState(initialTime);
  const heading = useRef<HTMLHeadingElement>(null);
  const today = jakartaDate();
  const dayAfter = (offset: number) =>
    new Date(Date.parse(today + "T00:00:00Z") + offset * 86400000).toISOString().slice(0, 10);
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [manual, setManual] = useState(!!initialId);
  const [openPicker, setOpenPicker] = useState(false);
  const [timeInputError, setTimeInputError] = useState("");
  const [selected, setSelected] = useState<AssetSnapshot | null>(
    initialId ? (slot.job?.snapshot as AssetSnapshot) : null,
  );
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false),
    [discard, setDiscard] = useState(false);
  const normalizedTime = completeCampaignTime(time);
  const when = localPlanTime(day, normalizedTime || "");
  const timeValid = !!when && validPlanTime(when) && !timeInputError;
  const dateValid = !!localPlanTime(day, "12:00") && day >= today && day <= dayAfter(PLANNING_DAYS);
  const selectedId = manual ? selected?.id || null : null;
  const dirty =
    day !== initialDate ||
    time !== initialTime ||
    manual !== !!initialId ||
    selectedId !== initialId ||
    [...channels].sort().join() !== [...initialChannels].sort().join();
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  const requestClose = () => {
    if (saving) return;
    if (discard) setDiscard(false);
    else if (dirty) setDiscard(true);
    else onClose();
  };
  return (
    <DialogFrame
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
      title="Atur rencana konten"
      description="Pilih properti, kanal pemasaran, tanggal, dan jam unggah untuk slot ini."
      focusFallbackId="marketing-day-heading"
      initialFocusRef={heading}
      contentClassName="marketing-modal marketing-plan-dialog marketing-plan-editor"
      closeClassName="marketing-plan-close"
    >
      {discard ? (
        <div className="marketing-plan-discard">
          <h2>Perubahan belum disimpan</h2>
          <p className="marketing-muted">
            Kembali ke formulir atau buang perubahan rencana ini.
          </p>
          <div className="marketing-modal-actions">
            <Action autoFocus onClick={() => setDiscard(false)}>
              Kembali mengedit
            </Action>
            <Action onClick={onClose}>Buang perubahan</Action>
          </div>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving) return;
            setSubmitted(true);
            setError("");
            if (!timeValid || !channels.length || (manual && !selectedId)) {
              document
                .getElementById(
                  !timeValid
                    ? !dateValid ? "marketing-plan-date" : "marketing-plan-time"
                    : !channels.length
                      ? "marketing-plan-instagram"
                      : "marketing-plan-property",
                )
                ?.focus();
              return;
            }
            setSaving(true);
            try {
              await onSave({
                sourceScheduledFor: slot.scheduledFor,
                scheduledFor: when!.toISOString(),
                listingId: selectedId,
                channels,
                ...(slot.job
                  ? {
                    jobId: slot.job.id,
                    expectedUpdatedAt: new Date(
                      slot.job.updatedAt,
                    ).toISOString(),
                  }
                  : {}),
              });
            } catch (failure) {
              setError((failure as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <header className="marketing-plan-heading">
            <p className="marketing-eyebrow">Planner perusahaan</p>
            <h2 ref={heading} tabIndex={-1}>Atur rencana konten</h2>
            <p className="marketing-muted">
              Pilih jadwal, aplikasi, dan properti. Semua dalam satu rencana.
            </p>
          </header>
          <div className="marketing-plan-body">
          <fieldset disabled={saving} className="marketing-plan-form">
            <legend className="sr-only">Pengaturan rencana konten</legend>
            {error && (
              <p role="alert" className="marketing-error">
                {error}
              </p>
            )}
            <section className="marketing-plan-schedule" aria-labelledby="marketing-plan-schedule-heading">
              <h3 id="marketing-plan-schedule-heading" className="marketing-plan-section-title"><CalendarClock size={17} /> Jadwal unggah <span>WIB</span></h3>
              <div className="marketing-plan-datetime">
                <div className="marketing-field">
                  <label htmlFor="marketing-plan-date">Tanggal unggah</label>
                  <div className="marketing-plan-input-shell">
                    <MarketingDatePicker
                      id="marketing-plan-date"
                      min={today}
                      max={dayAfter(PLANNING_DAYS)}
                      value={day}
                      onChange={setDay}
                      invalid={submitted && !dateValid}
                      descriptionId="marketing-plan-time-help"
                    />
                  </div>
                  <div className="marketing-plan-shortcuts" role="group" aria-label="Pilihan tanggal cepat">
                    {([[0, "Hari ini"], [1, "Besok"], [7, "+7 hari"]] as const).map(([offset, label]) => (
                      <button key={offset} type="button" aria-pressed={day === dayAfter(offset)} onClick={() => setDay(dayAfter(offset))}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className="marketing-field">
                  <label htmlFor="marketing-plan-time">Jam unggah <small>24 jam</small></label>
                  <div className="marketing-plan-input-shell marketing-plan-time-shell">
                    <Input
                      id="marketing-plan-time"
                      type="text"
                      inputMode="numeric"
                      placeholder="09:00"
                      maxLength={5}
                      value={time}
                      autoComplete="off"
                      onChange={(event) => {
                        const value = campaignTimeInput(event.target.value);
                        setTimeInputError(value === null ? "Gunakan jam 00–23 dan menit 00–59." : "");
                        if (value !== null) setTime(value);
                      }}
                      onBlur={() => { if (normalizedTime) setTime(normalizedTime); }}
                      aria-invalid={!!timeInputError || (submitted && !timeValid)}
                      aria-describedby="marketing-plan-time-help"
                    />
                    <Clock size={17} />
                  </div>
                  <div className="marketing-plan-shortcuts" role="group" aria-label="Pilihan jam cepat">
                    {data.config.schedules.map((schedule) => (
                      <button key={schedule} type="button" aria-pressed={normalizedTime === schedule} disabled={!validPlanTime(localPlanTime(day, schedule) || new Date(NaN))} onClick={() => { setTime(schedule); setTimeInputError(""); }}>{schedule}</button>
                    ))}
                  </div>
                </div>
              </div>
              <p
                id="marketing-plan-time-help"
                className={
                  timeInputError || (submitted && !timeValid) ? "marketing-error" : "marketing-muted"
                }
                role={timeInputError || (submitted && !timeValid) ? "alert" : undefined}
              >
                {timeInputError || (submitted && !timeValid ? !dateValid ? "Pilih tanggal hari ini hingga 90 hari ke depan." : "Pilih jam mendatang dengan format HH:MM." : "Waktu Indonesia Barat · Maksimal 90 hari ke depan.")}
              </p>
              <div className="marketing-plan-schedule-preview">
                <Clock size={18} />
                <div><span>Jadwal rencana</span><strong>{when ? new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(when) : "Lengkapi tanggal dan jam"}</strong><b>{normalizedTime || "HH:MM"} <small>WIB</small></b></div>
              </div>
            </section>
            <div className="marketing-plan-targets">
              <fieldset className="marketing-plan-channel-options">
                <legend><span className="marketing-plan-section-title"><Layers size={17} /> Aplikasi pemasaran</span></legend>
                <div className="marketing-plan-channel-grid">
                  {(["instagram", "whatsapp"] as const).map((channel) => (
                    <label key={channel} data-selected={channels.includes(channel)}>
                      <input
                        id={"marketing-plan-" + channel}
                        type="checkbox"
                        checked={channels.includes(channel)}
                        disabled={!data.config[channel]}
                        onChange={(event) =>
                          setChannels((current) =>
                            event.target.checked
                              ? [...current, channel]
                              : current.filter((item) => item !== channel),
                          )
                        }
                      />
                      <span className="marketing-plan-channel-icon">{channel === "instagram" ? (
                        <Instagram size={18} />
                      ) : (
                        <WhatsApp size={18} />
                      )}</span>
                      <span>
                        <strong>
                          {channel === "instagram" ? "Instagram" : "WhatsApp"}
                        </strong>
                        <small>
                          {!data.config[channel]
                            ? "Nonaktif di Pengaturan"
                            : channel === "instagram"
                              ? "Feed / carousel"
                              : "Status WhatsApp"}
                        </small>
                      </span>
                      <span className="marketing-plan-channel-check"><Check size={12} /></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {submitted && !channels.length && (
                <p role="alert" className="marketing-error">
                  Pilih minimal satu aplikasi pemasaran.
                </p>
              )}
              <fieldset className="marketing-plan-property-mode">
                <legend><span className="marketing-plan-section-title"><ImageIcon size={17} /> Properti yang dipasarkan</span></legend>
                <div className="marketing-plan-mode-options">
                  <label>
                    <input
                      type="radio"
                      name="marketing-property-mode"
                      checked={!manual}
                      onChange={() => setManual(false)}
                    />
                    Pilih otomatis
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="marketing-property-mode"
                      checked={manual}
                    onChange={() => { setManual(true); setOpenPicker(timeValid); }}
                    />
                    Pilih properti
                  </label>
                </div>
                {manual ? (
                  <PlanPropertyPicker
                    when={timeValid ? when!.toISOString() : null}
                    jobId={slot.job?.id}
                    selected={selected}
                    disabled={saving}
                    onSelect={setSelected}
                    open={openPicker}
                    onOpenChange={setOpenPicker}
                  />
                ) : (
                  <div className="marketing-plan-auto"><span><Layers size={23} /></span><strong>Properti dipilih oleh sistem</strong><p className="marketing-muted">Sesuai kriteria Investor, jadwal lelang, dan jeda pemasaran.</p></div>
                )}
                {submitted && manual && !selectedId && (
                  <p role="alert" className="marketing-error">
                    Pilih satu properti untuk rencana ini.
                  </p>
                )}
              </fieldset>
            </div>
            <p className="marketing-footnote">
              Materi disiapkan setelah rencana disimpan. Unggah terjadwal berjalan saat otomatisasi aktif dan akun terhubung.
            </p>
          </fieldset>
          </div>
          <footer className="marketing-plan-footer">
            <Action disabled={saving} onClick={requestClose}>
              Batal
            </Action>
            <Action primary type="submit" disabled={saving} aria-busy={saving}>
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? "Menyimpan…" : "Simpan rencana"}
              <span className="marketing-plan-save-icon"><ArrowRight size={16} /></span>
            </Action>
          </footer>
        </form>
      )}
    </DialogFrame>
  );
}

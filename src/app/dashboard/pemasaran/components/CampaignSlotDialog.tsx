"use client";
import { useEffect, useState } from "react";
import { DialogFrame } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { jakartaDate, type AssetSnapshot } from "@/lib/marketing/domain";
import { localPlanTime } from "@/lib/marketing/plan";
import type { CampaignSlot, CampaignGap } from "@/lib/marketing/campaign";
import { Action } from "./ui";
import { CampaignField, dateInput, inputDate } from "./CampaignForm";
import PlanPropertyPicker from "./PlanPropertyPicker";
import { Loader2 } from "./MarketingIcons";
export default function CampaignSlotDialog({
  slot,
  campaignId,
  proposalId,
  schedules,
  onClose,
  onSave,
}: {
  slot: CampaignSlot | CampaignGap;
  campaignId: string;
  proposalId: string;
  schedules: string[];
  onClose: () => void;
  onSave: (input: {
    slotId: string;
    listingId: string;
    scheduledFor: string;
  }) => Promise<void>;
}) {
  const initial = "asset" in slot ? slot.asset : null;
  const [day, setDay] = useState(
      dateInput(jakartaDate(new Date(slot.scheduledFor))),
    ),
    [time, setTime] = useState(
      new Date(Date.parse(slot.scheduledFor) + 7 * 3600000)
        .toISOString()
        .slice(11, 16),
    ),
    [asset, setAsset] = useState<AssetSnapshot | null>(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [discard, setDiscard] = useState(false),
    [submitted, setSubmitted] = useState(false);
  const when = localPlanTime(inputDate(day), time),
    dirty =
      asset?.id !== initial?.id || when?.toISOString() !== slot.scheduledFor;
  useEffect(() => {
    if (!dirty) return;
    const protect = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  const close = () => {
    if (!busy) dirty ? setDiscard(true) : onClose();
  };
  return (
    <DialogFrame
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Atur aset dan waktu tayang"
      description="Pilih aset dari campaign dan ubah waktu tayangnya."
      contentClassName="marketing-modal marketing-plan-dialog campaign-slot-dialog campaign-theme campaign-dialog"
    >
      {discard ? (
        <>
          <h2>Perubahan belum disimpan</h2>
          <div className="marketing-modal-actions">
            <Action autoFocus onClick={() => setDiscard(false)}>
              Kembali mengedit
            </Action>
            <Action onClick={onClose}>Buang perubahan</Action>
          </div>
        </>
      ) : (
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setSubmitted(true);
            if (!when || !asset) {
              setError("Pilih aset, tanggal, dan jam tayang dengan benar.");
              document
                .getElementById(
                  !when ? "campaign-slot-day" : "marketing-plan-property",
                )
                ?.focus();
              return;
            }
            setBusy(true);
            setError("");
            try {
              await onSave({
                slotId: slot.id,
                listingId: asset.id,
                scheduledFor: when.toISOString(),
              });
              onClose();
            } catch (failure) {
              setError((failure as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <header className="marketing-plan-heading">
            <p className="marketing-eyebrow">Jadwal campaign</p>
            <h2>Atur aset & waktu</h2>
          </header>
          <fieldset disabled={busy} className="marketing-plan-form">
            <legend className="sr-only">Aset dan waktu tayang</legend>
            {error && (
              <p
                id="campaign-slot-error"
                role="alert"
                className="marketing-error"
              >
                {error}
              </p>
            )}
            <div className="marketing-plan-datetime">
              <CampaignField
                id="campaign-slot-day"
                label="Tanggal · DD/MM/YYYY"
              >
                <Input
                  id="campaign-slot-day"
                  value={day}
                  maxLength={10}
                  aria-invalid={submitted && !when}
                  aria-describedby={
                    submitted && !when ? "campaign-slot-error" : undefined
                  }
                  onChange={(e) => setDay(e.target.value)}
                />
              </CampaignField>
              <CampaignField id="campaign-slot-time" label="Jam · HH:MM WIB">
                <Input
                  id="campaign-slot-time"
                  value={time}
                  maxLength={5}
                  aria-invalid={submitted && !when}
                  aria-describedby={
                    submitted && !when ? "campaign-slot-error" : undefined
                  }
                  onChange={(e) => setTime(e.target.value)}
                />
              </CampaignField>
            </div>
            <p className="marketing-footnote">
              Jam campaign: {schedules.join(" · ")} WIB. Pilih waktu yang belum
              terisi di dalam periode campaign.
            </p>
            <PlanPropertyPicker
              when={when && when > new Date() ? when.toISOString() : null}
              selected={asset}
              onSelect={setAsset}
              disabled={busy}
              campaign={{ id: campaignId, proposalId, slotId: slot.id }}
            />
            <p className="marketing-footnote">
              Hanya aset pilihan campaign yang ditampilkan. Template dan caption
              properti mengikuti listing.
            </p>
          </fieldset>
          <footer className="marketing-plan-footer">
            <Action disabled={busy} onClick={close}>
              Batal
            </Action>
            <Action primary disabled={busy} type="submit">
              {busy && <Loader2 className="animate-spin" size={16} />}Simpan
              jadwal
            </Action>
          </footer>
        </form>
      )}
    </DialogFrame>
  );
}

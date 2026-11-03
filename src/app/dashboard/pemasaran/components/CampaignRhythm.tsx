"use client";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type MutableRefObject,
} from "react";
import { Input } from "@/components/ui/input";
import {
  campaignTimeInput,
  campaignTimeOrderIssue,
  completeCampaignTime,
  resizeCampaignTimes,
} from "@/lib/marketing/campaign-time-input";
import { Minus, Plus } from "./MarketingIcons";
import { campaignAllocationLabel } from "@/lib/marketing/campaign-selection";

function TimeField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="marketing-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
/** Shared rhythm editor: examples and saved campaigns use identical controls. */
export default function CampaignRhythm({
  schedules,
  onChange,
  error,
  remembered,
}: {
  schedules: string[];
  onChange: (times: string[]) => void;
  error?: string;
  remembered?: MutableRefObject<string[]>;
}) {
  const localTimes = useRef([...schedules]);
  const rememberedTimes = remembered || localTimes;
  const orderIssue = campaignTimeOrderIssue(schedules);
  const canIncrease =
    !orderIssue &&
    schedules.every((time) => completeCampaignTime(time) === time);
  const [inputError, setInputError] = useState<{
    index: number;
    message: string;
  } | null>(null);
  const timeError = inputError
    ? `Jam ${inputError.index + 1}: ${inputError.message}`
    : orderIssue?.message || error;
  const pendingCaret = useRef<{
    input: HTMLInputElement;
    value: string;
    caret: number;
  } | null>(null);
  useLayoutEffect(() => {
    const target = pendingCaret.current;
    pendingCaret.current = null;
    if (
      target &&
      document.activeElement === target.input &&
      target.input.value === target.value
    )
      target.input.setSelectionRange(target.caret, target.caret);
  });
  function editTime(
    input: HTMLInputElement,
    raw: string,
    index: number,
    caret: number,
  ) {
    const value = campaignTimeInput(raw);
    if (value === null) {
      setInputError({
        index,
        message: "Gunakan jam 00–23 dan menit 00–59, misalnya 12:00.",
      });
      return;
    }
    setInputError((current) => (current?.index === index ? null : current));
    const nextCaret =
      !raw.includes(":") && raw.length > 2 && caret > 2 ? caret + 1 : caret;
    pendingCaret.current = { input, value, caret: nextCaret };
    onChange(schedules.map((time, i) => (i === index ? value : time)));
  }
  function setIntensity(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 12) return;
    setInputError(null);
    schedules.forEach((time, index) => {
      rememberedTimes.current[index] = time;
    });
    onChange(resizeCampaignTimes(schedules, count, rememberedTimes.current));
  }
  return (
    <div className="campaign-rhythm">
      <div className="campaign-time-controls">
        <div className="campaign-intensity">
          <div>
            <strong>Tayangan per hari</strong>
            <small>1–12 kali · WIB</small>
          </div>
          <div
            className="campaign-intensity-stepper"
            role="group"
            aria-label="Intensitas tayangan"
          >
            <button
              id="campaign-intensity-less"
              type="button"
              aria-label="Kurangi tayangan per hari"
              aria-controls="campaign-schedules"
              disabled={schedules.length <= 1}
              onClick={() => setIntensity(schedules.length - 1)}
            >
              <Minus size={17} />
            </button>
            <output
              id="campaign-dailyCount"
              htmlFor="campaign-intensity-less campaign-intensity-more"
              aria-live="polite"
              aria-label="Tayangan per hari"
            >
              {schedules.length}
            </output>
            <button
              id="campaign-intensity-more"
              type="button"
              aria-label="Tambah tayangan per hari"
              aria-controls="campaign-schedules"
              disabled={schedules.length >= 12 || !canIncrease}
              onClick={() => setIntensity(schedules.length + 1)}
            >
              <Plus size={17} />
            </button>
          </div>
        </div>
        <fieldset
          id="campaign-schedules"
          tabIndex={-1}
          className="campaign-times"
          aria-describedby={timeError ? "campaign-schedules-error" : undefined}
        >
          <legend className="sr-only">Jam tayang campaign</legend>
          {schedules.map((time, index) => (
            <div
              key={index}
              className="campaign-time-slot"
              data-period={
                Number(time.slice(0, 2)) < 12
                  ? "morning"
                  : Number(time.slice(0, 2)) < 17
                    ? "afternoon"
                    : "evening"
              }
            >
              <TimeField
                id={"campaign-time-" + index}
                label={"Jam " + (index + 1)}
              >
                <Input
                  id={"campaign-time-" + index}
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={time}
                  placeholder="09:00"
                  pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  title="Format 24 jam: HH:mm"
                  aria-invalid={
                    (!!error && !orderIssue) ||
                    inputError?.index === index ||
                    orderIssue?.index === index
                  }
                  aria-describedby={
                    timeError ? "campaign-schedules-error" : undefined
                  }
                  onChange={(e) =>
                    editTime(
                      e.currentTarget,
                      e.currentTarget.value,
                      index,
                      e.currentTarget.selectionStart ??
                        e.currentTarget.value.length,
                    )
                  }
                  onPaste={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget;
                    const start = input.selectionStart ?? 0;
                    const end = input.selectionEnd ?? input.value.length;
                    const pasted = e.clipboardData.getData("text").trim();
                    editTime(
                      input,
                      input.value.slice(0, start) +
                        pasted +
                        input.value.slice(end),
                      index,
                      start + pasted.length,
                    );
                  }}
                  onKeyDown={(e) => {
                    const input = e.currentTarget;
                    if (input.selectionStart !== input.selectionEnd) return;
                    const colon = input.value.indexOf(":");
                    if (colon < 0) return;
                    if (
                      e.key === "Backspace" &&
                      input.selectionStart === colon + 1 &&
                      colon > 0
                    ) {
                      e.preventDefault();
                      editTime(
                        input,
                        input.value.slice(0, colon - 1) +
                          input.value.slice(colon),
                        index,
                        colon - 1,
                      );
                    } else if (
                      e.key === "Delete" &&
                      input.selectionStart === colon &&
                      input.value.length > colon + 1
                    ) {
                      e.preventDefault();
                      editTime(
                        input,
                        input.value.slice(0, colon + 1) +
                          input.value.slice(colon + 2),
                        index,
                        colon + 1,
                      );
                    }
                  }}
                  onBlur={(e) => {
                    const value = completeCampaignTime(e.currentTarget.value);
                    if (value) {
                      setInputError((current) =>
                        current?.index === index ? null : current,
                      );
                      if (value !== time)
                        onChange(
                          schedules.map((v, i) => (i === index ? value : v)),
                        );
                    } else {
                      setInputError({
                        index,
                        message: "Lengkapi format HH:mm, misalnya 12:00.",
                      });
                    }
                  }}
                />
              </TimeField>
            </div>
          ))}
          {schedules.length < 12 && (
            <button
              type="button"
              className="campaign-time-add"
              aria-label="Tambah jam tayang"
              disabled={!canIncrease}
              onClick={() => setIntensity(schedules.length + 1)}
            >
              <Plus size={18} />
              <span>Tambah jam</span>
            </button>
          )}
        </fieldset>
      </div>
      <p className="marketing-footnote" aria-live="polite">
        {campaignAllocationLabel(schedules.length)} Jika satu kelompok kosong,
        sesi dipakai aset lain yang memenuhi syarat.
      </p>
      {timeError && (
        <p
          id="campaign-schedules-error"
          role="alert"
          className="marketing-error"
        >
          {timeError}
        </p>
      )}
    </div>
  );
}

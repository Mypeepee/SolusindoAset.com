"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import { id } from "date-fns/locale/id";
import { DialogFrame } from "@/components/ui/dialog";
import { jakartaDate } from "@/lib/marketing/domain";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "./MarketingIcons";

const DAY = 86400000;
const addDays = (date: string, count: number) =>
  new Date(Date.parse(date + "T00:00:00Z") + count * DAY)
    .toISOString()
    .slice(0, 10);
const dateFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const asDate = (day: string) => new Date(day + "T00:00:00Z");
const localDate = (day: string) => new Date(day + "T12:00:00");
const fromLocal = (day: Date) =>
  [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
const calendarLabels = {
  chooseDayAriaLabelPrefix: "Pilih",
  disabledDayAriaLabelPrefix: "Tidak tersedia",
  monthAriaLabelPrefix: "Bulan",
  weekAriaLabelPrefix: "Pekan",
};

export default function CampaignDateRange({
  startDate,
  endDate,
  errors,
  onChange,
}: {
  startDate: string;
  endDate: string;
  errors: { startDate?: string; endDate?: string };
  onChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState<string | null>(endDate);
  const [openingDay, setOpeningDay] = useState(startDate);
  const [calendarKey, setCalendarKey] = useState(0);
  const [position, setPosition] = useState({
    top: 8,
    left: 8,
    width: 660,
    maxHeight: 600,
  });
  const [twoMonths, setTwoMonths] = useState(true);
  const anchor = useRef<HTMLDivElement>(null);
  const calendar = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const dialogId = useId();
  const today = jakartaDate(),
    min = addDays(today, -89),
    max = addDays(today, 90);
  const days = end
    ? Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1
    : 0;
  const valid = !!end && end >= today && days > 0 && days <= 90;
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = anchor.current?.getBoundingClientRect();
      const width = Math.min(660, window.innerWidth - 24);
      const maxHeight = Math.min(560, window.innerHeight - 24);
      setTwoMonths(window.innerWidth >= 640);
      setPosition({
        width,
        maxHeight,
        left: Math.max(
          12,
          Math.min(rect?.left || 12, window.innerWidth - width - 12),
        ),
        top: Math.max(
          12,
          Math.min(
            (rect?.bottom || 12) + 8,
            window.innerHeight - maxHeight - 12,
          ),
        ),
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  function show(part: "startDate" | "endDate") {
    returnFocus.current = document.getElementById(
      "campaign-" + part,
    ) as HTMLButtonElement;
    setStart(startDate);
    setEnd(part === "endDate" ? null : endDate);
    setOpeningDay(part === "endDate" ? endDate : startDate);
    setCalendarKey((key) => key + 1);
    setOpen(true);
  }
  return (
    <div ref={anchor} className="campaign-date-range">
      <div className="campaign-date-triggers">
        {(["startDate", "endDate"] as const).map((part) => (
          <div key={part}>
            <label htmlFor={"campaign-" + part}>
              {part === "startDate" ? "Tanggal mulai" : "Tanggal akhir"}
            </label>
            <button
              id={"campaign-" + part}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={open ? dialogId : undefined}
              aria-invalid={!!errors[part]}
              aria-describedby={
                errors[part] ? "campaign-" + part + "-error" : undefined
              }
              onClick={() => show(part)}
            >
              <CalendarClock size={17} />
              <span>
                {dateFormat.format(
                  asDate(part === "startDate" ? startDate : endDate),
                )}
              </span>
              <ChevronRight size={14} />
            </button>
            {errors[part] && (
              <p
                id={"campaign-" + part + "-error"}
                role="alert"
                className="marketing-error"
              >
                {errors[part]}
              </p>
            )}
          </div>
        ))}
      </div>
      <DialogFrame
        open={open}
        onOpenChange={setOpen}
        title="Periode campaign"
        description="Pilih tanggal mulai dan akhir. Gunakan tombol panah untuk berpindah hari, Page Up dan Page Down untuk berpindah bulan. Maksimal 90 hari."
        hideClose
        initialFocusRef={calendar}
        returnFocusRef={returnFocus}
        contentId={dialogId}
        layer={10002}
        overlayClassName="campaign-type-overlay"
        contentClassName="campaign-theme campaign-date-popover"
        contentStyle={position}
      >
        <div className="campaign-date-header">
          <div>
            <strong>Periode campaign</strong>
            <p aria-live="polite">
              {!end ? "Pilih tanggal akhir" : "Pilih tanggal mulai"}
            </p>
          </div>
          <span>Maks. 90 hari</span>
        </div>
        <div
          className="campaign-date-presets"
          aria-label="Pilihan periode cepat"
        >
          {[7, 14, 30].map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={
                start === today && end === addDays(today, count - 1)
              }
              onClick={() => {
                setStart(today);
                setEnd(addDays(today, count - 1));
                setOpeningDay(today);
                setCalendarKey((key) => key + 1);
              }}
            >
              {count} hari
            </button>
          ))}
        </div>
        <div
          ref={calendar}
          className="campaign-date-calendar"
          tabIndex={-1}
          onFocus={(event) => {
            if (event.target === event.currentTarget)
              event.currentTarget
                .querySelector<HTMLElement>(
                  '.react-datepicker__day[tabindex="0"]',
                )
                ?.focus();
          }}
        >
          <DatePicker
            key={calendarKey}
            inline
            selectsRange
            locale={id}
            {...calendarLabels}
            selected={localDate(openingDay)}
            startDate={localDate(start)}
            endDate={end ? localDate(end) : null}
            openToDate={localDate(openingDay)}
            minDate={localDate(min)}
            maxDate={localDate(
              !end && addDays(start, 89) < max ? addDays(start, 89) : max,
            )}
            monthsShown={twoMonths ? 2 : 1}
            calendarStartDay={1}
            formatWeekDay={(name) => name.slice(0, 3)}
            shouldCloseOnSelect={false}
            focusSelectedMonth={false}
            fixedHeight
            onChange={([first, last]) => {
              if (first) setStart(fromLocal(first));
              setEnd(last ? fromLocal(last) : null);
            }}
            renderDayContents={(number, date) => (
              <span data-date={fromLocal(date)}>{number}</span>
            )}
            renderCustomHeader={({
              monthDate,
              customHeaderCount,
              decreaseMonth,
              increaseMonth,
              prevMonthButtonDisabled,
              nextMonthButtonDisabled,
            }) => (
              <div className="campaign-date-month-heading">
                {customHeaderCount === 0 ? (
                  <button
                    type="button"
                    aria-label="Bulan sebelumnya"
                    disabled={prevMonthButtonDisabled}
                    onClick={decreaseMonth}
                  >
                    <ChevronLeft size={17} />
                  </button>
                ) : (
                  <span />
                )}
                <h4>{monthFormat.format(asDate(fromLocal(monthDate)))}</h4>
                {customHeaderCount === (twoMonths ? 1 : 0) ? (
                  <button
                    type="button"
                    aria-label="Bulan berikutnya"
                    disabled={nextMonthButtonDisabled}
                    onClick={increaseMonth}
                  >
                    <ChevronRight size={17} />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            )}
          />
        </div>
        <div className="campaign-date-footer">
          <div aria-live="polite">
            <strong>
              {dateFormat.format(asDate(start))}
              {end && (
                <>
                  <ArrowRight size={12} />
                  {dateFormat.format(asDate(end))}
                </>
              )}
            </strong>
            <small>
              {valid
                ? `${days} hari tayang`
                : end && end < today
                  ? "Tanggal akhir harus hari ini atau setelahnya"
                  : "Pilih tanggal akhir untuk melanjutkan"}
            </small>
          </div>
          <div>
            <button type="button" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={() => {
                if (end && valid) {
                  onChange(start, end);
                  setOpen(false);
                }
              }}
            >
              Terapkan
            </button>
          </div>
        </div>
      </DialogFrame>
    </div>
  );
}

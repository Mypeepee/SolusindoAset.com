"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import { id as locale } from "date-fns/locale/id";
import { DialogFrame } from "@/components/ui/dialog";
import { CalendarClock, ChevronLeft, ChevronRight, Close } from "./MarketingIcons";

const localDate = (day: string) => new Date(day + "T12:00:00");
const dateValue = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");
const dateLabel = new Intl.DateTimeFormat("id-ID", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});

/** Single-date presentation of the same calendar engine used by CampaignDateRange. */
export default function MarketingDatePicker({
  id,
  value,
  min,
  max,
  invalid,
  descriptionId,
  onChange,
}: {
  id: string;
  value: string;
  min: string;
  max: string;
  invalid?: boolean;
  descriptionId?: string;
  onChange: (day: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 360, maxHeight: 440 });
  const trigger = useRef<HTMLButtonElement>(null);
  const calendar = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const selected = localDate(value);
  const hasDate = Number.isFinite(selected.getTime());

  useLayoutEffect(() => {
    if (!open) return;
    const visual = window.visualViewport;
    const measure = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const viewportTop = visual?.offsetTop || 0;
      const viewportHeight = visual?.height || window.innerHeight;
      const width = Math.min(360, window.innerWidth - 24);
      const maxHeight = Math.min(440, viewportHeight - 24);
      const below = (anchor?.bottom || viewportTop) + 8;
      const above = (anchor?.top || viewportTop) - maxHeight - 8;
      const preferred = below + maxHeight <= viewportTop + viewportHeight - 12
        ? below
        : above >= viewportTop + 12 ? above : below;
      setPosition({
        width,
        maxHeight,
        left: Math.max(12, Math.min(anchor?.left || 12, window.innerWidth - width - 12)),
        top: Math.max(viewportTop + 12, Math.min(preferred, viewportTop + viewportHeight - maxHeight - 12)),
      });
    };
    measure();
    window.addEventListener("resize", measure);
    visual?.addEventListener("resize", measure);
    visual?.addEventListener("scroll", measure);
    return () => {
      window.removeEventListener("resize", measure);
      visual?.removeEventListener("resize", measure);
      visual?.removeEventListener("scroll", measure);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        value={value}
        className="marketing-date-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-invalid={invalid}
        aria-describedby={descriptionId}
        onClick={() => setOpen(true)}
      >
        <span>{hasDate ? dateLabel.format(new Date(value + "T12:00:00Z")) : "Pilih tanggal"}</span>
        <CalendarClock size={18} />
      </button>
      <DialogFrame
        open={open}
        onOpenChange={setOpen}
        title="Pilih tanggal unggah"
        description="Pilih tanggal hingga 90 hari ke depan dalam WIB. Gunakan tombol panah untuk berpindah hari dan Page Up atau Page Down untuk berpindah bulan."
        contentId={dialogId}
        contentClassName="marketing-date-popover"
        overlayClassName="marketing-date-overlay"
        contentStyle={position}
        initialFocusRef={calendar}
        returnFocusRef={trigger}
        layer={10002}
        hideClose
      >
        <header className="marketing-date-heading">
          <div><strong>Pilih tanggal unggah</strong><small>Waktu Indonesia Barat</small></div>
          <button type="button" aria-label="Tutup kalender" onClick={() => setOpen(false)}><Close size={17} /></button>
        </header>
        <div
          ref={calendar}
          className="marketing-date-calendar"
          tabIndex={-1}
          onFocus={(event) => {
            if (event.target === event.currentTarget)
              event.currentTarget.querySelector<HTMLElement>('.react-datepicker__day[tabindex="0"]')?.focus();
          }}
        >
          <DatePicker
            inline
            locale={locale}
            selected={hasDate ? selected : null}
            openToDate={localDate(hasDate && value >= min && value <= max ? value : min)}
            minDate={localDate(min)}
            maxDate={localDate(max)}
            calendarStartDay={1}
            formatWeekDay={(name) => name.slice(0, 3)}
            chooseDayAriaLabelPrefix="Pilih"
            disabledDayAriaLabelPrefix="Tidak tersedia"
            monthAriaLabelPrefix="Bulan"
            weekAriaLabelPrefix="Pekan"
            fixedHeight
            onChange={(date: Date | null) => {
              if (!date) return;
              const day = dateValue(date);
              if (day < min || day > max) return;
              onChange(day);
              setOpen(false);
            }}
            renderDayContents={(number, date) => <span data-date={dateValue(date)}>{number}</span>}
            renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
              <div className="marketing-date-month">
                <h3 aria-live="polite">{new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(date)}</h3>
                <div>
                  <button type="button" aria-label="Bulan sebelumnya" disabled={prevMonthButtonDisabled} onClick={decreaseMonth}><ChevronLeft size={17} /></button>
                  <button type="button" aria-label="Bulan berikutnya" disabled={nextMonthButtonDisabled} onClick={increaseMonth}><ChevronRight size={17} /></button>
                </div>
              </div>
            )}
          />
        </div>
      </DialogFrame>
    </>
  );
}

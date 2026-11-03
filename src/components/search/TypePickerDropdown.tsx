"use client";

import { useLayoutEffect, useId, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { DialogFrame } from "@/components/ui/dialog";
import type { TypePickerProps } from "./TypePicker";
import { searchPropertyIcons } from "./property-type-icons";

/** Compact Home type picker variant, with the application's dialog focus owner. */
export default function TypePickerDropdown({
  value,
  onChange,
  options,
  icons,
  open,
  onOpenChange,
  label = "Jenis aset",
  disabled = false,
  id,
}: TypePickerProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ width: 1024, height: 768 });
  const panelId = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      setRect(trigger.current?.getBoundingClientRect() || null);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);
  const width = Math.min(
    360,
    Math.max(rect?.width || 280, 280),
    viewport.width - 16,
  );
  const below = viewport.height - (rect?.bottom || 0) - 16;
  const above = (rect?.top || 0) - 16;
  const down = below >= 300 || below >= above;
  const maxHeight = Math.min(
    460,
    viewport.height - 16,
    Math.max(180, down ? below : above),
  );
  const top = Math.max(
    8,
    Math.min(
      down ? (rect?.bottom || 8) + 6 : (rect?.top || maxHeight) - maxHeight - 6,
      viewport.height - maxHeight - 8,
    ),
  );
  const left = Math.max(
    8,
    Math.min(rect?.left || 8, viewport.width - width - 8),
  );
  const glyph = (name: string) =>
    searchPropertyIcons[name] ||
    searchPropertyIcons["solar:buildings-bold-duotone"];
  const toggle = (option: string) =>
    onChange(
      value.includes(option)
        ? value.filter((v) => v !== option)
        : [...value, option],
    );
  return (
    <div className="campaign-type-picker">
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        className="campaign-type-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        title={value.length ? value.join(", ") : "Semua jenis aset"}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
      >
        <Icon
          icon={glyph(
            value.length === 1
              ? icons?.[value[0]] || "solar:buildings-bold-duotone"
              : "solar:buildings-bold-duotone",
          )}
          width={20}
          aria-hidden="true"
        />
        <span className="campaign-type-value">
          <small>{label}</small>
          <strong>{value.length ? value.join(", ") : "Semua"}</strong>
        </span>
        {value.length > 1 && (
          <span className="campaign-type-count">{value.length}</span>
        )}
        <Icon
          icon={glyph("solar:alt-arrow-down-linear")}
          width={16}
          aria-hidden="true"
        />
      </button>
      <DialogFrame
        open={open}
        onOpenChange={onOpenChange}
        title={label}
        description="Pilih satu atau beberapa jenis aset. Pilihan langsung memperbarui filter campaign."
        hideClose
        initialFocusRef={first}
        contentId={panelId}
        layer={10002}
        overlayClassName="campaign-type-overlay"
        contentClassName="campaign-theme campaign-type-popover"
        contentStyle={{ top, left, width, maxHeight }}
      >
        <div className="campaign-type-heading">
          <span>{label}</span>
          <small>
            {value.length ? value.length + " dipilih" : "Semua jenis"}
          </small>
        </div>
        <div
          className="campaign-type-options"
          role="group"
          aria-label={label}
          onKeyDown={(event) => {
            const step =
              event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
            if (!step && event.key !== "Home" && event.key !== "End") return;
            event.preventDefault();
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
            );
            const index = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            buttons[
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? buttons.length - 1
                  : (index + step + buttons.length) % buttons.length
            ]?.focus();
          }}
        >
          {["Semua jenis aset", ...options].map((option, index) => {
            const selected =
              index === 0 ? !value.length : value.includes(option);
            return (
              <button
                ref={index === 0 ? first : undefined}
                key={option}
                type="button"
                role="checkbox"
                aria-checked={selected}
                onClick={() => (index === 0 ? onChange([]) : toggle(option))}
              >
                <Icon
                  icon={glyph(
                    index === 0
                      ? "solar:widget-3-bold-duotone"
                      : icons?.[option] || "solar:home-2-bold-duotone",
                  )}
                  width={20}
                  aria-hidden="true"
                />
                <span>{option}</span>
                <span className="campaign-type-check" aria-hidden="true">
                  {selected && (
                    <Icon icon={glyph("solar:check-read-linear")} width={15} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="campaign-type-footer">
          <button
            type="button"
            disabled={!value.length}
            onClick={() => onChange([])}
          >
            Reset pilihan
          </button>
          <button type="button" onClick={() => onOpenChange(false)}>
            Selesai
          </button>
        </div>
      </DialogFrame>
    </div>
  );
}

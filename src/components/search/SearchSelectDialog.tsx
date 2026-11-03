"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { CheckIcon, ChevronDownIcon, Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { DialogFrame } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SearchSelectProps } from "./SearchSelect";
import styles from "./search-select-dialog.module.css";

/** Expanded presentation of the shared picker; DialogFrame owns modal behavior. */
export default function SearchSelectDialog({
  label,
  value,
  options,
  icon,
  open,
  onOpenChange,
  onChange,
  theme = "dark",
  compact = false,
  layer = 2100,
  disabled = false,
  placeholder = "",
  valueLabel,
  valueDescription,
  busy,
  search,
  status,
  footer,
  triggerClassName = "",
  contentClassName = "",
  id,
  resultSummary,
}: SearchSelectProps) {
  const identity = useId();
  const dialogId = `${identity}-dialog`;
  const listId = `${identity}-list`;
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{
    height: number;
    top: number;
  } | null>(null);
  const selected = options.find((option) => option.value === value);
  const enabledOptions = options.filter((option) => !option.disabled);
  const tabValue =
    enabledOptions.find((option) => option.value === activeValue)?.value ||
    enabledOptions.find((option) => option.value === value)?.value ||
    enabledOptions[0]?.value;
  const display =
    valueLabel || selected?.shortLabel || selected?.label || placeholder;
  const touch =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;
  useEffect(() => {
    if (!open) return;
    const visual = window.visualViewport;
    const update = () => {
      const height = visual?.height ?? window.innerHeight;
      const top = visual?.offsetTop ?? 0;
      setViewport((current) =>
        current?.height === height && current.top === top
          ? current
          : { height, top },
      );
    };
    update();
    visual?.addEventListener("resize", update);
    visual?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      visual?.removeEventListener("resize", update);
      visual?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);
  useEffect(() => {
    if (open && scroller.current) scroller.current.scrollTop = 0;
  }, [open, search?.value]);
  const focusOption = (last = false) => {
    const enabled = list.current?.querySelectorAll<HTMLButtonElement>(
      'button[role="option"]:not(:disabled)',
    );
    const target = last ? enabled?.[enabled.length - 1] : enabled?.[0];
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  };
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.nativeEvent.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const enabled = [
      ...(list.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="option"]:not(:disabled)',
      ) || []),
    ];
    if (!enabled.length) return;
    event.preventDefault();
    const current = enabled.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? enabled.length - 1
          : (current + (event.key === "ArrowUp" ? -1 : 1) + enabled.length) %
          enabled.length;
    enabled[next]?.focus({ preventScroll: true });
    enabled[next]?.scrollIntoView({ block: "nearest" });
  };
  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-label={label}
        title={`${label}: ${display}`}
        className={`group flex min-h-12 w-full min-w-0 flex-col justify-center text-left outline-none ${triggerClassName}`}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          onOpenChange(true);
        }}
      >
        <span
          className={
            compact
              ? "sr-only"
              : "mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-gray-400"
          }
        >
          {label}
        </span>
        <span
          className={`flex w-full min-w-0 items-center gap-2 text-sm font-bold ${theme === "light" ? "text-gray-800" : "text-white"}`}
        >
          <span
            data-search-select-icon
            aria-hidden="true"
            className="shrink-0 text-gray-400"
          >
            {selected?.icon || icon}
          </span>
          <span data-search-select-value className="min-w-0 flex-1 truncate">
            <span data-search-select-value-label>{display}</span>
            {valueDescription && <span data-search-select-value-description>{valueDescription}</span>}
          </span>
          <ChevronDownIcon
            data-search-select-chevron
            width={16}
            height={16}
            aria-hidden="true"
            className="shrink-0 text-gray-400"
          />
        </span>
      </button>
      <DialogFrame
        open={open}
        onOpenChange={onOpenChange}
        title={label}
        description="Cari, telusuri daftar, lalu pilih satu opsi."
        contentId={dialogId}
        layer={layer}
        focusFallbackId={id}
        returnFocusRef={trigger}
        initialFocusRef={touch || !search ? heading : input}
        contentClassName={`${styles.dialog} ${theme === "light" ? styles.light : ""} ${contentClassName}`}
        closeClassName={styles.close}
        contentStyle={
          viewport
            ? ({
              "--search-select-viewport-height": `${viewport.height}px`,
              "--search-select-viewport-top": `${viewport.top}px`,
            } as CSSProperties)
            : undefined
        }
      >
        <header className={styles.header}>
          <h2 ref={heading} tabIndex={-1}>
            {label}
          </h2>
          <p className={styles.summary} role="status">
            {resultSummary}
          </p>
        </header>
        {search && (
          <div data-search-select-search className={styles.search}>
            <div className={styles.searchShell}>
              <MagnifyingGlassIcon className={styles.searchIcon} width={18} height={18} aria-hidden="true" />
              <Input
                ref={input}
                type="search"
                value={search.value}
                aria-label={search.label}
                aria-controls={listId}
                autoComplete="off"
                enterKeyHint="search"
                placeholder={search.placeholder}
                onChange={(event) => search.onChange(event.target.value)}
                onCompositionStart={() => search.onCompositionChange?.(true)}
                onCompositionEnd={() => search.onCompositionChange?.(false)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "Enter") {
                    event.preventDefault();
                    search.onSubmit?.();
                  }
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    focusOption(event.key === "ArrowUp");
                  }
                }}
              />
              {search.value && <button type="button" className={styles.clear} aria-label="Hapus pencarian" onClick={() => { search.onChange(""); input.current?.focus(); }}><Cross2Icon width={16} height={16} aria-hidden="true" /></button>}
            </div>
          </div>
        )}
        <div ref={scroller} data-search-select-scroll className={styles.body}>
          <div
            id={listId}
            ref={list}
            role="listbox"
            aria-busy={busy}
            aria-label={label}
            tabIndex={options.length && !enabledOptions.length ? 0 : undefined}
            className={styles.list}
            onKeyDown={navigate}
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                id={option.id}
                type="button"
                role="option"
                tabIndex={option.value === tabValue ? 0 : -1}
                onFocus={() => setActiveValue(option.value)}
                disabled={option.disabled}
                data-disabled={option.disabled ? "" : undefined}
                aria-selected={option.value === value}
                aria-describedby={
                  option.description
                    ? `${identity}-description-${index}`
                    : undefined
                }
                className={styles.option}
                onClick={() => {
                  onChange(option.value);
                  onOpenChange(false);
                }}
              >
                {option.icon && (
                  <span aria-hidden="true" className={styles.icon}>
                    {option.icon}
                  </span>
                )}
                <span className={styles.facts} data-search-select-facts>
                  <span className={styles.label} data-search-select-label>{option.label}</span>
                  {option.description && (
                    <span
                      id={`${identity}-description-${index}`}
                      data-search-select-description
                      className={styles.description}
                    >
                      {option.description}
                    </span>
                  )}
                </span>
                {option.value === value && (
                  <CheckIcon
                    width={16}
                    height={16}
                    aria-hidden="true"
                    className={styles.check}
                  />
                )}
              </button>
            ))}
          </div>
          {status && (
            <div data-search-select-status className={styles.status}>
              {status}
            </div>
          )}
          {footer && (
            <div data-search-select-footer className={styles.footer}>
              {footer}
            </div>
          )}
        </div>
      </DialogFrame>
    </>
  );
}

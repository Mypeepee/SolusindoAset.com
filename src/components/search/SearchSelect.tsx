"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import SearchSelectDialog from "./SearchSelectDialog";

type Search = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  onCompositionChange?: (composing: boolean) => void;
  onSubmit?: () => void;
};

/** Authored single-choice companion to the shared Home search pickers. */
export type SearchSelectProps = {
  theme?: "light" | "dark";
  compact?: boolean;
  layer?: number;
  disabled?: boolean;
  placeholder?: string;
  valueLabel?: string;
  valueDescription?: ReactNode;
  busy?: boolean;
  search?: Search;
  status?: ReactNode;
  footer?: ReactNode;
  triggerClassName?: string;
  contentClassName?: string;
  id?: string;
  label: string;
  value: string;
  options: {
    value: string;
    label: string;
    shortLabel?: string;
    id?: string;
    icon?: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
  }[];
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  presentation?: "popover" | "dialog";
  resultSummary?: ReactNode;
};

export default function SearchSelect(props: SearchSelectProps) {
  return props.presentation === "dialog" ? (
    <SearchSelectDialog {...props} />
  ) : (
    <SearchSelectPopover {...props} />
  );
}

function SearchSelectPopover({
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
  search,
  status,
  footer,
  triggerClassName = "",
  contentClassName = "",
  id,
}: SearchSelectProps) {
  const light = theme === "light";
  const selected = options.find((option) => option.value === value);
  const display =
    valueLabel || selected?.shortLabel || selected?.label || placeholder;
  const content = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const editingSearch = useRef(false);
  const descriptionPrefix = useId();
  const searchable = !!search;
  useEffect(() => {
    if (!open || !searchable || window.matchMedia("(pointer: coarse)").matches)
      return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => input.current?.focus());
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [open, searchable]);
  return (
    <Select.Root
      value={value}
      onValueChange={onChange}
      open={open}
      onOpenChange={(value) => {
        if (!value) editingSearch.current = false;
        onOpenChange(value);
      }}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        aria-haspopup={searchable ? "dialog" : "listbox"}
        aria-label={label}
        title={`${label}: ${display}`}
        className={
          "group flex min-h-12 w-full min-w-0 flex-col justify-center text-left outline-none " +
          triggerClassName
        }
      >
        <span
          className={
            compact
              ? "sr-only"
              : "mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 group-hover:text-primary"
          }
        >
          {label}
        </span>
        <span
          className={`flex w-full min-w-0 items-center gap-2 text-sm font-bold ${light ? "text-gray-800" : "text-white"}`}
        >
          <span
            data-search-select-icon
            className="shrink-0 text-gray-400"
            aria-hidden="true"
          >
            {selected?.icon || icon}
          </span>
          <span data-search-select-value className="min-w-0 flex-1 truncate">
            <Select.Value placeholder={placeholder}>{display}</Select.Value>
          </span>
          <Select.Icon
            data-search-select-chevron
            className="shrink-0 text-gray-400"
          >
            <ChevronDown size={16} />
          </Select.Icon>
        </span>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          ref={content}
          {...(searchable ? { role: "dialog", "aria-label": label } : {})}
          data-search-portal
          position="popper"
          sideOffset={16}
          collisionPadding={12}
          style={{ zIndex: layer }}
          className={`max-w-[calc(100vw-24px)] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border p-1.5 shadow-2xl ${light ? "border-gray-100 bg-white text-gray-800" : "border-white/10 bg-[#181c1b] text-white"} ${contentClassName}`}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onPointerDownCapture={
            searchable
              ? (event) => {
                  if (
                    (event.target as HTMLElement).closest(
                      '[role="option"],button',
                    )
                  )
                    editingSearch.current = false;
                }
              : undefined
          }
          onFocusCapture={
            searchable
              ? (event) => {
                  // Async options must not take focus from an in-progress search.
                  if (editingSearch.current && event.target !== input.current)
                    input.current?.focus({ preventScroll: true });
                }
              : undefined
          }
          onKeyDown={
            searchable
              ? (event) => {
                  if (event.key !== "Tab") return;
                  event.preventDefault();
                  event.stopPropagation();
                  editingSearch.current = false;
                  const targets = [
                    ...(content.current?.querySelectorAll<HTMLElement>(
                      'input:not(:disabled),button:not(:disabled),[role="option"]:not([data-disabled])',
                    ) || []),
                  ].filter((node) => node.getClientRects().length > 0);
                  const current = targets.indexOf(
                    document.activeElement as HTMLElement,
                  );
                  const next =
                    (current + (event.shiftKey ? -1 : 1) + targets.length) %
                    targets.length;
                  targets[next]?.focus();
                }
              : undefined
          }
        >
          {search && (
            <div data-search-select-search className="p-2">
              <Input
                ref={input}
                type="search"
                aria-label={search.label}
                placeholder={search.placeholder}
                value={search.value}
                onFocus={() => {
                  editingSearch.current = true;
                }}
                onChange={(event) => search.onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" || event.key === "Tab") return;
                  event.stopPropagation();
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "Enter") event.preventDefault();
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    editingSearch.current = false;
                    const items =
                      content.current?.querySelectorAll<HTMLElement>(
                        '[role="option"]:not([data-disabled])',
                      );
                    const index =
                      event.key === "ArrowUp" ? (items?.length || 0) - 1 : 0;
                    items?.[index]?.focus();
                  }
                }}
              />
            </div>
          )}
          <Select.Viewport
            {...(searchable ? { role: "listbox", "aria-label": label } : {})}
          >
            {options.map((option, index) => (
              <Select.Item
                id={option.id}
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                aria-describedby={
                  option.description
                    ? `${descriptionPrefix}-${index}`
                    : undefined
                }
                textValue={option.label}
                className={`relative flex min-h-11 cursor-pointer select-none items-center rounded-xl py-2 pl-3 pr-10 text-sm outline-none data-[disabled]:cursor-not-allowed ${light ? "data-[highlighted]:bg-emerald-50 data-[highlighted]:text-emerald-800" : "data-[highlighted]:bg-emerald-300/10 data-[highlighted]:text-emerald-200"}`}
              >
                {option.icon && (
                  <span
                    aria-hidden="true"
                    className={`mr-2.5 flex shrink-0 ${light ? "text-emerald-700" : "text-emerald-300"}`}
                  >
                    {option.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <Select.ItemText>{option.label}</Select.ItemText>
                  {option.description && (
                    <span
                      data-search-select-description
                      id={`${descriptionPrefix}-${index}`}
                      className="mt-1 block text-xs font-normal leading-relaxed opacity-75"
                    >
                      {option.description}
                    </span>
                  )}
                </span>
                <Select.ItemIndicator className="absolute right-3 text-emerald-300">
                  <Check size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          {status && <div data-search-select-status>{status}</div>}
          {footer && <div data-search-select-footer>{footer}</div>}
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

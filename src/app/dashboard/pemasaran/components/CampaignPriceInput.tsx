"use client";

import { useLayoutEffect, useRef } from "react";
import { Input, type InputProps } from "@/components/ui/input";

const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Keep numeric campaign data while preserving the caret in grouped prices. */
export default function CampaignPriceInput({
  value,
  onValueChange,
  ...props
}: Omit<InputProps, "value" | "onChange" | "type"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current === null || !input.current) return;
    const text = input.current.value;
    let position = 0,
      digits = 0;
    while (position < text.length && digits < caret.current) {
      if (/\d/.test(text[position])) digits++;
      position++;
    }
    input.current.setSelectionRange(position, position);
    caret.current = null;
  });
  return (
    <Input
      {...props}
      ref={input}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value === null ? "" : rupiah.format(value)}
      onChange={(event) => {
        const text = event.target.value;
        const raw = text.replace(/\D/g, "");
        const next = raw ? Number(raw) : null;
        if (next !== null && !Number.isSafeInteger(next)) return;
        caret.current = text
          .slice(0, event.target.selectionStart ?? text.length)
          .replace(/\D/g, "").length;
        onValueChange(next);
      }}
    />
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { primaryButton } from "./integration-ui";

function nationalNumber(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  return digits.replace(/^0+/, "").slice(0, 13);
}

export default function WhatsAppPhoneForm({ working, ready, onSubmit }: {
  working: boolean;
  ready: boolean;
  onSubmit: (phone: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const valid = /^[1-9]\d{5,12}$/.test(phone);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || !ready || working) return;
    onSubmit(`62${phone}`);
  };

  return (
    <form onSubmit={submit}>
      <label htmlFor="whatsapp-phone" className="text-xs font-medium text-slate-300">
        Nomor WhatsApp
      </label>
      <div className="mt-2 flex min-h-12 items-stretch overflow-hidden rounded-xl border border-white/15 bg-black/20 transition-colors focus-within:border-emerald-300/50 focus-within:ring-2 focus-within:ring-emerald-300/15">
        <span id="whatsapp-phone-prefix" className="flex shrink-0 items-center border-r border-white/10 bg-white/[0.025] px-3.5 text-sm font-medium tabular-nums text-slate-300">
          +62
        </span>
        <input
          id="whatsapp-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-describedby="whatsapp-phone-prefix whatsapp-phone-hint"
          required
          pattern="[1-9][0-9]{5,12}"
          title="Masukkan 6–13 digit, tanpa angka 0 atau kode negara di depan."
          value={phone}
          onChange={(event) => setPhone(nationalNumber(event.target.value))}
          disabled={working}
          placeholder="81234567890"
          className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm tabular-nums text-white outline-none placeholder:text-slate-600 disabled:opacity-50"
        />
      </div>
      <p id="whatsapp-phone-hint" className="mt-2 text-[11px] leading-5 text-slate-500">
        Tanpa angka 0 atau kode negara di depan. Contoh: 81234567890.
      </p>
      <button type="submit" disabled={working || !ready || !valid} className={`${primaryButton} mt-4 w-full`}>
        {working ? <Loader2 size={16} className="motion-safe:animate-spin" /> : null}
        Dapatkan kode
        <ArrowRight size={16} />
      </button>
    </form>
  );
}

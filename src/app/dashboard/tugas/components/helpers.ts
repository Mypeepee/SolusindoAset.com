"use client";

import { useState, useRef, useEffect } from "react";

export function fIDR(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function openWA(phone: string, name: string, msg?: string) {
  const n = phone.replace(/\D/g, "").replace(/^0/, "62");
  const m = msg ?? `Halo ${name}, saya dari Solusindo Aset. Ada info properti menarik yang ingin saya sampaikan 🏡`;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(m)}`, "_blank");
}

export function useCountUp(target: number, dur = 700) {
  const [val, setVal] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const from = ref.current; ref.current = target;
    if (from === target) { setVal(target); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setVal(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return val;
}

export function cn(...classes: Array<string | undefined | null | false>) {
    return classes.filter(Boolean).join(" ");
  }
  
  export function formatIDR(n: number) {
    const v = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(v);
  }
  
  export function compactNumber(n: number) {
    const v = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("id-ID", { notation: "compact" }).format(v);
  }
  
  export function formatDayLong(d = new Date()) {
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  
  export function safePhoneToWa(phone?: string) {
    if (!phone) return "";
    const digits = phone.replace(/[^0-9]/g, "");
    if (!digits) return "";
    // wa.me expects no "+"
    return `https://wa.me/${digits.startsWith("0") ? "62" + digits.slice(1) : digits}`;
  }
  
  export function humanTime(iso?: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  
  export function humanDateShort(iso?: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  }
  
  export function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
  }
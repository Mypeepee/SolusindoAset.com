export function toNumber(value: unknown): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  
  export function formatCurrency(value: unknown): string {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(toNumber(value));
  }
  
  export function formatDateID(value: Date | string | null | undefined): string {
    if (!value) return "-";
  
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
  
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }
  
  export function isIncomeKind(value: string): boolean {
    const normalized = String(value || "").toLowerCase();
    return (
      normalized.includes("masuk") ||
      normalized.includes("pemasukan") ||
      normalized.includes("income")
    );
  }
import { jakartaDayStart } from "./investor-deals";

/** Compare calendar dates in WIB, so today's auctions never become yesterday by hour. */
export function investorAuctionCountdown(
  value: string | null,
  now = new Date(),
) {
  if (!value || !Number.isFinite(now.getTime())) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value);
  if (!Number.isFinite(date.getTime())) return null;
  const days = Math.round(
    (jakartaDayStart(date) - jakartaDayStart(now)) / 86_400_000,
  );
  return {
    label: days === 0
      ? "Hari ini"
      : `${Math.abs(days).toLocaleString("id-ID")} hari ${days > 0 ? "lagi" : "lalu"}`,
    state: days === 0 ? "today" : days > 0 ? "upcoming" : "past",
  };
}

/** Discount colour describes savings only. Negative values are never a great deal. */
export function investorDiscountTone(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "unknown";
  if (value < 0) return "above";
  if (value === 0) return "zero";
  if (value < 30) return "subtle";
  if (value <= 50) return "good";
  return "exceptional";
}

/** Allowlist the database enum, preventing certificate numbers/free text entering cards. */
export function investorCertificateLabel(
  value: string | null | undefined,
): string | null {
  const labels: Record<string, string> = {
    SHM: "SHM",
    HGB: "HGB",
    SHGB: "SHGB",
    HGU: "HGU",
    HP: "Hak Pakai",
    STRATA_TITLE: "Strata Title",
    PPJB: "PPJB",
    AJB: "AJB",
    LAINNYA: "Lainnya",
  };
  return value ? (labels[value.trim().toUpperCase()] ?? null) : null;
}

/** Three numeric targets keep 44px pagination controls within a 288px content width. */
export function compactInvestorPages(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 3) return Array.from({ length: total }, (_, i) => i + 1);
  const middle = Math.max(2, Math.min(current, total - 1));
  const numbers = [1, middle, total];
  return numbers.flatMap((page, i): (number | "...")[] =>
    i > 0 && page - numbers[i - 1] > 1 ? ["...", page] : [page],
  );
}

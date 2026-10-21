export type StockNotificationStatus = "pending" | "sending" | "retry" | "sent" | "failed" | "uncertain";
export type AssetCheck = { id: string; contact: string; asset_id: string; location: string;
  auction_at: string; status: "pending"; created_at: number;
  notification_status: StockNotificationStatus | null; notification_recipient: string | null;
  notification_attempts: number; notification_sent_at: number | null; notification_error: string | null };
export type AssetCheckQueue = { total: number; items: AssetCheck[] };

// Project a fixed operational DTO; no history or qualification leaves the BFF.
export function assetCheckQueue(value: unknown): AssetCheckQueue | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.total !== "number" || !Number.isSafeInteger(data.total) || data.total < 0 || !Array.isArray(data.items) || data.items.length > 100) return null;
  const items: AssetCheck[] = [];
  for (const item of data.items) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^[a-f0-9-]{36}$/i.test(item.id) ||
      typeof item.contact !== "string" || !/^(?:[1-9]\d{6,14}|lid:\d{1,30})$/.test(item.contact) ||
      typeof item.asset_id !== "string" || !/^[A-Z0-9][A-Z0-9-]{0,49}$/i.test(item.asset_id) ||
      typeof item.location !== "string" || item.location.length > 240 || typeof item.auction_at !== "string" || !Number.isFinite(Date.parse(item.auction_at)) ||
      item.status !== "pending" || typeof item.created_at !== "number" || !Number.isSafeInteger(item.created_at)) return null;
    if (item.notification_status != null && !["pending", "sending", "retry", "sent", "failed", "uncertain"].includes(item.notification_status) ||
      item.notification_recipient != null && (typeof item.notification_recipient !== "string" || !/^[1-9]\d{6,14}$/.test(item.notification_recipient)) ||
      item.notification_attempts != null && (!Number.isSafeInteger(item.notification_attempts) || item.notification_attempts < 0) ||
      item.notification_sent_at != null && (!Number.isSafeInteger(item.notification_sent_at) || item.notification_sent_at < 0)) return null;
    if (item.notification_error != null && (typeof item.notification_error !== "string" || !/^[A-Z][A-Z0-9_]{0,79}$/.test(item.notification_error))) return null;
    items.push({ id: item.id, contact: item.contact, asset_id: item.asset_id, location: item.location,
      auction_at: item.auction_at, status: "pending", created_at: item.created_at,
      notification_status: item.notification_status ?? null, notification_recipient: item.notification_recipient ?? null,
      notification_attempts: item.notification_attempts ?? 0, notification_sent_at: item.notification_sent_at ?? null, notification_error: item.notification_error ?? null });
  }
  return { total: data.total, items };
}

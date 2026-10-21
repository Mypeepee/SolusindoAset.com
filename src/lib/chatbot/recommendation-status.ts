import { RECOMMENDATION_BATCH_SIZE } from "../../../backend/whatsapp/services/recommendation_policy.js";
export type RecommendationStatus = { configured: false } | {
  configured: true; enabled: boolean; pending: number; delivered: number; uncertain: number; awaiting_ack: number;
  initialized_at: number | null; last_scan_at: number | null; last_sent_at: number | null; last_error: string | null;
  max_per_message: number; interval_hours: number; hours: string;
  daily_day: string | null; daily_completed_at: number | null; daily_checked: number; daily_matched: number;
  daily_time: string; next_daily_at: number | null; whatsapp_connected: boolean; whatsapp_status: string;
  needs_review: { id: string; contact: string; created_at: number; property_ids: string[] }[];
};
export function recommendationStatus(v: any): RecommendationStatus | null {
  if (!v || typeof v !== "object") return null;
  if (v.configured === false) return { configured: false };
  const daily = { daily_day: v.daily_day ?? null, daily_completed_at: v.daily_completed_at ?? null, daily_checked: v.daily_checked ?? 0, daily_matched: v.daily_matched ?? 0,
    daily_time: v.daily_time ?? "08.00 WIB", next_daily_at: v.next_daily_at ?? null, whatsapp_connected: v.whatsapp_connected ?? false, whatsapp_status: v.whatsapp_status ?? "stopped" };
  if (daily.daily_day !== null && (typeof daily.daily_day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(daily.daily_day)) ||
    [daily.daily_completed_at, daily.next_daily_at].some(n => n !== null && (!Number.isSafeInteger(n) || n <= 0)) ||
    [daily.daily_checked, daily.daily_matched].some(n => !Number.isSafeInteger(n) || n < 0) || daily.daily_matched > daily.daily_checked ||
    daily.daily_time !== "08.00 WIB" || typeof daily.whatsapp_connected !== "boolean" || typeof daily.whatsapp_status !== "string" || !/^[a-z_]{1,40}$/.test(daily.whatsapp_status)) return null;
  if (v.configured !== true || typeof v.enabled !== "boolean" ||
    ["pending", "delivered", "uncertain", "awaiting_ack"].some(k => !Number.isSafeInteger(v[k]) || v[k] < 0) ||
    ["initialized_at", "last_scan_at", "last_sent_at"].some(k => v[k] !== null && (!Number.isSafeInteger(v[k]) || v[k] <= 0)) ||
    v.last_error !== null && (typeof v.last_error !== "string" || !/^[A-Z0-9_]{1,80}$/.test(v.last_error)) ||
    v.max_per_message !== RECOMMENDATION_BATCH_SIZE || v.interval_hours !== 24 || v.hours !== "08.00–20.00 WIB" ||
    !Array.isArray(v.needs_review) || v.needs_review.length > 20 || v.needs_review.some((r: any) => !r || !/^[a-f0-9-]{36}$/.test(r.id) || !/^[1-9]\d{6,14}$/.test(r.contact) ||
      !Number.isSafeInteger(r.created_at) || r.created_at <= 0 || !Array.isArray(r.property_ids) || !r.property_ids.length || r.property_ids.length > RECOMMENDATION_BATCH_SIZE || r.property_ids.some((id: any) => typeof id !== "string" || !/^[1-9]\d{0,17}$/.test(id)))) return null;
  const { configured, enabled, pending, delivered, uncertain, awaiting_ack, initialized_at, last_scan_at, last_sent_at, last_error, max_per_message, interval_hours, hours } = v;
  return { configured, enabled, pending, delivered, uncertain, awaiting_ack, initialized_at, last_scan_at, last_sent_at, last_error, max_per_message, interval_hours, hours,
    ...daily, needs_review: v.needs_review.map(({ id, contact, created_at, property_ids }: any) => ({ id, contact, created_at, property_ids })) };
}
export function recommendationMutation(v: any) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  if (Object.keys(v).join(",") === "enabled" && typeof v.enabled === "boolean") return { enabled: v.enabled };
  if (Object.keys(v).sort().join(",") === "delivery_id,resolution" && typeof v.delivery_id === "string" && /^[a-f0-9-]{36}$/.test(v.delivery_id) && ["delivered", "skipped"].includes(v.resolution)) return { delivery_id: v.delivery_id, resolution: v.resolution as "delivered" | "skipped" };
  return null;
}

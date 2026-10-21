import { validClientCheck } from "../../../backend/whatsapp/services/client_capture_status.js";

export type ClientProbe = { checked_at: number; id_agent: "AG108" } & (
  { status: "passed"; checks: { write: true; read: true; update: true; deduplication: true; cleanup: true } } |
  { status: "failed"; error: string });
export type ClientBackendStatus = { configured: boolean; pending: number | null; retrying: number | null; last_saved_at: number | null; probe: ClientProbe | null };
export type ClientCaptureStatus = {
  backend: ClientBackendStatus | null;
  crm: { available: boolean; count: number | null; last: { id: string; name: string; phone_masked: string; saved_at: string } | null };
  can_open_crm: boolean;
};
const count = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const timestamp = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
export function clientProbe(value: unknown): ClientProbe | null {
  if (!validClientCheck(value)) return null;
  const v = value as ClientProbe;
  return v.status === "passed" ? { status: "passed", checked_at: v.checked_at, id_agent: "AG108",
    checks: { write: true, read: true, update: true, deduplication: true, cleanup: true } } :
    { status: "failed", checked_at: v.checked_at, id_agent: "AG108", error: v.error };
}
export function clientBackendStatus(value: unknown): ClientBackendStatus | null {
  if (!value || typeof value !== "object") return null;
  const v = value as ClientBackendStatus;
  if (typeof v.configured !== "boolean" || (v.configured ? !count(v.pending) || !count(v.retrying) || Number(v.retrying) > Number(v.pending) : v.pending !== null || v.retrying !== null) ||
    v.last_saved_at !== null && !timestamp(v.last_saved_at) || v.probe !== null && !clientProbe(v.probe)) return null;
  return { configured: v.configured, pending: v.pending, retrying: v.retrying, last_saved_at: v.last_saved_at, probe: v.probe ? clientProbe(v.probe) : null };
}
export function clientCaptureStatus(value: unknown): ClientCaptureStatus | null {
  if (!value || typeof value !== "object") return null;
  const v = value as ClientCaptureStatus;
  if (typeof v.can_open_crm !== "boolean" || v.backend !== null && !clientBackendStatus(v.backend) || !v.crm || typeof v.crm.available !== "boolean" ||
    (v.crm.available ? !count(v.crm.count) : v.crm.count !== null) ||
    v.crm.last !== null && (!/^KL\d+$/.test(v.crm.last?.id) || typeof v.crm.last?.name !== "string" || typeof v.crm.last?.phone_masked !== "string" || !Number.isFinite(Date.parse(v.crm.last?.saved_at)))) return null;
  return v;
}

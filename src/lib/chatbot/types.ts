export type ConnectionState =
  | "connecting" | "awaiting_scan" | "pairing" | "requesting_code" | "awaiting_code"
  | "connected" | "reconnecting" | "logged_out" | "replaced" | "bad_session"
  | "forbidden" | "auth_error" | "connection_failed" | "stopped";

export interface ConnectionStatus {
  status: ConnectionState;
  connected: boolean;
  bot_accepting?: boolean | null;
  phone: string | null;
  qr_ready: boolean;
  pairing_code_ready: boolean;
  received: number;
  sent: number;
  handovers: number;
  last_message_at: number | null;
}

export interface PairingData { qr: string | null; code: string | null }
export type ConnectionAction = "connect" | "pair_again" | "pairing_code" | "disconnect";

export const needsNewSession = (state?: string) =>
  ["logged_out", "replaced", "bad_session", "forbidden", "auth_error"].includes(state || "");

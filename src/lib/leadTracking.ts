// src/lib/leadTracking.ts
// Client-side helper untuk capture lead saat user klik WA / Telepon / Survei
// di detail listing properti. Tidak ada popup — silent tracking.

const SESSION_KEY = "kosku_lead_session";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        "sess_" +
        Math.random().toString(36).slice(2, 10) +
        Date.now().toString(36);
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export interface TrackLeadClickInput {
  id_property: string | number | bigint;
  id_agent?: string;
  source: "whatsapp" | "telepon" | "survei";
}

export interface TrackLeadClickResult {
  ok: boolean;
  id_lead?: string;
  deduped?: boolean;
  error?: string;
}

export async function trackLeadClick(
  input: TrackLeadClickInput,
): Promise<TrackLeadClickResult> {
  if (!input.id_property || !input.id_agent) {
    return { ok: false, error: "missing id_property / id_agent" };
  }

  try {
    const res = await fetch("/api/leads/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_property: input.id_property.toString(),
        id_agent: input.id_agent,
        source: input.source,
        session_id: getSessionId(),
        referrer: typeof document !== "undefined" ? document.referrer : "",
      }),
      // jangan delay redirect kalau jaringan lambat
      keepalive: true,
    });

    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return (await res.json()) as TrackLeadClickResult;
  } catch (err) {
    console.error("trackLeadClick error:", err);
    return { ok: false, error: String(err) };
  }
}

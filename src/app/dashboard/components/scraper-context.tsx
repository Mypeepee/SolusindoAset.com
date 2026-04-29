"use client";

import {
  createContext, useContext, useState, useRef, useEffect,
  useCallback, ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScraperStatus = "idle" | "running" | "done" | "error";
export type CatState = { status: ScraperStatus; saved: number; skip: number };
export type LogEntry  = {
  id: number; ts: string;
  type: "info" | "success" | "warn" | "error";
  msg: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const KATEGORI_LIST = [
  "Rumah", "Apartemen", "Ruko", "Tanah",
  "Gudang", "Hotel dan Villa", "Toko", "Pabrik",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _lid = 1;
const nowTs = () =>
  new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

const initCats = (): Record<string, CatState> =>
  Object.fromEntries(KATEGORI_LIST.map((k) => [k, { status: "idle" as ScraperStatus, saved: 0, skip: 0 }]));

// ─── Context interface ────────────────────────────────────────────────────────

interface ScraperContextValue {
  catStates:   Record<string, CatState>;
  logs:        LogEntry[];
  anyRunning:  boolean;
  totalSaved:  number;
  totalSkip:   number;
  runScraper:  (targets: string[] | null, agentId: string, maxPages: number | "") => Promise<void>;
  stopScraper: (kategori?: string) => Promise<void>;
  resetAll:    () => void;
  pushLog:     (entry: Omit<LogEntry, "id" | "ts">) => void;
  clearLogs:   () => void;
}

const ScraperContext = createContext<ScraperContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ScraperProvider({ children }: { children: ReactNode }) {
  const [catStates, setCatStates] = useState<Record<string, CatState>>(initCats);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    setLogs([{ id: _lid++, ts: nowTs(), type: "info", msg: "AI Hub siap. Semua sistem online." }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sseRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // ── Log helpers ──────────────────────────────────────────────────────────
  const pushLog = useCallback((entry: Omit<LogEntry, "id" | "ts">) =>
    setLogs((p) => [...p.slice(-199), { ...entry, id: _lid++, ts: nowTs() }]), []);

  const clearLogs = useCallback(() =>
    setLogs([{ id: _lid++, ts: nowTs(), type: "info", msg: "Log dibersihkan." }]), []);

  // ── SSE reader — tidak dibatalkan saat navigasi ──────────────────────────
  const readSSEStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      sseRef.current = reader;
      const decoder  = new TextDecoder();
      let buf = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.replace(/^data:\s*/, "").trim();
            if (!line) continue;
            try {
              const ev      = JSON.parse(line);
              const logType: LogEntry["type"] =
                ev.level === "success" ? "success"
                : ev.level === "warn"  ? "warn"
                : ev.level === "error" ? "error"
                : "info";
              if (ev.msg) pushLog({ type: logType, msg: ev.msg });

              if (ev.kategori) {
                setCatStates((prev) => {
                  const cur = prev[ev.kategori] ?? { status: "idle" as ScraperStatus, saved: 0, skip: 0 };
                  return {
                    ...prev,
                    [ev.kategori]: {
                      status: ev.done
                        ? (ev.level === "error" ? "error" : "done")
                        : cur.status === "idle" ? "running" : cur.status,
                      saved: typeof ev.saved === "number" ? ev.saved : cur.saved,
                      skip:  typeof ev.skip  === "number" ? ev.skip  : cur.skip,
                    },
                  };
                });
              }
            } catch {}
          }
        }
      } catch (e: any) {
        if (e?.name !== "AbortError")
          pushLog({ type: "warn", msg: "Koneksi SSE terputus." });
      } finally {
        sseRef.current = null;
      }
    },
    [pushLog],
  );

  // ── Reconnect saat provider mount (misal page refresh) ──────────────────
  useEffect(() => {
    fetch("/api/ai-hub/scraper")
      .then((r) => r.json())
      .then(async (status: {
        anyRunning: boolean;
        categories: Record<string, { running: boolean; saved: number; skip: number }>;
      }) => {
        if (!status.anyRunning) return;

        setCatStates((prev) => {
          const next = { ...prev };
          for (const [k, s] of Object.entries(status.categories)) {
            if (next[k]) next[k] = { status: s.running ? "running" : next[k].status, saved: s.saved, skip: s.skip };
          }
          return next;
        });

        const running = Object.entries(status.categories)
          .filter(([, s]) => s.running)
          .map(([k]) => k);
        setLogs([{ id: _lid++, ts: nowTs(), type: "info",
          msg: `═══ Menyambung — scraper berjalan: ${running.join(", ")} ═══` }]);

        const res = await fetch("/api/ai-hub/scraper?stream=1");
        if (!res.ok || !res.body) return;
        await readSSEStream(res.body.getReader());
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start ────────────────────────────────────────────────────────────────
  const runScraper = useCallback(
    async (targets: string[] | null, agentId: string, maxPages: number | "") => {
      const body: Record<string, unknown> = {
        agentId,
        maxPages: maxPages === "" ? 0 : Number(maxPages),
        startPage: 1,
      };
      if (targets) body.kategori = targets;
      else         body.all      = true;

      if (!targets) {
        setCatStates(initCats());
        setLogs([{ id: _lid++, ts: nowTs(), type: "info", msg: "═══ Scraping semua kategori dimulai ═══" }]);
      } else {
        setCatStates((prev) => {
          const next = { ...prev };
          for (const k of targets) next[k] = { status: "running", saved: 0, skip: 0 };
          return next;
        });
      }

      try {
        const res = await fetch("/api/ai-hub/scraper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok || !res.body) {
          const e = await res.json().catch(() => ({})) as any;
          pushLog({ type: "error", msg: e.error || `Server error: ${res.status}` });
          return;
        }
        await readSSEStream(res.body.getReader());
      } catch (e: any) {
        if (e?.name !== "AbortError")
          pushLog({ type: "error", msg: `Gagal memulai: ${e?.message || e}` });
      }
    },
    [pushLog, readSSEStream],
  );

  // ── Stop ─────────────────────────────────────────────────────────────────
  const stopScraper = useCallback(async (kategori?: string) => {
    try { sseRef.current?.cancel(); sseRef.current = null; } catch {}
    const body = kategori ? { kategori } : { all: true };
    await fetch("/api/ai-hub/scraper", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    if (kategori) {
      setCatStates((prev) => ({ ...prev, [kategori]: { ...prev[kategori], status: "idle" } }));
    } else {
      setCatStates((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([k, v]) => [k, { ...v, status: "idle" as ScraperStatus }])
        )
      );
    }
    pushLog({ type: "warn", msg: kategori ? `Scraper ${kategori} dihentikan.` : "Semua scraper dihentikan." });
  }, [pushLog]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    setCatStates(initCats());
    setLogs([{ id: _lid++, ts: nowTs(), type: "info", msg: "Scraper direset." }]);
  }, []);

  const anyRunning = Object.values(catStates).some((c)  => c.status === "running");
  const totalSaved = Object.values(catStates).reduce((s, c) => s + c.saved, 0);
  const totalSkip  = Object.values(catStates).reduce((s, c) => s + c.skip,  0);

  return (
    <ScraperContext.Provider value={{
      catStates, logs, anyRunning, totalSaved, totalSkip,
      runScraper, stopScraper, resetAll, pushLog, clearLogs,
    }}>
      {children}
    </ScraperContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useScraper() {
  const ctx = useContext(ScraperContext);
  if (!ctx) throw new Error("useScraper must be used inside ScraperProvider");
  return ctx;
}

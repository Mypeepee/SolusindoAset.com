import type { InvestorFeed } from "./investor-deals";

/** Versioned, owner-scoped snapshots. Every display still revalidates authorization. */
const POLICY = "kelurahan-v3";
const MAX_AGE = 60_000;
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Entry = { key: string; data: InvestorFeed; savedAt: number };
const browserStorage = () => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};
export class InvestorFeedCache {
  private entries = new Map<string, Entry>();
  constructor(
    private storage: () => StoragePort | null = browserStorage,
    private now: () => number = Date.now,
  ) {}
  private storageKey(owner: string) {
    return `solusindo:investor:feed:${POLICY}:${owner}`;
  }
  read(owner: string, key: string): InvestorFeed | null {
    const memoryKey = `${owner}\0${key}`;
    let entry = this.entries.get(memoryKey);
    if (!entry) {
      try {
        const stored = JSON.parse(
          this.storage()?.getItem(this.storageKey(owner)) || "null",
        );
        if (stored?.key === key) entry = stored;
      } catch {
        /* Storage can be unavailable or full; network loading still works. */
      }
    }
    if (
      !entry ||
      !Number.isFinite(entry.savedAt) ||
      entry.savedAt > this.now() ||
      this.now() - entry.savedAt >= MAX_AGE ||
      !Array.isArray(entry.data?.items) ||
      !entry.data?.summary ||
      !Array.isArray(entry.data?.cities) ||
      typeof entry.data?.total !== "number"
    ) {
      this.entries.delete(memoryKey);
      return null;
    }
    // Older district-based evidence must never reappear from a local snapshot.
    if (
      entry.data.items.some(
        (item) =>
          !item ||
          typeof item.id !== "string" ||
          item.benchmark?.scope === "KECAMATAN",
      )
    )
      return null;
    this.entries.delete(memoryKey);
    this.entries.set(memoryKey, entry);
    while (this.entries.size > 8)
      this.entries.delete(this.entries.keys().next().value!);
    return entry.data;
  }
  write(owner: string, key: string, data: InvestorFeed) {
    const entry = { key, data, savedAt: this.now() };
    const memoryKey = `${owner}\0${key}`;
    this.entries.delete(memoryKey);
    this.entries.set(memoryKey, entry);
    while (this.entries.size > 8)
      this.entries.delete(this.entries.keys().next().value!);
    try {
      const serialized = JSON.stringify(entry);
      // Persist only the last response, with a strict size bound.
      if (serialized.length <= 750_000)
        this.storage()?.setItem(this.storageKey(owner), serialized);
      else this.storage()?.removeItem(this.storageKey(owner));
    } catch {
      /* A quota failure never turns a successful feed into an error. */
    }
  }
  clear(owner: string) {
    for (const key of this.entries.keys())
      if (key.startsWith(`${owner}\0`)) this.entries.delete(key);
    try {
      this.storage()?.removeItem(this.storageKey(owner));
    } catch {
      /* Optional storage. */
    }
  }
}
export const investorFeedCache = new InvestorFeedCache();

type Flight = {
  promise: Promise<InvestorFeed>;
  controller: AbortController;
  consumers: number;
  abortTimer?: ReturnType<typeof setTimeout>;
};
const flights = new Map<string, Flight>();
/** StrictMode/subscriber deduplication, while obsolete searches still abort. */
export function acquireInvestorFeed(
  owner: string,
  key: string,
  force: boolean,
  load: (signal: AbortSignal) => Promise<InvestorFeed>,
) {
  const flightKey = `${POLICY}:${owner}:${key}:${force ? "refresh" : "read"}`;
  let flight = flights.get(flightKey);
  if (!flight || flight.controller.signal.aborted) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const next: Flight = {
      controller,
      consumers: 0,
      promise: Promise.resolve()
        .then(() => load(controller.signal))
        .finally(() => {
          clearTimeout(timeout);
          if (flights.get(flightKey) === next) flights.delete(flightKey);
        }),
    };
    flight = next;
    flights.set(flightKey, flight);
  }
  if (flight.abortTimer) clearTimeout(flight.abortTimer);
  flight.consumers++;
  const current = flight;
  let released = false;
  return {
    promise: current.promise,
    release: () => {
      if (released) return;
      released = true;
      current.consumers--;
      if (current.consumers === 0)
        current.abortTimer = setTimeout(() => {
          if (current.consumers === 0 && flights.get(flightKey) === current)
            current.controller.abort();
        }, 0);
    },
  };
}

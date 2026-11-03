"use client";

import { useEffect, useRef, useState } from "react";
import type { Data } from "./ui";

type Month = Data["planner"];
type Entry = { value: Month; fetchedAt: number };
const FRESH_FOR = 60_000;
const MAX_MONTHS = 6;

// Scoped to this mounted OWNER workspace. A full refresh or mutation replaces
// the seed and invalidates every cached month, including previously empty ones.
export default function usePlannerMonth(
  month: string,
  seed: Month | undefined,
  read: (month: string, signal: AbortSignal) => Promise<Month>,
) {
  const cache = useRef(new Map<string, Entry>());
  const source = useRef<Month>();
  const sequence = useRef(0);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    month: string;
    value?: Month;
    error: string;
  }>({ month, error: "" });

  useEffect(() => {
    if (!seed) return;
    if (source.current !== seed) {
      cache.current.clear();
      cache.current.set(seed.month, { value: seed, fetchedAt: Date.now() });
      source.current = seed;
    }
    const request = ++sequence.current;
    const cached = cache.current.get(month);
    if (cached && Date.now() - cached.fetchedAt < FRESH_FOR) {
      setState({ month, value: cached.value, error: "" });
      return;
    }
    const controller = new AbortController();
    setState({ month, error: "" });
    void read(month, controller.signal)
      .then((value) => {
        if (controller.signal.aborted || request !== sequence.current) return;
        cache.current.delete(month);
        cache.current.set(month, { value, fetchedAt: Date.now() });
        while (cache.current.size > MAX_MONTHS)
          cache.current.delete(cache.current.keys().next().value!);
        setState({ month, value, error: "" });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted || request !== sequence.current) return;
        setState({ month, error: error.message });
      });
    return () => controller.abort();
  }, [month, seed, read, retry]);

  // Read a fresh cached month during render so returning to it never flashes
  // the previous month or a skeleton while waiting for the effect.
  const entry = source.current === seed ? cache.current.get(month) : undefined;
  const fresh = entry && Date.now() - entry.fetchedAt < FRESH_FOR;
  const value = fresh
    ? entry.value
    : source.current !== seed && seed?.month === month
      ? seed
      : state.month === month
        ? state.value
        : undefined;
  const error = state.month === month ? state.error : "";
  return {
    value,
    error,
    loading: !!seed && !value && !error,
    reload: () => {
      cache.current.delete(month);
      setState({ month, error: "" });
      setRetry((value) => value + 1);
    },
  };
}

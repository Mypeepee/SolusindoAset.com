"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { readInvestorSearch, writeInvestorSearch } from "@/lib/investor-search";
import {
  DEFAULT_DEAL_THRESHOLD,
  isolateTransactionFilters,
  type DealFilters,
} from "@/lib/investor-deals";
const percent = (value: string | null) =>
  value === null
    ? DEFAULT_DEAL_THRESHOLD
    : Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
function readState(params: URLSearchParams) {
  const city = params.get("city"),
    sort = params.get("sort");
  return {
    filters: isolateTransactionFilters({
      ...readInvestorSearch(params),
      transactionType: params.get("transaction") === "SEWA" ? "SEWA" : "BELI",
      listingCategory: ["PRIMARY", "LELANG", "SECONDARY"].includes(
        params.get("category") || "",
      )
        ? params.get("category")
        : "ALL",
      dataState: ["all", "unverified"].includes(params.get("data") || "")
        ? params.get("data")
        : params.get("data") === "deals"
          ? "deals"
          : "all",
      city: city === "all" ? "" : city || "Kota Surabaya",
      query: (params.get("q") || "").slice(0, 150),
      minSpread: percent(params.get("spread")),
      minDrop: percent(params.get("drop")),
      sort: ["spread", "drop", "price"].includes(sort || "") ? sort : "score",
      savedOnly: params.get("saved") === "1",
      upcomingOnly: params.get("upcoming") === "1",
    } as DealFilters),
    page: Math.max(
      1,
      Math.min(1_000_000, Math.floor(Number(params.get("page")) || 1)),
    ),
  };
}
const validIds = (raw: string | null): string[] => {
  const value: unknown = JSON.parse(raw || "[]");
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string =>
              typeof id === "string" && /^\d{1,20}$/.test(id),
          ),
        ),
      ].slice(0, 500)
    : [];
};
export function useInvestorState(bookmarkScope: string) {
  const params = useSearchParams();
  const [state, setState] = useState(() =>
    readState(new URLSearchParams(params.toString())),
  );
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [bookmarksReady, setBookmarksReady] = useState(false);
  const storageKey = `solusindo:investor:bookmarks:v2:${bookmarkScope}`;
  useEffect(() => {
    const restore = () => {
      try {
        setSavedIds(validIds(localStorage.getItem(storageKey)));
      } catch {
        setSavedIds([]);
      }
      setBookmarksReady(true);
    };
    restore();
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) restore();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storageKey]);
  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    const values: Record<string, string> = {
      transaction: state.filters.transactionType === "SEWA" ? "SEWA" : "",
      category:
        state.filters.listingCategory && state.filters.listingCategory !== "ALL"
          ? state.filters.listingCategory
          : "",
      data: state.filters.dataState || "all",
      city: state.filters.city || "all",
      q: state.filters.query,
      spread:
        state.filters.minSpread === DEFAULT_DEAL_THRESHOLD
          ? ""
          : String(state.filters.minSpread),
      drop:
        state.filters.minDrop === DEFAULT_DEAL_THRESHOLD
          ? ""
          : String(state.filters.minDrop),
      sort: state.filters.sort === "score" ? "" : state.filters.sort,
      view: "",
      saved: state.filters.savedOnly ? "1" : "",
      upcoming: state.filters.upcomingOnly ? "1" : "",
      page: state.page > 1 ? String(state.page) : "",
    };
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    writeInvestorSearch(next, state.filters);
    const query = next.toString(),
      target = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    if (
      target !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      window.history.replaceState(null, "", target);
  }, [state]);
  useEffect(() => {
    const restore = () =>
      setState(readState(new URLSearchParams(window.location.search)));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const updateFilters = useCallback(
    (next: Partial<DealFilters>) =>
      setState((previous) => ({
        ...previous,
        filters: isolateTransactionFilters({ ...previous.filters, ...next }),
        page: 1,
      })),
    [],
  );
  const toggleBookmark = (id: string) => {
    const wasSaved = savedIds.includes(id);
    if (!wasSaved && savedIds.length >= 500) {
      toast.info("Maksimal 500 bookmark di browser ini.");
      return;
    }
    const next = wasSaved
      ? savedIds.filter((value) => value !== id)
      : [...savedIds, id];
    setSavedIds(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      toast.success(
        wasSaved ? "Bookmark dihapus." : "Properti disimpan di browser ini.",
      );
    } catch {
      toast.info(
        "Bookmark disimpan sementara. Penyimpanan browser tidak tersedia.",
      );
    }
  };
  return {
    ...state,
    savedIds,
    bookmarksReady,
    updateFilters,
    toggleBookmark,
    setPage: (page: number) => setState((previous) => ({ ...previous, page })),
  };
}

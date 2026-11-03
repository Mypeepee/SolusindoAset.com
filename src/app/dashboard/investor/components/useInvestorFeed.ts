"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DealFilters, InvestorFeed } from "@/lib/investor-deals";
import {
  acquireInvestorFeed,
  investorFeedCache,
} from "@/lib/investor-feed-cache";
import { writeInvestorSearch } from "@/lib/investor-search";

export function useInvestorFeed(
  filters: DealFilters,
  page: number,
  savedIds: string[],
  ready: boolean,
  ownerScope: string,
) {
  const [query, setQuery] = useState(filters.query);
  const [composing, setComposing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    ownerScope: string;
    data: InvestorFeed;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{
    key: string;
    ownerScope: string;
    message: string;
    status: number;
  } | null>(null);
  const forceNext = useRef(false);
  useEffect(() => {
    if (composing) return;
    if (!filters.query) {
      setQuery("");
      return;
    }
    const timeout = setTimeout(() => setQuery(filters.query), 300);
    return () => clearTimeout(timeout);
  }, [filters.query, composing]);
  const requestKey = useMemo(() => {
    const params = new URLSearchParams({
      transaction: filters.transactionType || "BELI",
      category: filters.listingCategory || "ALL",
      data: filters.dataState || "all",
      city: filters.city,
      q: query,
      spread: String(filters.minSpread),
      drop: String(filters.minDrop),
      sort: filters.sort,
      page: String(page),
      view: "grid",
      saved: filters.savedOnly ? "1" : "0",
      upcoming: filters.upcomingOnly ? "1" : "0",
    });
    if (filters.savedOnly) params.set("ids", savedIds.join(","));
    writeInvestorSearch(params, filters);
    return params.toString();
  }, [
    filters.transactionType,
    filters.listingCategory,
    filters.dataState,
    filters.city,
    filters.locations,
    filters.propertyTypes,
    filters.minPrice,
    filters.maxPrice,
    filters.minLand,
    filters.maxLand,
    filters.rentalPeriod,
    filters.minSpread,
    filters.minDrop,
    filters.sort,
    filters.savedOnly,
    filters.upcomingOnly,
    query,
    page,
    savedIds,
  ]);
  const canFetch = !filters.savedOnly || ready;
  useEffect(() => {
    if (!canFetch) return;
    let current = true;
    const force = forceNext.current;
    forceNext.current = false;
    setLoading(true);
    setFailure(null);
    if (force) investorFeedCache.clear(ownerScope);
    else {
      const cached = investorFeedCache.read(ownerScope, requestKey);
      if (cached) setResult({ key: requestKey, ownerScope, data: cached });
    }
    const request = acquireInvestorFeed(
      ownerScope,
      requestKey,
      force,
      async (signal) => {
        const response = await fetch(
          `/api/dashboard/investor?${requestKey}${force ? "&refresh=1" : ""}`,
          { signal, cache: "no-store" },
        );
        const body = await response.json();
        if (!response.ok)
          throw Object.assign(
            new Error(
              typeof body.error === "string"
                ? body.error
                : "Data Investor belum dapat dimuat.",
            ),
            { status: response.status },
          );
        if (
          !Array.isArray(body.items) ||
          !body.summary ||
          !Array.isArray(body.cities) ||
          typeof body.total !== "number"
        )
          throw new Error("Respons data Investor tidak lengkap.");
        return body as InvestorFeed;
      },
    );
    request.promise
      .then((data) => {
        if (current) {
          investorFeedCache.write(ownerScope, requestKey, data);
          setResult({ key: requestKey, ownerScope, data });
        }
      })
      .catch((error: Error & { status?: number }) => {
        if (current) {
          setFailure({
            key: requestKey,
            ownerScope,
            message:
              error.name === "AbortError"
                ? "Permintaan melewati batas waktu. Coba perbarui kembali."
                : error.message,
            status: error.status ?? 503,
          });
          if (error.status === 401 || error.status === 403) {
            investorFeedCache.clear(ownerScope);
            setResult(null);
          }
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      request.release();
    };
  }, [requestKey, revision, canFetch, ownerScope]);
  const refresh = useCallback(() => {
    forceNext.current = true;
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible")
        setRevision((value) => value + 1);
    };
    const timer = setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const scoped = result?.ownerScope === ownerScope ? result : null;
  return {
    data: scoped?.key === requestKey ? scoped.data : null,
    metadata: scoped?.data ?? null,
    loading:
      loading || filters.query !== query || (filters.savedOnly && !ready),
    error:
      failure?.ownerScope === ownerScope && failure.key === requestKey
        ? failure
        : null,
    refresh,
    setComposing,
    submitSearch: () => {
      if (!composing) setQuery(filters.query);
    },
  };
}

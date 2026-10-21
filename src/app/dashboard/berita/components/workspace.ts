"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { BeritaListItem } from "@/lib/berita";
import type { BeritaStatus } from "@/lib/beritaUi";

export type Filters = {
  status: string;
  q: string;
  kategori: string;
  penulis: string;
  from: string;
  to: string;
  sort: string;
  review: string;
};
export const EMPTY_FILTERS: Filters = {
  status: "",
  q: "",
  kategori: "",
  penulis: "",
  from: "",
  to: "",
  sort: "newest",
  review: "",
};
export type Activity = { date: string; status: BeritaStatus };
export type WorkspaceData = {
  items: BeritaListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts: Partial<Record<BeritaStatus, number>>;
  authors: string[];
  activity: Activity[];
  reviewCount: number;
};

export async function beritaRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.error || "Permintaan gagal. Silakan coba lagi.");
  if (data === null)
    throw new Error("Respons server tidak valid. Silakan coba lagi.");
  return data as T;
}

export function useBeritaWorkspace(enabled: boolean) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (filters.q.trim() === debounced) return;
    const timer = setTimeout(() => {
      setDebounced(filters.q.trim());
      setPage(1);
      setSelected(new Set());
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.q, debounced]);

  useEffect(() => {
    try {
      if (localStorage.getItem("berita-view") === "grid") setView("grid");
    } catch {
      /* Storage may be disabled. */
    }
  }, []);

  const params = new URLSearchParams({ page: String(page), pageSize: "12" });
  Object.entries({ ...filters, q: debounced }).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<WorkspaceData>(
      enabled ? `/api/berita/admin?${params}` : null,
      beritaRequest,
      { keepPreviousData: true, revalidateOnFocus: true },
    );

  const updateFilters = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    if (Object.keys(patch).some((key) => key !== "q")) {
      setPage(1);
      setSelected(new Set());
    }
  };
  const changePage = (value: number) => {
    setPage(value);
    setSelected(new Set());
  };
  const changeView = (value: "list" | "grid") => {
    setView(value);
    try {
      localStorage.setItem("berita-view", value);
    } catch {
      /* View remains usable without persistence. */
    }
  };
  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const visibleSelected = useMemo(
    () =>
      new Set(
        (data?.items || [])
          .filter((item) => selected.has(item.id))
          .map((item) => item.id),
      ),
    [data?.items, selected],
  );
  const allSelected =
    !!data?.items.length && visibleSelected.size === data.items.length;
  const toggleAll = () =>
    setSelected(
      allSelected ? new Set() : new Set(data?.items.map((item) => item.id)),
    );
  return {
    data,
    error,
    loading: isLoading || (!data && !error),
    refreshing: isValidating,
    mutate,
    filters,
    updateFilters,
    resetFilters: () => {
      setFilters(EMPTY_FILTERS);
      setPage(1);
      setSelected(new Set());
    },
    page,
    changePage,
    view,
    changeView,
    selected: visibleSelected,
    clearSelection: () => setSelected(new Set()),
    toggle,
    toggleAll,
    allSelected,
  };
}

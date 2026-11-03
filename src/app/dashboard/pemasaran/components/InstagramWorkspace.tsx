"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type InstagramLibrary,
  type InstagramMedia,
  instagramMediaLabel,
} from "@/lib/marketing/instagram-content";
import { instagramRequest } from "./instagram-api";
import InstagramContentDialog from "./InstagramContentDialog";
import InstagramDeleteDialog from "./InstagramDeleteDialog";
import InstagramLibraryView from "./InstagramLibraryView";
import { instagramExamples, findInstagramExample } from "./instagram-examples";
import "./instagram-workspace.css";

function readParam(name: string, fallback = "") {
  return typeof window === "undefined"
    ? fallback
    : new URLSearchParams(window.location.search).get(name) || fallback;
}
function urlParam(name: string, value: string) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.history.replaceState(null, "", url);
}
export default function InstagramWorkspace({
  onSettings,
}: {
  onSettings: () => void;
}) {
  const [kind, setKind] = useState<"media" | "stories">(() =>
    readParam("igView") === "stories" ? "stories" : "media",
  );
  const [source, setSource] = useState<"live" | "examples">(() =>
    readParam("igSource") === "examples" ? "examples" : "live",
  );
  const [selectedExample, setSelectedExample] = useState(() =>
    readParam("igMedia")
      ? ""
      : findInstagramExample(readParam("igExample"))?.id || "",
  );
  const [initialPanel, setInitialPanel] = useState<"analytics" | "comments">(
    "analytics",
  );
  const [query, setQuery] = useState(() => readParam("igQuery"));
  const [filter, setFilter] = useState(() => readParam("igType", "all"));
  const [data, setData] = useState<InstagramLibrary | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [deleting, setDeleting] = useState<InstagramMedia | null>(null);
  const [selected, setSelected] = useState(() =>
    /^\d{1,32}$/.test(readParam("igMedia")) ? readParam("igMedia") : "",
  );
  const controller = useRef<AbortController | null>(null),
    sequence = useRef(0),
    lock = useRef(false),
    search = useRef<HTMLInputElement>(null);
  const load = useCallback(
    async (after?: string) => {
      if (after && lock.current) return;
      const request = ++sequence.current;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      lock.current = true;
      setLoading(true);
      setError("");
      try {
        const result = await instagramRequest<InstagramLibrary>(
          { mode: kind, ...(after ? { after } : {}) },
          undefined,
          abort.signal,
        );
        if (request !== sequence.current) return;
        setData((previous) => ({
          ...result,
          items:
            after && previous?.account.id === result.account.id
              ? [
                  ...new Map(
                    [...previous.items, ...result.items].map((item) => [
                      item.id,
                      item,
                    ]),
                  ).values(),
                ]
              : result.items,
        }));
      } catch (failure) {
        if (
          request === sequence.current &&
          (failure as Error).name !== "AbortError"
        )
          setError((failure as Error).message);
      } finally {
        if (request === sequence.current) {
          lock.current = false;
          setLoading(false);
        }
      }
    },
    [kind],
  );
  useEffect(() => {
    setData(null);
    void load();
    return () => {
      sequence.current++;
      controller.current?.abort();
    };
  }, [load]);
  // An empty connected account must stay an honest empty library. Examples are
  // available only through the explicit source switch, never as published posts.
  const examples = source === "examples";
  const sourceItems = useMemo(
    () =>
      examples
        ? instagramExamples.map((item) => item.detail.media)
        : data?.items || [],
    [data, examples],
  );
  const items = useMemo(
    () =>
      sourceItems.filter(
        (item) =>
          (filter === "all" ||
            instagramMediaLabel(item).toLowerCase() === filter) &&
          (!query.trim() ||
            (item.caption + " " + item.id)
              .toLocaleLowerCase("id-ID")
              .includes(query.trim().toLocaleLowerCase("id-ID"))),
      ),
    [sourceItems, filter, query],
  );
  function open(id: string) {
    setSelected(id);
    urlParam("igMedia", id);
  }
  function clearFilters() {
    setQuery("");
    setFilter("all");
    urlParam("igQuery", "");
    urlParam("igType", "");
  }
  function chooseSource(value: "live" | "examples") {
    setSource(value);
    urlParam("igSource", value);
    clearFilters();
    if (value === "examples" && kind !== "media") {
      setKind("media");
      urlParam("igView", "media");
    }
  }
  function deleted(mediaId: string) {
    setDeleting(null);
    setData(
      (previous) =>
        previous && {
          ...previous,
          account: {
            ...previous.account,
            mediaCount:
              previous.account.mediaCount === null
                ? null
                : Math.max(0, previous.account.mediaCount - 1),
          },
          items: previous.items.filter((item) => item.id !== mediaId),
        },
    );
    if (selected === mediaId) open("");
    if (readParam("igPreview") === mediaId) urlParam("igPreview", "");
    void load();
  }
  return (
    <>
      <InstagramLibraryView
        data={data}
        items={items}
        totalLoaded={sourceItems.length}
        loading={loading}
        error={error}
        examples={examples}
        query={query}
        filter={filter}
        kind={kind}
        searchRef={search}
        onSettings={onSettings}
        onRefresh={() => void load()}
        onMore={() => {
          if (data?.after) void load(data.after);
        }}
        onSource={chooseSource}
        onKind={(value) => {
          setKind(value);
          setSource("live");
          setFilter("all");
          urlParam("igView", value);
          urlParam("igSource", "live");
          urlParam("igType", "");
        }}
        onQuery={(value) => {
          setQuery(value);
          urlParam("igQuery", value);
        }}
        onFilter={(value) => {
          setFilter(value);
          urlParam("igType", value);
        }}
        onClear={clearFilters}
        onDelete={setDeleting}
        onOpen={(item, panel = "analytics") => {
          setInitialPanel(panel);
          if (examples) {
            setSelectedExample(item.id);
            urlParam("igExample", item.id);
          } else open(item.id);
        }}
      />
      {(selected || selectedExample) && (
        <InstagramContentDialog
          key={selected || selectedExample}
          mediaId={selected || selectedExample}
          accountId={selected ? data?.account.id : undefined}
          example={
            selectedExample ? findInstagramExample(selectedExample) : undefined
          }
          initialPanel={initialPanel}
          onClose={() => {
            open("");
            setSelectedExample("");
            urlParam("igExample", "");
          }}
          onDeleted={() => deleted(selected)}
        />
      )}
      {deleting && data?.account.id && (
        <InstagramDeleteDialog
          key={deleting.id}
          media={deleting}
          accountId={data.account.id}
          onClose={() => setDeleting(null)}
          onDeleted={() => deleted(deleting.id)}
        />
      )}
    </>
  );
}

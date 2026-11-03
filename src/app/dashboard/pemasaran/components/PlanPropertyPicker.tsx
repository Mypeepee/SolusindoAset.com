"use client";
import { useEffect, useRef, useState } from "react";
import SearchSelect from "@/components/search/SearchSelect";
import { errorLabels, type AssetSnapshot } from "@/lib/marketing/domain";
import {
  planCandidateReasonLabels,
  type PlanCandidate,
} from "@/lib/marketing/plan";
import { Action, number } from "./ui";
import { ImageIcon, Loader2 } from "./MarketingIcons";
import PlanPropertyPhoto from "./PlanPropertyPhoto";

export default function PlanPropertyPicker({
  when,
  jobId,
  selected,
  disabled,
  onSelect,
  campaign,
  open: controlledOpen,
  onOpenChange,
}: {
  when: string | null;
  jobId?: string;
  selected: AssetSnapshot | null;
  disabled: boolean;
  onSelect: (asset: AssetSnapshot) => void;
  campaign?: { id: string; proposalId: string; slotId: string; };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (value: boolean) => { setLocalOpen(value); onOpenChange?.(value); };
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const immediateSearch = useRef(false);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    items: PlanCandidate[];
    total: number;
    nextOffset: number;
  }>({ key: "", items: [], total: 0, nextOffset: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const campaignKey = JSON.stringify(campaign);
  const key = JSON.stringify([when, jobId, query, campaignKey]);
  useEffect(() => {
    if (!when || !open || composing) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const delay = query && !immediateSearch.current ? 300 : 0;
    immediateSearch.current = false;
    const timer = setTimeout(
      () => {
        const params = new URLSearchParams({
          mode: "candidates",
          when,
          query,
          offset: String(offset),
        });
        if (jobId) params.set("job", jobId);
        if (campaign) {
          params.set("id", campaign.id);
          params.set("proposal", campaign.proposalId);
          params.set("slot", campaign.slotId);
        }
        void fetch(
          "/api/dashboard/pemasaran" +
          (campaign ? "/campaigns" : "") +
          "?" +
          params,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        )
          .then(async (response) => {
            const body = await response.json();
            if (!response.ok)
              throw new Error(
                errorLabels[body.error] ||
                "Properti belum dapat dimuat. Coba kembali.",
              );
            if (!controller.signal.aborted)
              setResult((current) => ({
                key,
                total: body.total,
                nextOffset: body.nextOffset,
                items:
                  offset && current.key === key
                    ? [...current.items, ...body.items]
                    : body.items,
              }));
          })
          .catch((failure: Error) => {
            if (!controller.signal.aborted) setError(failure.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      delay,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [when, jobId, query, offset, retry, key, open, campaignKey, composing]);
  const items = result.key === key ? result.items : [];
  return (
    <div className="marketing-plan-properties" data-selected={!!selected}>
      <SearchSelect
        id="marketing-plan-property"
        label="Pilih properti"
        presentation="dialog"
        compact
        value={selected?.id || ""}
        valueLabel={
          selected
            ? `${selected.propertyType} · ${selected.city}`
            : undefined
        }
        valueDescription={selected ? <><span title={selected.address}>{selected.address}</span><b>Rp {number(selected.price)}</b><small>ID {selected.id} · Ganti properti</small></> : undefined}
        placeholder="Pilih properti yang akan dipasarkan"
        icon={
          selected ? (
            <PlanPropertyPhoto
              key={selected.id + selected.revision}
              asset={selected}
            />
          ) : (
            <ImageIcon size={17} />
          )
        }
        disabled={disabled || !when}
        open={open}
        layer={10002}
        onOpenChange={(value) => {
          if (value) {
            setLoading(true);
            setError("");
            setOffset(0);
          }
          setOpen(value);
        }}
        onChange={(id) => {
          const asset = items.find((item) => item.id === id);
          if (asset && !asset.unavailableReason) {
            onSelect(asset);
            setOpen(false);
          }
        }}
        options={items.map((asset) => ({
          id: `marketing-property-option-${asset.id}`,
          value: asset.id,
          label: `${asset.propertyType} · ${asset.city}`,
          description: (
            <>
              <span
                className="marketing-property-address"
                title={asset.address}
              >
                {asset.address}
              </span>
              <span className="marketing-property-price">
                Rp {number(asset.price)}
              </span>
              <span className="marketing-property-meta">ID {asset.id}{asset.landArea != null && asset.landArea > 0 ? ` · LT ${number(asset.landArea)} m²` : ""}</span>
              {asset.unavailableReason && (
                <span className="marketing-property-reason">
                  {planCandidateReasonLabels[asset.unavailableReason]}
                </span>
              )}
            </>
          ),
          disabled: !!asset.unavailableReason,
          icon: (
            <PlanPropertyPhoto key={asset.id + asset.revision} asset={asset} />
          ),
        }))}
        search={{
          label: "Cari properti",
          placeholder: "Cari lokasi, nama, atau ID",
          value: query,
          onCompositionChange: setComposing,
          onSubmit: () => { immediateSearch.current = true; setOffset(0); setRetry((value) => value + 1); },
          onChange: (value) => {
            setLoading(true);
            setError("");
            setQuery(value);
            setOffset(0);
          },
        }}
        triggerClassName="marketing-property-trigger"
        contentClassName="marketing-property-dropdown"
        busy={loading}
        resultSummary={
          loading
            ? "Memuat properti…"
            : result.key === key
              ? `${number(items.length)} dari ${number(result.total)} properti`
              : ""
        }
        status={
          error ? (
            <p role="alert" className="marketing-error">
              {error}
            </p>
          ) : loading ? (
            <p role="status" className="marketing-plan-loading">
              <Loader2 size={15} className="animate-spin" />
              Memuat properti…
            </p>
          ) : !items.length ? (
            <p role="status">
              {query
                ? "Tidak ada properti yang cocok dengan pencarian dan filter pemasaran. Coba lokasi, nama, atau ID lain."
                : campaign
                  ? "Belum ada properti yang memenuhi kriteria campaign pada waktu ini."
                  : "Belum ada properti sesuai filter pemasaran. Periksa wilayah, jenis, dan rentang harga di Pengaturan."}
            </p>
          ) : !loading &&
            items.length &&
            items.every((asset) => asset.unavailableReason) ? (
            <p role="status">
              Properti ditemukan, tetapi belum dapat dipilih. Lihat alasan pada
              setiap properti.
            </p>
          ) : null
        }
        footer={
          error ? (
            <Action onClick={() => setRetry((value) => value + 1)}>
              Coba kembali
            </Action>
          ) : !loading && query && !items.length ? (
            <Action
              onClick={() => {
                setQuery("");
                setOffset(0);
              }}
            >
              Tampilkan semua properti
            </Action>
          ) : result.key === key && result.nextOffset < result.total ? (
            <Action
              disabled={loading}
              onClick={() => setOffset(result.nextOffset)}
            >
              {loading ? "Memuat properti…" : "Muat properti berikutnya"}
            </Action>
          ) : null
        }
      />
      {!when && (
        <p className="marketing-muted">
          Pilih tanggal dan jam mendatang untuk melihat properti yang tersedia.
        </p>
      )}
      {selected && <p className="sr-only" data-plan-selected role="status">Properti dipilih: {selected.propertyType}, {selected.city}, Rp {number(selected.price)}.</p>}
      <p className="marketing-footnote">
        Properti siap dipasarkan tampil lebih dahulu. Properti yang belum tersedia disertai alasan.
      </p>
    </div>
  );
}

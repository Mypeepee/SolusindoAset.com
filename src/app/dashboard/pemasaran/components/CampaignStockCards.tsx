"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { AssetSnapshot } from "@/lib/marketing/domain";
import { TYPE_DB_TO_DISPLAY } from "@/lib/propertyType";
import { assetFreshnessLabel } from "@/lib/marketing/campaign-selection";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { Action, number } from "./ui";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  ImageIcon,
  Layers,
} from "./MarketingIcons";
import PlanPropertyPhoto from "./PlanPropertyPhoto";
import { CampaignDiscountFacts } from "./CampaignVisual";

export const stockDate = (value: string | Date) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
export const stockTime = (value: string | Date) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));

/** Photo-led stock in one native, keyboard-accessible horizontal strip. */
export default function CampaignStockCards({
  assets,
  source = "listing",
  now = new Date(),
  loading = false,
  archive = false,
  assignments = [],
}: {
  assets: AssetSnapshot[];
  source?: "listing" | "example";
  now?: Date;
  loading?: boolean;
  archive?: boolean;
  assignments?: { assetId: string; when: string; status?: string }[];
}) {
  const track = useRef<HTMLDivElement>(null);
  const trackId = useId();
  const hintId = useId();
  const reducedMotion = useReducedMotionPreference();
  const assetKey = assets.map((asset) => asset.id).join(",");
  const [position, setPosition] = useState({
    first: 1,
    last: 1,
    previous: false,
    next: false,
  });
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const visible = Array.from(element.children).flatMap((card, index) => {
        const rect = card.getBoundingClientRect();
        const shown =
          Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left);
        return shown >= rect.width / 2 ? [index + 1] : [];
      });
      const next = {
        first: visible[0] || 1,
        last: visible.at(-1) || 1,
        previous: element.scrollLeft > 2,
        next:
          element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
      };
      setPosition((current) =>
        current.first === next.first &&
        current.last === next.last &&
        current.previous === next.previous &&
        current.next === next.next
          ? current
          : next,
      );
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    element.scrollLeft = 0;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, [assetKey]);
  const move = (direction: -1 | 1) => {
    const element = track.current;
    const card = element?.firstElementChild;
    if (!element || !card) return;
    element.scrollBy({
      left:
        direction *
        (card.getBoundingClientRect().width +
          parseFloat(getComputedStyle(element).columnGap)),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };
  return (
    <>
      <p id={hintId} className="sr-only">
        Geser untuk melihat properti lain. Saat daftar difokuskan, gunakan panah
        kiri dan kanan; Home ke awal dan End ke akhir.
      </p>
      <div
        ref={track}
        id={trackId}
        className="campaign-ready-grid campaign-stock-grid"
        role="region"
        aria-label="Daftar properti campaign"
        aria-describedby={hintId}
        aria-busy={loading}
        tabIndex={assets.length > 1 ? 0 : undefined}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            track.current?.scrollTo({
              left: event.key === "Home" ? 0 : track.current.scrollWidth,
              behavior: reducedMotion ? "auto" : "smooth",
            });
          }
        }}
      >
        {assets.map((asset) => {
          const slot = assignments.find((item) => item.assetId === asset.id);
          return (
            <article
              key={asset.id}
              className="campaign-property-card"
              data-listing={asset.id}
            >
              <div className="campaign-property-image">
                <PlanPropertyPhoto asset={asset} source={source} size="card" />
                <span
                  className="campaign-property-badge"
                  data-archive={archive}
                  title={
                    slot?.status === "published"
                      ? "Sudah terbit"
                      : archive
                        ? "Arsip lelang"
                        : source === "example"
                          ? "Contoh properti"
                          : assignments.length
                            ? "Terjadwal di Planner"
                            : "Sesuai filter"
                  }
                >
                  {slot?.status === "published"
                    ? "Terbit"
                    : archive
                      ? "Arsip"
                      : source === "example"
                        ? "Contoh"
                        : assignments.length
                          ? "Terjadwal"
                          : "Sesuai filter"}
                </span>
                <span
                  className="campaign-property-photo-count"
                  aria-label={`${asset.images.length} foto`}
                  title={`${asset.images.length} foto`}
                >
                  <ImageIcon size={11} />
                  {asset.images.length}
                </span>
                {slot && (
                  <div className="campaign-property-slot">
                    <Clock size={12} />
                    <span className="sr-only">
                      {archive ? "Jadwal uji" : "Jadwal tayang"}
                    </span>
                    <time dateTime={slot.when}>
                      {stockTime(slot.when)} <small>WIB</small>
                    </time>
                  </div>
                )}
              </div>
              <div className="campaign-property-body">
                <div className="campaign-property-location">
                  <span>
                    {TYPE_DB_TO_DISPLAY[asset.propertyType] ||
                      asset.propertyType}
                  </span>
                  <span>{asset.city.replace(/^Kabupaten\s+/i, "Kab. ")}</span>
                </div>
                <h4 title={asset.address || asset.title}>
                  {asset.address || asset.title}
                </h4>
                <strong className="campaign-property-price">
                  Rp {number(asset.price)}
                </strong>
                <div className="campaign-property-footer">
                  <div className="campaign-property-metadata">
                    <CampaignDiscountFacts asset={asset} compact />
                    <div className="campaign-property-facts">
                      {asset.landArea != null && (
                        <span>
                          <Layers size={12} />
                          <span className="sr-only">Tanah </span>
                          {number(asset.landArea)} m²
                        </span>
                      )}
                      {asset.auctionDate && (
                        <span>
                          <CalendarClock size={12} />
                          <span className="sr-only">Lelang </span>
                          <time dateTime={asset.auctionDate}>
                            {stockDate(asset.auctionDate)}
                          </time>
                        </span>
                      )}
                    </div>
                    {!archive && (
                      <span className="campaign-asset-freshness">
                        {assetFreshnessLabel(asset, now)}
                      </span>
                    )}
                  </div>
                  <div className="campaign-property-actions">
                    {source === "listing" && asset.listingUrl && (
                      <a
                        className="marketing-action marketing-action-primary"
                        href={asset.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={
                          "Buka properti " +
                          (asset.address || asset.title) +
                          " di tab baru"
                        }
                      >
                        Detail
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {assets.length > 1 && (
        <div className="campaign-stock-navigation">
          <span role="status" aria-live="polite" aria-atomic="true">
            {position.first}
            {position.last > position.first
              ? `–${position.last}`
              : ""} dari {assets.length} properti
          </span>
          <div>
            <Action
              aria-label="Properti sebelumnya"
              aria-controls={trackId}
              disabled={loading || !position.previous}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </Action>
            <Action
              aria-label="Properti berikutnya"
              aria-controls={trackId}
              disabled={loading || !position.next}
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </Action>
          </div>
        </div>
      )}
    </>
  );
}

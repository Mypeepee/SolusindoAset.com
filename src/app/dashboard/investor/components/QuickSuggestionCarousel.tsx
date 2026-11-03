"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useIsPresent,
} from "framer-motion";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import {
  formatCompactRupiah,
  formatPercent,
  rentalPeriodLabel,
  type InvestorListing,
} from "@/lib/investor-deals";
import ListingImage from "./ListingImage";
import { useSwipe } from "@/hooks/useSwipe";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

const ROTATION_INTERVAL_MS = 5_000;

function SuggestionSlide({
  listing,
  index,
  total,
  direction,
  reducedMotion,
}: {
  listing: InvestorListing;
  index: number;
  total: number;
  direction: number;
  reducedMotion: boolean;
}) {
  const present = useIsPresent();
  const auctionDriver = listing.primaryDealType === "AUCTION_DROP";
  const featuredDiscount = auctionDriver
    ? listing.metricAuctionDropPct
    : listing.metricMarketSpreadPct;
  const marketLabel = "Diskon kelurahan";
  return (
    <motion.div
      className="investor-suggestion-slide"
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} dari ${total}`}
      aria-hidden={!present}
      custom={direction}
      variants={{
        enter: (dir: number) => ({ x: reducedMotion ? 0 : `${dir * 100}%` }),
        active: { x: 0 },
        exit: (dir: number) => ({ x: reducedMotion ? 0 : `${-dir * 100}%` }),
      }}
      initial="enter"
      animate="active"
      exit="exit"
      transition={{
        duration: reducedMotion ? 0 : 0.36,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="investor-featured-image" aria-hidden="true">
        <ListingImage
          src={listing.imageUrl}
          alt=""
          sizes="(max-width:767px) 35vw,25vw"
          className="object-cover"
        />
        <div />
      </div>
      <div className="investor-featured-content">
        <div className="investor-featured-metric">
          <strong className="investor-featured-score">
            {featuredDiscount !== null
              ? `${formatPercent(featuredDiscount)}%`
              : "—"}
          </strong>
          <span className="investor-featured-driver">
            {auctionDriver ? "Turun lelang" : marketLabel}
          </span>
        </div>
        <h3
          id={`investor-featured-title-${listing.id}`}
          className="investor-featured-title"
        >
          {listing.address || listing.title}
        </h3>
        <div className="investor-featured-bottom">
          <div className="investor-featured-price-row">
            <strong>{formatCompactRupiah(listing.currentAuctionPrice)}</strong>
            {listing.transactionType === "SEWA" && (
              <span>/{rentalPeriodLabel(listing.rentalPeriod)}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** A bounded carousel of server-ranked deals; rotation never changes result filters. */
export default function QuickSuggestionCarousel({
  listings,
  onView,
  paused = false,
  emptyMessage,
}: {
  listings: InvestorListing[];
  onView: (listing: InvestorListing) => void;
  paused?: boolean;
  emptyMessage: string;
}) {
  const root = useRef<HTMLElement>(null);
  const signature = listings.map((listing) => listing.id).join(":");
  const [slide, setSlide] = useState({ signature, index: 0, direction: 1 });
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [held, setHeld] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const reducedMotion = useReducedMotionPreference();
  const inView = useInView(root, { amount: 0.35 });
  const total = listings.length;
  const index =
    total && slide.signature === signature ? slide.index % total : 0;
  const active = listings[index];
  const canRotate =
    total > 1 &&
    reducedMotion === false &&
    !paused &&
    !userPaused &&
    !hovered &&
    !focused &&
    !held &&
    pageVisible &&
    inView;

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!canRotate) return;
    const timer = window.setTimeout(() => {
      setSlide((current) => ({
        signature,
        index:
          ((current.signature === signature ? current.index : 0) + 1) % total,
        direction: 1,
      }));
    }, ROTATION_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [canRotate, index, total, signature]);

  const move = (direction: number) => {
    if (total < 2) return;
    const next = (index + direction + total) % total;
    setSlide({ signature, index: next, direction });
    setAnnouncement(
      `Rekomendasi ${next + 1} dari ${total}: ${listings[next].title}`,
    );
  };

  const swipe = useSwipe(
    () => move(1),
    () => move(-1),
    40,
    { axisRatio: 1.3, ignoreInteractive: true, onInteractionChange: setHeld },
  );

  return (
    <article
      ref={root}
      className="investor-summary-card investor-featured"
      data-dashboard-accent="amber"
      data-active-listing-id={active?.id}
      data-autoplay={canRotate ? "playing" : "paused"}
      role="region"
      aria-roledescription="karusel"
      aria-labelledby="investor-suggestions-heading"
      tabIndex={total > 1 ? 0 : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setFocused(false);
      }}
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          (event.target as Element).closest(
            "button, a, input, textarea, select, [contenteditable]",
          )
        )
          return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
      {...swipe}
    >
      <div className="investor-featured-heading">
        <div className="investor-summary-label">
          <span className="investor-featured-spark">
            <Sparkles size={17} aria-hidden="true" />
          </span>
          <h2 id="investor-suggestions-heading">Quick suggestion</h2>
        </div>
        {total > 1 && (
          <div
            className="investor-suggestion-controls"
            role="group"
            aria-label="Kontrol rekomendasi"
          >
            <button
              type="button"
              aria-label="Properti rekomendasi sebelumnya"
              title="Sebelumnya"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="investor-suggestion-position" aria-live="off">
              {index + 1}/{total}
            </span>
            <button
              type="button"
              aria-label="Properti rekomendasi berikutnya"
              title="Berikutnya"
              onClick={() => move(1)}
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              aria-label={
                userPaused || reducedMotion
                  ? "Putar rekomendasi otomatis"
                  : "Jeda rekomendasi otomatis"
              }
              title={
                reducedMotion
                  ? "Mengikuti preferensi kurangi gerakan"
                  : userPaused
                    ? "Putar otomatis"
                    : "Jeda otomatis"
              }
              disabled={Boolean(reducedMotion)}
              onClick={() => setUserPaused((value) => !value)}
            >
              {userPaused || reducedMotion ? (
                <Play size={12} />
              ) : (
                <Pause size={12} />
              )}
            </button>
          </div>
        )}
      </div>
      <AnimatePresence key={signature} initial={false} custom={slide.direction}>
        {active && (
          <SuggestionSlide
            key={active.id}
            listing={active}
            index={index}
            total={total}
            direction={slide.direction}
            reducedMotion={reducedMotion !== false}
          />
        )}
      </AnimatePresence>
      {active ? (
        <button
          type="button"
          className="investor-featured-cta"
          aria-label="Lihat aset unggulan"
          aria-describedby={`investor-featured-title-${active.id}`}
          aria-haspopup="dialog"
          onClick={() => onView(active)}
        >
          Lihat aset <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      ) : (
        <p className="investor-featured-empty">{emptyMessage}</p>
      )}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
    </article>
  );
}

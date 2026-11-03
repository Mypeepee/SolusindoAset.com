"use client";
import { useEffect, useRef, useState } from "react";
import type { InstagramMedia } from "@/lib/marketing/instagram-content";
import { useSwipe } from "@/hooks/useSwipe";
import { Action } from "./ui";
import { ChevronLeft, ChevronRight, ImageIcon } from "./MarketingIcons";

/** One gallery owner for the library preview and the management dialog. */
export default function InstagramCarousel({
  media,
  slides,
  labels,
}: {
  media: InstagramMedia;
  slides: InstagramMedia[];
  labels?: string[];
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const thumbnails = useRef<HTMLDivElement>(null);
  const images = slides.length ? slides : [media];
  const currentIndex = Math.min(index, images.length - 1);
  const current = images[currentIndex];
  const previous = () => setIndex((value) => Math.max(0, value - 1));
  const next = () =>
    setIndex((value) => Math.min(images.length - 1, value + 1));
  const swipe = useSwipe(next, previous, 40, {
    axisRatio: 1.2,
    ignoreInteractive: true,
  });
  useEffect(() => setIndex(0), [media.id]);
  useEffect(() => {
    setFailed(false);
    // Only scroll the strip; never move the dashboard or modal.
    const strip = thumbnails.current;
    const button = strip?.children[currentIndex] as HTMLElement | undefined;
    if (strip && button) {
      if (button.offsetLeft < strip.scrollLeft)
        strip.scrollLeft = button.offsetLeft;
      else if (
        button.offsetLeft + button.offsetWidth >
        strip.scrollLeft + strip.clientWidth
      )
        strip.scrollLeft =
          button.offsetLeft + button.offsetWidth - strip.clientWidth;
    }
  }, [current.id, currentIndex]);
  return (
    <section
      className="ig-carousel"
      aria-label="Pratinjau carousel"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.target as Element).closest("video,input,textarea")) return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          next();
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          previous();
        }
      }}
    >
      <div className="ig-carousel-shell">
        <div className="instagram-preview-media" {...swipe}>
          {current.type === "VIDEO" && current.mediaUrl && !failed ? (
            <video
              key={current.id}
              src={current.mediaUrl}
              poster={current.thumbnailUrl || undefined}
              controls
              playsInline
              preload="metadata"
              onError={() => setFailed(true)}
            />
          ) : (current.mediaUrl || current.thumbnailUrl) && !failed ? (
            <img
              key={current.id}
              src={(current.mediaUrl || current.thumbnailUrl)!}
              alt={`${labels?.[currentIndex] || "Foto properti"}, slide ${currentIndex + 1} dari ${images.length}`}
              referrerPolicy="no-referrer"
              draggable={false}
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="instagram-preview-fallback">
              <ImageIcon size={32} />
              <p>Pratinjau media belum tersedia</p>
            </div>
          )}
          {images.length > 1 && (
            <div className="ig-slide-count" aria-hidden="true">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>
      </div>
      <div className="instagram-gallery-nav">
        <div className="ig-slide-description" role="status" aria-live="polite">
          <span>
            {String(currentIndex + 1).padStart(2, "0")} /{" "}
            {String(images.length).padStart(2, "0")}
          </span>
          <strong>
            {labels?.[currentIndex] ||
              (images.length > 1
                ? `Slide ${currentIndex + 1}`
                : "Pratinjau unggahan")}
          </strong>
        </div>
        {images.length > 1 && (
          <div className="ig-gallery-arrows">
            <Action
              disabled={currentIndex === 0}
              aria-label="Media sebelumnya"
              title="Slide sebelumnya"
              onClick={previous}
            >
              <ChevronLeft size={18} />
            </Action>
            <Action
              disabled={currentIndex === images.length - 1}
              aria-label="Media berikutnya"
              title="Slide berikutnya"
              onClick={next}
            >
              <ChevronRight size={18} />
            </Action>
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div
          className="ig-slide-thumbnails"
          ref={thumbnails}
          aria-label="Pilih slide"
        >
          {images.map((image, position) => (
            <button
              type="button"
              key={image.id}
              aria-pressed={position === currentIndex}
              aria-label={`Lihat slide ${position + 1}${labels?.[position] ? ": " + labels[position] : ""}`}
              onClick={() => setIndex(position)}
            >
              <img
                src={image.thumbnailUrl || image.mediaUrl || undefined}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <span>{String(position + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      )}
      {failed && (
        <p className="marketing-footnote">
          Media tidak dapat dimuat. Coba slide lain atau buka posting di
          Instagram.
        </p>
      )}
    </section>
  );
}

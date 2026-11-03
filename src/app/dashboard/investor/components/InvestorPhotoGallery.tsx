"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { PROPERTY_CARD_PHOTO_CLASS } from "@/components/property/PropertyCardFrame";
import { SliderDots } from "@/components/SliderDots";
import { useSwipe } from "@/hooks/useSwipe";
import ListingImage from "./ListingImage";
import type { ReactNode } from "react";

/** Investor variant of the Lelang photo surface; no autoplay during comparison. */
export default function InvestorPhotoGallery({
  images,
  title,
  children,
}: {
  images: string[];
  title: string;
  children: ReactNode;
}) {
  const [position, setPosition] = useState(0);
  const index = Math.min(position, Math.max(0, images.length - 1));
  const multiple = images.length > 1;
  const next = () => setPosition((previous) => (previous + 1) % images.length);
  const previous = () =>
    setPosition((current) => (current - 1 + images.length) % images.length);
  const swipe = useSwipe(next, previous, 40, {
    axisRatio: 1.2,
    ignoreInteractive: true,
  });
  return (
    <div
      className={`${PROPERTY_CARD_PHOTO_CLASS} investor-card-photo`}
      role={multiple ? "region" : undefined}
      aria-roledescription={multiple ? "carousel" : undefined}
      aria-label={multiple ? `Foto ${title}` : undefined}
      tabIndex={multiple ? 0 : undefined}
      onKeyDown={(event) => {
        if (!multiple || event.target !== event.currentTarget) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          if (event.key === "ArrowLeft") previous();
          else next();
        }
      }}
      {...(multiple ? swipe : {})}
      data-photo-index={index}
      data-photo-count={images.length}
    >
      <ListingImage
        key={images[index] || "missing"}
        src={images[index] || ""}
        alt={`Foto ${index + 1} dari ${Math.max(1, images.length)} · ${title}`}
        sizes="(max-width:767px) 92vw,(max-width:1359px) 45vw,400px"
        className="investor-card-image object-cover"
      />
      <div className="investor-card-photo-shade" />
      {children}
      {multiple && (
        <>
          <button
            type="button"
            className="investor-gallery-arrow is-previous"
            onClick={previous}
            aria-label="Foto properti sebelumnya"
            title="Foto sebelumnya"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="investor-gallery-arrow is-next"
            onClick={next}
            aria-label="Foto properti berikutnya"
            title="Foto berikutnya"
          >
            <ChevronRight size={18} />
          </button>
          <SliderDots
            total={images.length}
            index={index}
            className="investor-gallery-dots"
          />
          <span className="investor-gallery-count" aria-hidden="true">
            <Images size={12} />
            {index + 1}/{images.length}
          </span>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            Foto {index + 1} dari {images.length}
          </span>
        </>
      )}
    </div>
  );
}

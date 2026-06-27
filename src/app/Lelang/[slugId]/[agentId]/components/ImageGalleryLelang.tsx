"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Icon } from "@iconify/react";

const LightboxPortal = dynamic(() => import("./LightboxPortal"), { ssr: false });

export default function ImageGallery({ images }: { images: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);

  const mobileSliderRef = useRef<HTMLDivElement>(null);

  const displayImagesGrid =
    images.length >= 5
      ? images.slice(0, 5)
      : [
          ...images,
          ...Array(5 - images.length).fill(
            images[images.length - 1] || "/images/hero/banner.jpg"
          ),
        ];

  const mobileImages = images;

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const openLightbox = (index: number) => {
    setPhotoIndex(index);
    setIsOpen(true);
  };

  const closeLightbox = () => setIsOpen(false);

  const nextPhoto = useCallback(() => {
    setPhotoIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevPhoto = useCallback(() => {
    setPhotoIndex((prev) => (prev + images.length - 1) % images.length);
  }, [images.length]);

  const handleScrollUpdate = () => {
    if (mobileSliderRef.current) {
      const { scrollLeft, clientWidth } = mobileSliderRef.current;
      const newIndex = Math.round(scrollLeft / clientWidth);
      setMobileActiveIndex(newIndex);
    }
  };

  const scrollMobile = (direction: "left" | "right") => {
    if (!mobileSliderRef.current) return;

    const { clientWidth, scrollLeft } = mobileSliderRef.current;
    const currentIndex = Math.round(scrollLeft / clientWidth);

    let targetIndex =
      direction === "left" ? currentIndex - 1 : currentIndex + 1;
    targetIndex = Math.max(0, Math.min(targetIndex, mobileImages.length - 1));

    mobileSliderRef.current.scrollTo({
      left: targetIndex * clientWidth,
      behavior: "smooth",
    });

    setMobileActiveIndex(targetIndex);
  };

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextPhoto();
      if (e.key === "ArrowLeft") prevPhoto();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, nextPhoto, prevPhoto]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = "/images/hero/banner.jpg";
  };

  return (
    <div className="w-full relative">
      {/* DESKTOP GRID */}
      <div className="hidden lg:grid grid-cols-4 grid-rows-2 gap-3 h-[450px] rounded-2xl overflow-hidden">
        <div
          className="col-span-2 row-span-2 relative cursor-pointer group overflow-hidden"
          onClick={() => openLightbox(0)}
        >
          <Image
            src={displayImagesGrid[0]}
            alt="Main View"
            fill
            sizes="(max-width: 1024px) 0px, 60vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            priority
            onError={handleImageError}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
        </div>

        {displayImagesGrid.slice(1, 5).map((img, idx) => (
          <div
            key={idx}
            className="relative cursor-pointer group col-span-1 row-span-1 overflow-hidden"
            onClick={() => openLightbox(idx + 1)}
          >
            <Image
              src={img}
              alt={`Gallery ${idx}`}
              fill
              sizes="(max-width: 1024px) 0px, 30vw"
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              onError={handleImageError}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />

            {idx === 3 && images.length > 5 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openLightbox(4);
                  }}
                  className="bg-white text-black px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-gray-100 transition-colors active:scale-95"
                >
                  <Icon icon="solar:gallery-bold-duotone" className="text-lg" />
                  Lihat Semua ({images.length})
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MOBILE SLIDER dengan padding top */}
      <div className="lg:hidden relative h-[300px] sm:h-[340px] w-full overflow-hidden">
        <div
          ref={mobileSliderRef}
          onScroll={handleScrollUpdate}
          className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide touch-pan-x rounded-2xl"
        >
          {mobileImages.map((img, idx) => (
            <div
              key={idx}
              className="relative h-full min-w-full snap-center bg-gray-900"
              onClick={() => openLightbox(idx)}
            >
              <Image
                src={img}
                alt={`Slide ${idx}`}
                fill
                className="object-cover"
                onError={handleImageError}
                priority={idx === 0}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
            </div>
          ))}
        </div>

        {/* Arrow Kiri */}
        {mobileActiveIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              scrollMobile("left");
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-sm text-white p-2.5 rounded-full shadow-xl active:scale-95 transition-all z-20 border border-white/20"
          >
            <Icon icon="solar:alt-arrow-left-linear" className="text-xl" />
          </button>
        )}

        {/* Arrow Kanan */}
        {mobileActiveIndex < mobileImages.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              scrollMobile("right");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-sm text-white p-2.5 rounded-full shadow-xl active:scale-95 transition-all z-20 border border-white/20"
          >
            <Icon icon="solar:alt-arrow-right-linear" className="text-xl" />
          </button>
        )}

        {/* Counter */}
        <div className="absolute bottom-4 right-4 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-white border border-white/10 pointer-events-none z-10 shadow-lg">
          {mobileActiveIndex + 1} / {images.length}
        </div>

        {/* Dots */}
        <div className="absolute bottom-4 left-4 flex gap-1.5 z-10">
          {images.slice(0, Math.min(5, images.length)).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full backdrop-blur-sm transition-all duration-300 ${
                i === mobileActiveIndex ? "bg-white w-4" : "bg-white/40 w-1.5"
              }`}
            />
          ))}
          {images.length > 5 && (
            <div className="text-white/70 text-[10px] font-bold ml-1 self-center">
              +{images.length - 5}
            </div>
          )}
        </div>
      </div>

      {/* LIGHTBOX — lazy-loaded, framer-motion dimuat hanya saat dibuka */}
      {mounted && isOpen && (
        <LightboxPortal
          images={images}
          photoIndex={photoIndex}
          onClose={closeLightbox}
          onNext={nextPhoto}
          onPrev={prevPhoto}
        />
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

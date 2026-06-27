"use client";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";

interface LightboxPortalProps {
  images: string[];
  photoIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function LightboxPortal({
  images,
  photoIndex,
  onClose,
  onNext,
  onPrev,
}: LightboxPortalProps) {
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[99999999] bg-black flex items-center justify-center w-screen h-screen top-0 left-0"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
        >
          <Icon icon="solar:close-circle-bold" className="text-3xl lg:text-4xl text-gray-300 hover:text-white" />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-2 lg:left-8 z-50 p-3 lg:p-4 rounded-full bg-black/50 text-white transition-all active:scale-95 hover:bg-white hover:text-black border border-white/10"
        >
          <Icon icon="solar:alt-arrow-left-linear" className="text-2xl lg:text-3xl" />
        </button>

        <motion.div
          key={photoIndex}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative w-full h-full max-h-[80vh] lg:max-h-[85vh] max-w-[95vw] lg:max-w-[90vw] flex items-center justify-center"
        >
          <Image
            src={images[photoIndex]}
            alt="Cinema View"
            fill
            sizes="(max-width: 768px) 95vw, 90vw"
            className="object-contain"
            priority
            quality={100}
          />
        </motion.div>

        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-2 lg:right-8 z-50 p-3 lg:p-4 rounded-full bg-black/50 text-white transition-all active:scale-95 hover:bg-white hover:text-black border border-white/10"
        >
          <Icon icon="solar:alt-arrow-right-linear" className="text-2xl lg:text-3xl" />
        </button>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/5 text-white font-bold text-sm tracking-widest z-50">
          {photoIndex + 1} / {images.length}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

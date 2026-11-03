"use client";
import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
/** Missing source photos use a neutral placeholder, never another property's photo. */
export default function ListingImage({
  src,
  alt,
  sizes,
  className = "",
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 text-slate-400">
      <ImageOff size={28} aria-hidden="true" />
      <span className="text-[11px]">Foto belum tersedia</span>
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Robust editorial cover image.
 * - `unoptimized` so admin-pasted URLs from any host render without
 *   needing next.config remotePatterns entries.
 * - Falls back to a branded gradient when missing or broken.
 */
export default function CoverImage({
  src,
  alt,
  className = "",
  sizes,
  priority,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const usable = src && !failed;

  if (!usable) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#0f1f1a] via-[#0a1410] to-[#0a0a0a] ${className}`}
      >
        <div className="flex flex-col items-center gap-2 opacity-40">
          <svg
            viewBox="0 0 24 24"
            className="h-10 w-10 text-emerald-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
            <path d="M9 22V12h6v10" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/70">
            Solusindo Aset
          </span>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={src as string}
      alt={alt}
      fill
      unoptimized
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

// app/dashboard/hrm/components/shared/Avatar.tsx
"use client";

import { useState } from "react";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  status?: "online" | "offline";
}

const SIZE = {
  sm: { wrapper: "h-8 w-8",  text: "text-xs",  dot: "h-2.5 w-2.5" },
  md: { wrapper: "h-10 w-10", text: "text-sm",  dot: "h-3 w-3" },
  lg: { wrapper: "h-14 w-14", text: "text-base", dot: "h-3.5 w-3.5" },
};

// Warna background berdasarkan huruf pertama nama
const PALETTE = [
  "bg-emerald-500/30 text-emerald-200",
  "bg-blue-500/30 text-blue-200",
  "bg-violet-500/30 text-violet-200",
  "bg-amber-500/30 text-amber-200",
  "bg-rose-500/30 text-rose-200",
  "bg-cyan-500/30 text-cyan-200",
  "bg-pink-500/30 text-pink-200",
  "bg-orange-500/30 text-orange-200",
];

function getInitials(name: string) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function getColor(name: string) {
  const code = (name ?? "").charCodeAt(0) || 0;
  return PALETTE[code % PALETTE.length];
}

function buildGoogleDriveUrl(raw: string): { thumb: string; full: string } | null {
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      const idFromQuery = url.searchParams.get("id");
      if (idFromQuery) {
        return {
          thumb: `https://drive.google.com/thumbnail?id=${idFromQuery}&sz=w128`,
          full:  `https://drive.google.com/uc?export=view&id=${idFromQuery}`,
        };
      }
      const match = raw.match(/\/d\/([^/]+)/);
      if (match?.[1]) {
        return {
          thumb: `https://drive.google.com/thumbnail?id=${match[1]}&sz=w128`,
          full:  `https://drive.google.com/uc?export=view&id=${match[1]}`,
        };
      }
      // URL lain langsung pakai
      return { thumb: raw, full: raw };
    } catch {
      return null;
    }
  }

  // Anggap sebagai Google Drive file ID
  return {
    thumb: `https://drive.google.com/thumbnail?id=${raw}&sz=w128`,
    full:  `https://drive.google.com/uc?export=view&id=${raw}`,
  };
}

export function Avatar({ src, name, size = "md", status }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const s = SIZE[size];
  const initials = getInitials(name);
  const colorClass = getColor(name);

  const urls = src?.trim() ? buildGoogleDriveUrl(src.trim()) : null;
  const showImg = urls && !imgFailed;

  return (
    <div className="relative inline-block shrink-0">
      <div
        className={`${s.wrapper} rounded-full border border-white/10 flex items-center justify-center overflow-hidden`}
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urls.thumb}
            alt={name}
            className="h-full w-full object-cover"
            onError={(e) => {
              // Coba full URL dulu
              if ((e.target as HTMLImageElement).src !== urls.full) {
                (e.target as HTMLImageElement).src = urls.full;
              } else {
                setImgFailed(true);
              }
            }}
          />
        ) : (
          // Fallback: initials dengan warna
          <div className={`h-full w-full flex items-center justify-center font-bold ${s.text} ${colorClass}`}>
            {initials}
          </div>
        )}
      </div>

      {status && (
        <span
          className={`absolute bottom-0 right-0 ${s.dot} rounded-full border-2 border-[#05060A] ${
            status === "online" ? "bg-emerald-400" : "bg-slate-500"
          }`}
        />
      )}
    </div>
  );
}

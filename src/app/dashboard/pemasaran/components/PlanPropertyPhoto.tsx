"use client";

import { useState } from "react";
import type { AssetSnapshot } from "@/lib/marketing/domain";
import { ImageIcon } from "./MarketingIcons";

/** The existing photo proxy serves genuine listing photos, including auction hosts. */
export default function PlanPropertyPhoto({
  asset,
  source = "listing",
  size = "thumbnail",
}: {
  asset: AssetSnapshot;
  source?: "listing" | "example";
  size?: "thumbnail" | "card";
}) {
  const [index, setIndex] = useState(0);
  return (
    <span className="marketing-property-photo" aria-hidden="true">
      {index < asset.images.length ? (
        <img
          key={index}
          src={
            source === "example"
              ? asset.images[index]
              : `/api/foto/${asset.id}?view=card&w=${size === "card" ? 640 : 118}&index=${index}`
          }
          alt=""
          width={size === "card" ? 640 : 56}
          height={size === "card" ? 400 : 56}
          loading="lazy"
          decoding="async"
          onError={() => setIndex((value) => value + 1)}
        />
      ) : (
        <ImageIcon size={20} />
      )}
    </span>
  );
}

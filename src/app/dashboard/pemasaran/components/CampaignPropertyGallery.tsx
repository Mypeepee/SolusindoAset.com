"use client";
import type { AssetSnapshot } from "@/lib/marketing/domain";
import type { InstagramMedia } from "@/lib/marketing/instagram-content";
import { DialogFrame } from "@/components/ui/dialog";
import InstagramCarousel from "./InstagramCarousel";
import { number } from "./ui";

/** Source-property gallery shared by current stock and historical previews. */
export default function CampaignPropertyGallery({
  asset,
  source = "listing",
  archive = false,
  onClose,
}: {
  asset: AssetSnapshot | null;
  source?: "listing" | "example";
  archive?: boolean;
  onClose: () => void;
}) {
  const slides: InstagramMedia[] = asset
    ? asset.images.map((url, index) => ({
        id: asset.id + ":photo:" + index,
        caption: "",
        type: "IMAGE",
        product: "FEED",
        mediaUrl:
          source === "example"
            ? url
            : `/api/foto/${asset.id}?view=card&index=${index}&w=640`,
        thumbnailUrl: null,
        permalink: null,
        timestamp: null,
        likes: null,
        comments: null,
        commentsEnabled: null,
      }))
    : [];
  return (
    <DialogFrame
      open={!!asset}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Foto properti"
      description={
        archive
          ? "Foto asli dari arsip properti; bukan penawaran aktif."
          : "Foto properti dari sumber listing."
      }
      contentClassName="marketing-modal marketing-preview-modal campaign-theme campaign-property-gallery"
    >
      {asset && (
        <>
          <p className="marketing-eyebrow">
            {archive
              ? "Properti arsip"
              : source === "example"
                ? "Contoh properti"
                : "Foto properti"}
          </p>
          <h3>{asset.address || asset.title}</h3>
          <p className="campaign-gallery-price">
            Rp {number(asset.price)} <span>· {asset.city}</span>
          </p>
          <InstagramCarousel
            key={asset.id}
            media={slides[0]}
            slides={slides}
            labels={slides.map((_, index) => "Foto properti " + (index + 1))}
          />
        </>
      )}
    </DialogFrame>
  );
}

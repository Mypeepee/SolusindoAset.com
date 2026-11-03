"use client";
import { useState } from "react";
import { toast } from "sonner";
import { DialogFrame } from "@/components/ui/dialog";
import type { InstagramMedia } from "@/lib/marketing/instagram-content";
import InstagramCarousel from "./InstagramCarousel";
import { Action, date, imageUrl, stateLabels, type Job } from "./ui";
import "./instagram-workspace.css";
export default function MarketingPreviewDialog({
  preview,
  onClose,
}: {
  preview: Job | null;
  onClose: () => void;
}) {
  const [copying, setCopying] = useState(false);
  const slides: InstagramMedia[] = preview
    ? [
        "feed.jpg",
        ...(Array.isArray(preview.media)
          ? preview.media.flatMap((item) =>
              item &&
              typeof item === "object" &&
              "name" in item &&
              typeof item.name === "string" &&
              /^photo-[1-3]\.jpg$/.test(item.name)
                ? [item.name]
                : [],
            )
          : []
        ).sort(),
      ].map((name) => ({
        id: preview.id + "/" + name,
        caption: preview.caption,
        type: "IMAGE",
        product: "FEED",
        mediaUrl: imageUrl(preview.id, name),
        thumbnailUrl: imageUrl(preview.id, name),
        permalink: null,
        timestamp: null,
        likes: null,
        comments: null,
        commentsEnabled: null,
      }))
    : [];
  const labels = slides.map((_, i) =>
    i === 0 ? "Poster utama" : `Foto detail ${i}`,
  );
  return (
    <DialogFrame
      open={!!preview}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Pratinjau materi pemasaran"
      description="Instagram: poster lalu foto detail. WhatsApp: satu poster. Caption menggunakan data properti yang sama."
      contentClassName="marketing-modal marketing-preview-modal instagram-studio-dialog"
    >
      <h2>Materi pemasaran</h2>
      {preview && (
        <p className="marketing-muted">
          {date(preview.scheduledFor)} WIB · {stateLabels(preview.status)}
        </p>
      )}
      {preview && (
        <>
          <div className="marketing-preview-images">
            <figure>
              <figcaption>
                Carousel Instagram · 4:5 · 1080×1350 · {slides.length} slide
              </figcaption>
              <InstagramCarousel
                key={preview.id}
                media={slides[0]}
                slides={slides}
                labels={labels}
              />
              <a
                className="marketing-action marketing-download"
                href={imageUrl(preview.id, "feed.jpg")}
                download="01-poster-instagram.jpg"
              >
                Unduh poster Instagram
              </a>
            </figure>
            <figure>
              <figcaption>
                Status WhatsApp · 9:16 · 1080×1920 · 1 poster
              </figcaption>
              <img
                src={imageUrl(preview.id, "story.jpg")}
                alt="Poster Status WhatsApp"
                width={1080}
                height={1920}
              />
              <a
                className="marketing-action marketing-download"
                href={imageUrl(preview.id, "story.jpg")}
                download="poster-status-whatsapp.jpg"
              >
                Unduh poster WhatsApp
              </a>
            </figure>
          </div>
          <div className="marketing-caption-heading">
            <h3>Caption Instagram</h3>
            <Action
              disabled={copying}
              onClick={async () => {
                setCopying(true);
                try {
                  await navigator.clipboard.writeText(preview.caption);
                  toast.success("Caption disalin.");
                } catch {
                  toast.error(
                    "Caption belum bisa disalin. Pilih teks caption lalu salin secara manual.",
                  );
                } finally {
                  setCopying(false);
                }
              }}
            >
              Salin caption
            </Action>
          </div>
          <pre className="marketing-caption">{preview.caption}</pre>
          <p className="marketing-footnote">
            Jika tautan di caption tidak bisa diketuk, calon pembeli dapat
            memindai QR di poster atau mengirim DM dengan kode properti.
          </p>
          <p className="marketing-footnote">
            Pratinjau tidak menerbitkan konten. Harga dan kelayakan diperiksa
            lagi sebelum publikasi.
          </p>
        </>
      )}
    </DialogFrame>
  );
}

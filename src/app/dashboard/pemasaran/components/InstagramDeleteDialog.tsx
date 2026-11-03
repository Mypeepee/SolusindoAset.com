"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { DialogFrame } from "@/components/ui/dialog";
import {
  instagramMediaLabel,
  type InstagramMedia,
} from "@/lib/marketing/instagram-content";
import { instagramRequest, instagramRequestId } from "./instagram-api";
import { Action, date } from "./ui";
import { ExternalLink, ImageIcon } from "./MarketingIcons";

/** One deletion owner for direct gallery actions and the content manager. */
export default function InstagramDeleteDialog({
  media,
  accountId,
  onClose,
  onDeleted,
  onBusy,
  nested = false,
}: {
  media: InstagramMedia;
  accountId: string;
  onClose: () => void;
  onDeleted: () => void;
  onBusy?: (value: boolean) => void;
  nested?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false),
    [imageFailed, setImageFailed] = useState(false);
  const requestId = useRef(""),
    mutation = useRef(false),
    cancel = useRef<HTMLButtonElement>(null);
  const image =
    media.thumbnailUrl || (media.type !== "VIDEO" ? media.mediaUrl : null);
  async function remove() {
    if (mutation.current || blocked) return;
    mutation.current = true;
    setBusy(true);
    onBusy?.(true);
    setError("");
    try {
      requestId.current ||= instagramRequestId();
      await instagramRequest(
        {},
        {
          action: "delete-media",
          mediaId: media.id,
          accountId,
          requestId: requestId.current,
        },
      );
      toast.success("Postingan dihapus dari Instagram.");
      onDeleted();
    } catch (failure) {
      const code = (failure as { code?: string }).code;
      setError(
        code
          ? (failure as Error).message
          : "Koneksi terputus; hasil belum dapat dipastikan. Periksa Instagram atau coba permintaan yang sama untuk membaca hasil tersimpan.",
      );
      if (
        [
          "INSTAGRAM_ACTION_UNCERTAIN",
          "INSTAGRAM_ACTION_PENDING",
          "INSTAGRAM_ACTION_FAILED",
        ].includes(code || "")
      )
        setBlocked(true);
    } finally {
      mutation.current = false;
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <DialogFrame
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title="Hapus postingan dari Instagram?"
      description="Postingan yang dipilih akan dihapus dari akun Instagram yang terhubung."
      contentClassName="marketing-modal marketing-small-modal instagram-studio-dialog instagram-delete-dialog"
      layer={nested ? 10002 : undefined}
      initialFocusRef={cancel}
      hideClose={busy}
      focusFallbackId="instagram-content-search"
    >
      <h2>Hapus postingan ini?</h2>
      <div className="ig-delete-preview">
        <div className="ig-delete-thumbnail">
          {image && !imageFailed ? (
            <img
              src={image}
              alt="Postingan yang akan dihapus"
              onError={() => setImageFailed(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <ImageIcon size={24} />
          )}
        </div>
        <div>
          <strong>
            {media.caption.slice(0, 180) || "Postingan Instagram"}
          </strong>
          <p>
            {instagramMediaLabel(media)} · {date(media.timestamp)} WIB
          </p>
        </div>
      </div>
      <p>
        Postingan beserta interaksinya akan dihapus dari Instagram. Seluruh
        slide carousel ikut terhapus. Tindakan ini tidak dapat dibatalkan
        melalui aplikasi.
      </p>
      {error && (
        <p className="marketing-error" role="alert">
          {error}
        </p>
      )}
      {media.permalink && (
        <a
          className="marketing-link"
          href={media.permalink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Periksa di Instagram <ExternalLink size={14} />
        </a>
      )}
      <div className="marketing-modal-actions">
        <Action ref={cancel} disabled={busy} onClick={onClose}>
          Batal
        </Action>
        <Action
          className="instagram-danger"
          disabled={busy || blocked}
          aria-busy={busy}
          onClick={() => void remove()}
        >
          {busy ? "Menghapus…" : "Hapus postingan"}
        </Action>
      </div>
    </DialogFrame>
  );
}

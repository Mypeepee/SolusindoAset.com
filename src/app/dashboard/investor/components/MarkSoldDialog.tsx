"use client";

import { useRef, useState } from "react";
import {
  CheckCircledIcon,
  HomeIcon,
  InfoCircledIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import { DialogFrame } from "@/components/ui/dialog";
import { formatRupiah, type InvestorListing } from "@/lib/investor-deals";

/** Investor status confirmation; DialogFrame owns focus, scroll and dismissal. */
export default function MarkSoldDialog({
  listing,
  saving,
  error,
  onConfirm,
  onClose,
}: {
  listing: InvestorListing;
  saving: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <DialogFrame
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      title="Tandai aset terjual?"
      description="Aset ini dan semua listing historisnya akan ditandai terjual dan dikeluarkan dari daftar Investor."
      contentClassName="investor-surface investor-sold-dialog"
      overlayClassName="investor-dialog-overlay"
      hideClose
      initialFocusRef={cancelRef}
      focusFallbackId="investor-heading"
    >
      <div className="investor-sold-dialog-core">
        <div className="investor-sold-dialog-body">
          <span className="investor-sold-emblem" aria-hidden="true">
            <CheckCircledIcon />
          </span>
          <p className="investor-sold-eyebrow">Status aset</p>
          <h2>Tandai aset terjual?</h2>
          <p className="investor-sold-intro">
            Pastikan aset yang Anda pilih sudah terjual.
          </p>
          <div className="investor-sold-asset-tray">
            <div className="investor-sold-asset">
              <div className="investor-sold-thumbnail">
                {listing.imageUrl && !imageFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.imageUrl}
                    alt=""
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <HomeIcon aria-hidden="true" />
                )}
              </div>
              <div className="investor-sold-asset-copy">
                <span className="investor-sold-asset-id">#{listing.id}</span>
                <p>{listing.address || listing.title}</p>
                {listing.cityName && <span>{listing.cityName}</span>}
                <strong>{formatRupiah(listing.currentAuctionPrice)}</strong>
              </div>
            </div>
          </div>
          <div className="investor-sold-consequence">
            <InfoCircledIcon aria-hidden="true" />
            <p>
              Aset ini dan <strong>semua listing historisnya</strong> akan
              ditandai terjual dan dikeluarkan dari daftar Investor.
            </p>
          </div>
          {error && (
            <p className="investor-sold-error" role="alert">
              {error} Silakan coba lagi.
            </p>
          )}
        </div>
        <div className="investor-sold-dialog-footer">
          <button
            ref={cancelRef}
            type="button"
            className="investor-sold-cancel"
            disabled={saving}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="investor-sold-action investor-sold-confirm"
            disabled={saving}
            aria-busy={saving}
            onClick={onConfirm}
          >
            <span className="investor-sold-label" aria-live="polite">
              {saving ? "Menyimpan…" : "Tandai terjual"}
            </span>
            <span className="investor-sold-icon" aria-hidden="true">
              {saving ? (
                <UpdateIcon className="investor-sold-spinner" />
              ) : (
                <CheckCircledIcon />
              )}
            </span>
          </button>
        </div>
      </div>
    </DialogFrame>
  );
}

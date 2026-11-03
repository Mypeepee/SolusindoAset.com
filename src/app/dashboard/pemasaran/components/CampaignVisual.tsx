"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { campaignStatus, type CampaignRecord } from "@/lib/marketing/campaign";
import type { AssetSnapshot } from "@/lib/marketing/domain";
import { CheckCircle, Clock, Layers, Pause, Play } from "./MarketingIcons";

export function CampaignSurface({
  children,
  className = "",
  tone = "mint",
}: {
  children: ReactNode;
  className?: string;
  tone?: "mint" | "blue" | "amber" | "teal";
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={"campaign-bezel " + className}
      data-tone={tone}
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.04 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="campaign-panel-core">{children}</div>
    </motion.div>
  );
}

export function CampaignStatus({
  campaign,
  now,
}: {
  campaign: CampaignRecord;
  now?: Date;
}) {
  const status = campaignStatus(campaign, now);
  const Icon =
    status === "Dijeda"
      ? Pause
      : status === "Aktif"
        ? Play
        : status === "Terjadwal"
          ? Clock
          : status === "Berakhir"
            ? CheckCircle
            : Layers;
  return (
    <span className="campaign-status" data-status={status}>
      <Icon size={13} />
      {status}
    </span>
  );
}

export function CampaignSectionHeading({
  icon,
  title,
  children,
  step,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  step?: string;
}) {
  return (
    <div className="campaign-section-title">
      <span className="campaign-section-icon">{icon}</span>
      <div>
        <h3>{title}</h3>
        {children && <p>{children}</p>}
      </div>
      {step && (
        <span className="campaign-section-step" aria-hidden="true">
          {step}
        </span>
      )}
    </div>
  );
}

export function CampaignButtonIcon({ children }: { children: ReactNode }) {
  return (
    <span className="campaign-button-icon" aria-hidden="true">
      {children}
    </span>
  );
}

/** Only source-backed percentages; an absent benchmark is never padded with zero. */
export function CampaignDiscountFacts({
  asset,
  compact = false,
}: {
  asset: AssetSnapshot;
  compact?: boolean;
}) {
  const format = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
  const market = asset.marketSpreadPct,
    auction = asset.auctionDropPct;
  if (!Number.isFinite(market) && !Number.isFinite(auction)) return null;
  return (
    <span className="campaign-discount-facts" data-compact={compact}>
      {market != null && Number.isFinite(market) && (
        <span
          data-metric="market"
          title={`${format.format(Math.abs(market))}% ${market < 0 ? "di atas" : "di bawah"} harga kelurahan`}
        >
          {compact
            ? `Kelurahan ${market === 0 ? "" : market < 0 ? "+" : "−"}${format.format(Math.abs(market))}%`
            : `${format.format(Math.abs(market))}% ${market < 0 ? "di atas" : "di bawah"} kelurahan`}
        </span>
      )}
      {auction != null && Number.isFinite(auction) && (
        <span
          data-metric="auction"
          title={`Nilai lelang ${auction < 0 ? "naik" : "turun"} ${format.format(Math.abs(auction))}%`}
        >
          {compact
            ? `Lelang ${auction === 0 ? "" : auction < 0 ? "+" : "−"}${format.format(Math.abs(auction))}%`
            : `Lelang ${auction < 0 ? "naik" : "turun"} ${format.format(Math.abs(auction))}%`}
        </span>
      )}
    </span>
  );
}

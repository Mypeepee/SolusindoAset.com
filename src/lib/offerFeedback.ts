// Mapping tawaran negosiasi → seberapa realistis dibanding harga pasar.
// Riset rentang nego properti Indonesia: 0-5% nego standar, 5-15% masih umum,
// 15-25% agresif, 25-35% rendah, >35% jauh di bawah pasar (sering diabaikan agen/penjual).

export type OfferTier = "over" | "fair" | "great" | "good" | "aggressive" | "low" | "unrealistic";

export interface OfferFeedback {
  tier: OfferTier;
  message: string;
  textClass: string;
  barClass: string;
  icon: string;
  /** Posisi indikator pada gauge, 0-100 */
  gaugePct: number;
}

export function getOfferFeedback(diffPct: number, priceLabel: string = "harga listing"): OfferFeedback {
  const gaugePct = Math.min(Math.max(diffPct, 0), 40) / 40 * 100;

  if (diffPct < 0) {
    return {
      tier: "over",
      message: `Tawaran Anda melebihi ${priceLabel}`,
      textClass: "text-amber-400/70",
      barClass: "bg-amber-400",
      icon: "solar:arrow-up-bold",
      gaugePct: 0,
    };
  }
  if (diffPct === 0) {
    return {
      tier: "fair",
      message: `Sesuai ${priceLabel}`,
      textClass: "text-white/40",
      barClass: "bg-white/40",
      icon: "solar:check-circle-bold",
      gaugePct: 0,
    };
  }
  if (diffPct <= 5) {
    return {
      tier: "great",
      message: `${diffPct}% di bawah ${priceLabel} — wajar, peluang diterima tinggi`,
      textClass: "text-[#86efac]/80",
      barClass: "bg-[#86efac]",
      icon: "solar:check-circle-bold",
      gaugePct,
    };
  }
  if (diffPct <= 15) {
    return {
      tier: "good",
      message: `${diffPct}% di bawah ${priceLabel} — dalam rentang nego umum`,
      textClass: "text-[#86efac]/70",
      barClass: "bg-[#86efac]",
      icon: "solar:like-bold",
      gaugePct,
    };
  }
  if (diffPct <= 25) {
    return {
      tier: "aggressive",
      message: `${diffPct}% di bawah ${priceLabel} — agresif, sertakan alasan kuat (cash, siap closing cepat)`,
      textClass: "text-amber-400/80",
      barClass: "bg-amber-400",
      icon: "solar:info-circle-bold",
      gaugePct,
    };
  }
  if (diffPct <= 35) {
    return {
      tier: "low",
      message: `${diffPct}% di bawah ${priceLabel} — peluang diterima kecil, kecuali penjual butuh cepat`,
      textClass: "text-orange-400/80",
      barClass: "bg-orange-400",
      icon: "solar:danger-triangle-bold",
      gaugePct,
    };
  }
  return {
    tier: "unrealistic",
    message: `${diffPct}% di bawah ${priceLabel} — jauh di bawah pasar, berisiko diabaikan`,
    textClass: "text-rose-400/80",
    barClass: "bg-rose-400",
    icon: "solar:close-circle-bold",
    gaugePct,
  };
}

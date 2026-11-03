import { calculateRoi, type ListingCategory } from "./investor-deals";
import { TARIF_BALIK_NAMA } from "./lelangBiaya";

export interface PurchaseAssumptions {
  price: number;
  /** Percentage points, e.g. 5 = 5%. At most two decimal places. */
  rates: Record<string, number>;
  eviction: number;
}
export interface PurchaseFee {
  code: string;
  label: string;
  rate: number;
  amount: number;
}
export const isAuctionPurchase = (category?: ListingCategory | null) =>
  !category || category === "LELANG";

export function purchaseFeeDefinitions(category?: ListingCategory | null) {
  return isAuctionPurchase(category)
    ? ["bphtb", "bea_lelang", "ppn_lelang", "roya_balik_nama"].map((code) => {
        const fee = TARIF_BALIK_NAMA.find((item) => item.kode === code)!;
        return {
          code,
          label: fee.label,
          rate: Math.round(fee.persen * 10000) / 100,
        };
      })
    : [
        { code: "bphtb", label: "BPHTB", rate: 5 },
        { code: "ajb", label: "AJB", rate: 0.5 },
      ];
}

export function defaultPurchaseAssumptions(
  price: number,
  category?: ListingCategory | null,
): PurchaseAssumptions {
  return {
    price,
    rates: Object.fromEntries(
      purchaseFeeDefinitions(category).map((fee) => [fee.code, fee.rate]),
    ),
    eviction: isAuctionPurchase(category) ? 135_000_000 : 0,
  };
}

/** Round each fee to IDR before adding. Integer arithmetic also handles half-Rupiah ties. */
export function calculatePurchase(
  assumptions: PurchaseAssumptions,
  category?: ListingCategory | null,
) {
  const { price, rates, eviction } = assumptions;
  if (
    !Number.isSafeInteger(price) ||
    price <= 0 ||
    !Number.isSafeInteger(eviction) ||
    eviction < 0
  )
    return null;
  const fees: PurchaseFee[] = [];
  for (const definition of purchaseFeeDefinitions(category)) {
    const rate = rates[definition.code];
    if (
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 100 ||
      Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-7
    )
      return null;
    const basisPoints = Math.round(rate * 100);
    const amount = Number(
      (BigInt(price) * BigInt(basisPoints) + BigInt(5000)) / BigInt(10000),
    );
    if (!Number.isSafeInteger(amount)) return null;
    fees.push({ ...definition, rate, amount });
  }
  const documents = fees.reduce((sum, fee) => sum + fee.amount, 0);
  const clearing = isAuctionPurchase(category) ? eviction : 0;
  const total = price + documents + clearing;
  if (!Number.isSafeInteger(total)) return null;
  return { price, fees, documents, eviction: clearing, total };
}

export function calculateResaleScenario(
  totalPurchase: number | null,
  pricePerSqm: number | null | undefined,
  landArea: number | null,
) {
  if (
    !totalPurchase ||
    !pricePerSqm ||
    !landArea ||
    !Number.isFinite(pricePerSqm) ||
    pricePerSqm <= 0 ||
    !Number.isFinite(landArea) ||
    landArea <= 0
  )
    return null;
  const resalePrice = Math.round(pricePerSqm * landArea);
  if (!Number.isSafeInteger(resalePrice)) return null;
  const result = calculateRoi(totalPurchase, resalePrice, 0);
  return result ? { ...result, resalePrice } : null;
}

/** Call after transaction/type/geography/identity eligibility filtering. */
export function selectCmaEvidence<
  T extends {
    assetCode: string;
    baselinePricePerSqm: number;
    updatedAt: string;
  },
>(peers: T[], targetAssetCode: string) {
  const ordered = peers
    .filter(
      (peer) =>
        peer.assetCode !== targetAssetCode &&
        Number.isFinite(peer.baselinePricePerSqm) &&
        peer.baselinePricePerSqm > 0,
    )
    .sort(
      (a, b) =>
        b.baselinePricePerSqm - a.baselinePricePerSqm ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.assetCode.localeCompare(b.assetCode),
    );
  const cheapestPeer = ordered.at(-1) ?? null;
  return {
    samples: ordered.slice(0, 9),
    minBaselinePricePerSqm: cheapestPeer?.baselinePricePerSqm ?? null,
    cheapestPeer,
  };
}

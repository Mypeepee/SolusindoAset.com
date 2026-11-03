import { withInvestorRead } from "@/lib/investor-read.server";
import {
  isolateTransactionFilters,
  type CmaValidationProof,
  type DealFilters,
  type InvestorFeed,
} from "@/lib/investor-deals";
import {
  getLegacyInvestorFeed,
  getCachedInvestorFeed,
  getCachedCmaProof,
  getLegacyCmaProof,
} from "@/lib/investor-cma-legacy.server";

// A shared snapshot reads stored CMA when ready, then validates the auction
// driver with the existing history engine BEFORE OR qualification/ranking.
export async function getInvestorFeed(
  filters: DealFilters,
  page: number,
  view: string,
  savedIds: string[],
  refresh = false,
): Promise<InvestorFeed> {
  const isolated = isolateTransactionFilters(filters);
  const cached =
    !refresh && getCachedInvestorFeed(isolated, page, view, savedIds);
  if (cached) return cached;
  return withInvestorRead((tx) =>
    getLegacyInvestorFeed(tx, isolated, page, view, savedIds, refresh),
  );
}
export async function getCmaValidationProof(
  id: string,
): Promise<CmaValidationProof | null> {
  const cached = getCachedCmaProof(id);
  if (cached) return cached;
  return withInvestorRead((tx) => getLegacyCmaProof(tx, id));
}

# Investor valuation pipeline v2

Authority: the current Investor dashboard requirements. `/dashboard/investor`,
feed, proof and location correction require a freshly verified active OWNER.
The existing public listing table remains the canonical source.

## Auction Drop: authoritative history

Investor now uses the existing `Riwayat Lelang Aset` collector from
`auctionHistory.ts` (matching, identical parcel scope, event deduplication and
chronology). `auction-history-prices.server.ts` batches candidates for the entire
ranking scope and computes `(first valid recorded price - current event price) /
first valid recorded price * 100`. It never substitutes the historical maximum,
uses a future event as an earlier comparison, or mixes partial/broader parcels.
Fewer than two distinct comparable priced events leaves Auction Drop unavailable.
Equal prices produce exactly 0%; increases remain negative. Values retain full
precision until display. Initial-price provenance and source IDs appear in the
Investor history table and link to the actual listings.

Target fingerprints and raw price/limit/date fields are read with the CMA row.
One set-based candidate query serves all targets; matching uses the same collector
and per-reference 1,000-candidate limit as the detail history. Raw NULL/zero limit
is preserved for identical event-key behavior. Full-scope requests avoid large
array/LIKE scans, then apply the same per-reference city predicates in memory.

Both source-CMA and stored-CMA paths pass through this history validation before
OR thresholds, signed-SUM ranking, summary, sorting and pagination. The validated target
initial price is separate from the existing stored CMA peer baseline. Legacy
stored auction scores are not trusted for Investor ranking; stored CMA ratios
and benchmarks remain usable. The shared 60-second snapshot contains the validated
history/metrics and feeds the ROI proof as well. This integration requires no
live schema installation or source price changes.

Regression examples: 1B → 250M = **75%**; 1B → 2B → 250M still **75%**;
306M → 306M = **0%**; different land parcels, duplicate events and missing price
history do not manufacture a discount. `verify-investor-auction-history.cjs`
compares real Investor results against the actual detail-history engine, including
source IDs 54948 and 64493 from the reported screenshot.

## Transaction and price contracts

BELI includes PRIMARY, LELANG and SECONDARY. SEWA is isolated in both queries
and UI. A source classified SEWA, or an explicitly rental-prefixed auction title,
never enters buy comparisons. Rental comparisons require the same structured
`listing_sewa_detail.durasi_sewa` period: HARIAN, MINGGUAN, BULANAN or TAHUNAN.
There is no inferred period or automatic annualization. Unknown rental periods
remain visible with an unavailable market metric. Auction drop and resale ROI
are unavailable for rentals. Legacy rental-prefixed auction records still link
to their actual source category route.

Every price/m² uses positive **land area**. Building area is absent from the
valuation query, cards, detail, table and analysis. Missing land is never replaced
by building area. Arithmetic keeps PostgreSQL numeric precision until display.

| Stored field in `investor_listing_valuations` | Formula / meaning                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `harga_lelang_pertama`                        | Earliest positive recorded auction baseline; mandatory for LELANG, otherwise nullable                 |
| `harga_lelang_terakhir`                       | Active buy offer / auction limit / selected-period rental tariff                                      |
| `harga_per_meter`                             | Initial auction baseline / land; nullable without auction evidence                                    |
| `current_price_per_meter`                     | Current price / land                                                                                  |
| `market_basis_per_meter`                      | LELANG: initial price / land. PRIMARY/SECONDARY: active offer / land. SEWA: same-period tariff / land |
| `metric_auction_drop_pct`                     | BELI + LELANG only: `(initial-current)/initial*100`                                                   |
| `metric_market_spread_pct`                    | `(peer_mean-current_price_per_meter)/peer_mean*100`                                                   |
| `primary_deal_score`                          | Signed `auction_drop + market_spread` in points; omit missing drivers; both missing remains NULL      |

A buy property qualifies when auction drop reaches its threshold **OR** market
spread reaches its threshold. Default thresholds are 25%. Rentals have only the
market driver. All modes default to descending combined points, with unknown last and
stable source-ID ties. The separate “Semua listing” and “Perlu verifikasi” scopes
make incomplete/nonqualifying data reachable without fabricating a deal score.

The TypeScript `ListingProperty` interface provides the requested complete
auction storage contract. `InvestorListing` is the UI/feed boundary and preserves
actual nulls for non-auction prices, missing land, kelurahan, dates and metrics.
`AuctionHistoryPoint` exposes round, date, price and drop from the initial price.

## Cleaning, identity and CMA

A missing/blank kelurahan ID **or** name excludes the target from market
calculation and excludes it as a peer, even when district peers exist. Such rows
have `market_eligible=false`, NULL benchmark/spread, scope NONE and count zero.
The UI shows “Data Kelurahan Belum Terverifikasi” and a correction action.
A proven auction drop can still qualify independently.

The source has no physical asset code. `AST-*` hashes canonical city, district,
kelurahan, certificate type and the complete normalized sorted certificate set.
Certificate order, separators and leading zeros do not create another asset;
different parcel bundles stay separate. Missing identity evidence produces
`UNVERIFIED-<source_id>` and never contributes as a peer. This is source identity
matching, not independent cadastral verification. `investor_assets` has a unique
physical code; the valuation projection is unique on `(asset_code,transaction_type)`
so one property may independently be offered for purchase and rent.

Within each intent, the latest observed event wins, with source ID breaking
same-date ties. Latest sold, withdrawn, invalid-price, non-property or unsupported
asset events suppress older available copies. First auction means earliest
**recorded** positive auction price, never maximum price; it does not assert
that the database contains the actual first auction round.

Peers must be latest active unique assets, have verified identity and geography,
positive land/baseline, exact property type and exact intent. Rentals must also
match period. Target asset is excluded. Use the arithmetic mean of the individual
ratios, not SUM(prices)/SUM(areas). The benchmark always uses the exact same
kelurahan, including a single valid peer. Two physical assets therefore compare
against one another. A target without a valid local peer keeps a NULL benchmark;
it is never expanded to kecamatan or city. A low-sample note explains fewer
than three peers without changing scope. There is no weighting, trimming or
type mixing.

The proof endpoint checks AVG/COUNT over the entire eligible peer set and returns
the nine highest-price/m² peer records, plus additive `imageUrl`,
`minBaselinePricePerSqm` and `cheapestPeer` fields. Mean and minimum use the
complete eligible pool before slicing; both exclude the target. The frontend
inserts the current target as the tenth row and sorts all visible rows by
descending price/m². Rows retain their actual category, source link, baseline
price, land and ratio. The cheapest reference may be outside the visible slice. A mismatch between stored
aggregate and proof fails explicitly instead of presenting inconsistent data.

## Owner location correction

GET `/api/dashboard/investor/:id/location` resolves city → kecamatan → kelurahan
through the same reference provider as `/api/regions/wilayah`. PATCH accepts
only region IDs and a source revision. Server validation checks each parent;
client-provided names are ignored. An active OWNER is required on every request.
Origin checks reject cross-site writes. A source row lock and revision comparison
produce HTTP 409 for concurrent changes. Only kecamatan, kelurahan and update
time change. Successful commit invalidates compatibility snapshots; installed
v2 ingestion triggers refresh the affected old/new district projections.

The shared dialog has loading, timeout, inline error, retry, dependent selections,
a single in-flight save, conflict/reload and server-confirmed Sonner success.
Choices survive a failed save. Closing discards this small local selection draft;
there is no autosave or unrelated listing edit. Native Select popups intentionally
use platform geometry/keyboard behavior, consistent with existing region forms.

## Stored pipeline and activation

`prisma/migration_investor_intent_v2.sql` creates the additive projection, physical
asset registry, city aliases, source-scope ledger, readiness state, constraints,
indexes and triggers. Original `listing` and v1 tables are retained. Enum-like
CHECK constraints cover intent, category, property and rental period. Partial
covering peer indexes start with intent/period/region/type; ranking indexes support
intent/city/score. Missing-kelurahan rows have a dedicated partial index.

`scripts/sql/investor-v2-storage.sql` is the storage template. Run
`node scripts/generate-investor-v2.cjs` after changing the canonical query. The
generator embeds that same query as `investor_v2_compute`, avoiding divergent
read-time and write-time math. Do not hand-edit the generated SQL function.

Statement transition-table triggers batch source INSERT/UPDATE/DELETE. Rental
period/tariff changes also refresh the projection. Normal ingestion refreshes
only affected city/district scopes for both intents, using ordered district
advisory locks. All old/new scopes are deleted before insertion to handle moved
source IDs safely. Unrelated view-counter changes do not recompute CMA. The
BEFORE trigger guards stored ratios, eligibility, metrics and the signed sum. A failed
refresh rolls back the source transaction. Full backfill takes a source-table
write barrier and belongs in a maintenance window; there is no such global
barrier during normal ingestion.

A new unknown city alias invalidates readiness until reconciliation, allowing
the compatibility reader to preserve visibility. Install/backfill atomically
seeds aliases, computes both intents, validates arithmetic and marks v2 ready.
The installer defaults to ROLLBACK. **Permanent activation has not been performed.**
The earlier auto-review rejected deploying persistent triggers/backfill because
that changes active write behavior; approval for that operation is still separate.

## Available before activation

Requests check v2 readiness, then prefer stored metrics when ready. Before that,
`investor-cma-legacy.server.ts` runs the same canonical SQL using SELECT only.
Window calculations avoid the underestimated repeated joins that previously
timed out nationally. Bounded process snapshots cache at most four intent/city
scopes and 100,000 rows for 60 seconds, coalesce concurrent requests and supply
consistent pagination/proof. SQL has a local 20-second limit. A cache generation prevents pre-correction queries from repopulating stale snapshots. No request installs
tables, runs a migration or injects mock listings.

CMA reads prefer the stored projection when it is ready. Validated full-scope
history and final scores are cached, then filtered/ranked/paged consistently for
both stored and compatibility sources. Both use
read-only Repeatable Read transactions and private/no-store responses. The current UI always renders 30-card pages; the legacy map feed remains bounded at 200. City IDs retain province and Kota/Kabupaten distinctions.

## Validation commands

```sh
node scripts/generate-investor-v2.cjs
node scripts/test-investor-roi.cjs
node scripts/test-investor-deals.cjs
node scripts/test-investor-auction-history.cjs
node scripts/test-investor-cma-db.cjs
node scripts/test-investor-location.cjs
node scripts/test-investor-cache.cjs
node scripts/verify-investor-cma-rehearsal.cjs
node scripts/verify-investor-feed.cjs
node scripts/verify-investor-auction-history.cjs
node scripts/verify-investor-http.cjs
node scripts/verify-investor-dashboard.mjs
node scripts/verify-investor-live-browser.mjs
```

Database fixture/correction tests and the live-source rehearsal use private
schemas and always ROLLBACK. Actual feed/HTTP/browser checks use no source writes.
Browser correction tests intercept PATCH with in-memory fixtures; no real
kelurahan was selected or corrected by this task. Permanent activation, when
separately approved, uses `node scripts/install-investor-cma.cjs --apply`; never
use db reset, db push or destructive renames for this feature.

The synthetic Kebraon proof contains 1B/100m², 2B/72m² and 900M/180m²: arithmetic
mean **14,259,259.259259… IDR/m²**. A subsequent 500M record for the first peer
still contributes its initial 10M/m² exactly once. Fixtures never ship in the app.

## Current ranking and card-feed contract (2026-10-25)

The explicit ranking rule supersedes the former maximum-driver score: market discount 90% + historical auction drop 80% = 170 points. Use unrounded, signed source values for sorting. A price increase (negative drop) reduces the total; missing evidence is omitted rather than fabricated, and both unknown remains null. OR thresholds and the mature history collector are unchanged. The serializer recomputes this sum from the validated metric columns even if an existing stored snapshot still contains a MAX score. The combined score is internal; recommendations show the actual strongest source percentage, and cards/validation panels do not display a point total.

The card feed returns 30 rows per page, after ranking the entire filtered scope. `certificateType` comes from source `listing.legalitas`, never `nomor_legalitas`; the UI allowlists source enum labels. Canonical SELECT and generated ingestion SQL reflect the new score; these source edits do not activate or migrate database storage. Deployments with older installed v2 storage must upgrade its score check/trigger and refresh valuations before relying on its stored rank index; runtime serialization remains compatible.


## Investor acquisition simulation

`investor-roi.ts` reuses only the four percentage constants from the shared
auction cost policy. It intentionally does not call the broader public-detail
cost totals: Investor's authorized defaults exclude document service and agent
fees, and use a fixed Rp135M clearing assumption. Rates use basis points and
integer arithmetic, rounding each line to IDR before summing. Auction at Rp1B
totals Rp1.22B; Primary/Secondary at Rp1B totals Rp1.055B. Both resale scenarios
are rounded to IDR and divide profit by the complete purchase total. These are
explicit simulation assumptions; optional UI overrides are in-memory only.
The validation endpoint remains owner-only, private/no-store and SELECT-only;
this additive response change requires no database migration.


## Kelurahan-only policy and fast reads — 2026-10-25

The policy is version 3. `hasInvestorReadModel` accepts only a fully refreshed
version-3 projection; version-2 district benchmarks fall back to the canonical
SELECT path. The generated storage script records policy 3, with only
KELURAHAN/NONE scopes. No storage script or source trigger was applied by this
optimization. Runtime compatibility continues to work against the active
`listing` table.

Valuation windows carry narrow financial/identity tuples. Wide descriptions
join after valuation; photo strings and presentation history are loaded only
for the displayed cards/recommendations (one bounded batch), or the ROI proof
selection. The duplicate SQL history JSON window is removed: the existing
mature history collector remains the source of the auction metric. Normalized
candidate city/certificate buckets are reused without changing candidate caps,
chronology, matching, or same-parcel rules.

A dedicated `pg` reader uses the already-installed driver, a maximum of two
connections, exact BigInt identifiers, decimal strings, configured search_path,
20s statement / 25s query limits, and read-only Repeatable Read transactions.
Fresh owner authorization still runs before every HTTP response. Cached views
bypass the read transaction entirely when their details are already hydrated.
The 60s snapshot retains serialized ranking inputs and at most 24 filtered full
rankings; pagination slices these rankings, always before response serialization.
Snapshots remain bounded to four scopes / 100,000 rows. Shared flights and the
cache generation prevent stale correction completions from repopulating state.

Browser snapshots are scoped to owner, full filter key and policy version, with
60s expiry, eight in-memory entries and only the last bounded response persisted
in sessionStorage. They display immediately after hydration while every request
revalidates with the API. StrictMode/subscriber requests coalesce; abandoned
searches abort. Manual refresh bypasses both cache layers, and permission failures
clear the owner's local snapshot. First cold loads still read the full eligible
scope before globally ranking; cached results never approximate a top page from
only the visible properties. The API exposes safe auth/investor Server-Timing
measurements without property or account identifiers.

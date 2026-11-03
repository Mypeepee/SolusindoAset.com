# Investor v2 verification — 23 October 2026

Dashboard and analysis read the active database before schema activation. No
Investor storage tables/triggers or sample source rows were permanently installed.
Real location corrections were not performed: correction write tests use private
fixture schemas or intercepted browser requests.

| Check                                                       | Result                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/test-investor-deals.cjs`                      | Passed OR/MAX, unknown values, strict geography, rent-period and auction-driver isolation, owner/input guards                                                                                                                                                                                                          |
| `node scripts/test-investor-cma-db.cjs`                     | Passed canonical/stored parity for both intents, mixed buy categories, land-only math, rent-period isolation, stale rental detail on buy, physical deduplication, max-ten proof, insert/update/delete and cross-district correction triggers; private schema rolled back                                               |
| `node scripts/test-investor-cache.cjs`                      | Passed correction/read race: old snapshots cannot replace fresh data or evict a new request                                                                                                                                                                                                                            |
| `node scripts/test-investor-location.cjs`                   | Passed owner/origin guard, reference hierarchy, malformed input, optimistic conflict, location-only persistence and cache invalidation; private schema rolled back                                                                                                                                                     |
| `node scripts/verify-investor-cma-rehearsal.cjs`            | Passed stored feed/proof/pagination/ROI inputs against a private copy of actual source records; all changes rolled back                                                                                                                                                                                                |
| `node scripts/verify-investor-feed.cjs`                     | Passed actual READ ONLY city/national feed, formula, pagination, proof and score order                                                                                                                                                                                                                                 |
| `node scripts/verify-investor-http.cjs`                     | Actual feed/proof HTTP 200 for OWNER, 401/403 otherwise, private/no-store, isolated rent feed, null-kel exclusion and real reference choices; no source writes                                                                                                                                                         |
| `node scripts/verify-investor-dashboard.mjs`                | Passed 38 fixture feed requests: intent/category/data modes, hidden auction filters cleared from rental URL, correction failure/retry/409/save, cards/table/map, search cancellation, OR/MAX, pagination, bookmarks, hover/click/keyboard proof, auto ROI, mobile, reduced motion, permission/error/stale/empty states |
| `node scripts/verify-investor-live-browser.mjs`             | Actual database responses: six buy cards, valid proof, three rentals, unverified geography and real location options; mobile has no document overflow. Every non-GET request blocked                                                                                                                                   |
| `node scripts/generate-investor-v2.cjs --check`             | Generated storage function matches canonical query/template                                                                                                                                                                                                                                                            |
| Prisma validation, feature Prettier, `git diff --check`     | Passed                                                                                                                                                                                                                                                                                                                 |
| Production build in isolated copy                           | Passed; original running `.next` preserved; temporary environment copies removed afterward                                                                                                                                                                                                                             |
| Strict feature UI audit using `docs/investor/ui-audit.json` | Zero findings                                                                                                                                                                                                                                                                                                          |
| Root static UI audit                                        | 163 findings: two native-select ownership flags are resolved by the scoped feature manifest; 161 lie outside this feature                                                                                                                                                                                              |
| Root TypeScript                                             | 138 pre-existing errors outside changed Investor/region files; none in this feature                                                                                                                                                                                                                                    |

The build already skips repository-wide type/lint enforcement; its success does
not resolve the unrelated TypeScript/static-audit backlog. Native region popups
are platform owned, documented in UX-CONTRACT.md. The static audit supplements,
and does not replace, the browser tests.

Actual observations: 1,952 active buy assets and **879 qualifying deals** in
Surabaya; 85,125 active buy assets and **35,516 qualifying deals** nationally at
default 25% OR thresholds. Surabaya has three rental listings and 242 buy listings
requiring kelurahan verification. Counts are snapshots, not fixed application data.
Cold compatibility reads are heavier nationally; measured full check runs varied
under concurrent build/browser load. Cached snapshots last 60 seconds. The stored
path in the isolated rehearsal returned city/page/proof checks in 338ms and
national/empty/saved checks in 856ms after a 100-second full backfill. These local
measurements are not production latency promises.

Kebraon fixtures prove mean **14,259,259.259259… IDR/m²** from 1B/100m²,
2B/72m² and 900M/180m². The later duplicate contributes its initial ratio once.
Missing kelurahan targets never acquire a district market estimate. Valid
low-sample kelurahan uses exact-type/intent/period district peers only.

Actual browser captures: `/tmp/investor-restored-live-desktop.png`,
`/tmp/investor-restored-live-proof.png`, `/tmp/investor-restored-live-mobile.png`,
`/tmp/investor-live-rent.png`, `/tmp/investor-live-location.png`. The separate
`investor-cma-validation-*` captures use synthetic browser fixtures.

Permanent v2 storage activation remains pending. Automatic approval review
previously rejected the live backfill/persistent-trigger deployment because it
changes active listing write behavior. The implementation and isolated rehearsal
are complete; the live dashboard continues through SELECT-only compatibility.

## Auction Drop correction

The earlier arithmetic used Investor's strict CMA asset grouping as its history
source. It now reuses the mature Riwayat Lelang Aset collector for the independent
auction driver. Full-scope history validation precedes qualification, MAX and
pagination on both stored-CMA and compatibility paths. Standby SQL storage stays
additive; no schema was installed or actual listing changed.

- `test-investor-auction-history.cjs`: 75% for 1B → 250M; unchanged 306M is 0%;
  1B → 2B → 250M is 75% (first, not maximum); no future/other-parcel/duplicate
  discount, missing evidence stays unknown, and historical price fallback matches
  the existing detail engine.
- `test-investor-cma-db.cjs`: isolated fixtures also prove OR qualification and
  sorting use validated history before pagination. A false 75% from a different
  land parcel is rejected; a real 75% with an incomplete older kelurahan is found.
  Raw NULL-limit duplicate events remain one auction and cannot fabricate a drop.
- `verify-investor-auction-history.cjs`: real screenshot asset 64493 uses 54948 and
  64493, both 306,000,000 IDR, producing exactly 0%. Six ranked listings were
  independently compared with the actual detail-history results in READ ONLY.
- `verify-investor-feed.cjs`: observed 927 qualifying Surabaya deals and 36,480
  national deals after history integration; cold city checks took 3.7 seconds and
  national checks 17.4 seconds in that run. Counts/latencies are snapshots.
- Browser fixture matrix still passes all 38 feed requests. Feature typecheck has
  no new errors; the 138 unrelated repository errors remain.

The earlier counts above document the previous algorithm. These history-corrected
observations supersede them for the Auction Drop driver.

## Compact property cards — 23 October 2026

The card now shows a short source-derived asset/location heading, price, land and
price/m², one divided metrics row and two actions. Rank/category, bookmark and
auction schedule overlay a reserved 112px/128px photo. MAX/gauge/sample details
remain available in the existing analysis/detail dialogs. Clicking the short
heading exposes the complete original listing title and restores focus on close.

- `node scripts/verify-investor-dashboard.mjs` passed **39 feed requests** and
  **20 layout cases**: buy, rent, unverified geography and long geography with an
  expired auction schedule, each at 320×568, 360×640, 390×844, 768×1024 and 1440×900.
  Tests measure actual browser bounds: no horizontal overflow, internal card
  scrolling or clipped content; the entire preview card and its actions fit the
  dashboard content viewport. Main actions, bookmark and correction measure at
  least 44×44px. Existing search/filter/OR/MAX/pagination, error/stale/retry,
  bookmark persistence, cards/table/map, ROI/proof, correction/retry/conflict,
  keyboard/focus, reduced motion and owner navigation checks also passed.
- At 320×568, fixture card maxima were **394px buy, 400px rent, 434px unverified,
  and 484px for combined long geography and warnings**, inside a 501px content
  viewport. This is a minimum portrait viewport contract; cards keep natural
  height and do not gain fixed-height clipping or an internal scrollbar.
- `node scripts/verify-investor-live-browser.mjs` passed using the actual active
  database, with all non-GET requests blocked. Observed 927 Surabaya deals, three
  rental listings, 242 unverified listings, HTTP 200 validation and three proof
  rows. Actual card maxima at 320×568 were **394px buy, 454px rent and 448px
  unverified**; each fit entirely. An initial proof wait timed out while other
  verification ran; the subsequent complete read-only run passed. Counts remain
  snapshots. No location save or schema change was performed.
- Scoped `audit_project.py --mode strict --config docs/investor/ui-audit.json
--no-write`: zero findings. Repository-wide strict audit retains 163 existing
  findings. `designmd lint DESIGN.md`: zero errors, three existing orphaned-token
  warnings. Updated Investor design/interaction contracts match runtime ownership.
- Prettier check passed for the changed components, stylesheet and browser scripts.
  `tsc --noEmit --pretty false` retains 138 unrelated repository errors and reports
  none in Investor. An isolated `next build` completed successfully (119 static
  pages); temporary source/environment copies were removed and the workspace dev
  build was preserved. Existing build configuration skips type/lint validation;
  separate checks above remain the evidence for those checks.

Screenshots: `/tmp/investor-compact-actual-buy-320.png`,
`/tmp/investor-compact-actual-rent-320.png`,
`/tmp/investor-compact-actual-unverified-320.png`,
`/tmp/investor-compact-buy-1440.png`, and
`/tmp/investor-compact-long-content-320.png`.

## Public listing card style / five Investor facts

The latest reference supersedes the earlier compact-card layout above. Public and
Investor cards now reuse `PropertyCardFrame` (#111111, 24px corners). Investor shows
full IDR price, the complete available street/location address, and a rounded facts
panel containing land area, local CMA discount and actual historical auction drop.
Agent profiles, source-title summaries, rank, schedule and separate price/m² copy
are absent from Investor cards. Existing analysis/detail/bookmark/correction flows
remain available. District-expanded CMA is labeled “kecamatan.”

- `node scripts/verify-investor-dashboard.mjs`: **39 feed requests passed**, with
  20 responsive cases across 320×568, 360×640, 390×844, 768×1024 and 1440×900. New
  assertions verify the street address plus missing geography, full grouped IDR,
  land area, absence of agent/date/price-m² blocks, and unclamped address text.
  A long street address plus long district/city and missing-kelurahan warning
  produces a **487px** card inside the **501px** content viewport at 320×568.
  Normal buy/rent fixtures reach **394px**, and unverified fixtures **397px** at
  that size. Every action remains visible with at least a 44×44px touch target;
  there is no card scrollbar, clipping or horizontal document overflow. Existing
  filter/sort/search, loading/empty/error/retry/stale, ROI/proof, keyboard/focus,
  correction/conflict/save, bookmarks, table/map and authorization checks pass.
- `node scripts/verify-investor-live-browser.mjs`: actual READ ONLY setup, actual
  Investor responses, all non-GET browser requests blocked. HTTP 200 feed/proof,
  six cards and three proof rows; snapshots remain 927 Surabaya deals, three rent
  listings and 242 unverified listings. At 320×568, card maxima are **430px buy,
  417px rent and 415px unverified**, all fully visible. The public `/Lelang` card
  also passes a browser smoke check: original DIV shell, 24px radius, #111111
  background, photo, agent and detail link remain present after sharing the shell.
- `tsc --noEmit --pretty false`: 138 pre-existing errors outside Investor and the
  shared property-card files; no errors in the changed components. Scoped strict
  UI audit has zero findings. `designmd lint DESIGN.md` has zero errors and three
  existing orphaned-token warnings. Source and screenshot review confirm the
  latest design/interaction contracts match the five-fact reference.
- Isolated `next build` completed successfully with 119 generated static pages,
  including the public listing routes and Investor client bundle. The temporary
  source/environment copies were removed; the active dev cache was preserved.
  Prettier and whitespace checks passed for the changed feature/shared-frame files.
  Repository build configuration still skips full type/lint validation; separate
  results above identify the existing repository-wide type errors honestly.

The updated `/tmp/investor-compact-actual-buy-320.png` and
`/tmp/investor-compact-buy-1440.png` captures show this version. Addresses use only
source data and recorded geography; missing street data is never fabricated.

## Spatial overview: header, unified filters and summary

`InvestorHeader`, `InvestorFilters` and `InvestorSummary` now form a single
overview composed by InvestorDashboard. Search/city/transaction share one glass
surface with native Select/datalist ownership. Existing category, date, reset,
debounce/IME/cancellation and Beli/Sewa isolation remain connected. The summary
reads the actual feed: count/total with an accessible ratio meter, signed average
spread, and a featured asset CTA labeled by its true MAX driver. Empty totals have
no ratio meter; missing spread stays unavailable and negative spread is explicitly
above the benchmark. Featured frames reserve room for loading and two-line titles.

- `node scripts/verify-investor-dashboard.mjs` exited **0**, with **43 feed
  requests** in the final run. Four overview viewports (320×568, 390×844,
  768×1024, 1440×900) pass bounds/overflow checks. Count/total/ratio are checked
  against the structured feed. The featured CTA works with Enter, Escape and
  restored focus; the native city select opens/closes via keyboard. Negative
  average, zero assets, missing average and empty recommendation states pass.
  An auction-driven recommendation also exposes its separate market spread.
  Existing 20 card-layout cases and the filter/transaction/search/retry/stale,
  bookmark, ROI/proof, correction, table/map, reduced-motion and role matrix pass.
- `node scripts/verify-investor-live-browser.mjs` exited **0** using actual
  database reads with all non-GET browser requests blocked. The observed overview
  shows **927 / 1,952 assets (47.5%)**, **8.9% average spread**, and **1,644 assets
  with CMA** in Surabaya. Featured data and its listing dialog, rental separation,
  proof and location-reference reads pass. These are snapshots, not runtime
  constants. The public card-shell smoke check and full-card phone bounds pass.
- Both QA CLIs explicitly exit after normal browser/database cleanup to release
  idle SDK handles. The dev server sends verbose logs to a private temporary
  file, avoiding blocked stdout during browser runs.
- Scoped strict UI audit: **zero findings**. Official DESIGN.md lint: **zero
  errors**, three existing orphaned-token warnings. Prettier/whitespace checks
  pass. `tsc --noEmit --pretty false` reports **138 existing errors outside
  Investor**, and no errors in the changed components.
- An isolated production `next build` exited **0**, generating 119 static pages
  and a 22.8kB Investor route bundle. Temporary source/environment copies were
  removed. The repository build still skips global type/lint enforcement; the
  separate results above describe those checks.

Actual overview captures: `/tmp/investor-overview-actual-desktop.png` and
`/tmp/investor-overview-actual-mobile.png`. Fixture captures are separately named
`/tmp/investor-overview-desktop.png` and `/tmp/investor-overview-mobile.png`.

### Home SearchHero alignment — 23 October 2026

The current user reference supersedes the dark glass/native-select search design.
Investor now composes the actual Home KeywordField, LocationPicker, TypePicker,
TabFilterFields, SearchSubmitButton and MobileSearchDock. Desktop has the same
white pill, column order and green round search action. The same searchTabs option
source supplies asset types and rental durations. Investor's named variants stop
location drill-down at kota/kabupaten and expose land dimensions only. Home keeps
its default deeper geography and building-area controls. Secondary discount
thresholds move into an initially collapsed disclosure. Search uses address and
exact IDs; internal-search examples do not advertise unsupported nearby searches.

- The final synthetic browser run passed **53 feed requests**, including province
  drill-down, city search, no kecamatan action in Investor, shared asset options,
  invalid price rejection before requests, applied price/land filters, URL reload
  restoration, mobile filter-sheet nesting and the existing transaction, ranking,
  proof, correction, retry, stale, bookmarks, pagination and card-layout matrix.
  Popup/sheet interactions wait for their real animation/lifecycle. Dialog focus
  restoration is checked after its close lifecycle has completed.
- The actual read-only browser run passed with **927 Surabaya deals / 1,952
  assets**, **3 rental listings**, **242 unverified listings**, and **3 proof
  rows**. Canonical Home city parameters also return **927 deals**. A combined
  RUMAH / Rp100–500 million / 100–500m² filter returns **157 active listings**;
  every displayed row satisfies the type, city, price and land predicates.
  Home itself opens the shared white bar and still exposes its Kecamatan action.
  All non-GET browser requests remain blocked; no actual geography was saved.
- `test-investor-deals.cjs` passes additional type/range/geography/URL/rental-period
  and invalid API cases. Identically named Kota and Kabupaten remain distinct
  after reload; unknown land is never coerced to zero. Auction-history checks
  still prove 1B → 250M = 75%, unchanged 306M → 306M = 0%, chronology, deduplication
  and missing-evidence safeguards. Search runs before pagination without changing
  the CMA peer pool.
- Scoped strict audit: **zero findings**. Its native-select configuration applies
  to the documented location-correction form variant; search owners are recorded
  separately in the manifest and exercised by browser QA. DESIGN.md lint has
  **zero errors** and three existing token warnings. The full repository still
  has **138 existing TypeScript errors outside the modified Investor/search
  components**; no feature errors were reported. Feature formatting and
  `git diff --check` pass.
- The isolated production build passed, generating **119 static pages**. Source
  and environment copies were removed after the check; the live dev cache was
  not used for the build. Existing global type/lint bypasses remain reported
  separately above.

Actual captures: `/tmp/investor-overview-actual-desktop.png`,
`/tmp/investor-overview-actual-mobile.png`, `/tmp/home-search-owner-desktop.png`.
The mobile city-limit fixture capture is `/tmp/investor-home-city-mobile.png`.

### Owner dashboard layout — 23 October 2026

The current design follows the active PremiumAgentDashboard rather than a listing
landing hero. DashboardKpiSurface and DashboardKpiIcon share the owner's existing
palette, icon frames, background and hairlines. Investor shows four equal tiles:
available assets (sky), worth-it assets (emerald), average spread (violet), and
highest discount (amber). A single property workspace groups scope, ordering,
view switches, cards and pagination. Its “Cari & filter” disclosure starts closed,
preserves selections and shows the applied filter group count. Home controls keep
their city-depth limit and use the existing dark theme inside that workspace.

Property cards retain their five facts with wallet/address, ruler, market-discount
and auction-history icons and subtle semantic cell colors. There is no agent row.
The current price, MAX/OR scoring and actual auction-history calculations remain
unchanged. Two interaction defects found during verification were fixed: finishing
the region-index fetch no longer clears a user's typed location, and uncovering a
CMA badge after closing a dialog no longer counts as deliberate mouse hover.

- Actual read-only browser verification passed with 927 Surabaya deals, 1,952
  available assets, 3 rentals, 242 unverified listings and 3 CMA proof rows. The
  combined type/price/land filter returns 157 assets and canonical Home city
  parameters resolve to the same 927-deal scope. Home keeps its deeper location
  controls. These are observed snapshots, never application constants.
- At 320×568, full actual buy/rental/unverified cards measure 430/417/415px in
  the 501px content viewport, without horizontal overflow, clipping or internal
  scrolling. The public property card retains its existing frame and agent row.
- Domain and auction-history checks pass, including 1B → 250M = 75%, unchanged
  prices = 0%, chronological baselines, missing evidence and OR/MAX ranking.
- Strict scoped audit: zero findings. Official DESIGN.md lint: zero errors and
  three existing token warnings. Feature formatting/whitespace checks pass.
  The full repository reports 138 pre-existing TypeScript errors outside the
  modified Investor, shared KPI and owner components; those changed paths are
  free of TypeScript diagnostics.
- The isolated production build passed with 119 static pages. To limit local
  resource use, its temporary config uses one build worker; the repository config
  is unchanged. Temporary source/environment copies are removed after completion.
  Existing global type/lint bypasses are evaluated separately as above.

Actual captures: `/tmp/investor-owner-actual-desktop.png`,
`/tmp/investor-owner-actual-mobile.png`, and the actual compact-card captures for
buy, rent and unverified at 320px. The fixture interaction suite checks four
colored KPI icons, collapsed/expanded filters, city depth, typed-query preservation,
price/land range validation, URL reload, ROI/proof/retry, bookmark/scope transitions,
map counts after location reset, and the full compact-card matrix. Cross-screen
owner fixtures use the actual array calendar and listing-performance API contracts.

Final owner-layout fixture run exited 0 with 53 Investor feed requests and 20
compact-card cases. The long-address 320×568 case remains 487px within the 501px
content viewport. The owner dashboard also renders its original four interactive
KPI tiles with the shared emerald/violet/sky/amber surfaces; the cross-screen
fixture uses valid calendar arrays and listing-performance payloads. Its capture
is `/tmp/dashboard-owner-shared-kpi.png`. Both actual and fixture browser suites
completed normal cleanup. The final isolated single-worker build exited 0 and
its temporary files were removed.

## 2026-10-23 — three summaries, persistent Home search, then results

Latest explicit layout replaces the previous four-tile/collapsed-workspace design:
no visible title or introduction; two square metric cards (Worth-it, average
spread), one wider Quick suggestion with the actual asset photo; then a white
Home-style searchbar and property results. Kota / Kabupaten, Kelurahan text,
Beli/Sewa and Jenis properti remain visible on desktop and mobile. Secondary
filters are disclosed separately. Ranking uses a compact authored dropdown.

- `verify-investor-dashboard.mjs` passed 53 feed requests, including exact
  three-section order, three cards, two square aspect ratios, unclipped summary
  text and four visible search fields at 320, 390, 768 and 1440px. All 20 existing
  card layout cases still pass, including 320×568 long/unverified content.
  Transaction/sort dropdown keyboard, Escape and focus restoration, city-depth
  limit, range validation, query cancellation/IME, URL reload, ROI/proof,
  bookmarks, category, scope, map/table, correction conflict, stale/retry/403,
  reduced motion and owner/public sibling-screen checks passed.
- Actual read-only database browser verification passed: Surabaya 927 worth-it
  assets / 1,952 active assets, 8.9% average spread, three rental listings, 242
  unverified listings, three proof rows, 157 listings after combined filters;
  canonical Home city URL returns the same 927. No Investor feed was mocked and
  no database write was permitted. Real 320px cards remained fully visible at
  430px (buy), 417px (rent), 415px (unverified), within 501px available space.
- Quant/deal and shared auction-history tests passed, including 1B → 250M = 75%
  and unchanged 306M → 306M = 0%. No valuation pipeline or stored data changed.
- Prettier passed for changed UI/search/test/context files; premium strict UI
  audit reports zero findings. DESIGN lint has zero errors and the same three
  existing orphan-token warnings.
- TypeScript reports the existing 138 repository errors outside Investor and
  shared search components; there are no errors in these changed components.
  Production configuration separately skips repository-wide TS/lint checks.
- Production build is verified in an isolated temporary copy using one worker;
  the user's running dev server and its `.next` output remain untouched.

## 2026-10-24 — compact summary cards

The latest density request supersedes the earlier square aspect-ratio layout.
Summary height now follows content with a 176px desktop baseline, independent of
viewport width. Desktop padding is 16px and metric type is 32–34px; phone metric
cards use a 140px baseline, with a 164px full-width recommendation. The 1:1:2
widths, semantic icons, genuine feed values, photo and 44px featured CTA remain.
CTA space is reserved beside the price instead of adding an entire footer row.
The searchbar and property cards retain their existing behaviors and dimensions.

Browser verification passed 53 fixture feed requests and all 20 property-card
layout cases. Summary checks now cover 320, 390, 768, 1024, 1440 and 1920px:
all three remain under 200px high, no horizontal overflow or clipped text, and no
featured text/CTA overlap. At 1440px the row is 176px rather than approximately
270px (about 35% shorter). Empty, negative, error/stale, rental, keyboard/dialog
and owner/public sibling checks still pass. Screenshots were inspected at desktop
and 320px. No database or quantitative logic changed.

Prettier and strict UI audit passed; DESIGN lint has zero errors and the same
three existing orphan-token warnings. TypeScript still reports 138 existing
repository errors outside Investor, with none in the Investor sources. The
production build is checked in an isolated temporary copy with one worker, without
touching the running dev server's output or enabling permanent database changes.

## 2026-10-24 — automatic Quick suggestion carousel

QuickSuggestionCarousel rotates up to five real qualifying properties every five
seconds, with a 360ms horizontal slide. The existing feed adds the bounded optional
summary.suggestedDeals array from its already-ranked cityDeals pool before result
pagination; this adds no valuation arithmetic, SQL query or database write.
Older feeds retain their single-topDeal fallback. The parent deduplicates asset
identities and preserves BELI/SEWA isolation. Position resets for a different set;
the stable detail CTA survives changes between slides and ordinary refreshes.

Controls expose previous/next, position and persistent pause/resume. Scoped arrow
keys and the shared useSwipe hook support manual navigation; its optional axis
ratio/interactive-target checks keep vertical scrolling and buttons independent.
The reduced-motion preference uses a shared reactive useSyncExternalStore hook,
including changes to the OS preference after mount. Autoplay pauses on hover,
focus, active gestures, hidden/offscreen pages, loading/error and open dialogs.
Reduced motion retains manual navigation without automatic sliding. Outgoing
slides are aria-hidden, auto changes are aria-live off, and manual changes alone
announce their position. Timers/listeners clean up on unmount or context changes.
The three summary cards keep their compact height and existing palette.

Browser checks cover real timed advancement, previous/next/keyboard selection,
matching detail CTA and focus restoration, manual pause, hover, modal/visibility/
offscreen pause, real touch swipe versus vertical scroll, live reduced-motion
changes, and six responsive summary sizes. Empty feeds retain no rotating controls.
The broader Investor browser regression includes existing filtering, ROI, proof,
correction, auth, card layout and owner/public sibling workflows.

Actual SELECT-only database verification passed with five distinct ranked
recommendations from 927 Surabaya deals. Advancing to the second property opened
that exact property's details and restored focus; returning selected the first
asset again. Real rental, unverified, CMA proof, price/type/land filters, canonical
city restoration and public card/Home checks also passed. All writes were blocked.

Quant/deal and shared auction-history tests passed. Formatting and strict UI audit
passed; DESIGN lint has zero errors and the same three pre-existing token warnings.
TypeScript still reports 138 existing errors outside the changed Investor/shared
hook sources, with no errors in these changed files. Production verification uses
an isolated temporary copy and one worker, preserving the running dev server.

Final carousel-only command:
`INVESTOR_QA_SUGGESTIONS_ONLY=1 node scripts/verify-investor-dashboard.mjs`
passed on the final carousel implementation, including real timed rotation,
manual navigation, matching CTA/focus, all pause conditions, touch/vertical scroll,
live reduced-motion changes and compact responsive geometry. The actual database
browser run also passed with five ranked suggestions. An earlier broader fixture
run passed 58 requests; subsequent broad attempts were interrupted by Puppeteer
frame detachment in existing hover checks. Final-state browser evidence therefore
uses the focused carousel checks plus the successful actual-data workflow.

## 2026-10-25 — one-row result controls and transaction icons

The old secondary disclosure, scope tabs, saved/reset row and separate result
ordering row are replaced by one 40px toolbar below the primary searchbar.
It contains Filter, scope, count, order, view and refresh. On phones, compact
icons and a short scope label retain one row; the count remains a live-region
status without consuming visible width. Saved-only and Reset now live inside
Filter. Transaction options and the selected trigger use a house for Beli and a
key for Sewa through the shared SearchSelect option-icon adapter.

Filter reuses DialogFrame with visible header/footer and a scrolling body.
Price/land ranges reuse Home SearchRangeInputs directly, with formatting,
validation, linked error text and IME-safe Enter; no nested range popups or
building-area fields are added. Rental periods reuse searchTabs values in a
nested authored Select above the dialog. Existing query, threshold, transaction,
category, saved, range-apply and URL behavior is preserved. The recommendation
carousel pauses while Filter is open. The kelurahan field retains its borderless
focus treatment, and button width no longer animates during viewport changes.

`INVESTOR_QA_TOOLBAR_ONLY=1 node scripts/verify-investor-dashboard.mjs` passed:
one row/no horizontal overflow at 320, 390, 768 and 1440px; Beli/Sewa option and
trigger icons; no keyword focus box; narrow modal/footer geometry; keyboard trap,
nested dropdown Escape and trigger focus restoration; invalid range rejection
and accessible errors; correct price/land apply; scope verification, table/grid,
saved-only and reset. Desktop/mobile screenshots were inspected.

Actual SELECT-only browser verification also passed: 927 Surabaya deals, five
ranked recommendations, three rental and 242 unverified listings, three CMA proof
rows, and 157 listings after combined type/price/land constraints. Public listing
card and Home region navigation checks remain unchanged and pass. No writes were
permitted. Quant/deal and shared auction-history tests passed.

Prettier and the strict UI audit pass. DESIGN lint has zero errors and its same
three pre-existing token warnings. TypeScript retains 138 unrelated repository
errors, with none in changed Investor/SearchSelect/TabFilterFields sources.
Production build verification uses a temporary isolated copy and one worker;
the user's running dev server and database configuration remain intact.

## 2026-10-25 — active listing visibility, cards only and atomic filters

The initial API/client scope is now `all`, including after changing transaction
or resetting the search. Worth-it remains explicit, with unchanged OR/MAX math.
A zero-Worth-it state distinguishes qualification from a failed feed and offers
Lihat semua listing while preserving the applied property filters. The API now
normalizes `city=all` to the same unrestricted city value used by the client;
previously that sentinel could be rejected as an unknown city.

The UI always requests grid pagination and renders PropertyDealCard. The
card/table/map picker and its client state are removed; old view URL parameters
are discarded. No schema changes, fake listings or database writes were made.

All advanced fields now form one draft. Terapkan commits category, ranges,
period, thresholds, saved-only and upcoming together. Dismissal discards edits;
Reset filter clears the advanced draft without changing the main search until
applied. Primary/auction/secondary/all pills have inline Lucide icons. Text and
number inputs have no green outline or outer ring; filter fields use a neutral
slate focus border and the kelurahan input remains borderless.

Verification:

- Focused browser tests pass at 320/390/768/1440px: single-row controls, missing
  view picker, legacy-view normalization, neutral numeric/keyword focus,
  category/transaction icons, atomic apply/cancel/reset, invalid range rejection,
  saved-only and zero-Worth-it recovery with two actual-shaped fixture records.
- Actual API HTTP checks pass: 401 anonymous, 403 non-owner, 200 owner, private
  no-store, real CMA proof, transaction isolation and location options.
- Live browser against the isolated final production build passes with no
  Investor API fixture: 1,952 active Surabaya listings, 927 qualifying deals,
  five real suggestions, three rentals, 242 unverified records and three proof
  rows. All six displayed source IDs, current prices, land areas, categories,
  active statuses and addresses match the `listing` table in a READ ONLY query.
- The exact reported Secondary case is covered against the real API and DOM:
  **two Secondary properties render as cards with zero Worth-it deals**.
  Combined city/type/price/land filtering still returns 157 real records.
- At 320×568 the complete real buy/rent/unverified/Secondary cards measure
  430/417/415/394px inside the 501px content viewport, with no clipping or
  horizontal overflow. Actual screenshots were inspected.
- Deal/quant, auction-history and cache-invalidation regressions pass. In
  particular 1B → 250M remains 75%, and 306M → 306M remains 0%.
- Prettier, git diff whitespace and strict UI audit pass. DESIGN lint has zero
  errors and the same three orphan-token warnings. The repository typecheck
  needs a 4GB heap and reports its existing 138 errors, none in changed Investor
  or shared search paths. Both isolated production builds exit 0, generating
  119 pages. The final Investor route is 37.5kB / 243kB first load.

The shared dev server completed the live HTTP checks, but two live-session
browser attempts did not finish hydration within 120 seconds (no page errors or
Investor responses). Final live UI evidence therefore uses a temporary production
server on port 3012, which passes. The user's port-3000 server was never stopped
or restarted; the temporary server, build copy and copied environment files are
removed after verification. Sandbox-limited static sitemap data reads during the
build do not affect the successful dynamic Investor API checks.

Actual captures: `/tmp/investor-owner-actual-desktop.png`,
`/tmp/investor-secondary-actual-desktop.png` and
`/tmp/investor-compact-actual-secondary-320.png`.

## 2026-10-25 — recover the actual persisted empty Worth-it search

The prior change handled new visits but left the user's existing
`data=deals&category=SECONDARY&city=Kota Surabaya&sort=spread` URL empty. Changing
a default does not overwrite an explicit persisted scope. This follow-up tests
that original state, including its hidden category filter.

The feed supplies `summary.matchingListingsCount`: the actual count after query,
category, geography, type, price, land, bookmark and schedule filters, excluding
only the discount qualification. This reuses the already-loaded source snapshot;
no new database query or valuation calculation is added. Default all-scope
requests reuse the ranked count. Unknown and negative CMA values stay intact.

When a successful Worth-it result is empty but that exact matching count is
positive, the dashboard automatically requests the same real filters with scope
all. Scope, URL and result count change together. A compact status identifies the
unmet threshold and active category. Its Hapus filter tambahan action clears the
advanced constraints, retaining city, primary query/type and sorting. Real empty
query/range/saved/schedule results and API errors do not broaden. The status is
scoped to the recovered search and disappears when the other filters change.
SearchSelect now explicitly renders its selected label (short label when present)
instead of waiting for Radix's hidden ItemText portal; transitions and SSR no
longer leave the selected text blank.

Verification completed against the user's existing port-3000 dev server:

- `INVESTOR_QA_RECOVERY_ONLY=1 node scripts/verify-investor-dashboard.mjs` passes
  the original persisted URL, automatic card recovery, true zero Worth-it,
  synchronized scope/notice, same-city reset, reload and 320/390/768/1440px.
  Separate unmatched keyword and 110,000m² filters remain empty without showing
  unrelated records.
- The focused one-row toolbar/filter/keyboard/neutral-focus suite also passes.
- `node scripts/verify-investor-live-browser.mjs` passes with actual Investor API
  responses and READ ONLY source verification. The exact reported Surabaya URL
  automatically displays **one real Secondary card** while Worth-it stays zero
  and spread stays −124.3%. Its source is the Grand Harvest Kebraon listing,
  Rp 990,000,000 and 60m². Hapus filter tambahan restores **1,952 Surabaya assets**
  while preserving the selected city. No manual scope selection is part of this
  reproduction. The actual screenshot was inspected.
- The same actual-data run retains 927 qualifying Surabaya deals, five ranked
  suggestions, three rentals, 242 unverified assets, three proof rows and 157
  combined search results. The recovered card is 394px in the 501px content area
  at 320×568, with no clipping/overflow.
- Quant/deal, shared auction-history and cache/source-count tests pass. The new
  count regressions check saved-only, upcoming-only, missing query and price/land
  mismatches, including recovery eligibility without fabricating a deal.
- Prettier, whitespace and strict UI audit pass. DESIGN lint has no errors and
  the same three token warnings. The 4GB repository typecheck reports its same
  138 unrelated errors, none in the changed Investor or SearchSelect paths.
  An isolated single-worker production build exits 0 and generates 119 pages;
  Investor is 37.8kB / 244kB first load. The temporary build and environment copies
  are deleted; the user's server is not restarted or stopped.

Actual screenshot: `/tmp/investor-stale-filter-actual-desktop.png`.

## 2026-10-25 — Lelang-sized Investor card, genuine gallery and savings colours

The card follows the actual public Lelang photo geometry through the shared
PROPERTY_CARD_PHOTO_CLASS (240px / md:256px) and existing 24px PropertyCardFrame.
A 400px width cap prevents wide single-column dashboard cards. The public card's
appearance is unchanged: its identical class string is now a shared constant.
Investor uses a compact short-phone photo variant to retain the complete-card
viewport contract.

The revised hierarchy is photo/category/type → price or limit with land area
alongside → complete address → flat comparison strip → ROI, centred bookmark,
right-aligned detail. The old three nested tinted metric boxes are removed.
Currency stays fully grouped and addresses remain unclamped. A non-auction or
rental listing does not acquire an auction metric. No agent, schedule, building
area, repeated MAX score or card-level valuation math is introduced.

Both positive savings metrics use the requested tier palette: zero white,
0–30 exclusive muted, 30–50 inclusive orange, >50 red. Negative values retain
Di atas/Naik labels and a neutral tone rather than the red excellent-saving
signal; null remains a grey dash. Source classification, history and math are
unchanged. CmaProofTrigger's accessible label includes the actual value/meaning.

The feed retains imageUrl and adds ordered/deduplicated imageUrls from gambar
(up to 50 stored references). The gallery reuses useSwipe and SliderDots and
supports previous/next, scoped keys and touch with natural vertical scrolling.
Single/empty sources hide controls; each source has its own failure state and
missing sources show a neutral placeholder. No card autoplay. The existing image
proxy has a bounded card/index variant selecting stored photos, preserving their
original ratio and returning 404 on failed/missing sources. Its email/default
portrait crop and fallback stay compatible; it accepts no arbitrary URL input.

Verification:

- `node scripts/test-investor-presentation.cjs` passes numeric tiers including
  0/0.1/29.9/30/50/50.1/94.7, negative/unknown safeguards, source ordering and
  deduplication, mixed local/Drive/remote references, index bounds, second-photo
  selection, aspect-ratio preservation, honest missing photos and email behavior.
- `INVESTOR_QA_CARDS_ONLY=1 node scripts/verify-investor-dashboard.mjs` passes
  real pointer/keyboard/touch gallery controls, natural vertical scroll,
  failed-to-valid photo recovery, empty/single sources, all computed CSS tier
  colours, intact ROI/bookmark/detail actions and reduced motion. Complete cards
  pass 320×568, 360×640, 390×844, 768×1024 and 1440×900 without inner scrolling,
  clipping or page overflow. Fixture states are deep-cloned to avoid mutating
  later test responses. Swipe starts on photo content, away from arrow targets.
- `node scripts/verify-investor-live-browser.mjs` passes with the real database
  on the user's port-3000 server. Six source rows match the displayed price,
  land, status/category/address and gallery references. A real five-photo
  listing loads its second image successfully. Investor photo height is
  **256px, exactly matching the measured public Lelang photo**; cards stay ≤400px.
- Actual buy/rent/unverified/Secondary/recovered-Secondary cards measure
  **437/419/410/399/399px** inside the 501px content area at 320×568. The original
  persisted empty-Worth-it URL still recovers to the genuine Surabaya card, and
  reset restores 1,952 active Surabaya assets. The run retains 927 qualifying
  deals, five suggestions, three rentals, 242 unverified assets, three proof
  rows and 157 combined-filter results. No write or migration was performed.
- Deal/quant, auction-history and cache/source-count regressions pass. The
  strict UI audit and whitespace check pass; DESIGN lint has zero errors and
  its same three token warnings. Prettier passes for the touched Investor,
  gallery, proxy, shared frame, DTO/presentation and test sources. The existing
  public PropertyCard retains its authored formatting outside the two constant
  import/usage edits.
- The 4GB repository typecheck retains its existing 138 unrelated errors, with
  none in the touched Investor/proxy/shared-frame/card paths. The isolated
  single-worker production build exits 0 and generates 119 pages; Investor is
  38.6kB / 245kB first load. Temporary copies, including copied environment files,
  are removed automatically. The user's dev server is not stopped or restarted.

Inspected actual capture: `/tmp/investor-gallery-actual-desktop.png`.
Phone capture: `/tmp/investor-compact-actual-buy-320.png`.

## 2026-10-25 — Certificate type, fluid cards, 30 rows and combined points

The latest explicit correction supersedes the earlier 400px cap and MAX score.
Cards now fill their available container columns using a 300px minimum grid,
with a 2px tinted outer bezel and black inner core. Source certificate type
appears beside a compact point total; certificate numbers are not serialized.
The existing gallery, price, land-only specs, full address and discount tiers
remain. Footer positions are unchanged, with nested icon discs, emerald hover /
keyboard-focus fills, pressed states and reduced-motion support.

Primary score is now the **signed sum** of known market and auction percentages,
using full precision before display rounding. 90 + 80 = 170 points. Increases
reduce the sum; one unknown driver is omitted and two unknown drivers remain
null. OR qualification and the mature auction-history engine stay intact. The
serializer recomputes from validated source metrics to avoid restoring an old
stored MAX rank. Source SQL, generated ingestion SQL and guards reflect SUM;
no public migration was activated.

The card feed slices the complete ranked result into **30 rows**. Numbered
pagination exposes actual ranges, current/first/last pages and ellipses; the
compact window retains 44px targets without overflowing phone content widths.

Verified:

- Deal tests cover 90 + 80, signed negative contributions, genuine zero,
  missing/invalid evidence and a combined deal outranking a larger single driver.
  Presentation tests cover all certificate labels, rejection of a certificate
  number/free-text value, compact page windows through 1,000 pages, all prior
  discount tiers and gallery/source proxy safeguards. History/cache regressions
  pass unchanged.
- SELECT-only database checks pass for Surabaya and the national scope. Surabaya
  retains 1,952 active assets and 927 qualifying deals; 30 rows are returned and
  page 2 contains distinct, lower-ranked results. National top score is
  188.09858066554318 points. Isolated-schema v2 tests pass canonical/stored parity
  and write/update/delete/correction triggers; all test fixtures are rolled back.
- The real owner browser test passes source matching for **30 actual rows**,
  including exact legalitas, price/limit, land, address and photo references.
  Recommendations and card rankings use the same signed sum. Page 2 has 30
  distinct lower-ranked properties, with working numbered navigation back to
  page 1 and URL synchronization. The compact pagination fits 320px.
- Actual rows occupy the full available grid width at 320, 390, 768, 1024 and
  1440px. Real buy/rent/unverified/Secondary/recovered-Secondary cards measure
  **469/451/489/431/431px** inside a 501px phone content area, without clipping,
  card-internal scrolling or page overflow. Gallery media remains exactly
  256px at desktop, matching the public Lelang card. The actual first gallery
  has four photos and its second photo loads correctly. CMA proof shows ten
  actual rows; three rentals, 242 unverified assets, 157 combined-filter matches
  and the original persisted empty-Worth-it recovery still pass.
- The focused card browser suite passes gallery arrows/keyboard/touch, vertical
  scrolling, source failure recovery, zero/single photo states, CSS discount
  colours, preserved actions and complete cards at 320×568 through desktop.
- Strict UI audit reports zero findings. Prettier and whitespace checks pass.
  DESIGN lint retains zero errors and its three existing orphan-token warnings.
  Repository typecheck retains 138 pre-existing errors outside Investor, with
  none in the affected Investor/shared-card paths.
- The final isolated, one-worker production build exits 0 and generates all
  119 pages. Investor is 39.7kB / 246kB first load. Temporary environment copies
  are removed, and the user's running dev server/root .next are untouched.

Focused hover QA (`INVESTOR_QA_HOVER_ONLY=1`) also passes precise pointer hover,
dark-on-emerald contrast, nested icon motion, 44px targets and reduced motion.
Tests use instant positioning before pointer hover to avoid smooth-scroll drift.

Actual captures: `/tmp/investor-gallery-actual-desktop.png`,
`/tmp/investor-compact-actual-buy-320.png`,
`/tmp/investor-pagination-actual-mobile.png`.

## 2026-10-25 — Neutral focus, photo captions and centred actions

The new correction removes green outlines/rings/borders and card hover glow from
Investor controls, shells and dialogs. Keyboard focus stays visible with neutral
slate/white treatments; compact toolbar triggers use a rounded inset stroke.
LocationPicker and the native Select have optional neutral-focus variants used
by Investor, preserving the existing Home/public defaults. Filled emerald states
and semantic brand symbols remain.

The address preview now clamps to **two lines**. Its complete source value stays
in the accessible action name, native title and detail view. Property type and
certificate type share a plain caption at the bottom left of the photo, blending
into the same black card surface. No pill, separate metadata box or certificate
number. Gallery dots sit above that caption, with the true photo count separate.
Transaction/type glyphs use bundled, unmodified Solar duotone icons from the
installed set; source and CC BY 4.0 attribution are in investor-card-icons.ts.

Footer labels are geometrically centred in equally sized ROI/detail controls.
Symmetric icon slots retain the established hover motion; the icons disappear
below a 340px card-container width so text stays centred and unobstructed.
Bookmark remains in the middle, and all action targets remain at least 44px.
Combined points are now private across cards, recommendations and dialogs;
Paling worth-it still sorts by the exact signed sum and returns 30 rows.
Quick suggestion displays the actual strongest source discount and its label.

Verification:

- `INVESTOR_QA_REFINEMENT_ONLY=1 node scripts/verify-investor-dashboard.mjs`
  passes 320/390/768/1024/1440px: two-line previews, exact button-text centres,
  plain photo captions, genuine certificate labels, new symbols, neutral shells,
  no page overflow or visible point total. Sort works with pointer and keyboard,
  Escape restores focus, city input focus is neutral, and ROI proof has no point
  total. The harness waits for Radix focus restoration and the input's finite CSS
  transitions before inspecting the settled style.
- The actual owner browser test passes all 30 source rows, real prices/land/
  certificate enum/photos, ranked recommendations, numbered page 2 and back,
  and real ROI proof with ten rows. It retains 1,952 active Surabaya assets,
  927 qualifying deals, three rentals, 242 unverified assets and 157 combined
  filter matches. Existing empty-Worth-it recovery and public/Home behavior pass.
- At 320×568, real buy/rent/unverified/Secondary/recovered-Secondary cards measure
  **401/421/393/401/401px** inside the 501px content viewport, with no inner
  scrolling, clipping or horizontal overflow. Desktop gallery media stays 256px.
- Quant, presentation, history and cache regressions pass. Strict UI audit has
  zero findings; formatting and whitespace checks pass. The repository typecheck
  retains its 138 pre-existing errors outside the affected Investor/shared-focus
  paths, with no new errors in those paths.
- The final isolated one-worker production build exits 0 and generates 119 pages;
  Investor is 41.2kB / 247kB first load. Temporary environment copies are removed.
  The user's dev server and root .next are untouched. No database write or public
  migration occurs.

Actual capture: `/tmp/investor-gallery-actual-desktop.png`.
Phone capture: `/tmp/investor-compact-actual-buy-320.png`.

The current HOVER_ONLY check also passes nested-icon motion, dark-on-emerald
contrast, 44px targets and reduced motion in a fresh mouse context. Mouse hover
and CDP touch-gallery scenarios run separately to avoid leaving browser pointer
capabilities polluted between scenarios.

## 2026-10-25 — Centered ROI workspace and acquisition scenarios

The old right drawer is replaced by a centered DialogFrame business variant
(max 1280px). Its compact source header and evidence/financial split stack below
960px. CMA uses actual photo thumbnails, two-line linked locations and a marked
Aset ini row. Ten rows maximum means target + up to nine peers, sorted by land
price/m² descending. The API adds the full-pool minimum and cheapest source;
its selection is bounded before photo/link serialization. No migration or source
write is required. The auction tab dynamically reuses the exact public
RiwayatLelang component and endpoint, including its chart, photos, status,
current marker, and independent loading/retry behavior.

The financial helper uses the approved Investor-only assumptions, with per-line
integer Rupiah rounding. Ubah asumsi/Reset affect only local state. Two resale
scenarios use all-pool mean/minimum × target land, with total acquisition as the
ROI denominator. Primary/Secondary use only BPHTB/AJB; SEWA keeps its same-period
tariff analysis and exposes no purchase/resale results. Missing evidence remains
unknown rather than a fabricated zero.

Validation completed:

- `node scripts/test-investor-roi.cjs`: auction Rp1B → Rp1.22B;
  Primary/Secondary Rp1B → Rp1.055B; exact rounded line summation; positive,
  negative and breakeven ROI; invalid inputs/local overrides; cheapest outside
  the top nine and target excluded.
- Existing deal, auction-history and presentation regressions pass. History
  includes Rp1B → Rp250M = 75% and equal limits = 0%, while excluding unrelated
  parcels and future events from the Investor auction metric.
- `node scripts/test-investor-cma-db.cjs`: stored/canonical parity and isolation
  remain correct; proof mean/minimum/count match an independent full-pool SQL
  aggregate excluding the target. All private fixtures rolled back.
- `INVESTOR_QA_ROI_ONLY=1 node scripts/verify-investor-dashboard.mjs`: passes at
  320/768/1024/1440px with centered max-width geometry, target + nine rows,
  descending ratios, photos, one vertical scroll owner, reachable 44px close,
  separate CMA/history failure and retry, local edits/reset, Primary/Secondary,
  missing land/benchmark, rental period isolation, roving tabs, focus trap and
  restoration, Escape, neutral focus and reduced motion.
- `INVESTOR_QA_LIVE_ROI_ONLY=1 node scripts/verify-investor-live-browser.mjs`:
  actual active database, GET-only browser requests and read-only owner lookup;
  1,952 active assets, 30 verified source cards, ten displayed proof rows and
  ten loaded genuine thumbnails. The selected asset's Rp100M active limit gives
  Rp243.5M total acquisition; its three genuine auction events match the shared
  historical discount. Actual modal CMA/history layouts pass all four widths.
- Strict application UI audit: zero findings. Design lint: zero errors, three
  existing orphan-token warnings. Whole-repo TypeScript reports the same 138
  pre-existing errors, with zero errors in the affected Investor files. An
  isolated Next production build compiles and generates all 119 pages; the
  running dev server and root .next are left intact.

Review captures: `/tmp/investor-roi-actual-cma-1440.png`,
`/tmp/investor-roi-actual-history-320.png`, and the four-width
`/tmp/investor-roi-cma-*.png` / `investor-roi-history-*.png` fixture captures.

## 2026-10-26 — Strict kelurahan CMA and faster reloads

The previous district fallback is removed from the canonical SQL, storage policy,
serializer, proof selection and UI. One valid same-kelurahan peer is sufficient;
no peer means an unavailable benchmark. Two physical assets remain visible and
compare against one another, excluding the target from the aggregate. The
scope/category/transaction/rental-period and physical-asset safeguards remain.
The dropdown explicitly exposes Diskon kelurahan tertinggi and Penurunan lelang
tertinggi, with short selected labels for the one-row mobile toolbar.

Performance changes:

- Versioned owner/filter-scoped 60s browser snapshots display matching cards
  before the fresh response. StrictMode/bookmark hydration coalesces to one
  request. Obsolete queries still abort. Explicit refresh bypasses cache, and
  401/403 removes the local snapshot and cards.
- Fresh server snapshots bypass database transactions/readiness queries. Full
  rankings are cached independently of pagination, with bounded views/scopes.
- Narrow valuation tuples avoid sorting photo/description payloads. Metadata
  joins after valuation; photos and presentation history are hydrated only for
  visible cards/recommendations or proof rows, in one bounded batch. The
  redundant SQL history JSON window is removed; the mature collector remains.
- A dedicated read-only Repeatable Read pg pool (existing runtime dependency)
  is shared across route bundles, capped at two connections and bounded query
  timeouts. BigInt identifiers remain exact; configured schema and bound values
  are preserved. Only official pg TypeScript declarations were added; runtime
  packages were not reinstalled. No source trigger, migration or index was
  applied to the active database.

Measured locally, using the actual source in read-only transactions (indicative
measurements, excluding HTTP auth/network and development compilation):

| Core operation, Surabaya | Before | After |
| --- | ---: | ---: |
| Cached reload | 47 ms | <1 ms |
| Page 2 | 48 ms | 1 ms, one bounded photo batch |
| First highest-kelurahan sort | 46 ms | 9 ms |
| First highest-auction-drop sort | 47 ms | 9 ms |
| Repeated sort | 52 ms | <1 ms |

The national profile covers 85,125 assets. During optimization its first cold
load dropped from 23.8s to 13.7s; cached reload/repeated sort takes about 1ms,
page 2 about 8ms, and a new national sort about 0.6–0.8s. First national access
still evaluates the complete scope and remains materially slower than a city;
there is no page-local ranking shortcut. The city cold read is around 1.2s.
Benchmark files are `/tmp/investor-performance-before.json`,
`/tmp/investor-performance-after.json` and
`/tmp/investor-performance-national-pg.json`; run
`INVESTOR_BENCH_DRIVER=pg node scripts/benchmark-investor.cjs` for the native
reader, with `INVESTOR_BENCH_NATIONAL=1` for all cities.

Verification completed:

- Deal, presentation, auction-history, ROI, read-transaction and both cache
  regressions pass. DB fixtures confirm one-peer/zero-peer local CMA and no
  district fallback, alongside ingestion/update/delete/correction parity;
  all private fixtures are rolled back.
- `INVESTOR_QA_PERFORMANCE_ONLY=1 node scripts/verify-investor-dashboard.mjs`
  passes: one initial request, cards before a deliberately blocked fresh
  response, repeated-sort reuse, exact menu labels/order, forced refresh,
  transient-error snapshot retention and permission-cache clearing. Cached
  reload displayed cards in 797ms including local page load/hydration.
- Focused ROI browser QA passes 320/768/1024/1440px, including low-sample
  kelurahan evidence, independent failures, keyboard and no overflow.
- Actual GET-only browser QA verifies 30 cards against current listing rows,
  ten genuine proof thumbnails, the same CMA minimum/purchase total and three
  matched auction-history events at all four sizes. Active Surabaya count
  remains 1,952; Worth-it counts reflect the corrected local-only baseline.
- Strict UI audit has zero findings; design lint has zero errors and the three
  existing orphan-token warnings. TypeScript has no affected-file errors;
  131 unrelated repository errors remain (the pg declarations also resolved
  some previous declaration errors). The isolated Next build succeeds for
  all 119 pages; Investor is 47kB / 253kB first-load JS. The root .next and
  running development server remain intact.

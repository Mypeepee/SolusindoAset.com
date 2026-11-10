# About page / completed-project editor


Scope: completed-project publication from `/about/company-profile`. Existing dashboard workflows retain their own contracts.

| Capability    | Canonical owner                                | Source of truth                                       | Allowed variants                           | Verification                                   |
| ------------- | ---------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| Form          | Shared Input, Label, Textarea; React Hook Form | success-story-schema.ts; this contract                | Completed-project creation                 | Inline errors, focus, mobile, retry            |
| Dialog        | DialogFrame / Radix                            | Shared focus and dismissal primitive                  | Owner editor; existing berita presentation | Focus trap, Escape, restoration, dirty close   |
| Toast         | Existing root Sonner provider                  | Successful server-confirmed insert                    | Success acknowledgement                    | Success announcement                           |
| Scrollbar     | Existing document baseline; native overflow    | Visible native scrollbar for carousel and dialog body | Thin horizontal thumbnail rail             | First thumbnail visible; keyboard/touch scroll |
| CRUD          | `/api/about/stories`; StoryEditor              | Current user instruction, fresh database role         | Create and public read                     | Guard, validation, idempotency, persistence    |
| Authorization | requireStoryOwner                              | `Agent.jabatan`, agent membership, account status     | Active OWNER writes; everyone reads        | OWNER allowed; all other roles denied          |

The user explicitly limits adding completed projects to OWNER. `session.user.jabatan` controls the visible action; every image upload and creation request re-reads the current agent by authenticated `id_pengguna`. Only an active OWNER with an active account can write. USER, AGENT, ADMIN, PRINCIPAL, STOKER, TEAMLEADER, pending/suspended agents, and disabled accounts cannot write. Public reads remain available to all.

Published stories are editorial records in `company_profile_story`, separate from financial `project_selesai`. Existing six documented cases remain as maintained seed content. The request UUID is also the primary key, so retrying a timed-out save does not duplicate a project. Persist the server-returned record; refreshes retrieve it from the database.

Creation stays in the About page. The editor uploads photos in the background with at most two concurrent uploads; previews appear immediately using revocable object URLs. Each photo supports removal, cover selection, error, and retry. Accept at most six JPG/PNG/WebP/AVIF files of 8 MB each. The server verifies actual decoding and writes optimized WebP files, scoped to the authenticated owner. Project creation only accepts that owner's uploaded paths.

Use `noValidate`, inline associated field errors, first-invalid focus, one in-flight save, and a stable save button. Never discard fields on a network or permission failure. Disable save while photos are pending or failed. Closing a dirty form requires an app-owned confirmation; leaving the document uses only the browser lifecycle unsaved-changes mechanism. Show success only after the server confirms persistence, then select the new public project.

The carousel supports touch dragging, native thumbnail scrolling, explicit previous/next controls, and keyboard arrows scoped to the focused carousel. Typing in the editor must never change a project. On mobile show an automatic rightward nudge until interaction; reduced-motion removes it. Any project description length accepted by validation must fit naturally in the stage.

Deployment: run `prisma/migration_company_profile_story.sql` in each environment and retain `public/uploads/success-stories` on durable storage, following the repository's existing local-media deployment pattern. The dynamic `/uploads/success-stories/[owner]/[filename]` route serves new optimized images immediately, including after production startup; UUID URLs use immutable browser caching. No external publishing, email, or accounting transaction is part of this action.

## Profile agent referral sharing — 2026-11-02

Authority: the user's referral-sharing correction. `ReferralShareCard` owns
profile sharing; `src/lib/site.ts` owns the externally reachable public base URL.
Salin Link copies a warm agent invitation, the current code and its public `/r/`
URL. Native sharing and WhatsApp carry the same invitation. Salin kode copies
only the code. Cancellation of native sharing ends the action. Clipboard failure
must not report success; Sonner owns localized feedback.

`src/app/r/[code]/route.ts` retains account-signup prefill and the three-day
referral cookie. Relative Location headers keep both valid and invalid-code
redirects on the visitor's origin, even when the reverse proxy's internal origin
is localhost. The invitation explains account signup followed by Gabung Jadi
Agent; the existing agent application and upline rules remain the authority.
Code/share/copy stay in one responsive row, with visible keyboard focus and
accessible names in compact mode. Verify proxy redirects, code prefill, copy,
native-share cancellation/fallback, and narrow layouts in browser checks.

## CRM region preferences — 2026-11-05

CRM geographic identity (user correction, 2026-11-05): `FormPreferensi` owns
conversion between `SelectedRegion` and all four saved `loc_*` fields.
`LocationPicker`'s administrative variant carries the full parent chain and
Kota/Kabupaten prefixes. Rehydration and selection IDs retain those parents;
namesakes in different cities or districts remain separate selections. District
pills show the city/regency; village pills show district and city/regency.
`klienMatch` applies every known saved parent in both SQL before its candidate
limit and strict in-memory matching, including cron and chatbot consumers.
Missing legacy parents remain unknown and are never guessed from a name alone.
District saves require their city/regency; village saves require district and
city/regency. Incomplete legacy scopes cannot match arbitrary namesakes, and the
shared form explains which region must be selected again.
A legacy selection missing only its province can still be unchecked under the
same known city/district. Ignore aborted/superseded child-list responses when
navigating, closing or reopening the picker. Verify save/read/edit round trips,
Sukodono Sidoarjo vs Lumajang, namesake villages, city/regency distinction,
multiple selections, request races, failure recovery, keyboard and narrow layouts.

Regression checks: `scripts/test-client-region-scope.cjs` and
`scripts/verify-client-region-browser.mjs` (local intercepted fixtures).

## CRM discount preferences — 2026-11-01

Authority: the user's client preference requirement. One optional discount type (Kelurahan, Turun lelang, Keduanya) and one whole percentage 1–99. Empty fields preserve existing behavior. Normalize leading zeros in the input; reject malformed or partial pairs at the API and database. Keduanya uses AND, with both canonical metrics strictly greater than the threshold; equality and unknown evidence do not qualify. Resolve from the existing Investor kelurahan CMA and ordered auction-history engine, before candidate limits. CRM matching, badges, email scans and WhatsApp recommendation preparation share the criterion. Existing account ownership checks remain authoritative.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | SearchSelect / Radix | Shared authored search primitive | CRM discount, three individually illustrated options | Open popup, keyboard, width, narrow viewport |
| Form | FormPreferensi; preferensiDiskon; preferensiInput | User's discount preference requirement | Client create/edit and preference editor | Optional/paired validation, input/paste, save/read/edit/clear |
| CRUD | Existing authenticated client/preference routes | Existing agent ownership and transactional API contract | Optional diskon_jenis + diskon_persen | Transactional persistence, serialization, unchanged ownership |

Install `prisma/migration_preferensi_diskon.sql` before deploying the generated Prisma client. Grouping and invalidation include both discount fields, so editing or changing only the threshold cannot merge distinct preferences or reuse old matches. A failed valuation read stays an error; it must never silently broaden the results. No outgoing message is sent by saving a preference or by the verification workflow.

CRM empty-result diagnostics use the same saved criteria, canonical discount evidence,
ownership exclusions and duplicate handling as recommendations. The existing
one-calendar-month WIB auction freshness rule remains a hard recommendation gate.
When otherwise matching records have old or missing schedules, report their actual
count, latest recorded schedule and cutoff instead of claiming no matching property
exists. Those records are diagnostic evidence only and cannot become selectable or
enter outgoing drafts. Distinguish discount nonqualification from schedule exclusion.
Search errors, incomplete responses and failed background refreshes remain visible;
only the latest request for the current criteria may replace the cache or its error.
Retry reads the same criteria without saving changes or sending messages.

When a matching criterion includes a discount, each matching CRM asset card shows
its actual qualifying percentage under the price, using the retained canonical
valuation snapshot. Show only the requested comparison; Keduanya shows both.
When an asset matches multiple criteria, merge their applicable comparisons into
one card. A card that only matches a criterion without a discount has no discount
badge. Missing evidence stays absent. Localized percentage rounding is presentation
only and never changes matching. FaktaDiskon owns this compact read-only fact row.
Slot allocation limits which asset IDs appear. Every displayed asset retains all
matching criterion memberships and their discount evidence, including criteria
whose slots selected another asset. Allocated slots never exceed the requested limit.

## Owner Investor Deals

Scope: `/dashboard/investor`. Authority: current user requirements for transaction
isolation, land-only CMA, null-geography cleaning, precomputed storage and owner
location correction. Database and roles: `Listing`, `ListingSewaDetail`,
`sessionJabatan.ts`, `investor-owner.server.ts`; quant contract: `docs/investor/CMA.md`.
Owner Apps contains Jadwal & Acara, Scrape and Investor only.

| Capability            | Canonical owner                                                                        | Source of truth                                     | Allowed variants                                                                                                      | Verification                                                            |
| --------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Select / autocomplete | Home LocationPicker, TypePicker, SearchRangeInputs, KeywordField; SearchSelect / Radix | Shared /api/regions provider and searchTabs options | Authored Home panels; Investor max city depth and land-only dimensions; native Select only inside location correction | Drill/search/multi-select, city limit, Escape, mobile, range validation |
| Form                  | Shared Input/Select                                                                    | CMA auto-filled ROI; source revision for correction | Optional buy ROI, separate rent tariff analysis, owner location selection                                             | Invalid inputs, timeout, retry, conflict, confirmed save                |
| Dialog                | Shared DialogFrame / Radix                                                             | Existing focus/dismissal primitive                  | Listing, centered ROI workspace, small location correction dialog                                                       | Focus containment/restoration, Escape, mobile                           |
| Toast                 | Root Sonner                                                                            | Bookmark outcome or committed correction response   | Explicit local-storage fallback and server-confirmed location save                                                    | Status, duplicate prevention, storage/network error                     |
| Table                 | Semantic table + server pagination                                                     | Investor feed/proof API                             | Thirty cards/rows; max 200 legacy map points; target + max nine proof peers                                                     | Global ranking, pagination, clamping, overflow                          |
| Scrollbar             | globals.css document baseline                                                          | --app-scrollbar-* tokens                            | Native thin, forced colors automatic                                                                                  | Computed root/dialog/table behavior                                     |
| Authorization         | Middleware, server page, fresh API guard                                               | Current account and Agent membership/OWNER role     | Active OWNER reads and location correction only                                                                       | 401/403, revoked role, origin validation                                |

BELI combines PRIMARY/LELANG/SECONDARY; SEWA has its own view and same-period
comparison. No building area appears in algorithms or Investor cards/detail.
Missing kelurahan ID/name completely excludes market metrics and displays the
specified badge plus correction action. The “Perlu verifikasi” scope exposes
otherwise unscored rows. Valid low-sample geography may expand to the same district
with a warning. Full math, deduplication, baseline provenance and activation rules
are in the maintained CMA contract.

Auction Drop uses the shared Riwayat Lelang Aset collector, exact parcel scope,
real chronological prices and event deduplication. It requires two valid events;
unchanged prices are 0%, and unknown history stays unavailable. Validate the entire
scope before qualification/sort/page, including when CMA comes from stored rows.
The history disclosure exposes first/current prices and real source links.

Each independent buy driver uses OR qualification; the signed sum of available market and auction discounts gives the default rank in points. Both unknown stays null; negative drivers reduce the total.
Rentals have no auction driver or resale ROI. Null evidence stays unknown, never
fabricated zero.

The Investor page begins directly with three compact summaries: Worth-it and average-spread cards, followed by a wide Quick suggestion card with the actual top-ranked asset and detail CTA. The title is screen-reader-only. Desktop width proportions are 1:1:2 with a content-driven 176px baseline height; there is no square aspect-ratio constraint. Phones retain two compact metric cards followed by a full-width recommendation. Cards grow only for real wrapped content. The 44px featured CTA reserves space beside the price and must not overlap text. No header, introductory panel or collapsed primary search appears.

QuickSuggestionCarousel consumes up to five ranked qualifying assets from summary.suggestedDeals, with a single-topDeal fallback for older feeds. Rankings are computed by the existing server score before pagination, within the selected geography/transaction/search context. Deduplicate asset identities. Refreshing the same IDs preserves position; changing the recommendation set resets to the first slide. Photo, price, driver, score, address and stable detail CTA always reference the same active listing.

Autoplay advances every five seconds only while visible, with no active hover/focus/pointer interaction, loading/failure or dialog. An explicit pause persists until resumed. Previous/next controls and scoped left/right keys wrap; horizontal touch swipes select slides while vertical gestures scroll. Reduced motion disables autoplay and slide transitions while retaining manual selection. Hidden/offscreen pages stop timers; resume starts a fresh interval. Zero/one listing has no controls/timer. Automatic updates are aria-live off; manual changes announce the position. Outgoing visual slides are hidden from accessibility, and the stable CTA restores focus after detail dismissal. All timers, visibility listeners and gestures clean up on unmount/context changes. No per-slide network calls or database writes occur.

The always-visible Home-style white searchbar follows the summaries. Kota / Kabupaten uses Home LocationPicker and the same reference endpoints, browsing provinces and ending at city/kabupaten; Kota and Kabupaten prefixes survive URL restoration. Kelurahan is an internal text search field (the existing query also searches address/ID). It never changes verified geography. Beli/Sewa uses the shared authored SearchSelect/Radix primitive, including keyboard selection, collision handling, Escape, outside dismissal and focus restoration. Jenis properti uses Home TypePicker/searchTabs options. The four fields remain visible as a two-column grid on phones. Fixed placeholder text is an explicit KeywordField variant; Home's animated examples remain the default.

One compact toolbar follows the searchbar: Filter, scope, count, sort and refresh. Scope is an authored dropdown (Worth-it / Semua listing / Perlu verifikasi), with a short selected label. The count moves to screen-reader-only presentation on phones; icon buttons/select triggers keep one row without overflow. Results always render property cards. Remove the view picker, ignore legacy table/map URL values and normalize the URL. Initial and transaction-reset scope is Semua listing; Worth-it remains an explicit filter. A zero-qualified result must distinguish nonqualification from a feed failure. When summary.matchingListingsCount confirms real matches with all other applied constraints, automatically switch only scope to all and show the real cards with a visible recovery status. Update the trigger and URL, retain the selected geography/category/ranges/query/bookmarks/schedule, and keep true Worth-it counts/metrics unchanged. A compact Hapus filter tambahan action clears advanced criteria while retaining the primary city/query/type and sorting. A true unmatched query, range, saved selection or schedule stays empty. Reset does not require editing the URL. Reset and saved-only move into Filter. Primary transaction options and selected values show Home/KeyRound icons via the shared SearchSelect owner. Its selected trigger explicitly renders the option label (or shortLabel), including during scope transitions and SSR.

Filter uses the existing DialogFrame focus trap, Escape/outside dismissal and focus restoration. Its body owns scrolling and footer actions remain visible. The shared Home SearchRangeInputs expose price/land fields directly, with linked errors, formatting and composition-safe Enter. No building area is exposed. Rental period retains searchTabs options in an authored Select above the modal layer; Escape first dismisses that nested Select. Invalid ranges never reach the feed. All advanced fields are one draft: category, period, thresholds, saved/upcoming and ranges commit atomically on Terapkan. Ordinary dismissal discards the draft; opening restores the applied values. Reset filter clears only the advanced draft and requires Terapkan. Empty-result Reset pencarian clears search criteria and restores Semua listing while retaining transaction. Category pills have semantic Layers3/Building2/Gavel/Home icons. Investor text/number input focus has no colored outline or outer ring; a neutral slate border preserves a visible field focus. The white kelurahan field stays completely borderless. Other keyboard controls retain visible focus. Discount thresholds qualify the explicit Worth-it scope, not Semua listing; the dialog states that relationship.

InvestorResultControls owns scope, sort, count and refresh. InvestorFilters owns the modal trigger and adapts Home controls; opening it pauses QuickSuggestionCarousel. Before pagination, geography/types/price/land/period constraints apply without pruning the CMA peer pool. Changing transaction resets incompatible filters and restores the applicable scope/sort. Summary behavior remains unchanged: actual feed values, signed negative spread, honest unknown/zero states and the actual strongest source percentage; combined points are private. The native Select remains limited to the existing location-correction form. Loading/error/stale/empty states remain explicit.

The Investor property card uses the public Lelang shell and shared photo-height
constant (240/256px), with a container-responsive full-width grid and a short-phone photo variant. No 400px cap inside a wider column.
It contains transaction/type pills, a source-photo gallery, full IDR price/limit,
land area beside the price, the complete address, source certificate type without its number and a flat comparison strip.
The source title, agent, schedule, a score hero and price-per-m² stay out of the
card. Price/type labels remain readable and the address preview is limited to two lines, with its full value available through the accessible name/title and detail. No card has
inner scrolling; the full card and actions fit 320×568. ROI/sewa analysis is left,
bookmark centred and detail right, each with a 44px target. Lihat detail is a native link to the listing's canonical detail URL in a new tab, with noopener/noreferrer; it does not open the preview dialog. Addresses open the
existing detail dialog and restore focus. LocationStatus retains its warning and
existing owner correction action.

Auction cards expose their actual schedule in a single-line pill at the top-right
of the photo. Compare calendar days in Asia/Jakarta: 10 November on 5 November is
“5 hari lagi”; 1 November is “4 hari lalu”; any time today is “Hari ini”. Keep the
source date in semantic time markup and its full localized accessible name/tooltip.
The existing 60-second/visibility feed refresh keeps labels current. Do not invent
a schedule for missing/invalid dates or expose auction labels on other transactions.

Tandai terjual occupies a separate full-width card-footer row. Opening it never
writes: the Investor DialogFrame confirmation identifies the selected source asset
and explains that all matching historical listings are marked sold and leave the
Investor feed. Focus Batal initially; cancel/Escape restore the invoking control.
During the existing owner-only status PATCH, prevent duplicate submission and
dismissal, retain button dimensions, and announce pending state. Failure keeps the
asset and inline error available for retry; success closes the dialog, acknowledges
the server response through Sonner, and refreshes the current feed. The confirmation
uses the same status endpoint and matching scope; it introduces no new lifecycle
transition or authorization rule. Browser verification intercepts every status write.

The same exact numeric colour scale applies to both positive discounts: 0 white,
0–30 exclusive muted, 30–50 inclusive orange, >50 red (excellent saving). Unknown
is a grey dash; negative values are grey with Di atas/Naik text and must never
receive the excellent-saving red. Labels and accessible names express meaning
beyond colour. Expanded district CMA says kecamatan. SEWA and non-auction listings
do not acquire an auction metric. No valuation or ranking rule changes.

InvestorPhotoGallery owns the card gallery and reuses useSwipe, SliderDots and
PROPERTY_CARD_PHOTO_CLASS from the existing public card. Photo references come
from the current listing's gambar, preserving order and deduplicating up to 50;
the feed keeps imageUrl and adds imageUrls. Photo controls support previous/next,
scoped left/right keys and touch gestures while preserving vertical scrolling.
No autoplay. Single/empty sources hide controls. Image failure is local to the
current source and recovers on moving to a valid photo. Never substitute another
asset photo. The image proxy's indexed card variant selects only stored source
references, preserves aspect ratio, bounds indices, and returns 404 on failure;
its email/default behavior stays compatible. Reduced motion removes fades. Photo
selection, bookmark, ROI and detail stay independent.

Analyze ROI / market spread click, Enter, Space, or deliberate fine-pointer hover
opens the shared drawer. Its hierarchy is target → validated score/benchmark →
visible ROI simulation (buy only) or rental comparison → optional auction history
→ max-ten-row proof. Formula copy stays brief. The arithmetic mean includes every
eligible peer, independent of the displayed ten. Target and peer links are real.
Missing CMA leaves the resale input blank until an assumption is supplied.

Location correction uses the same DialogFrame, Input/Select and Sonner owners.
It submits only selected IDs and source revision. Failed saves retain selections;
409 requires reloading options. Dependent requests abort and cannot overwrite newer
choices. One save can be active; dismissal is blocked while it is pending. Closing
a nonpending two-select draft discards its local choices without an extra prompt.
Only geography/update time changes; price and other listing data stay intact.

The latest user request authorizes this correction flow for the owner dashboard;
it does not expand role access elsewhere. The earlier permanent migration was
rejected by automatic approval review and remains a separate activation step.
SELECT-only compatibility keeps real data available until v2 storage is ready.
Every request checks readiness. No fake records are a fallback for a failed API.

Transaction, category, data scope, query, sort and page live in the URL. Legacy view values are removed; the client always requests grid pagination.
Remote search is 300ms debounced, IME-aware, abortable and stale-safe; clear/Enter
are immediate. Context changes hide previous-context rows. Same-context refresh
failure retains the last snapshot with visible stale/error feedback. Refresh every
60 seconds when visible and on return. Initial loading, empty, timeout, permission,
retry and out-of-range states are explicit. Bookmarks are numeric IDs in per-account
local browser storage (cap 500), synchronized across tabs with honest failure copy.

Locale id-ID, currency IDR and Asia/Jakarta dates/time. ROI is an editable local
scenario, auto-filled from validated CMA × land when available, with explicit zero
additional costs. It creates no payment, financing or guaranteed-return claim.

Investor card page size is 30. The server qualifies and ranks the entire scope before page slicing; primary rank = signed market discount + signed historical auction drop. The recommendation set uses the same score, independent of result-page number. Numbered pagination reuses the shared page-window calculation through InvestorPagination, with a compact three-number window, ellipses, aria-current, loading-disabled controls and 44px hit targets. Retain URL page persistence, existing result-scroll/focus and last-page bounds. ROI and detail hover/focus states include nested icon motion and emerald fill; pressed and reduced-motion states are explicit.

The latest Investor refinement removes all green control/card outlines and rings. Keyboard focus remains visible in slate/white, with a rounded inset stroke for toolbar triggers. Home LocationPicker and native Select use their optional neutral-focus business variant only in Investor. The address preview is clamped to two lines; the complete address stays in its accessible action name/title and detail view. Property type and certificate type form a plain bottom-left photo caption, without a pill; gallery dots sit above it and source-count controls stay separate. Transaction badges remain at the top with Solar duotone icons matching the public property family. Footer text is centred in equal-width ROI/detail controls, with symmetric icon slots that are removed in narrow card containers. No combined point total is exposed on the card, recommendation or dialogs; default sorting is labelled Paling worth-it. Ranking logic and 30-per-page behavior remain unchanged.

Investor card discount labels (including their icons) and percentage values are centred within their own equal-width columns, with symmetric horizontal padding around the divider.


## Investor ROI workspace — 2026-10-25

DialogFrame owns centering (max 1280px), Escape, focus containment/restoration and the sole vertical scroll. A 44px sticky close stays accessible at 320px. The compact header preserves source photo, two-line address/link/title, category, land and current price. Desktop evidence and finances split at 960px; below that they stack. CMA/Riwayat tabs implement roving focus with arrows/Home/End. The lazy history tab reuses the public detail component and endpoint, with its own retry state. A CMA outage never replaces or invents auction evidence.

CMA shows target + up to nine peers, all sorted descending on land price/m². The target is marked in text and emerald fill, using current price; auction peers say Limit awal and use initial prices. All-pool mean/minimum exclude target, preserve transaction/property/period/unique-asset rules, and stay inside the same kelurahan even with one peer. A low-sample note never expands geography. The minimum source stays linked even outside the table's nine peers. Rows use actual photos, a two-line location with complete title/link, and no asset-code column.

The purchase simulation is scoped to Investor: auction base + BPHTB 5% + bea lelang 2% + PPN 1.1% + roya/balik nama 0.4% + Rp135M clearing; Primary/Secondary base + BPHTB 5% + AJB 0.5%. No document-service or agent fee. Each fee rounds to IDR before summation. Local Ubah asumsi changes only price/rates/clearing; Reset restores defaults. CMA revalidation preserves edits unless source price/category changes. Mean and minimum resale scenarios use target land, and ROI divides profit by total acquisition, never the limit alone. Missing land/benchmark leaves purchase totals visible and scenarios unknown. Rental analysis has neither acquisition costs nor resale ROI. Profit wording covers only the listed acquisition costs.


## Investor local benchmarks and reload performance — 2026-10-25

All market discounts and ROI baselines use the exact kelurahan/property/intent/period group. One valid peer is enough; no peer means unknown. Cards remain visible in Semua listing. There is no kecamatan benchmark or automatic expansion. The sort dropdown includes Diskon kelurahan tertinggi and Penurunan lelang tertinggi (buy only), globally ranked before the 30-card page is sliced.

The browser displays only snapshots matching owner, policy and complete filter key. Its 60s cache is bounded and every shown snapshot revalidates authorization/data. A forced refresh bypasses cached values; 401/403 clears the stored feed and visible cards. Transient failures retain matching data with the existing snapshot warning. Request coalescing removes StrictMode/bookmark-hydration duplicates, and obsolete searches still abort. The server coalesces cold work and reuses 60s financial snapshots/full rankings; only page/proof photos are batch-hydrated. Cached financial results are never a page-local ranking or a manual valuation. Public property and auction-detail behavior stays unchanged.

Investor's “Jadwal lelang terdekat” sort uses the WIB calendar date, then descending signed points (diskon kelurahan + turun lelang) within the same date, then numeric listing ID for equal points. Auction time cannot outrank a higher score on that date. Today's auctions remain eligible throughout the WIB day; past, missing and invalid schedules follow upcoming dates. Missing drivers remain unknown, negative discounts reduce points, and sorting covers the full filtered scope before pagination. Canonical owner: `selectDeals` in `src/lib/investor-deals.ts`; regression coverage: `scripts/test-investor-date-ranking.cjs`.
## Public auction history ordering

The detail history and Investor history share `auctionHistoryOrder.ts`: ascending
`tanggal_lelang`, with undated entries last and numeric listing IDs only breaking
ties. Creation dates and the currently opened listing never determine a round.
Round numbers and comparable-parcel price changes are derived after sorting on
both the server and client; dates display in Asia/Jakarta. Source years remain
literal: a verified wrong year is corrected in data, never inferred by the UI.

## Pemasaran company workflow

The company Pemasaran workspace follows the maintained
[canonical UI and workflow contract](docs/pemasaran-ux.md). The shared owners,
permission policy, state transitions, and verification remain explicit there.

## Campaign / Planner example scenario — 2026-10-31

Campaign rhythm uses a shared 24-hour mask: typing/pasting 1200 becomes 12:00, invalid ranges/junk/oversized paste are rejected, and incomplete input cannot save. Completed slots must strictly increase in their displayed order; an earlier or equal time marks the offending field and blocks saving, generation, approval and local Planner projection. Intensity additions/restorations retain existing edited times while producing a unique chronological list; late-night additions remain within the same day. Historical approved records and period reservations remain readable without rewriting their source data.

“Coba A, B, C” opens local example mode, identified in both tabs and in the URL. Three example assets share the production campaignSchedule/selectCampaignAssets rules (freshness, auction lead time and seven-day cooldown). Start at 00:00 WIB today to inspect morning slots even at night. Rhythm changes update both screens immediately; invalid/duplicate times clear the projection and explain the error. Insufficient stock leaves explicit gaps. The scenario never reads/writes marketing APIs, prepares real media, creates publications or enables automation. Use local example photos only; do not request dummy IDs from the listing/media proxy. Reset/reload restores defaults, exit restores real campaign access without changing saved records. Other workspace tabs are unavailable until exit.

## Newest-property archive examples — updated 2026-11-01

When current Campaign stock is empty, the inventory response may include a read-only archive: up to six newest auction records that still meet the campaign's geographic/type/price/discount/evidence rules and have source photos. Original prices, dates, links and identities remain unchanged. For an ended campaign, the main page shows its end date and a change-period action. Historical properties load only inside the explicit “Contoh tampilan dari properti arsip” disclosure, labelled Pratinjau arsip; diagnostics remain available separately. For an upcoming/current period with no live stock, archived examples retain the same explicit archive labelling. An explicit example day precedes the selected batch so production lead/cooldown rules can project the chosen upload intensity. Coba arsip di Planner opens the same property identities and times in the shared Planner; rhythm edits stay local. The archive URL restores through authenticated, abortable campaign/inventory reads, with retry/exit on failure. No archive data enters saved selections, approved jobs or publications, and live eligibility/approval/worker expiry checks remain unchanged. Current stock always takes precedence over this archive view.

Stock remains in one horizontally scrollable row at every width. Within the explicitly opened stock view, all properties are immediately available without further expansion or vertical stacking. Preserve large source photos, readable addresses, complete prices, original auction dates and 44px gallery/detail actions down to 320px. Native swipe/trackpad, previous/next controls, a visible-range count, scoped arrow keys and Home/End navigate the same stock; the whole page must not overflow horizontally. Respect reduced motion, avoid autoplay, retain scroll position on unchanged inventory refresh and restore gallery focus to its trigger. The trial time stays on its assigned property's photo. The compact schedule overview retains the same assignment order, with full addresses accessible on narrow screens. Scrolling never changes selections or Planner assignments; the current-source disclosure remains keyboard operated.


## Campaign lifecycle and automatic editor assets — 2026-11-01

The applied brief owns running/paused campaign periods; unapplied draft edits cannot
extend publication eligibility. Ended status overrides every stored lifecycle state
at the next WIB day. The visible clock updates every 30 seconds and on window focus
or visibility restoration; simulation retains its explicit frozen clock. Generation,
approval, resume, media preparation and dispatch enforce period eligibility on the
server, even with an old tab. Approval rejects expired briefs. Expired execution
skips unattempted work and retains published/sending/uncertain delivery evidence.
Overdue queued/paused slots without delivery evidence read Terlewat and do not count
as ready. Preparation and dispatch remain separate actions.

Campaign asset filters are the only asset-selection input in the editor. The complete
recommendation determines saved IDs, freshest first; the photo strip shows up to six
examples. There is no repeated address search or manual priority radio. A filter
change clears inventory validity before a new response arrives, aborts old requests,
and prevents old IDs from generating a new proposal. Empty/error inventory still
permits a valid draft save; its rhythm projects read-only sessions without creating execution jobs. Saving filters never changes
previously approved jobs when saving only a draft. The current explicit “Simpan ke
Planner” action saves, generates and applies a validated plan in one operation,
then invalidates the month cache. Separate manual review retains Apply confirmation.
Historical manual records remain readable through compatible server schemas.

Time formatting owns the colon. Four digit deletions clear an HH:mm value and four
numeric entries replace it. Partial minute edits including a first digit 6–9 remain
editable, but cannot save or project until a complete valid 00–59 minute exists.
Pasted invalid ranges/junk/oversized values remain rejected. Completed times must
strictly increase in displayed order. Lifecycle, stale-response, keyboard deletion,
approved-period dispatch and historical-example isolation require regression coverage.


## Campaign deadline and coverage policy — 2026-11-01

The owner's latest request supersedes the 24-hour marketing lead and freshness-only
rank. All marketing preparation and dispatch require at least 120 hours before an
auction, inclusive at the boundary. Campaign recommendations use the first real
upcoming publication time. Daily session count determines the split: reserve roughly
one third (rounded, at least one for 2–12 sessions) for coverage; the rest prioritize
auctions 5–14 days away. Five sessions allocate three near and two coverage turns.
Coverage prefers distant unseen stock, then other unseen stock,
then least-recently exposed eligible stock. Rescue unseen near-deadline assets only
when the next usable slot would be too late; end-of-period rescue uses a 24-hour
horizon. All eligibility, verified price evidence, identity deduplication, slot
conflicts and cooldown checks remain hard constraints.

Ninety-day job/publication history seeds exposure and rotation. One multichannel job
counts once. Missed unattempted work does not count; ambiguous sending evidence
remains protected. Distribute coverage turns across the configured daily times, preserving their
positions when regenerating a partially elapsed day. One-session campaigns carry
the coverage turn across days using exposure history; unrelated reservations
between times cannot steal coverage turns. Persist policy version and authored selection reason with proposals
and plans. Legacy unapproved proposals require regeneration; attempted/publication
history is immutable. No qualifying source date is changed to invent live stock.

Save to Planner immediately creates property assignments and refreshes the owning
month; material preparation is still separate, and global automation is not enabled
by saving. Failed synchronization keeps form values and the last acknowledged
campaign ID/revision for retry. Draft-only save retains existing Planner jobs.
Coverage gaps are honest: display eligible/scheduled/remaining counts rather than
guaranteeing all properties fit finite slots. Pending drafts show a compact Planner
notice with a direct campaign action. A future gap reads Belum terisi; an elapsed
empty slot reads as historical nonpublication. Summary Jadwal terisi includes
unrendered property plans as well as prepared materials.

Campaign lists separate current periods (Campaign berjalan) from elapsed periods
(Campaign usai), with real draft/paused/scheduled/active status still visible.
An approved period controls grouping even when its saved draft differs. The final
day remains current until 00:00 WIB the next day. Filter before independently
paginating each group; counts and empty states refer to that group. Restore both
page numbers in the URL and clamp pages after data changes. Refresh the split
across midnight without interrupting an unsaved inline edit. Expired rows use
subdued forest/charcoal surfaces, neutral time chips, an explicit Berakhir badge
and secondary actions. History remains readable and editable, with publication
guards unchanged.


Campaign rhythms and Planner sessions — 2026-11-01:
The saved campaign period and its own HH:mm times own calendar projections.
A 1–3 November campaign with five daily times yields fifteen sessions, five boxes
on each date and five agenda cards per selected day. Render every configured time,
including on phones; do not cap at three entries or replace extra sessions with dots.
Empty drafts expose read-only “Jadwal draf” sessions; elapsed projected times read
“Waktu lewat” and never claim publication history. They offer Buka campaign, not
global automatic preparation/manual-plan actions. Approved periods keep their
immutable times until changes are applied. Ignore unassigned, unattempted global
placeholders within campaign dates; retain actual assignments and delivery evidence.
Outside the campaign period, global settings still govern ordinary automatic slots.
Both draft saves and applied plans invalidate the month cache immediately.
Policy version 3 requires old unapproved proposals to regenerate before applying.


## Live two-day campaign queues — 2026-11-01

The current owner request supersedes the example/archive workflow and full-period
asset preselection. Production has no A/B/C action, archive substitution or example
Planner mode. Old simulation query parameters are discarded and load the real workspace.
CampaignReadyAssets is the single live queue owner: it reads persisted Planner jobs,
original property facts and actual publication states, in dated horizontal carriages.
Keep large photo cards and shared gallery/scroll controls; render at most two day groups.

Batches are anchored to the campaign start in WIB, with two dates each. Prepare the
next batch on the preceding batch's final day. For 1–3 November, five daily sessions:
creation prepares ten jobs on 1–2 November; on 2 November the panel shows the next
batch, 3 November only (five jobs), while 2 November assignments stay in Planner.
Never create dates after campaign end. Future dates beyond the prepared horizon keep
all configured slots, labelled Menunggu batch. The worker and live panel reconcile
the queue under the existing worker lease; polling does not enable publication.

Fresh searches use approved campaign criteria, never IDs frozen in the previous batch.
Keep still-valid committed jobs unchanged during automatic refresh. New matching stock
can enter the following batch. Refill shortages/reviewable unattempted jobs at 15-minute
intervals or explicit refresh, without overwriting delivery attempts or manual plans.
Empty source stock activates honest unfilled jobs; it never substitutes expired archives.
Unapplied edits cannot change the approved queue. Preserve unrelated campaign metadata.

Published properties never re-enter campaign selection, across all publication history
and campaigns. Protect sending/uncertain evidence too. Deduplicate stable parcel identity,
exclude other future reservations, and prohibit repeats inside a generated plan. Recheck
lifetime publication evidence at approval, media preparation and dispatch; the same
multichannel job may finish its remaining channel. All source, verified price evidence,
minimum five full days before auction, daily intensity and priority rules stay enforced.
Policy version 4 requires old unapproved proposals to regenerate.

Current automated acceptance for this workflow lives in verify-marketing-batches-browser.mjs
and verify-marketing-campaigns-db.cjs. Earlier archive/simulation browser scripts describe
the retired workflow and are superseded for production acceptance.

## Surat generation — 2026-11-04

The current request requires all letter types to produce a PDF and expose
actionable failures. `suratGeneration.ts` owns the PN/Grosse/MOU form fields and
validation; their actual supplied DOCX documents and existing MOU service own
document wording and financial terms. The supplied PN body is signed directly
by the applicant, despite its original filename. Do not invent a PN authority
clause; show that limitation in its form. Grosse can include the supplied power
of attorney. Original Word files remain untouched; `prepare-permohonan-templates.py`
produces separate parameterised copies and fails on unexpected source changes.

| Capability | Canonical owner | Source of truth | Variant | Verification |
| --- | --- | --- | --- | --- |
| Form | Shared Input/Textarea, SuratTemplateModal | suratGeneration.ts, supplied DOCX | PN, Grosse, MOU | Required data, NIK, date, first-error focus, manual entry |
| Dialog | DialogFrame / Radix | Existing shared primitive | Permohonan/MOU | Focus, Escape, dirty dismissal, mobile |
| Date | Typed YYYY-MM-DD | Shared validation; Asia/Jakarta | Surat date | Invalid calendar dates; midnight WIB |
| Toast | Root Sonner | Valid PDF response | Download started | Never claim local save completion |
| Download | suratDownload.ts | PDF content type/signature and server filename | All surat modals | HTTP, session, timeout, invalid body, delayed URL cleanup |
| Generation | Existing route + docxToPdf | Current Prisma schema; supplied template | All letter types | Real LibreOffice PDF; isolated database fixtures |

OCR is optional; all required values remain manually editable. Map the OCR API's
actual `*_pemohon` keys to the selected party and retain manual values when OCR
returns empty fields. Block generation during scanning, prevent duplicate submit,
ignore stale scan results, preserve values on failure, and leave an explicit retry
action. A generation success closes the form only after a valid PDF starts downloading.
The shared converter bounds queue wait and execution, isolates each LibreOffice
profile, and retains all document pages. Invoice persistence failure is a failed
operation; identical invoice retries reuse the existing record. Receipt retries
retain the recorded number/date, with database locking across number allocation
and generation. Financial/register QA uses an in-memory database and intercepted
browser mutations, never production fixture inserts.

## Dua akun Google Drive — 2026-11-04

Authority: the user's explicit choice of server configuration only. There is no
new storage dashboard or database token store. `googleDrivePool.mjs` owns OAuth
refresh, quota checks, folder paths, file ownership lookup and bounded uploads;
`googleDrive.ts` supplies the server singleton. The standalone scraper uses the
same pool and environment configuration.

Drive 1 keeps its existing roots. Drive 2 uses its own configured roots or lazy
app-owned folders. Insufficient remaining bytes and `storageQuotaExceeded` permit
per-file fallback; permission, rate and uncertain network failures do not trigger
a second upload. Preserve file IDs/URLs and cover ordering. Cleanup targets only
the current operation's created files, or old files explicitly replaced by the
existing workflow, and locates their account by permission-aware lookup.

The pool defaults to private sharing; callers explicitly retain the existing
workflow's sharing policy. Tokens remain server environment variables and never
appear in API status or error output. Uploading listing photos requires the same
signed-in agent as listing creation. Agent-registration uploads belong to the
signed-in user. API failures preserve the user's form and explain capacity/errors.

Acceptance: `npm run test:drive` covers the pool and actual upload handlers with
injected Google/database adapters. `npm run diagnose:drive` reads real account
capacity and configuration without uploading or changing files. Second-account
activation requires its genuine OAuth refresh token and an application restart.

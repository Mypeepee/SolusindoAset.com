# Pemasaran company workflow

The owner's 3 November report identifies deletion discoverability as the UX
problem. Every live card and the selected-post action row expose a visible,
labelled Hapus button. One click opens InstagramDeleteDialog directly, with the
selected photo/caption, type/date and a single explicit confirmation. It uses the
same authenticated deletion service, mutation lock, retry ID, error handling and
server acknowledgement as the manager entry point. Cancel restores the actual
trigger; after removal, focus falls back to the search when that trigger no
longer exists. Successful removal updates the owning list/count and refreshes it.
Permission/loading restrictions disable the visible action; examples do not
offer deletion. All entries share this dialog, with a nested layer only inside
the content manager. Browser acceptance includes actual pointer clicks on a
320px gallery, cancel/focus, direct success, missing browser APIs and failures.

Instagram deletion request IDs are generated inside the protected mutation flow.
`instagram-api.ts` owns the secure UUID helper: native randomUUID where available,
otherwise getRandomValues with RFC 4122 version/variant bits. A browser without
either capability receives an explicit pre-send error and the button recovers.
Retries retain the original ID. The browser regression uses physical pointer
clicks and missing-API cases rather than only invoking DOM click handlers.
The trial post 18079119182441886 was actually removed through the application on
3 November 2026; provider acknowledgement, succeeded audit and MEDIA_DELETED
history were verified separately from the account's now-empty media response.

## Poster dan caption sosial — 2026-11-02

Authority: the owner's supplied poster and current Instagram/WhatsApp request.
`property-cover.ts` owns the collage, brand, specifications, price and contact
composition. Media preparation renders the first Instagram slide at 1080×1350,
then 1–3 detail photos at the same 4:5 ratio. WhatsApp dispatch sends only the
1080×1920 poster. Never post individual detail photos to Status.

`captionFor` owns authored Indonesian sales copy for each property type: emotional
opening, actual title/address/specifications, offer price or auction limit, actual
auction schedule, detail destination and a DM/contact CTA. Unknown facts stay
absent. Private rankings, fabricated savings/urgency and guaranteed returns never
enter the copy. Reserve the full public URL and CTA within the 2,200-character
limit. `marketingListingUrl` resolves the canonical listing through `SITE_URL`,
independently of the temporary/signed media origin;
the locally generated QR uses that exact destination without a QR web service.
Source certificate type is included in snapshots and rechecked before dispatch.
Existing approved campaign captions remain unchanged; newly generated plans use
the new caption. Preparation and preview never enable or trigger publication.

MarketingPreviewDialog reuses InstagramCarousel, its existing scoped visual tokens
and DialogFrame for slide/thumbnail/keyboard/swipe navigation, focus and dismissal.
It shows each channel's dimensions/count and the actual stored caption. Copy uses
the root Sonner feedback with manual selection on failure. Same-origin downloads
retain OWNER authorization. The QR/DM guidance remains available when a caption
URL cannot be tapped. Verification: `scripts/verify-marketing-artwork.cjs`,
`scripts/verify-marketing-poster-browser.mjs` and `scripts/test-marketing.cjs`.

Business authority: the approved Pemasaran implementation brief, the existing
Investor qualification/ranking contract, fresh OWNER authorization, and
[Pemasaran domain/integration contract](docs/pemasaran.md).

| Capability     | Canonical owner                                  | Source of truth                           | Allowed variants                                              | Verification                                                   |
| -------------- | ------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| Select/Listbox | SearchSelect / Radix and LocationPicker          | Existing search primitives                | Category/location popovers; expanded property picker          | Keyboard, touch/wheel scrolling, visual viewport, narrow width |
| Form           | Shared Input/Switch + marketing settings Zod schema     | MarketingConfig / fresh server validation | Settings, typed HH:MM schedules                               | Field errors, duplicate times, retained edits                  |
| Scrollbar      | Global application CSS                           | --app-scrollbar-\* tokens                 | Bounded contacts and modal body                               | Visible scrolling, narrow screen                               |
| Toast          | Root Sonner                                      | Committed server response                 | Save, preview, test, analytics                                | Inline failure plus accessible feedback                        |
| CRUD           | Pemasaran API + persistent settings/job services | docs/pemasaran.md                         | Pessimistic saves with revision conflict                      | Save/discard, stale revision, 401/403                          |
| Dialog         | Shared DialogFrame / Radix                       | Existing focus/dismissal primitive        | Activation, test dispatch, preview, unsaved changes, comments | Pointer, Escape, focus return                                  |
| Date           | MarketingDatePicker / CampaignDateRange / react-datepicker + PlannerCalendar | Asia/Jakarta domain schedule | Authored single-date and range popups with id locale, HH:MM fields and month navigation | Invalid times, rollover, month navigation, focus and arrow keys |

Planner is the initial section. The selected tab, calendar month and date are
preserved in the URL. Calendar arrow keys move by one day or one week. Mobile
calendar cells show compact status dots; the selected-day agenda retains all
times, listing facts, channel states and material actions.

Month arrows use the OWNER-only `mode=planner` read to fetch only that month's
jobs and latest metrics. They do not reload company settings, account connections,
or other sections. The compact toolbar remains usable while its calendar loads.
Below 768px, the month, previous/next/today and all three channel filters stay in
one row. Use an abbreviated month and icon controls with accessible names and
tooltips, retaining 44px height. WhatsApp channel controls use the bundled brand
logo; the chat icon remains reserved for comments.
Month responses are cached in memory for sixty seconds (at most six months) and
invalidated by a successful mutation/full refresh. Same-month date/today and
channel selection are local; superseded requests are cancelled and cannot
overwrite the current month. Loading and retry remain in the calendar region.

Five navigable sections preserve the selected tab in the URL. Scheduled lists use 20-slot
server pagination. Preview creates media without publication. Unsaved settings
are guarded before changing sections and on page unload; ordinary save is
pessimistic and does not require confirmation. Activating automation and sending
a real WA test use app-owned confirmation naming the schedules/channels or
recipient. Fields retain their values on failure, and permission checks read the
current OWNER membership and account status from the database.

Pengaturan owns its compact presentation in `MarketingSettings.tsx`. Account
identity, channel switches, automatic asset criteria, typed WIB schedules and
WhatsApp audience remain one revisioned settings draft. Property filters use the
same eight buy-property types and display names as the shared Home/domain contract,
so existing property filters remain editable. The readiness links
reflect draft identity/channel/audience values and the server's WhatsApp test
state; they are preparation guidance, not a replacement for server activation
checks or a claim that media is ready. Existing Campaign periods, asset overrides
and publication rules remain authoritative. Adding a time chooses an unused hour
and focuses it; removal focuses the preceding retained time. Save validation
associates messages with fields and focuses the first invalid control. Batalkan
restores the server snapshot and clears validation messages. Failed saves preserve
the draft; in-flight saves prevent duplicate submission. The footer follows the
form content rather than covering it. Contacts have bounded scrolling, an explicit
clear-search action and distinct unsynced/no-results states. The optional Status
test form is a native disclosure and retains the existing real-send confirmation.
Responsive, keyboard, save/failure and reduced-motion evidence lives in
`scripts/verify-marketing-settings-browser.mjs`; its mutations are intercepted and
never change persistent settings or deliver media.

One published channel cannot be resent by another channel's failure. Ambiguous
delivery shows Perlu diperiksa; the inspection action reconciles existing
evidence without republishing. Both queue and analytics expose independent
channel outcomes. Unavailable metrics render Belum tersedia, preserve prior
successful values on refresh failure, and show last synchronization time.
Observed WhatsApp counts do not claim a complete audience list.

Instagram setup reuses DialogFrame for a first-time guide and five server-side
readiness checks. Secret values are never returned to the client. The callback
URL is shown only for a valid configured public origin; otherwise it is clearly
labeled as an example. OAuth begins on that same HTTPS origin so the state and
OWNER cookies can return to it. Setup does not activate automation or send media.
The header's Hubungkan Instagram action starts OAuth when configuration is ready;
from a different origin it first opens the configured HTTPS website. Callback
failures use allowlisted messages in both a toast and the connection card. Logs
record only the failed stage and a static issue code, without provider text,
authorization codes, state or credentials.
The connection uses the server-selected login mode. Unified Login remains the
default; `INSTAGRAM_LOGIN_MODE=facebook` uses Facebook USER authorization,
an optional separate USER configuration ID, and the pinned company Instagram ID.
Facebook mode independently verifies profile and publishing quota, exchanges
to a long-lived token, checks the returned identity and expiry, and encrypts
credentials under a distinct provider envelope before persistence. An empty
Page list does not prevent a pinned-ID connection when both Instagram API
checks succeed. The guide follows the active mode, using the same DialogFrame
and readiness-check owner. Switching mode invalidates credentials from the
other mode. Connecting never enables automation. Facebook mode does not infer
Page-level webhook subscription readiness from a valid publishing credential.
The following assignment rules apply to Unified Login and its permission set.
The server validates permissions, portfolio, and the assigned Instagram account
before reporting success. Multiple shared accounts require an explicit company
account ID or reconnection with only one shared account. A verified non-expiring
SUAT can be connected with no expiry date. Legacy, revoked, mismatched, or expired
credentials never render as connected. The first-time guide names Meta App
settings → Basic and Unified Login rather than the legacy Instagram credentials.
An empty assignment response is a discovery failure, not proof that the user
omitted an account in consent. Discovery validates granular Instagram targets or
an explicitly configured company ID with Meta before saving. The configured-ID
fallback also verifies read access to the account's publishing capability.
Direct profile reads use the current `id,username` fields and verify the
Instagram-specific publishing edge instead of relying on legacy `ig_id`.
Discovery never creates or publishes test media. Failure messages distinguish missing
discovery results, a configured-account mismatch, and unavailable profile or
publishing access without exposing provider text or credentials.

Calendar slots without prepared media are explicitly labeled automatic. Only
future slots are projected; past rows require actual stored jobs. Preparing a
selected slot creates a persistent asset plan under the worker lease and does
not publish or enable automation. The selected time must match the saved
schedule and fall within ninety days. Cooldown applies around the target date,
including other reservations; a distant future plan does not block today's
selection. Auctions must still be upcoming on the planned publication date.

Each untouched slot has an Atur rencana action. The DialogFrame editor owns
property selection (automatic or one specific qualifying property), a nonempty
subset of the enabled Instagram/WhatsApp channels, and a custom future date/time
in WIB within ninety days. The authored MarketingDatePicker, date shortcuts and typed HH:MM
field share the same server schema and round-trip validation. Date limits and
shortcuts use Asia/Jakarta; time shortcuts use saved schedules and disable passed
times. Compact time input uses the shared campaign parser. Manual selection opens
the picker immediately and uses a debounced,
abortable, paginated SearchSelect expanded picker from the full Investor ranking and cooldown
scope. Search runs before pagination. Eligible assets appear first; matching
active assets that cannot be marketed remain visible with a disabled option and
a reason. A passed auction date, unknown evidence, cooldown, or missing photo
never becomes an eligible choice. Configure/save and publishing still enforce the
original strict criteria. Thumbnails in both options and the selected trigger use
the existing listing photo proxy, retry only that asset’s other source photos,
and reserve their space on failure. Only public listing facts enter this picker. The selected asset is
reserved immediately; photo rendering can be requested separately and also
runs before publication. A manually selected property never silently changes
to another property if it becomes unavailable.

Saving is pessimistic, retains field values on failure, and never activates
automation or publishes content. Dirty dismissal presents the app-owned discard
choice; an in-flight save cannot be dismissed. The footer remains visible and
focus stays within the dialog. The property picker opens a nested DialogFrame (overlay 10002, content 10003),
independent of the trigger position. It uses most of the screen on phones and a
large centered panel on desktop. Search/header stay fixed; the list occupies the
remaining height and owns scrolling, including status, retry, and Load more.
Visual viewport updates preserve usable space above the phone keyboard. Closing
returns to the property trigger without changing any form field.
Reopening retains the transient search query for this mounted editor; no search
URL or persistent browser storage is needed. Clear cancels pending work and
restores the full matching list immediately. IME composition pauses requests;
Enter starts the current search immediately. IDs and genuine land area help
distinguish otherwise similar properties. Selected listing facts appear once in
the picker trigger. Only the form body scrolls in the editor; its header, close
and save/cancel actions remain reachable. MarketingDatePicker reuses react-datepicker
inside a nested DialogFrame with an authored forest/sage presentation, Indonesian
month/day labels and Monday-first weeks. A single date click commits and closes.
Arrow keys/Page Up/Page Down navigate, Enter selects, and Escape dismisses only
the calendar and restores trigger focus. Disabled past/out-of-range dates cannot
change the plan. No native browser calendar is invoked. A failed save retains every field and manual
selection; server eligibility and revision checks remain authoritative.
The trigger retains the selected property when results change. Search supports
spaces; arrows enter the list, Enter selects, Tab reaches the list and its actions, and
Escape closes the property panel before the editor. Opening shows the initial list
without requiring a search term. The property result list may scroll locally.
Rencana tersimpan distinguishes an unrendered saved plan from Materi siap.

Manual plans persist in `marketing_jobs.plan`, survive global settings saves,
and revalidate under the current settings before publishing. Per-job channel
choices drive publication creation. Global channel disabling still prevents
sends. A configured property never bypasses Investor qualification, cooldown,
public-listing checks or auction validity at the scheduled time. Date moves
and optimistic revision checks commit in one transaction under the worker
lease. A hidden RESCHEDULED marker suppresses the previous automatic slot;
occupied target times return a conflict. Slots with delivery attempts or
published/sending/uncertain outcomes are immutable. Existing publication evidence
is never cleared by an edit.

Analytics uses all jobs in the selected month, independent of the paginated
content list. Views are grouped by content date from the latest received
snapshot, never presented as daily traffic. Instagram and WhatsApp are filtered
separately. No published media means no synthetic engagement chart.

## Campaign fresh

The compact CampaignForm uses TypePicker's `variant="campaign"` for the Home
sale/auction catalogue: Rumah, Tanah, Gudang, Apartemen, Pabrik, Ruko, Toko, and
Hotel & Villa. BUY_PROPERTY_TYPES and the existing label/icon map own these
values; Kos remains rental-only. The popup uses shared DialogFrame for focus,
Escape, outside dismissal and restoration, an authored anchored position with
viewport clamping, local Solar glyphs, multi-selection, arrow keys, reset and a
Selesai action. Desktop settings share two columns; mobile stacks them.
CampaignDateRange combines DialogFrame with installed react-datepicker and its complete
id locale for a two-month desktop/one-month phone calendar,
range selection, 7/14/30-day presets, keyboard navigation and explicit Batal/Terapkan.
Dismissal preserves the saved period and restores focus. Currency text is grouped
with id-ID separators while the draft/API retain numeric/null prices; caret position
survives edits within a formatted value. Campaign surfaces and picker portals
inherit root bold DM Sans. The editor keeps emerald surfaces throughout, with sky periods/evening, amber
morning/attention, teal timing controls, rose afternoon/Instagram and mint WhatsApp.
Primary actions are mint; all boundaries/focus stay neutral. No green outline/glow.
The 1–12 stepper uses native buttons/output and retains edited times through reducing
and restoring slots. Shared Switch uses native checkbox behavior with role=switch;
whole channel rows activate it, keyboard Space works and the input target is 44px.
Global-disabled channels keep their previous availability rules. Mobile list cards
use compact locale-aware ranges beside asset/frequency metadata; counts and
content-sized Edit/Buka actions share one footer while retaining 44px targets. 44px controls,
retained errors, dirty-close and the save footer remain.

Campaign editing also follows these shared owners. Direct Edit expands
CampaignForm within the campaign list and disables surrounding navigation
while that editor is open. Saving retains the draft through save/generation
failures; retry reuses the persisted campaign revision rather than creating
another campaign. The stock preview is read-only and refreshes every minute.
Empty selections are seeded once per filter/schedule scope from real server
recommendations; an explicit clear is preserved. Recommendation coverage is
separate from selected count and published history. Fresh source entry dates,
parcel cooldown and the 24-hour auction safety window are shared by preview,
proposal, approval, worker and Planner eligibility. New campaigns default to
fresh priority; existing manual selections remain manual. Applying a proposal
invalidates the mounted Planner cache. See campaigns.md for the domain rules.

CampaignInventoryStatus is the shared editor/preview owner for source counts and
eligibility reasons. The complete source scope is read without media/history
hydration and uses the same cached Investor snapshot and geographic/price filters.
Counts distinguish source inventory, eligible inventory and selected assets;
calendar capacity is separate. No remaining schedule shows available stock cards,
not a blank grid. Expired source inventory names its latest auction date/year and
links to the existing Scrape page in a new tab, preserving unsaved form edits.
No filter, deadline or publishing guard is relaxed and no import starts on view.

## Instagram account library

Business/API authority: [Instagram content integration contract](instagram-content.md)
and Meta's current media, insights, and comment moderation references linked there.
The Instagram section reads the connected account directly; Konten and Analitik
retain the application's schedule/publication history. Account content is not imported
as scheduled jobs. `igView`, `igType`, `igQuery`, and `igMedia` preserve the selected
library mode, loaded-content filter, search, and detail in the URL. The API's opaque
cursor is used only as a parameter on a fixed official edge, never as a request URL.
Load more appends/deduplicates; local filtering is explicitly scoped to loaded items.

Shared ownership stays in the canonical map above: Action/Button for controls,
Input/Textarea for text, DialogFrame for detail/confirmation/discard, and Sonner for
acknowledged outcomes. Dates/numbers use id-ID and Asia/Jakarta. The dashboard owns
list scrolling; the detail dialog body owns its scrolling. No native picker or new
select implementation is introduced. Skeleton/loading, error/retry, no-result and
empty library states remain distinct. Cancellation prevents stale reads overwriting
the selected dataset; refresh retains the current usable result if the request fails.

Every endpoint verifies active OWNER; every write checks Origin, pinned account,
fresh provider permissions, media ownership, and comment-to-media membership. Writes
are pessimistic. Persistent UUID request keys protect against repeated dispatch;
uncertain replies retain their draft and cannot be blindly retried. Delete dialogs
name the object/consequence, initially focus Batal, remain open on failure, and cannot
close while dispatch is in progress. Reply drafts survive tab changes inside detail;
dismissal asks before discarding and browser unload uses the narrow lifecycle guard.
An acknowledged media deletion removes it from the live library and labels any
existing publication history as deleted without clearing historical delivery evidence
or making the job eligible to republish. Archiving/editing uses an honest Instagram
link because these actions have no supported API endpoint.

### Instagram visual redesign and examples

The owner's 2 November 2026 compact dark-emerald redesign supersedes the earlier
light surface and automatic example fallback. Keep the real account/permission/state
contracts above. The source selection (`igSource`)
and selected example (`igExample`) are separate from real media IDs (`igMedia`).
The default source is Sudah diunggah and always shows the real dataset, including
zero posts. Empty results never substitute examples. Errors and active-Story empty
states retain their honest error/empty treatment. Examples require explicit selection. Switching source clears local
filters without modifying the account, jobs, metrics, or publications.

Three local example carousels use repository photography and illustrative counts.
Each starts with a real 1080×1350 design-cover image, followed exclusively by photos
of the same property. Production generation uses the same cover template, then all
1–3 available source photos, including the first photo. A one-photo listing therefore
still produces a two-slide carousel. New container creation requires 2–4 slides and
rejects legacy one-image material with a prepare-again message before any dispatch.

The connected account header and four compact summaries retain true account/list
counts, even in example mode. Like/comment totals describe only loaded media; missing
metrics remain unavailable. A dark emerald photo gallery shows published posts with
format, date, likes and comments. A compact inspector contains carousel, collapsible
caption, performance and management controls. Narrow screens stack the inspector
below the gallery; selecting a post brings its inspector into view. `igPreview` restores that selection. Gallery behavior
is shared with the detail dialog: thumbnails, previous/next, scoped keyboard arrows,
horizontal swipe, no wrapping/autoplay, and uncropped detail photos. Changing property
starts at its cover. Vertical touch gestures scroll normally. Examples remain labeled,
read-only local data; opening analytics/comments never calls API detail or mutations.
All real write guards, draft protections and confirmations remain unchanged.

Visual ownership is recorded in DESIGN.md and the scoped instagram-workspace.css.
Preserve keyboard focus, 44px primary controls, clearable search, reduced motion,
one phone column, and accessible panel scrolling. Evidence:
`scripts/verify-instagram-redesign-browser.mjs` verifies the example source,
source separation, six viewport widths, local font, poster-first galleries, same-property photo sequences, thumbnails/swipe/keys, analytics/comments,
URL restore and zero Instagram mutations; the existing content browser script
continues to exercise live-source behavior using intercepted fixtures.

## Campaign ownership

Business authority: the owner's approved Campaign plan and [Campaign contract](campaigns.md).
Campaign replaces the Konten navigation item. The old list, channel outcomes,
reconciliation and pagination live in Planner's accessible history disclosure.
Legacy `tab=antrean` opens that disclosure. Campaign selection/page are restored
through `campaign` and `campaignPage` URL parameters.

Reuse the canonical map above: shared Input, SearchSelect, LocationPicker,
DialogFrame and Sonner. Campaign forms use the normal dashboard scroller and a
sticky action footer, not a nested scrolling form. The slot editor reuses the
expanded PlanPropertyPicker with a fixed campaign candidate endpoint; only its
business source differs. Date/time remain typed DD/MM/YYYY and HH:MM in WIB.
The carousel preview reuses InstagramCarousel, its keyboard/swipe/thumbnails,
and production-rendered cover and photos in a named dark campaign presentation.

Campaign selects actual assets from filters before setting 1–12 daily WIB hours.
The compact filter panel also owns per-campaign discount criteria. Shared
SearchSelect chooses either local-market discount, historical auction decline,
or either criterion (explicit OR). Labeled percentage Inputs accept 0–100 with
inline errors and a percent suffix; only the relevant thresholds are visible.
Leading integer zeros normalize in the field immediately (0050 → 50); 0 and
decimal values such as 0.5 retain their meaning.
Help names the same-type/same-kelurahan land-price/m² average and first auction
price. Missing evidence stays unknown. Candidate and ready-stock facts reuse
CampaignDiscountFacts, with mint for the local benchmark and amber for auctions.
Changing these filters revalidates retained selections; saving and approving
propagates the same criteria into Planner and worker checks. Freshness ordering,
auction deadlines, cooldown, and global publishing/channel controls still apply.
Checkbox selections persist across search/pagination; unavailable selected assets
are marked rather than removed. Reordering controls determine rotation priority.
Form save retains edits on failure and returns to selected campaign detail on
success. Save remains enabled except during submission. With no eligible selection
or no upcoming hours, the primary action is Simpan draf, with a reason next to
the action. It persists only the brief, including unavailable selections, without
generating proposals or changing approved Planner jobs. With eligible assets and
future slots, the existing Simpan & susun jadwal flow remains. A failed generation
explicitly says the draft was saved; its retry reuses that campaign revision.
Parent tab navigation and unload protect dirty briefs; slot-dialog
dismissal protects dirty edits. Approval names the campaign, exact slot count,
replacement scope and current global automation state, stays open on failure,
and cannot be dismissed in flight. Data/proposal updates are pessimistic,
revision checked, and stale reads cannot replace another selected campaign.
Campaign uses no AI or custom message fields. Empty times show stock, cooldown
or conflict reasons before approval. Approved daily schedules suppress regular
automatic projections across the approved period, including while paused; draft
edits leave the approved settings alone. Unavailable metrics render Belum tersedia. Only real records appear in empty/list states.

Campaign's visual variant uses scoped emerald shells, mint selection/ready states,
blue schedule information and amber pause/empty states, always with text/icons.
`CampaignSurface` owns the nested presentation and reduced-motion-aware reveal;
shared primitives retain all interaction, focus, async and validation behavior.
Name/period, filters/asset selection, and hours/channels are three numbered form
sections. Date and count facts remain asymmetric on desktop and stack on phones.
The palette, local font, radii and runtime token mapping live in DESIGN.md.

Campaign list density is compact: status/title and location, date/asset count/hours,
publication counts, and Open align in adjacent columns on wide panels. Container
breakpoints stack the groups on narrow panels, preserving labels and 44px actions.
Do not restore oversized list-card padding or large publication counters.

Campaign lists use 20-row server pagination; proposal review uses 12-slot pages;
results show the most recent 100 with total coverage. Phone layouts preserve all
actions, status text, source facts and 44px controls without horizontal overflow.
Evidence: test-marketing-campaigns.cjs, verify-marketing-campaigns-db.cjs and
verify-marketing-campaigns-browser.mjs.

Campaign list lifecycle: MarketingCampaigns owns two compact current/ended
sections, independent URL pages and empty states; campaigns.server owns filtering
before pagination using the effective approved period in WIB. CampaignSurface,
CampaignStatus and campaigns.css own the subdued expired presentation. Existing
Action and inline CampaignForm continue to own editing and navigation. Browser
coverage includes both groups at 320–1512px and independent pagination; database
coverage includes approved-vs-draft dates, legacy fallback and WIB midnight.

### Simulasi aset A/B/C

Campaign menyediakan **Coba A, B, C** untuk mencoba stok yang memenuhi kriteria tanpa mengubah listing asli. Banner tetap terlihat di Campaign dan Planner. Ritme memakai kontrol yang sama dengan editor asli; kalender/agenda memakai komponen Planner yang sama. Tiga slot awal: A 09:00, B 13:00, C 18:00 WIB hari ini, dengan jam simulasi 00:00 WIB yang dinyatakan eksplisit. Perubahan langsung dihitung ulang; stok kurang menjadi slot kosong, waktu invalid mengosongkan proyeksi. Reset dan Keluar simulasi selalu tersedia; tab lain dan kontrol publikasi asli tidak aktif selama simulasi. Preview hanya foto/cover contoh lokal dan tidak memanggil API marketing.

### Properti database terbaru saat stok aktif kosong

CampaignReadyAssets menampilkan archive dari inventory secara otomatis bila tidak ada stok aktif. Label arsip dan tanggal sumber selalu terlihat; diagnostics 0 siap tayang tersedia dalam disclosure Kondisi data saat ini. Semua filter tetap berlaku dan enam properti dipilih dari tanggal lelang terbaru, dengan tiga kartu awal. CampaignStockCards menjadi pemilik kartu foto besar bagi stok aktif, arsip dan contoh. CampaignPropertyGallery memakai proxy foto berindeks yang sama. Pratinjau Planner menggunakan CampaignSimulation sebagai varian arsip, satu brief/proyeksi lokal dan Planner yang sama; URL memulihkan arsip melalui API inventory read-only. Tidak ada tanggal sumber, campaign tersimpan, job, publikasi atau otomatisasi yang diubah oleh pratinjau.


The current Campaign save workflow is **Simpan ke Planner**: save, generate and
apply the validated property plan, then invalidate cached months. It remains a
reversible plan write and does not enable global publishing. Saving an empty/error
inventory remains draft-only; acknowledged IDs/revisions survive synchronization
failures. Manual proposal review retains its apply confirmation. Auctions need at
least five complete days at every preparation/publication stage. Deadline and
coverage use quotas derived from the configured daily session count (five sessions
mean three near and two coverage turns), with 90-day exposure history,
identity cooldown, actual capacity gaps and an unchanged factual source. The pending
campaign notice is a MarketingPlanner business variant of shared Action and existing
semantic tokens; it links to the campaign instead of suggesting past time can be
filled. Jadwal terisi counts real assigned plans, while future unfilled gaps and
historical skipped rows keep separate labels.


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

Calendar campaign coverage is derived directly from the month response's
`campaignPeriods`, using inclusive WIB date boundaries, independently of jobs and
the selected channel. Each campaign receives a company-wide creation-order
appearance index from retained IDs, independently of month/filter/API order.
The C-number, hue and palette-reuse pattern match in the key, each date ribbon and
the agenda; drafts and paused states stay explicit. The read-only ID query runs
only when periods exist. A single campaign colours its cell; overlap retains a
neutral surface with three separate ribbons and the actual remaining count.
All covering names/ranges remain in the accessible date label and agenda, including
when more than three overlap. Phone ribbons retain their C-number. The month key
shows all campaigns in its own horizontal scroller; activating one selects its
first covered date in the current month, including a period begun in a prior month.
Selecting a date preserves existing agenda/navigation; Buka campaign keeps its
route owner. Month cache invalidation remains unchanged. Verification:
`scripts/verify-planner-campaign-periods-browser.mjs` covers empty jobs, channel
filters, 14 campaigns, palette reuse, overlap, refresh/API reordering, inclusive/
cross-month periods, keyboard and 320–1440px layouts. Browser verification calls
only the read-only planner endpoint, intercepts operational dashboard requests
with its fixture/retained planner snapshot, and blocks every non-GET API request.
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

Empty queue diagnosis reuses CampaignInventoryStatus and the campaignInventory
service. A draft has no persisted assignments; that alone never means the source
stock failed eligibility. Read its saved filters, or activeBrief for an applied
campaign, and show the actual source counts, rejection reasons and latest auction
date. Expired source data links to the existing scrape workflow in a new tab.
Drafts say Belum diterapkan ke Planner rather than promising an automatic batch.
Inventory-read failures preserve stored assignments and offer the existing queue
refresh action. These reads never approve a draft or change publication settings.

Policy 5 keeps assignments reserved across batches, paused campaigns and elapsed
sessions. Only untouched jobs explicitly replaced at the proposal's times can be
released. Lifetime publication evidence also matches stored snapshot/plan IDs after
identity aliases change. All planning, approval, preparation and per-channel send
paths enforce the same shared deduplication owner. A later duplicate is removed
from an automatically refreshed batch; a shortage waits for another unique asset.
Inventory explains reserved assets separately from missing photos. Delivery evidence
survives every refresh, and a multichannel job can finish its own remaining channel.

Property cards group discounts, land/auction facts and listing freshness on the
left, with one Detail link vertically centered on their right. The link uses the
shared mint primary-action presentation and a 44px target. It opens the property's canonical
listing in a new tab. There is no Lihat foto action or separate gallery entry in
these cards. CampaignStockCards owns this behavior in both the queue and editor.

The Instagram header stays on one row below a 1024px content width: title,
connected account and refresh. Its compact presentation hides the introduction
and decorative elements as needed while preserving the handle, connection text,
full profile accessible name and keyboard focus.

## Analytics content intelligence — 2026-11-02

`mode=analytics` is a fresh OWNER-authorized, private/no-store, read-only endpoint.
It reads published channel records by `publishedAt` in WIB, including the selected
month and two preceding calendar months; it does not prepare slots, probe Meta,
write settings, or depend on queue pagination. Only the latest metric snapshot
and allowlisted public property facts enter the response. All manual Instagram
content outside Pemasaran remains in the Instagram workspace, explicitly excluded
from these property cohorts. Published/deleted records remain truthful history.

The monthly/channel dashboard separates publication volume from audience response.
Counts include real zeros; unavailable, invalid and negative metrics remain null.
Each KPI reports metric coverage. Date charts show latest lifetime metrics grouped
by actual publication date, never daily metric increments. A native range control
supplies keyboard/touch date selection; hover is supplementary. Post ranking
sorts all matching records before local ten-row pagination. Search, selected
segment/dimension, sort and page persist in analytics-prefixed URL parameters.
Search is local and needs no debounce. Clear/reset returns to the first page.
Display clamps an out-of-range page after refresh. Channel/month navigation cannot
be blocked by an unrelated mutation. Superseded reads abort; requests time out at
30 seconds; same-period refresh failures preserve and explicitly label old data.
A different month never shows the prior month's totals. Period controls remain
available in loading/error states. Full workspace refresh or sync invalidates the
analytics read; switching channels uses the already fetched dataset.

Shared SearchSelect owns sort/type/projection popups and keyboard behavior.
Action/Input retain their existing owners with a scoped analytics presentation.
Details use native disclosure buttons with expanded/control relationships.
The existing DialogFrame/comments service owns comments, focus and restoration.
Analytics CSV includes every filtered result across pages, leaves null metrics
blank and protects spreadsheet formula prefixes. Downloads are local only.
Transient chart metric/date, audience dimension/order, expanded posting and
projection-type choices remain local to this mounted analytical exploration;
committed table filters are URL-restorable.

Response is the median per-post `(likes + comments) / views * 100`, or observed
WhatsApp reactions/replies. It requires all three metrics and views > 0. Saving
and sharing remain separate because availability varies. Response measures
interactions per view, never unique people or intent to buy. Segment comparisons
require at least three fully measured posts per segment; a leading-segment note
also requires two distinct properties per segment and two qualifying segments.

Projection is an explicitly labelled historical analogy for one property type
and channel. It shows the 25th–75th percentiles and median of recorded cumulative
views. It requires five posts aged at least 72 hours, three distinct properties,
and a 14-day span of publication dates. Deleted/missing-view records are excluded.
It does not fit an AI model or forecast conversions, does not imply statistical
confidence, and discloses unequal exposure ages/seasonality/ad effects. Missing
evidence shows the exact unmet thresholds, without sample data or a prediction.
Validate through a one-variable content experiment at equal exposure age.

Verification: `node --test scripts/test-marketing-analytics.cjs` and
`node scripts/verify-marketing-analytics-browser.mjs`. Browser fixtures are isolated
and labelled as testing; no provider mutations or production publications occur.

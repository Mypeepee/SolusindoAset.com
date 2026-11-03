---
version: alpha
colors:
  page: "#070A12"
  surface: "#0B1018"
  text: "#FFFFFF"
  primary: "#6EE7B7"
  danger: "#FDA4AF"
typography:
  sans:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
  numeric:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
rounded:
  card: "12px"
  dialog: "24px"
  control: "12px"
spacing:
  cardPadding: "16px"
  fieldGap: "20px"
  controlHeight: "44px"
components:
  DialogFrame:
    backgroundColor: "#0B1018"
    textColor: "#FFFFFF"
    rounded: "24px"
  Input:
    backgroundColor: "rgba(15, 23, 42, 0.5)"
    textColor: "#F1F5F9"
    rounded: "12px"
    height: "44px"
  Textarea:
    backgroundColor: "rgba(15, 23, 42, 0.5)"
    textColor: "#F1F5F9"
    rounded: "12px"
    padding: "12px 16px"
---

## Overview

CRM discount preference uses the shared `FormPreferensi` in all client create/edit surfaces. Retain the existing dark emerald form identity and DM Sans. Its compact nested field group pairs an authored `SearchSelect` with one numeric percentage; pin, descending arrows and layers identify Kelurahan, Turun lelang and Keduanya in both trigger and options. The controls stack on phones and keep 44px targets, visible focus and reduced-motion support. Runtime ownership stays with the existing search primitive and form Tailwind classes.

Scope: the existing About / company profile page and its owner-only completed-project editor. This records the existing identity, without prescribing a redesign of other routes. Public content is a brand surface; the owner editor follows the application behavior contract in UX-CONTRACT.md.

## Colors

Keep the established dark navy and emerald identity. White carries headings; muted white carries descriptions. Emerald marks selected projects and the primary save action. Errors use rose plus explanatory text.

## Typography

Reuse the local DM Sans font in the root layout. Compact cards use 15–16px titles and 13–13.5px descriptions. Form fields use 14px type and labels. Currency uses Indonesian grouping and tabular numbers. Never truncate the project description on the public stage.

## Layout

Promise cards use one, two, and four columns across phone, tablet, and desktop. The three hero statistics stay in one row, as do both hero actions. Thumbnail rows start at the first item when overflowing; only rows that fit are centered.

The editor uses a bottom sheet on narrow phones and a centered dialog on larger devices. Its body owns scrolling; header and actions remain visible. A desktop preview is supplementary, and no required field depends on it.

## Elevation & Depth

Subtle borders define cards. Reserve the stronger shadow and backdrop for modal layers. Completed-project photography supplies the visual emphasis; avoid stacking decorative effects on the form.

## Shapes

Cards and fields use 12px radii. The editor uses 24px on desktop and rounded top corners on phones. Primary and secondary actions are pill shaped with at least 44px height.

## Components

Runtime ownership remains the established Tailwind configuration, root font, shared input/textarea, and DialogFrame. DialogFrame owns Radix focus containment, Escape/outside dismissal, and focus restoration; the berita wrapper retains its existing presentation. Sonner is the existing shared notification system. The editor owns validation through React Hook Form and its shared Zod schema.

Motion: short 180–300ms state transitions. On phones, the thumbnail row gently moves right while visible until the user interacts. Reduced-motion disables that cue and removes transform transitions. Respect vertical touch scrolling on the main stage.

## Do's and Don'ts

- Preserve authored project text and prices; do not invent case studies.
- Keep selection, thumbnail scrolling, image navigation, and form typing independent.
- Do not center an overflowing flex row, hide its first item, or bind carousel keyboard shortcuts globally.
- Do not ship the owner editor and validation library in the initial public carousel bundle.

## Agent referral card

The profile referral card retains its neutral dark surface, mint #86efac actions,
existing typography and rounded code badge. Code, share and copy actions share
one row at every viewport. Container width owns the compact mode: below 360px
of card content, share/copy use labeled accessible icons with 44px targets;
wider cards show their visible labels. Keep copied feedback within the same
button footprint, visible keyboard focus, and reduced-motion behavior. The card
uses the existing Sonner provider for success and failure feedback.

## Investor dashboard business variant

`/dashboard/investor` is an owner-only product surface. The property-card reference remains the existing card on Jual/Lelang/Sewa: neutral black surface, rounded silhouette, photo, transaction/type pills, strong white price and a flat comparison strip. Reuse the shared `PropertyCardFrame` rather than introducing another shell. The Investor business variant highlights these core facts: full available address, current price, land area, discount against the local average land price/m², and historical auction drop, plus the source certificate type. Omit the agent profile, verbose source title, rank, schedule, score hero and standalone price/m² from the card. The source title, benchmark/gauge, initial price, samples and auction history remain in analysis/detail. Show full grouped IDR currency, the entire address with natural wrapping, and each percentage once. Keep the combined score private in all active views. Signed market discount + historical auction drop now determine ranking, in points (90 + 80 = 170), before pagination. Unknown drivers are omitted and both unknown means no score. BELI combines all buy categories; SEWA shows period-specific comparisons without auction metrics. The established dashboard chrome and DM Sans remain. The card comparison strip follows the explicitly requested discount-intensity palette; summary/drawer driver colours retain their existing roles.

Runtime tokens remain canonical (mapping model B): `src/app/dashboard/investor/investor.css` owns `--investor-bg` (#070A0B), `--investor-panel` (#0A0F10), `--investor-text` (#F1F5F9), `--investor-muted` (#94A3B8), `--investor-market` (#6EE7B7), and `--investor-auction` (#FCD34D). Shared Tailwind primitives retain their existing tokens; the Investor variant adapts their surface without changing their behavior. The document scrollbar baseline is owned by the `--app-scrollbar-*` tokens in `globals.css` and inherited by new scroll surfaces, including the table and modal.

The current explicit Investor layout is three summaries → always-visible searchbar → property cards. There is no visible page title, introductory copy, landing hero or framed workspace heading. The accessible page title remains screen-reader-only. The latest density correction removes the square aspect ratio: the first two summaries (Worth-it deals and signed average spread) and Quick suggestion use content-driven height with a compact 176px desktop baseline, 16px padding and 18px corners. Quick suggestion remains twice as wide, with the actual top-ranked asset photo, the actual strongest driver percentage, address, price and detail CTA. On phones the two metric summaries share the first row (140px baseline, growing for wrapped content) and the recommendation fills the next row (164px baseline). Icons are 28–32px, metric numbers 28–34px, and inter-card spacing 10–12px. Increasing viewport width must never increase summary height. The featured CTA remains a 44px target in the bottom right, with reserved price-row space and no text overlap. All three have visible semantic symbols. Keep neutral black with restrained emerald and sky icon tones; do not add a fourth summary, fabricated chart or an agent profile.

`investor.css` owns this summary/search composition. DashboardKpiIcon supplies the existing owner dashboard's emerald and sky icon treatments without changing that dashboard's KPI layout. Counts, count ratio and percentages come from the feed. Negative spreads stay signed and explicitly above the benchmark; unknown evidence stays a dash. A zero total does not expose an invalid meter. The combined score is internal only. The featured value displays the actual dominant source percentage and its precise market/district/auction label, never the summed score as a percentage.

Quick suggestion uses a compact horizontal carousel of at most five actual qualifying properties, ranked by the signed sum of available drivers in the feed before pagination. The same server snapshot supplies recommendations and summary metrics; changing result page or sort must not replace the recommendation set. Rotate every five seconds with a 360ms horizontal slide. Keep the heading, position counter, previous/next, pause control and detail CTA stable while photo, score, address and price move together. No extra card height, rows or decorative progress strip. Reserve text space beside the 44px detail CTA. Manual navigation supports touch swipes and scoped arrow keys; vertical scrolling remains natural.

Pause rotation on hover, focus, pointer interaction, offscreen/hidden pages, loading/stale states and open dialogs. Respect explicit pause until resumed. Reduced-motion users get manual controls without autoplay or sliding. Announce manual changes only; automatic changes never interrupt screen readers. Empty/single-property feeds have no rotating controls. Keep only the incoming slide accessible during a transition and preserve CTA focus when dialogs close. The bounded summary.suggestedDeals field extends the existing feed without schema changes or per-slide requests; older feeds fall back to their one topDeal.

The searchbar follows the Home reference's white pill surface, divided fields, dark values and emerald circular search action. Four fields are always visible: Kota / Kabupaten, Kelurahan text input, Beli/Sewa single-choice dropdown, and Jenis properti. Reuse Home LocationPicker and TypePicker for data, options and authored panels; the shared SearchSelect/Radix primitive owns the transaction popup. On phones the four fields form a two-column grid with a full-width search action. LocationPicker permits province browsing/multi-selection and stops at city/kabupaten. Kelurahan text uses the existing internal query search (also supporting address/ID), not an unverified geography update. The fixed field hint replaces Home's rotating examples only in this named variant; Home defaults remain unchanged. The kelurahan input stays borderless on focus, with no outline, underline or ring. Investor text/number inputs use a neutral slate focus border and no outer ring; buttons and other keyboard controls retain visible focus.

Below the white searchbar, one 40px toolbar owns all result controls: Filter trigger, scope dropdown, a quiet result count, sort dropdown and refresh. Do not reintroduce scope tabs, separate count/action rows, exposed discount summaries or a standalone reset row. On narrow screens keep this single row: Filter/sort/refresh use compact icons, scope retains its selected short label, and the count is screen-reader-only. No horizontal page scrolling or wrapped toolbar controls. Beli uses a house icon and Sewa a key icon in both the transaction options and selected trigger. SearchSelect owns option icons, concise trigger labels and authored popup behavior.

Filter opens the shared DialogFrame, with direct Home SearchRangeInputs for price/land ranges instead of nested range popups. Keep category, rental period, discount thresholds, upcoming-only and saved-only inside this dialog; Reset and Terapkan share its footer. The dialog body scrolls independently while actions remain visible. Rental-period Select uses the existing searchTabs values and a layer above the dialog. Scope/sort changes remain immediate. All advanced fields (category, ranges, period, thresholds, saved and upcoming) are one local draft: only Terapkan commits; Escape/outside/close discards edits. Reset filter clears the advanced draft; Terapkan commits it. Preserve primary geography/query/type selections when resetting the advanced draft. Category pills use Layers3/Building2/Gavel/Home icons. Initial and transaction-reset scope is Semua listing; Worth-it remains explicit. If its result is empty but the server confirms matches under every other filter, automatically recover to Semua listing and synchronize the URL/trigger/count. A compact status above the real cards states that the discount threshold was not met and names the active listing category. Hapus filter tambahan clears advanced criteria immediately while retaining city/query/type/sort. Never broaden a true query, range, bookmark or schedule mismatch. Worth-it classification and summary counts remain unchanged. All results are property cards, including restored legacy view URLs; there is no view picker. Queries remain remote, cancelable, IME-safe and persisted in the URL. These controls never alter CMA peer aggregation. Opening Filter pauses the recommendation carousel.

The Investor card now takes its dimensions from the public Lelang card through `PropertyCardFrame` and `PROPERTY_CARD_PHOTO_CLASS`: #111111 surface, 24px radius, 240px photo below md and 256px at md and above. The latest correction removes the 400px cap. The business grid uses repeat(auto-fill, minmax(min(100%, 300px), 1fr)) so each card fills its actual column at every container width. It adapts to the dashboard sidebar, without a right-side gap inside a wider column. The Investor shell now uses a 1px neutral hairline and 23px black core, without green borders or hover glow; public cards are unchanged. On short phones (height ≤700px), the business variant reduces the photo to 136–176px; long addresses/incomplete geography or rental period use 88px there. This preserves a complete card inside the 320×568 dashboard content viewport. The shared public card's appearance is unchanged by the extracted class constant.

Card hierarchy: real photo gallery with transaction and property-type pills → full IDR price/limit with land area beside it → complete address → a flat one/two-column discount strip → the three footer actions. Address previews use 13px/19px and clamp to at most two lines, adding only absent geography. The complete value remains in the title, accessible action name and detail view. Price is 23px desktop, 22px mobile and 20px below 360px; percentages use 25px tabular numbers. Price/type facts retain plain labels. Avoid a repeated source title, agent profile, date, score hero, per-m² figure, three tinted nested boxes or decorative gauges. Land is a quiet label/value beside the price, never building area. The footer is always ROI/sewa analysis on the left, bookmark centred and detail on the right, with 44px targets and emerald brand actions. ROI and detail are low-profile pills with nested icon discs: hover/focus reveals a pale emerald surface, dark text and a small icon translation/rotation; press scales down. Bookmark gets its own circular hover/selected state. Custom cubic-bezier motion uses transform/opacity and respects reduced motion.

Both discount numbers share an explicit savings-intensity scale (`investor-presentation.ts` plus the card's `--discount-tone` mapping): exactly zero is #FFFFFF; positive values below 30 are muted #B4BCB8; 30–50 inclusive are orange #FB923C; greater than 50 is red #F87171. Negative values and unknown evidence use #A8B2AD; retain Di atas / Naik wording for negatives and a dash for null. Never use the absolute negative percentage to award a red “great discount” tone. Red here means an exceptional positive saving as explicitly requested; it does not change destructive-action intent. District-expanded CMA still says kecamatan. Classification and historical baselines are unchanged; ranking uses the signed sum as requested.

InvestorPhotoGallery reuses the public photo geometry, shared SliderDots and useSwipe. Show only source photos from the listing's gambar field, ordered/deduplicated (up to 50), with a true count, previous/next buttons, scoped arrow keys and horizontal touch swipe. Vertical gestures scroll. Manual gallery controls have 44px targets; no card-gallery autoplay. One/zero source photos hide navigation. Failed images show a neutral placeholder, and moving to another photo resets only that photo's error state. Reduced motion removes image fades. The existing /api/foto/[id] proxy has a bounded `view=card&index=N` variant preserving original ratio and returning an honest 404 on missing source; its default email crop/fallback remains compatible. No arbitrary remote URL or invented fallback photo is exposed. The main feed adds imageUrls while retaining imageUrl compatibility.

Dialogs retain their existing 24px shell and DialogFrame focus/dismissal behavior. The compact location correction and full warning remain available. The dashboard shell owns vertical scrolling; only the proof table in analysis owns horizontal overflow. No card has its own scroll region.

The ROI workspace is a centered Investor business variant of DialogFrame, at most 1280px wide with 20px desktop viewport insets and a 24px neutral shell. Phones use 6px insets and an 18px shell. It inherits dashboard DM Sans, near-black surfaces and filled emerald highlights, with visible neutral keyboard focus. A compact asset-photo/address/land/current-price header precedes evidence on the left and purchase costs/scenarios on the right (stacked below 960px). The modal alone owns vertical scrolling; its 44px sticky close stays reachable. Only the evidence table scrolls horizontally. CMA and the exact public RiwayatLelang component occupy keyboard-operated tabs, with independent loading/errors. Primary/Secondary and rentals expose CMA only. The table contains the target plus up to nine highest-price/m² peers, sorted together descending; the target has an emerald fill and text marker. Mean and minimum use all eligible peers in the exact kelurahan, excluding the target. A single peer is valid; fewer than three peers gets a low-sample note and never widens geography. Assumptions are optional local edits with Reset, and never write source data. Rental periods stay isolated, with no purchase/resale simulation. Reduced motion, Escape, focus trapping and restoration use the established DialogFrame owner.

Investor pagination is a controlled business variant using the shared page-window utility. Page size is fixed at 30 for the card feed; sort and qualify the full result before slicing. Show a concise actual result range/count and a numbered dark capsule with first/last access, ellipses, previous/next and aria-current. The compact variant has at most three 44px number targets plus two ellipses, fitting the 288px phone content area. Disable controls during requests and retain existing URL/scroll/focus ownership. Certificate labels are allowlisted from legalitas (SHM, HGB, HGU, HP, STRATA_TITLE, PPJB, AJB, LAINNYA); no certificate number enters the feed or card. Missing type is an honest dash.

Latest Investor refinement: all focus outlines, borders, rings and hover shells are neutral, including the white Home search, toolbar, filter/correction dialogs and property cards. Preserve visible keyboard focus with slate/white treatments. Toolbar triggers use a rounded inset focus stroke rather than an outer rectangle. Filled emerald selected/CTA states and semantic icons retain brand colour. LocationPicker and native Select opt into focusTone="neutral"; their other consumers retain existing defaults.

Keep the source transaction badge at the top of the photo. Property type and certificate type share a plain bottom-left caption, with no pill, frame or separate panel. Blend the photo into the same #111111 body surface and place gallery dots above this caption, preserving a separate photo count. Card category/type symbols use an unmodified bundled Solar duotone subset from the installed icon set, matching public property iconography without runtime fetches. Source and CC BY 4.0 attribution are in investor-card-icons.ts. Footer labels are geometrically centred in equal-width controls; side icon slots are symmetric and disappear below a 340px card-container width, retaining text and 44px targets. Keep recommendation/card/detail/analysis free of visible combined points; default sort reads “Paling worth-it” while signed-SUM ranking and 30 rows remain unchanged.

Investor card discount labels (including their icons) and percentage values are centred within their own equal-width columns, with symmetric horizontal padding around the divider.

Investor performance refinement: keep the current layout. The sort menu explicitly names “Diskon kelurahan tertinggi” and “Penurunan lelang tertinggi”, with concise selected labels on narrow toolbars. Initial fetches coalesce, and owner/policy/filter-scoped snapshots show the matching cards while fresh data loads; never mix a different city's results. Manual refresh forces fresh data. The ROI proof uses the same strict kelurahan-only rule even for one peer. Photograph loading is batched for visible cards and proof rows, without changing genuine galleries or card dimensions.

## Pemasaran dashboard business variant

The OWNER navigation places Pemasaran directly between Dashboard and Tugas in
both sidebars. Its unmodified Solar `volume-loud-linear` glyph is bundled in
`marketing-menu-icon.ts` so it renders without the Iconify network service.
The campaign H-1 email uses the same dark emerald identity through the dedicated
`campaign-reminder-email.ts` renderer: charcoal-green canvas, mint action and
deadline, Arial email fallback, table layout, one primary Campaign deep link,
and no remotely loaded images. It remains readable at 320px and includes a
plain-text version and Outlook button fallback. Review copies explicitly label
their campaign data as examples.

Pemasaran is an OWNER product workspace for the company accounts: Planner,
Campaign, Instagram, Analitik, and Pengaturan. The monthly content calendar is the default
surface, paired with a selected-day agenda. Reuse dashboard DM Sans, charcoal
panels (#131715), 18px radius, fine tinted hairlines, and the existing Tailwind primary
token (#99E39E). Runtime ownership remains the existing Tailwind/theme system;
the feature maps primary to --marketing-accent rather than defining a new brand.
The calendar is the signature: actual prepared content, explicitly labeled
automatic future slots, real times and independent channel states. Keep the
month calendar left and the day agenda right on wide screens; stack at narrower
widths. Mobile dates retain selection, accessible names and status dots, with
the complete content in the day agenda. Past history is never projected.
Use Radix icons for the Pemasaran variant, with the bundled Ionicons WhatsApp
brand asset for that channel. The tab indicator uses restrained
spring motion and honors reduced motion. Keep summaries factual, with no invented charts or engagement.
Empty analytics says unavailable; absent metrics never become zero.

The Pemasaran masthead is a compact emerald business variant owned by
`components/MarketingHeader.tsx` and `components/marketing-header.module.css`.
Its 22/21px nested shell uses the Campaign palette (#061713 base, #0D241D surface,
#16382D selected), with mint
Planner, amber Campaign, rose Instagram, sky Analitik and teal Pengaturan icons.
Keep company identity, account, refresh and truthful automation status together;
omit the header's Rencanakan konten action. All five labeled sections stay visible
in one row, with stacked icon/label targets on narrow containers. Use container
width for control reflow, 44px touch targets, neutral keyboard focus, restrained
spring selection and reduced-motion support. Preserve dashboard DM Sans and
compact padding; this header does not inherit landing-page whitespace.

Pengaturan uses the same compact product register through
`components/MarketingSettings.tsx` and `components/marketing-settings.css`.
The runtime `--ms-*` tokens own this business variant: base #061713, surface
#0D241D, raised #143229, text #EDF8F1, muted #B1C9BC, mint #9CDEB9,
sky #9DC5EC, amber #E9C17C and violet #C7B7EF. Mint identifies account/automation,
sky asset selection, amber timing and violet audience; Instagram retains rose.
Apply color to symbols, switches, chips and concise state text, with neutral
white/.10 hairlines and #D0D6E0 keyboard focus. Do not tint whole panels purple.
Keep DM Sans, 22/18px nested shells, 17px padding, 44px controls and 14px gaps.
At 780px available form width, two independently stacked columns avoid equal-height
empty space; narrower forms use one column. The save/cancel footer stays in natural
flow so it never covers fields on short screens. Shared Input, Switch, Action,
SearchSelect, LocationPicker, DialogFrame and Sonner retain behavior ownership.
The category popup matches its trigger width. Field styling removes the shared
input glow and scrolling blur only inside this variant. Once-visible panel reveals
use 800ms opacity/transform with cubic-bezier(.22,1,.36,1); reduced motion removes them.

Campaign is a compact dark workspace for property assets, a campaign period and a
repeatable daily posting rhythm. Campaign mobile uses the dashboard's existing 16px outer inset without adding a second horizontal padding layer.
The five navigation tabs stay on one phone row. Mobile cards give identity, period/times, compact
publication counts and compact footer actions a clear hierarchy. Dashboard, Planner and
Instagram keep their established presentations.

Runtime ownership is `components/campaigns.css` through `.campaign-theme` and
`--campaign-*`. Base #061713, surface #0D241D and raised #16382D establish dark
emerald. Mint #9CDEB9 supplies primary actions and published/selected content; teal
#8AD6CB daily timing, sky #9DC5EC periods/evening, amber #E9C17C morning/attention,
and rose #E8A2AC afternoon/Instagram. Identity #0E2D27, filters #182B20 and timing
#10291F stay within the emerald family. Color belongs to icons, time chips, status
and channel fills; avoid broad purple/brown panels or rainbow boundaries. Primary
hover is #B8EDD0 with dark #082419 ink. Text #EDF8F1 and muted #B1C9BC remain
readable. Boundaries/focus stay neutral: white at .21 for fields, white at .10 for
hairlines, #D0D6E0 keyboard focus. No green outline or glow. Inherit root bold DM
Sans for headings/body/portals, with tabular numbers for times and counts. Runtime
CSS tokens are canonical; this document mirrors their accepted values.

`CampaignSurface` provides neutral flat surfaces with quiet 1px boundaries.
The compact editor uses 18/17px shell/core corners with 1px padding. Campaign lists
use a compact 18/15px shell/core and 16px desktop padding. Phone cards use 15/14px
corners, 12px padding and 6px row gaps.
Keep identity/status, period/assets/hours, counts and the Open action in four
adjacent desktop columns rather than stacking all metadata under the title.
Use actual container width for the 850/550px list breakpoints; narrow rows stack
while preserving every fact and 44px actions. Titles are 14px; mobile publication
counts use compact 15px figures. Mobile titles precede the status badge; compact
locale-aware date ranges share a wrapping row with asset/frequency metadata. Times
wrap below on narrow phones and share the metadata row when 440–549px is available. Publication counts and content-sized Edit/Buka controls share
the footer, with 44px touch heights. Below 350px container width, the labeled actions
omit decorative icons to preserve room. Normal three-time rows should stay below 150px on wide desktops.
The header is a compact 18px-padded toolbar using the emerald surface. Read-only
facts have an asymmetric grid on desktop, one column on phones. Stock, filled
slots and gaps use sky, sage and amber accents; mobile tiles form a vertical list.
Property photos get a recessed frame and slots retain visible edit/preview actions.
Shared Action buttons receive the scoped pill presentation; forward arrows sit
inside a trailing circular enclosure. Inputs, SearchSelect, LocationPicker,
DialogFrame, Sonner and the dashboard scroller retain canonical ownership.

The editor is compact: name and dates share one desktop row; filters and daily
timing sit beside each other once the editor container reaches 780px. A full-width
asset section follows. Use 16px padding, 12px section gaps, 18/17px corners,
14px section headings and 44px fields. Narrow editors use 12px panel padding. Remove step numbers, oversized time tiles,
focus glows, repeated summaries and default field-group margins. Phones stack the
sections while retaining two date/price columns and compact time fields. The asset
section automatically reflects the existing filters, with fresh stock first and
one large horizontal photo strip. Do not repeat address search, checkboxes or
priority controls. Keep loading, retry, availability details and the save footer compact.
Frames reveal once in view with only
opacity/transform (800ms, cubic-bezier(.22,1,.36,1)); button movement is restrained.
Reduced motion removes reveals and transitions. Never blur scrolling panels.

Discount criteria live below the price range within the existing emerald filter
panel. Shared SearchSelect owns the comparison mode; shared Inputs with percent
suffixes own 0–100 thresholds. Mint identifies the same-kelurahan comparison and
amber identifies auction decline. At 400px filter width, mode and thresholds
share one row; narrower panels stack the mode above two threshold columns.
Explanatory text names the benchmark, OR rule, and unknown evidence. Candidate
and ready-stock rows display actual source percentages through CampaignDiscountFacts.
Percentage integer prefixes normalize immediately (030 → 30), preserving 0 and
decimals. Save has one stable primary action: Simpan draf when inventory is not
ready or no future slots remain, otherwise Simpan & susun jadwal. A compact
explanation above the footer actions names the condition; saving a draft does not
generate proposals or replace Planner jobs. Only an in-flight submit disables Save.
Do not replace freshness priority with a fabricated score or fill missing metrics
with zero. CSS retains neutral field borders and the existing bold DM Sans.

CampaignInventoryStatus provides one compact emerald source/eligibility panel
in the editor and ready-stock preview. White carries the source/eligible counts;
amber carries actual exclusion reasons, and mint links to the existing source
refresh workflow. Keep slot capacity and selected count distinct from stock.
Use source-backed dates including the year, no empty reserved grid when there
are no cards, and preserve eligible stock cards when recommendation slots are
zero. The source-refresh link opens a new tab to retain the campaign draft.

Ritme tayang combines a native button/output stepper (1–12, 44px buttons) with
editable time slots. Numeric typing/paste normalizes HHmm to HH:mm; reject hours
outside 00–23, minutes outside 00–59, junk and oversized paste. Keep caret editing
and deletion around the colon usable. Partial input gets an associated error and
cannot be committed. Slots must increase strictly (Jam 1 < Jam 2 < Jam 3); mark
the offending field immediately and keep its entered value available for repair.
Save, generation, approval and local Planner projection share this rule. Added
times are unique and sorted within the same day, including midnight; shrinking/
re-expanding restores edited times in chronological order. Disable addition until
existing time edits are complete and ordered. Historical approved records retain
their original stored order and reserved periods. The live count announces changes without moving focus.
Mobile time fields use two columns with a direct Tambah jam cell; all twelve slots wrap naturally. Native Switch
in `src/components/ui/switch.tsx` owns checkbox/switch behavior and 44px input hit
areas, while `switch.module.css` owns track/thumb/focus/reduced motion. Channel rows
supply rose Instagram and emerald WhatsApp variants via --switch-color and tint;
labels activate the whole row. The channel container chooses one/two columns by its
actual width. Global channel availability and draft/save semantics remain unchanged.

Jenis aset reuses the Home TypePicker through its named campaign dropdown
variant. Home sale/auction labels, database values and eight Solar icons remain
shared; the icon subset is bundled locally. The compact trigger keeps its label above the icon/value row and summarizes
multi-selection, and the anchored menu owns scrolling, arrow keys, reset, Escape
and focus restoration through DialogFrame. It clamps to 8px viewport insets and
uses the existing nested-picker layer 10002/10003. The panel keeps the same
--campaign-* tokens and the root DM Sans font. The Home picker presentation is retained.

The campaign period uses CampaignDateRange, an authored business variant built on
DialogFrame and the installed react-datepicker primitive with its complete id locale.
The library owns calendar ARIA, range selection and keyboard behavior. It shows two
months on desktop and one on phones, locale-aware date labels, range highlighting,
7/14/30-day presets, explicit Batal/Terapkan, month navigation and roving keyboard
focus. Cancel/Escape preserve the period and restore the trigger. The viewport
clamps the popup, and the server's 90-day range/horizon remain authoritative.
CampaignPriceInput wraps the shared Input: grouped id-ID text, numeric/null data,
plain digit paste, and a digit-relative caret for editing within a grouped price.
The Home LocationPicker's campaign presentation and SearchSelect content class
supply neutral popup boundaries and focus without changing other consumers.

Campaign rows expose Edit directly and expand the shared CampaignForm in place.
A read-only stock preview above the list shows genuine recommended properties,
their actual source dates, coverage, and last check time. Reuse CampaignSurface,
CampaignStockCards, Action, and the existing --campaign-* tokens. Refresh visible
stock once per minute without writing saved schedules. Editor filters select fresh
recommendations automatically; changing a filter invalidates previous inventory
immediately. Persist this selection only on save, and change Planner jobs only on
the explicit “Simpan ke Planner” action, which now saves, generates and applies
in one user operation. Historical saved manual records remain readable. A source
timestamp is never invented. Auctions need at least five complete days between posting and their
start, and a shared selector applies parcel cooldown, slot conflicts, rotation,
and a daily allocation derived from campaign intensity to recommendations and proposals; source
freshness resolves equivalent priority. The Planner marks
newly ineligible campaign assets for review and omits replaced future revisions.

Campaign has no AI, strategy, message editing or AI evaluation. The shared
carousel and source-based sales caption follow the marketing artwork contract below. Review shows filled and empty times
with precise reasons; preview reuses InstagramCarousel in this dark presentation.
The explicit Save to Planner action applies its validated plan immediately;
separate manual proposal review retains its apply confirmation. Approved periods replace regular
automatic projections, including while paused; manual plans remain. Draft edits
cannot change approved settings. The old content queue stays below Planner.

The Planner has its own emerald dark-mode surface variant, scoped to
`.marketing-planner` in `pemasaran.css`. Forest shells (#10271F), deep-green
calendar cells (#0D221C), and a teal weekday bar distinguish the calendar from
the dashboard background. Nested calendar and summary shells create subtle
depth without heavy shadows. Semantic tones are consistent across summary
tiles, calendar entries, dots, pills, and daily cards: emerald (#174C3B) for
ready material, blue slate (#1B3042) for automatic slots, sage (#293B2A) for
published content, and amber (#3B3021) for attention. Selected dates have a
stronger emerald fill; today keeps the primary brand date badge. Always keep
text/icon status labels alongside colour. Focus stays neutral and visible;
reduced motion removes the brief entrance animation. Other tabs retain their
existing palette. Runtime `--planner-*` tokens own this variant, with
`data-planner-tone` mapping actual statuses to their surface, ink, and accent.

The dashboard owns scrolling; the contact list and modal body may scroll locally.
The Planner toolbar groups the month, previous/next/today controls, and channel
filters in one compact row. Below 768px, keep the complete toolbar in one row:
abbreviate the month, hide visible control labels, and retain named icon buttons
with tooltips and neutral keyboard focus. Use 44px-high touch targets with compact
widths that fit 320px screens. Status WhatsApp uses the bundled Ionicons WhatsApp
brand logo, never a generic chat symbol. Omit the redundant timezone label here; daily slot
times still say WIB. Navigation only reads the authenticated month endpoint,
without refreshing settings, connections, content pagination, or dashboard
chrome. Cache up to six months within the mounted OWNER workspace for sixty
seconds; invalidate them after a mutation or full refresh. Cancel superseded
requests and keep failures and loading feedback local to the calendar. Same-month
date/today selection and channel filtering require no network request.
Planner summaries stay in four equal columns at every width. Below 1024px,
use compact visible labels (Siap, Otomatis, Terbit, Perhatian), stacked status
icons, and smaller spacing; retain full accessible labels and all four colours.
All cards must fit the phone width without horizontal scrolling. Settings stack. Skeletons match
the calendar during initial loading. Preparation remains a separate action from
activation: preparing a dated asset never publishes it. Analytics is scoped to
the selected month and channel, independent of the content-list page.
The shared DialogFrame owns focus, Escape and restoration. Its default overlay
uses z-index 10000; Pemasaran modal content uses 10001. Use shared Button/Input,
SearchSelect and LocationPicker with the named feature presentation. Sonner owns
feedback. Times are typed HH:MM with explicit Asia/Jakarta text and validation.

Generated marketing posters use navy #0D1B2A, warm cream #F7F4EC and crimson
#8B1A1A, with local Plus Jakarta Sans embedded by the shared property-cover template.
Real listing photography supplies the visual content. Display source facts and
the company contact; Investor scores and ROI remain selection inputs.

Per-slot Atur rencana opens a forest-toned DialogFrame editor with an authored date calendar and
typed WIB time, Instagram/WhatsApp checkbox cards, and automatic/manual property
selection. The manual picker uses the expanded dialog presentation of shared SearchSelect,
with genuine listing photo thumbnails, addresses, types, cities, and prices in
scrollable options; the selected trigger retains its photo. Eligible matches come
first without changing their Investor order. Other matching active assets remain
visible but disabled, with the actual reason (expired auction, qualification,
reservation, or missing photo); never turn a blocked search into an empty result.
The property panel is independent of trigger position: 860px wide with up to
800px height on desktop, and 8px screen insets on phones. Its header/search stay
fixed; the list owns the remaining height and scrolling. Status and Load more
belong inside that scroller, never in a large pinned footer. Follow the visual
viewport when a phone keyboard opens; use 16px mobile search text to prevent
input zoom. The closed trigger retains the selected property. DialogFrame owns
nested focus, Escape and restoration, with overlay layer 10002 and content 10003.
Other SearchSelect consumers keep the anchored popover presentation.

The per-slot editor uses the scoped `.marketing-plan-editor` business variant:
an 860px desktop split puts schedule controls beside channels/property, then
stacks below 768px. Its fixed header/footer surround one scrolling form body.
Keep the existing DM Sans and forest identity; nested inset surfaces, 28px dialog
corners and pill footer actions add depth without extra decorative content.
MarketingDatePicker reuses the Campaign react-datepicker engine through an authored
single-date presentation. Its button opens a forest/sage calendar with Indonesian
month/day labels, Monday-first weeks and explicit previous/next controls. A single
date click commits and closes; arrow keys select dates, Escape dismisses only the
calendar and returns focus to its trigger. The nested DialogFrame uses the existing
10002/10003 layers and clamps to the visual viewport. Native browser date inputs
are excluded from this editor. The range is today's WIB date through
the ninety-day limit. Hari ini, Besok and +7 hari are explicit local shortcuts;
time shortcuts come from the actual saved schedules. The shared campaign time
parser formats compact input such as 1300 to 13:00. Desktop schedule preview
shows the actual localized date/time. Primary actions stay visible on phones.
Switching to manual selection opens the property dialog immediately. Its compact
desktop rows align real prices on the right and list ID/land area under the
address; phones stack these facts. Search has an explicit clear button, retains
its query when reopened, pauses during composition, cancels obsolete requests,
and accepts immediate Enter submission. The selected trigger contains the photo,
address, price and ID in one place. Use short transform/opacity motion with reduced
motion support. Runtime ownership is `components/marketing-plan.css`; shared
SearchSelectDialog owns search controls and DialogFrame owns nested focus.
Use the existing emerald semantic tokens, shared Input/Button, neutral keyboard
focus, sticky footer, and the canonical discard behavior. A selected but
unrendered property shows its actual listing photo and Rencana tersimpan;
Siapkan materi remains separate from saving. Attempted publications have no
edit action. The four summary layouts and compact calendar toolbar stay consistent; Jadwal terisi now includes actual unrendered property plans.

The Instagram account library follows the owner's 2 November 2026 compact,
colorful dark-emerald brief, superseding its earlier paper editorial surface.
`components/instagram-workspace.css` owns --ig-paper (#091B18), --ig-white
(#102923), --ig-ink (#EDF8F3), --ig-muted (#A2BCB2), --ig-line and --ig-soft.
Mint #79E2B5 owns active/primary actions, violet #C4B5FD followers/views/examples,
coral #FDA4AF likes and amber #FCD28A comments. The Instagram brand tile uses a
small coral/violet/peach gradient. Self-hosted Plus Jakarta Sans remains scoped
to Instagram; sibling marketing screens retain their existing DM Sans identity.

Below a 1024px Instagram container width, keep the title, connected account and 44px refresh control in one row. Hide the introductory sentence and content badge in this compact header; retain the account handle and connection text. Reduce decorative icons on phones, preserve full account identity in the profile link accessible name/title, and ellipsize unusually long handles without pushing refresh outside the row.

A compact account header, four factual summaries and source/search/filter controls
precede the photo-led gallery and smaller inspector. Use 20px workspace padding,
10–18px gaps, nested 18/14px gallery cards and 21/17px inspector shells. The gallery
has two or three columns, including two on phones. With at most three loaded
results, desktop uses compact horizontal photo cards above a full-width split
inspector so a short library never leaves a tall empty column. Larger datasets
keep the gallery beside the inspector. Narrow content containers stack the inspector. The inspector uses a bounded uncropped media
preview, a clearable caption disclosure, colored per-post metrics and 44px actions.
Selecting a card on a narrow viewport scrolls its inspector into view. Document
scrolling remains natural. No viewport-height workspace or oversized hero gap.

“Sudah diunggah” is the default source, including for an empty connected account.
Examples require explicit selection; no auto-substitution. Account summaries always
come from the live account/list response, including when examples are selected.
Like/comment totals describe only loaded media; missing values remain unavailable.
Example counts are illustrative and labeled on cards, the source banner and metrics.
`igPreview` restores the preview independently of live/example modal IDs.

InstagramCarousel still owns uncropped photos/video, thumbnails, 44px arrows,
scoped arrow keys and horizontal swipe, with natural vertical touch scrolling and
no autoplay. The dark dialog shares the same palette, and DialogFrame retains focus,
scroll, confirmation and draft protection behavior. Motion uses transform/opacity
and cubic-bezier(.22,1,.36,1); reduced motion removes entrance and image effects.

The owner's 3 November deletion UX correction puts a labelled Hapus action on
every real post card and alongside the selected post actions. Use the existing
coral danger tone, trash icon, and 44px targets at all widths. Card preview and
deletion are separate native buttons inside an article; selection keeps its
existing emerald treatment. InstagramDeleteDialog is the shared confirmation
owner for the card, preview and content manager. It identifies the post with a
thumbnail, caption, type/date and explicit consequence, focuses Batal, and keeps
failure/retry behavior identical across entry points. Examples have no delete
action. Runtime ownership remains instagram-workspace.css and shared Action,
DialogFrame and Sonner; no additional menu or analytics screen is required.

New Instagram materials contain one 1080×1350 design cover followed by 1–3 source
photographs from the same listing, including the original first photo. Publishing
requires 2–4 slides. The shared property-cover HTML template owns both production
artwork and local examples: navy brand header, one-to-three-photo collage, crimson
title ribbon, cream address/specification cards, gold-accented price ticket and
navy contact footer, matching the owner's supplied poster. Source certificate type
is optional; unknown specifications stay absent. Locally generated QR and caption
share the canonical public listing URL. Feed output is 1080×1350; WhatsApp is one
1080×1920 poster with protected top/bottom space and no detail slides.
It embeds local Plus Jakarta Sans and validated local
photo buffers. Examples include an explicit artwork disclaimer; absent facts are
omitted. Existing saved one-image material must be prepared again before dispatch.

Campaign example mode is an explicit, reversible local scenario entered through “Coba A, B, C”. Keep the emerald surfaces and neutral outlines; reuse CampaignStockCards, CampaignRhythm, the real MarketingPlanner and DialogFrame/InstagramCarousel. A persistent “Simulasi · data contoh” banner owns reset/exit and explains the frozen 00:00 WIB clock. Example prices, dates and photos never imply active listings. Both tabs share one mounted scenario; phone sections stack compactly while only the property strip scrolls horizontally.

Campaign stock uses one horizontal strip of large photo-led cards at every width. Within an opened stock view, all available properties render directly; never wrap them into rows, shrink them to thumbnail rails or paginate the example strip. Ended campaigns keep the entire historical example behind an explicit disclosure. Each card is at most 360px wide, capped below the strip width to reveal the next card on phones. A 16:10 source photo precedes a 14px address, 24px IDR price, actual discount facts and one 44px Detail link alongside the metadata on the right. Group discounts, land/auction facts and listing freshness in the left column; center the Detail action vertically beside them instead of reserving a separate button row. The Detail link uses the shared mint primary-action fill, dark ink, pill corners and neutral keyboard focus; it opens the canonical listing in a new tab. Do not show a Lihat foto button in these cards. Keep 6px outer padding, 16/10px outer/photo corners and compact 6px body gaps. The trial time sits on the photo. Native horizontal overflow, proximity snap, a thin neutral scrollbar, previous/next buttons and a live visible-range count share one owner in CampaignStockCards. Support touch/trackpad, scoped arrow keys, Home/End, reduced motion, viewport changes and visible keyboard focus; never autoplay or intercept vertical scrolling. Keep bold DM Sans, emerald/teal/amber/sky tokens and neutral borders/focus. The stock shell retains its 14px padding, compact toolbar, concise schedule overview and shared diagnostics/count footer. Use the existing listing proxy's indexed card view and supported 640px size; missing photos remain honest.


Campaign lifecycle follows the approved period in WIB, including when the workspace
stays open across midnight. An ended period takes precedence over draft/paused/running
labels and reads “Berakhir”. The main stock area becomes a compact end-state with
“Ubah periode campaign”; historical real-property examples are loaded only when
“Contoh tampilan dari properti arsip” is deliberately expanded. Example stock remains
one large horizontal strip and opens “Coba arsip di Planner”, never active publications.
An unapplied draft can differ from the approved period; identify that distinction.
Hide resume for ended campaigns and disable stale generation/application/slot edits.
CampaignRhythm treats the colon as formatting: four Backspaces clear four digits;
four new numeric keys produce HH:mm. Keep intermediate edits possible, while save
and Planner projection require valid, strictly increasing times. Use shared error
messages, neutral focus and existing emerald/amber/teal/sky accents.

Ended detail pages without proposals show one end-state, with no duplicate schedule
instructions or inactive generate action. Empty publication history uses one compact
heading and sentence; reserve result-list space only when actual history exists.

The campaign list has two compact sections: Campaign berjalan and Campaign usai.
The first contains active, scheduled, draft and paused records whose effective
period has not ended; their real status badges remain visible. Filter each section
before its independent 20-record pagination, with separate counts and URL pages.
Ended rows use a charcoal forest surface (#192421), muted metadata/time chips,
a dusty amber/rose Berakhir badge and secondary Edit/Buka controls. Keep text
legible and 44px actions, without whole-card opacity or green outlines. Reclassify
at WIB midnight using the approved period; preserve an open unsaved editor.


Planner distinguishes future unfilled campaign gaps (“Belum terisi”) from historical
skips. Empty past slots never ask the owner to select a property for elapsed time.
A compact pending-campaign notice names the actual draft, saved asset count and
opens its campaign, clarifying why regular projected slots have no assigned property.
The first summary reads Jadwal terisi and counts planned/ready jobs, so a saved
property assignment is visible even before material rendering. Policy explanations
reuse scoped footnotes and actual selection reasons, without additional control groups.


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

Each campaign has a consistent visual identity, independent of session status.
The read-only month response assigns `appearanceIndex` from all retained campaign
IDs ordered by creation time and ID. Changing month, channel, draft/state, API
order or adding a newer campaign cannot renumber an existing one. There is no
campaign deletion workflow. `planner-campaign-appearance.ts` maps that identity to
twelve spaced hues, a unique C-number and solid/striped/dotted code patterns for
palette reuse. CSS consumes its `--planner-campaign-*` variables in the cell,
each campaign ribbon, the horizontally scrolling month key and the agenda card.
Codes and names ensure that colour is never the only identifying information.
The month key lists every visible campaign with its code, name and actual range;
clicking it selects the first covered date in the visible month. It alone scrolls
horizontally and never widens the page. Empty sessions and channel filters never
erase period coverage. A single campaign tints the cell in its own hue; overlap
uses a neutral cell and up to three independently coloured ribbons, followed by
the actual remaining count. Each ribbon has its own start/end and draft treatment.
Phone ribbons retain their coloured C-number; full names/ranges/states remain in
the date's accessible label. Selecting the date exposes every overlapping campaign
and its Buka campaign action. Today and selection keep their established green
circle/outline. Campaign dates, session status colours and publication behaviour
remain owned by their existing domain services.
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

## Analitik pemasaran — 2026-11-02

Analitik is a product dashboard in the established dark emerald identity. Runtime
ownership is `components/marketing-analytics.css` scoped to
`.marketing-analytics-workspace`; portal tokens use `.analytics-select-popup`.
Base #071B16, surface #0D241E and raised #142F27 carry DM Sans inherited from the
dashboard. Text #EDF7F1 and muted #AFC4B9 stay readable. Mint #9CE2BB identifies
publication volume, sky #91CCEC views, rose #F1ABC0 likes, violet #C5B6EE comments,
amber #EED091 content highlights, and teal #81D6CA historical projections.
Colours identify metrics alongside explicit labels, never indicate invented growth.

Five-pixel outer trays and 25/20px concentric corners enclose the analytical
panels; phones use 4px trays with 22/18px corners. An asymmetric trend/highlight
row and audience/projection row break the KPI rhythm. Reuse Action, Input,
SearchSelect/Radix, existing Radix marketing icons and the company WhatsApp logo.
Controls have neutral visible focus and 44px targets. Keep product density and
16–23px panel padding, consistent with the masthead and Campaign. No landing-page
section padding, large-area blur, heavy shadows or new font download. Reveals use
only opacity/transform, 800ms cubic-bezier(.22,1,.36,1), and reduced-motion opt-out.
The dashboard owns vertical scrolling; long segment comparisons alone may scroll.
At narrow widths rows become legible content cards, with one-column analysis
panels and two-column KPIs. No horizontal page overflow. Empty states keep the
palette and useful instructions without fabricated charts or metrics.

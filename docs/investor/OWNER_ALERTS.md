# Email aset lelang ke owner

Authority: owner's request on 6 November 2026, with explicit confirmation that
only auctions scheduled today or later should be mailed. Reuse the client
property email's shared shell and `propertyCard` in `src/lib/mailer.ts`.

Eligibility comes from the same canonical auction-history collector used by
Investor, across the whole inventory before pagination. Require BELI / LELANG,
TERSEDIA, positive known prices, a known auction drop **strictly greater than
60%**, and an auction calendar date today or later in Asia/Jakarta. Exactly 60%,
unknown history, kelurahan discount alone, sold/withdrawn assets, rentals,
Primary/Secondary, undated or elapsed auctions do not qualify. The unrounded
metric controls eligibility. A qualifying value that rounds to 60% is displayed
as `> 60%` instead of misleadingly claiming exactly 60%.

Recipients are all current Agent records with OWNER, AKTIF membership and an
AKTIF AGENT account with a valid saved email address. No address is hardcoded.
Refresh the recipient's role/email and each source's availability, price and
auction date after photo preparation and immediately before sending.

`server.js` starts the dedicated scheduler every 15 minutes in WIB. Each owner
gets at most one email attempt per hour, containing up to six previously
unnotified assets, ordered by the canonical auction drop. A digest contains
source photos, initial/current prices, actual percentage, land area, auction
date and public detail links, plus an owner-only Investor destination. Source
images use the existing inline-photo pipeline and public proxy fallback.
Unsent eligible assets remain available for later batches; the first activation
also considers existing qualifying inventory.

## Delivery records

`investor_owner_alerts` is durable per `(owner_id, asset_key)`. The canonical
Investor asset identity survives a new historical source listing ID. Successful,
uncertain and exhausted deliveries never automatically re-alert that asset to
the same owner. The history records recipient, selected source, initial/current
price, drop, attempt ID, SMTP result and timestamps. It is private operational
data, with no public API or source certificate numbers.

A short per-owner advisory-lock transaction claims a batch. Photo downloads
and SMTP happen outside database transactions. Interrupted preparation is safe
to reclaim; an abandoned sending attempt becomes uncertain. Definite SMTP
rejections retry after the one-hour cooldown, up to five attempts. Ambiguous
SMTP acceptance and crashes after dispatch never blindly resend. Investigate
uncertain/exhausted records before any manual recovery. Nothing in a GET,
preview, page visit or dry run sends mail.

## Installation and verification

1. `npm run db:investor-alerts` installs only the additive delivery table/index.
   This has already been applied to this workspace's configured database.
2. Build the website and restart its existing production service so its custom
   server registers the new scheduler. Retain GMAIL_USER, GMAIL_APP_PASSWORD and
   CRON_SECRET in the production environment. No additional email credentials
   are required.
3. `POST /api/cron/investor-owner-alerts?dryRun=1`, with the existing cron bearer
   secret, validates real candidates without writes or SMTP. Missing/wrong
   secrets are rejected even in development. No secret query parameter or
   recipient override is supported.
4. The same authenticated POST without `dryRun=1` dispatches eligible batches.
   Responses/logs contain counts, never recipient addresses or source secrets.

Checks:

- `npm run test:investor-alerts`
- `node --test scripts/test-campaign-reminders.cjs` (shared SMTP regression)
- `node scripts/verify-investor-owner-alerts-db.cjs` (PostgreSQL TEMP table only)
- `node scripts/preview-investor-owner-email.cjs` (offline 320/390/800px preview;
  no send option; artifacts under `.runtime/investor-owner-alerts`)

Keep dry-run and preview outputs distinct from real delivery acknowledgements.
The schema migration or a successful build alone does not activate a scheduler
in an already-running production process.

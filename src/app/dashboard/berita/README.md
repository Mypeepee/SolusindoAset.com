# Ruang redaksi

The `/dashboard/berita` workspace uses the project's existing Next.js App Router,
React, Tailwind, Prisma, SWR, Radix Dialog and `react-easy-crop` dependencies.
No new runtime dependencies are required.

## Components

- `StatCard`: global counts and actual article-creation activity over seven days.
- `FilterBar`: keyboard tabs, 300 ms debounced search, category/author/date/review
  filters, and a locally persisted list/grid preference.
- `ArticleListItem` / `ArticleUI`: stable image frames, fallbacks, selection,
  badges, author credits and keyboard-accessible quick actions.
- `QuickPreviewDrawer`: authenticated article detail and sanitized Markdown.
- `EditorModal` / `BeritaEditor`: lazy-loaded workspace, dirty-form protection,
  Markdown block toolbar, SEO, media and publication settings. The existing
  `/new` and `/[id]` editor routes remain available.
- `MediaUploader`: local crop/zoom/aspect controls; the upload endpoint validates
  the actual image data, strips metadata and produces a bounded WebP file.
- `SeoPanel` / `PublishingTimer`: independent meta description, slug, OpenGraph
  preview, indicative keyword density and a publication countdown in WIB.
- `workspace.ts`: request errors, SWR caching, pagination and page-scoped selection.
- `workspace.module.css`: scoped visual tokens, responsive layouts and reduced motion.

## Access policy

The server checks the agent's current database position for every write. Session
claims only control visible UI. `OWNER` can publish, schedule, pin, archive and
permanently delete articles. `ADMIN` and the existing `PRINCIPAL` position can
create/edit drafts and submit them for review with an optional proposed schedule.
Editing a live article as Admin creates a separate draft; the live article stays
available. The Owner's team/role link opens the existing HRM administration page.

Bulk mutations accept up to 50 valid IDs and execute in one database transaction.
Selection is limited to the current page and resets when filters or pages change.
Draft/review articles are excluded from public detail reads and metadata.

## Database and deployment

Apply only this additive migration; do not reset the database or push unrelated
pending schema changes:

```sh
npx prisma db execute --file prisma/migration_berita_workspace.sql --schema prisma/schema.prisma
npx prisma generate
```

The migration adds `meta_description`, `review_requested_at`, and
`requested_publish_at`. It has already been applied to the local development
database during implementation. Restart the application after regenerating Prisma.
Apply the same migration independently to each deployment database.

`npm start` runs the existing `server.js`, which now calls
`/api/cron/berita-publish` once per minute when `CRON_SECRET` is configured.
The endpoint rejects requests without its bearer secret, is idempotent, and only
publishes approved `SCHEDULED` articles whose deadline has passed. For deployments
that do not run `server.js`, configure an external scheduler with that endpoint and
an `Authorization: Bearer <CRON_SECRET>` header. Public reads also include due
scheduled articles between ticks. The blog index's existing ISR cache is invalidated
by editorial mutations and the publication job.

## Verification

```sh
node scripts/test-berita-workspace.cjs
```

The focused policy/endpoint tests mock the database and cover RBAC, review requests,
scheduling, payload limits, partial updates, atomic batches, public filtering and
cron authorization. Browser interactions can be checked against a local dev server:

```sh
BERITA_QA_ORIGIN=http://127.0.0.1:3000 node scripts/preview-berita.mjs
```

The browser script uses isolated in-memory article/session fixtures, intercepts
all API calls, and never modifies live articles. It requires Chrome (or
`BERITA_QA_BROWSER`) and produces screenshots under `/private/tmp/berita-*.png`.
The full project TypeScript check currently reports unrelated existing errors;
no diagnostic points to the editorial module.

### Actual database and running-server checks

The UI fixture tests above do not verify the running application database. Use
the following check for the real local connection, loading `.env.local` and `.env`
with the same precedence as Next.js:

```sh
node scripts/check-berita-connection.mjs
node scripts/check-berita-connection.mjs --write-check --browser
```

This check compares the live authenticated list, detail, search and status counts
with PostgreSQL records. The optional write check creates, updates and deletes
only its own unpublished draft; the browser check uses the real application and
API responses. It keeps its short-lived local session in memory and does not
print credentials. It refuses remote database and application hosts.

If PostgreSQL reads succeed but local API routes return HTTP 500 after regenerating
Prisma, restart the development process. A running process retains its old Prisma
instance across hot reloads. A missing `.next/server/pages/_document.js` also
indicates a broken generated build cache: stop the server, move `.next` aside,
then restart `npm run dev`. Neither repair requires resetting or reseeding data.

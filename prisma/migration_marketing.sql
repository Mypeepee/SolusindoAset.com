-- Additive, repeatable installation. Does not touch listing, Investor or chatbot data.
BEGIN;
CREATE TABLE IF NOT EXISTS marketing_settings (
  id TEXT PRIMARY KEY DEFAULT 'company', enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 1,
  "leaseToken" TEXT, "leasedUntil" TIMESTAMPTZ, "lastTickAt" TIMESTAMPTZ, "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS marketing_connections (
  id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, username TEXT, "tokenCipher" TEXT,
  "expiresAt" TIMESTAMPTZ, "testedAt" TIMESTAMPTZ, "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS marketing_jobs (
  id TEXT PRIMARY KEY, "scheduledFor" TIMESTAMPTZ NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued', reason TEXT, "listingId" TEXT, "assetKey" TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}', caption TEXT NOT NULL DEFAULT '', media JSONB NOT NULL DEFAULT '[]',
  "settingsRevision" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_jobs_status_scheduled_idx ON marketing_jobs(status, "scheduledFor");
ALTER TABLE marketing_jobs ADD COLUMN IF NOT EXISTS plan JSONB NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS marketing_jobs_asset_scheduled_idx ON marketing_jobs("assetKey", "scheduledFor");
CREATE TABLE IF NOT EXISTS marketing_publications (
  id TEXT PRIMARY KEY, "jobId" TEXT NOT NULL REFERENCES marketing_jobs(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', "containerId" TEXT,
  "externalId" TEXT, permalink TEXT, "errorCode" TEXT, "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ, "publishedAt" TIMESTAMPTZ, "lastSyncedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("jobId",channel)
);
CREATE INDEX IF NOT EXISTS marketing_publications_state_published_idx ON marketing_publications(state,"publishedAt");
CREATE TABLE IF NOT EXISTS marketing_metrics (
  id TEXT PRIMARY KEY, "publicationId" TEXT NOT NULL REFERENCES marketing_publications(id) ON DELETE CASCADE,
  "values" JSONB NOT NULL DEFAULT '{}', reason TEXT, "fetchedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_metrics_publication_fetched_idx ON marketing_metrics("publicationId","fetchedAt" DESC);
INSERT INTO marketing_settings(id) VALUES ('company') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS marketing_instagram_webhook_state (
  "appId" TEXT PRIMARY KEY, "lastChallengeAt" TIMESTAMPTZ, "lastDeliveryAt" TIMESTAMPTZ,
  "receivedBatches" INTEGER NOT NULL DEFAULT 0, "ignoredEntries" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS marketing_instagram_webhook_events (
  id TEXT PRIMARY KEY, "appId" TEXT NOT NULL, "accountId" TEXT NOT NULL,
  field TEXT NOT NULL, "payloadCipher" TEXT NOT NULL, "providerTime" TIMESTAMPTZ,
  deliveries INTEGER NOT NULL DEFAULT 1, "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastReceivedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "expiresAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS marketing_instagram_webhook_events_app_received_idx
  ON marketing_instagram_webhook_events("appId", "receivedAt" DESC);
CREATE INDEX IF NOT EXISTS marketing_instagram_webhook_events_expiry_idx
  ON marketing_instagram_webhook_events("expiresAt");
-- Idempotency and audit metadata; never store comment/reply text or credentials.
CREATE TABLE IF NOT EXISTS marketing_instagram_actions (
  id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "ownerId" TEXT NOT NULL,
  action TEXT NOT NULL, "targetId" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'succeeded', 'failed', 'uncertain')),
  result JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_instagram_actions_pending_target_idx
  ON marketing_instagram_actions("accountId", "targetId") WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS marketing_instagram_actions_created_idx ON marketing_instagram_actions("createdAt" DESC);
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'draft', brief JSONB NOT NULL,
  evaluation JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS marketing_campaign_proposals (
  id TEXT PRIMARY KEY, "campaignId" TEXT NOT NULL REFERENCES marketing_campaigns(id),
  version INTEGER NOT NULL, data JSONB NOT NULL, "approvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE ("campaignId", version)
);
ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS "activeBrief" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE marketing_jobs ADD COLUMN IF NOT EXISTS "campaignId" TEXT REFERENCES marketing_campaigns(id);
ALTER TABLE marketing_jobs ADD COLUMN IF NOT EXISTS "campaignProposalId" TEXT REFERENCES marketing_campaign_proposals(id);
CREATE INDEX IF NOT EXISTS marketing_jobs_campaign_scheduled_idx ON marketing_jobs("campaignId", "scheduledFor");
CREATE TABLE IF NOT EXISTS marketing_campaign_reminders (
  id TEXT PRIMARY KEY,
  "campaignId" TEXT NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  "endDate" TEXT NOT NULL, recipient TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ, "messageId" TEXT, "errorCode" TEXT, "sentAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("campaignId", "endDate", recipient)
);
COMMIT;

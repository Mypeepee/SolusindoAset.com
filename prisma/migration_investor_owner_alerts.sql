BEGIN;

CREATE TABLE IF NOT EXISTS investor_owner_alerts (
  id text PRIMARY KEY,
  owner_id varchar(20) NOT NULL REFERENCES agent(id_agent) ON DELETE CASCADE,
  asset_key text NOT NULL,
  listing_id bigint NOT NULL,
  recipient text NOT NULL,
  initial_price numeric(24,2) NOT NULL,
  current_price numeric(24,2) NOT NULL,
  drop_pct numeric(12,8) NOT NULL,
  state text NOT NULL DEFAULT 'retry',
  attempts integer NOT NULL DEFAULT 0,
  delivery_id text,
  claimed_at timestamptz,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  message_id text,
  error_code text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investor_owner_alerts_state CHECK (state IN ('preparing','sending','sent','retry','uncertain','failed')),
  CONSTRAINT investor_owner_alerts_owner_id_asset_key_key UNIQUE(owner_id, asset_key)
);
CREATE INDEX IF NOT EXISTS investor_owner_alerts_owner_id_state_idx
  ON investor_owner_alerts(owner_id, state);

COMMIT;

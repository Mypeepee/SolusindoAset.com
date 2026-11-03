-- Additive; rerunnable. Editorial portfolio, separate from financial project_selesai.
CREATE TABLE IF NOT EXISTS company_profile_story (
  id uuid PRIMARY KEY,
  images text[] NOT NULL CHECK (cardinality(images) BETWEEN 1 AND 6),
  type varchar(60) NOT NULL,
  title varchar(120) NOT NULL,
  location varchar(120) NOT NULL,
  description text NOT NULL,
  market_price numeric(20,0) NOT NULL CHECK (market_price > 0),
  deal_price numeric(20,0) NOT NULL CHECK (deal_price > 0),
  tiktok_url varchar(500),
  created_by varchar(20) NOT NULL REFERENCES agent(id_agent),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_profile_story_created ON company_profile_story(created_at DESC);

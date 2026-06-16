CREATE TABLE IF NOT EXISTS "tugas_meta" (
  "id_agent"   VARCHAR(20)  NOT NULL,
  "task_key"   VARCHAR(120) NOT NULL,
  "meta"       JSONB        NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "tugas_meta_pkey" PRIMARY KEY ("id_agent","task_key")
);
CREATE INDEX IF NOT EXISTS "tugas_meta_id_agent_idx" ON "tugas_meta"("id_agent");

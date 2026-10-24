export const postgresSchema=`
CREATE TABLE IF NOT EXISTS captra_runs (
  id uuid PRIMARY KEY,
  app text NOT NULL,
  app_version text NOT NULL,
  capability text NOT NULL,
  status text NOT NULL,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  project_id text NOT NULL,
  session_id text,
  input jsonb NOT NULL,
  validated_input jsonb,
  output jsonb,
  approval text,
  error text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS captra_runs_idempotency
  ON captra_runs (tenant_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS captra_runs_identity ON captra_runs (tenant_id,user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS captra_events (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES captra_runs(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  protocol text NOT NULL,
  type text NOT NULL,
  capability text NOT NULL,
  detail text NOT NULL,
  data jsonb,
  at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id,sequence)
);

CREATE TABLE IF NOT EXISTS captra_memories (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  scope text NOT NULL,
  owner_id text NOT NULL,
  type text NOT NULL,
  content text NOT NULL,
  confidence double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS captra_memories_recall ON captra_memories (tenant_id,scope,owner_id,created_at DESC);
ALTER TABLE captra_memories ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS captra_memories_text ON captra_memories USING gin (to_tsvector('simple',content));

CREATE TABLE IF NOT EXISTS captra_jobs (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL UNIQUE REFERENCES captra_runs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  available_at timestamptz NOT NULL DEFAULT now(),
  leased_by text,
  lease_until timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS captra_jobs_claim ON captra_jobs (status,available_at) WHERE status IN ('queued','leased');
`

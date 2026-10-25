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
  approval_identity jsonb,
  error text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS captra_runs_idempotency
  ON captra_runs (tenant_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS captra_runs_identity ON captra_runs (tenant_id,user_id,created_at DESC);
ALTER TABLE captra_runs ADD COLUMN IF NOT EXISTS approval_identity jsonb;

CREATE TABLE IF NOT EXISTS captra_conversations (
  tenant_id text NOT NULL,
  id text NOT NULL,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id)
);
CREATE INDEX IF NOT EXISTS captra_conversations_owner
  ON captra_conversations (tenant_id,user_id,updated_at DESC,id);

CREATE TABLE IF NOT EXISTS captra_conversation_messages (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id text NOT NULL,
  conversation_id text NOT NULL,
  id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,conversation_id,id),
  FOREIGN KEY (tenant_id,conversation_id)
    REFERENCES captra_conversations(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS captra_conversation_messages_page
  ON captra_conversation_messages (tenant_id,conversation_id,sequence DESC);

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

CREATE TABLE IF NOT EXISTS captra_checkpoints (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES captra_runs(id) ON DELETE CASCADE,
  key text NOT NULL,
  sequence integer NOT NULL,
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id,sequence)
);
CREATE INDEX IF NOT EXISTS captra_checkpoints_lookup ON captra_checkpoints (run_id,key,sequence DESC);

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

CREATE TABLE IF NOT EXISTS captra_effects (
  tenant_id text NOT NULL,
  tool text NOT NULL,
  key text NOT NULL,
  status text NOT NULL,
  output jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,tool,key)
);

CREATE TABLE IF NOT EXISTS captra_shared_state (
  tenant_id text NOT NULL,
  key_hash text NOT NULL,
  key jsonb NOT NULL,
  value jsonb,
  has_value boolean NOT NULL DEFAULT false,
  version bigint NOT NULL DEFAULT 0,
  fence bigint NOT NULL DEFAULT 0,
  lease_owner text,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,key_hash)
);

CREATE TABLE IF NOT EXISTS captra_state_events (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  key_hash text NOT NULL,
  key jsonb NOT NULL,
  type text NOT NULL,
  actor text NOT NULL,
  version bigint NOT NULL,
  token bigint,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS captra_state_events_history ON captra_state_events (tenant_id,key_hash,at,id);

CREATE TABLE IF NOT EXISTS captra_usage (
  id text PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES captra_runs(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  project_id text NOT NULL,
  capability text NOT NULL,
  provider text NOT NULL,
  model text,
  attempt integer NOT NULL,
  status text NOT NULL,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  cached_input_tokens bigint NOT NULL DEFAULT 0,
  reasoning_tokens bigint NOT NULL DEFAULT 0,
  cost_usd double precision NOT NULL DEFAULT 0,
  duration_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS captra_usage_tenant_time ON captra_usage (tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS captra_usage_user_time ON captra_usage (tenant_id,user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS captra_usage_run ON captra_usage (run_id,created_at);

CREATE TABLE IF NOT EXISTS captra_evaluation_reports (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text,
  suite text,
  variant text,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS captra_evaluations_history ON captra_evaluation_reports (tenant_id,project_id,suite,created_at DESC);
`

export function postgresVectorSchema(dimensions:number){if(!Number.isInteger(dimensions)||dimensions<1||dimensions>16_000)throw new Error('Vector dimensions must be an integer between 1 and 16000');return `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS captra_memory_vectors (
  memory_id uuid PRIMARY KEY REFERENCES captra_memories(id) ON DELETE CASCADE,
  embedding vector(${dimensions}) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS captra_memory_vectors_hnsw
  ON captra_memory_vectors USING hnsw (embedding vector_cosine_ops);
`}

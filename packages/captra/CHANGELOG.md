# captra

## 0.5.0

### Minor Changes

- Add the first Captra 0.5 developer-preview slice: authenticated request rate limiting, the `captra/devtools` run inspector, and a generated Hello AI World agent with demo and OpenAI modes.

### Patch Changes

- Updated dependencies
  - @captra-ai/devtools@0.5.0
  - @captra-ai/server@0.5.0

## 0.4.2

### Patch Changes

- Reject cross-key lease substitution, malformed actors and owners, invalid versions and fencing tokens, non-finite expirations, and leases longer than five minutes across the in-memory and PostgreSQL shared-state adapters.
- Updated dependencies
  - @captra-ai/state@0.4.1
  - @captra-ai/postgres@0.4.2

## 0.4.1

### Patch Changes

- Require version zero and no lease when inserting previously missing shared state, preventing stale expected versions or unvalidated lease commits from creating state. Add real PostgreSQL concurrency, tenant-isolation, lease-takeover, fencing, and audit-history coverage.
- Updated dependencies
  - @captra-ai/postgres@0.4.1

## 0.4.0

### Minor Changes

- Add shared multi-agent state with optimistic versioned commits, automatic conflict replanning, expiring leases, fencing tokens, validation, audit history, capability lock declarations, and a tenant-scoped PostgreSQL adapter.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.4.0
  - @captra-ai/state@0.4.0
  - @captra-ai/postgres@0.4.0
  - @captra-ai/server@0.4.0

## 0.3.0

### Minor Changes

- Add Captra State, a typed reactive state graph with subscriptions, request deduplication, prefix invalidation, optimistic updates, rollback, persistence, and hydration. Capabilities can now declare state reads, writes, and invalidations; local and remote React hooks apply those effects after successful execution.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.3.0
  - @captra-ai/state@0.3.0
  - @captra-ai/server@0.3.0
  - @captra-ai/react@0.3.0
  - @captra-ai/client@0.3.0
  - @captra-ai/openai@0.3.0
  - @captra-ai/postgres@0.3.0

## 0.2.0

### Minor Changes

- 09ce055: Prepare the first compiled Captra framework release with an approved brand system and startup animation, a tested full-stack starter, framework-aware CLI generators and diagnostics, accessible headless UI primitives, typed remote React lifecycle and streaming, composable governance hooks, a versioned third-party plugin contract, agent capabilities, durable execution, adaptive memory, provider integrations, real PostgreSQL and pgvector integration coverage, end-to-end typed HTTP contracts, official Next.js, Hono, Express, and Node backend mounts, transport-safe results, observability, and evaluations.

### Patch Changes

- Updated dependencies [09ce055]
  - @captra-ai/core@0.2.0
  - @captra-ai/client@0.2.0
  - @captra-ai/server@0.2.0
  - @captra-ai/react@0.2.0
  - @captra-ai/postgres@0.2.0
  - @captra-ai/openai@0.2.0

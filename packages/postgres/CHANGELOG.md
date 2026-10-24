# @captra-ai/postgres

## 0.4.1

### Patch Changes

- Require version zero and no lease when inserting previously missing shared state, preventing stale expected versions or unvalidated lease commits from creating state. Add real PostgreSQL concurrency, tenant-isolation, lease-takeover, fencing, and audit-history coverage.

## 0.4.0

### Minor Changes

- Add shared multi-agent state with optimistic versioned commits, automatic conflict replanning, expiring leases, fencing tokens, validation, audit history, capability lock declarations, and a tenant-scoped PostgreSQL adapter.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.4.0
  - @captra-ai/state@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.3.0

## 0.2.0

### Minor Changes

- 09ce055: Prepare the first compiled Captra framework release with an approved brand system and startup animation, a tested full-stack starter, framework-aware CLI generators and diagnostics, accessible headless UI primitives, typed remote React lifecycle and streaming, composable governance hooks, a versioned third-party plugin contract, agent capabilities, durable execution, adaptive memory, provider integrations, real PostgreSQL and pgvector integration coverage, end-to-end typed HTTP contracts, official Next.js, Hono, Express, and Node backend mounts, transport-safe results, observability, and evaluations.

### Patch Changes

- Updated dependencies [09ce055]
  - @captra-ai/core@0.2.0

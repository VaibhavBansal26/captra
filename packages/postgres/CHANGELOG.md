# @captra-ai/postgres

## 0.11.0

### Minor Changes

- 8572913: Add complete conversation lifecycle metadata and collaboration: titles, labels, listing, rename, archive/restore/delete, owner/editor/viewer roles, sharing, ownership transfer, typed client methods, a React lifecycle hook, and a Devtools conversation view.

## 0.10.0

### Minor Changes

- 3a487b8: Add an explicit run-completion transaction contract and a PostgreSQL implementation that atomically commits durable assistant messages, usage, completion events, and terminal run state. Durable chat now stages deterministic message and usage records for replay-safe completion.

## 0.9.0

### Minor Changes

- 94e59be: Add tenant-safe conversation lifecycle operations, HTTP and client methods, and bounded PostgreSQL retention cleanup.

## 0.8.0

### Minor Changes

- fb793b6: Add a tenant-safe PostgreSQL conversation store with deduplicated appends and cursor-paginated history.

## 0.7.0

### Minor Changes

- Add repeated evaluation runs, tenant-scoped in-memory and PostgreSQL report history, and an evaluation history dashboard for Devtools.

## 0.6.0

### Minor Changes

- Add durable model-attempt usage accounting, tenant-safe reporting APIs, PostgreSQL aggregation, typed client queries, and Devtools cost views.

## 0.5.1

### Patch Changes

- Add package-specific npm READMEs with installation, usage, security notes, documentation links, and repository links. Package and public-release checks now fail when README content is missing.

## 0.5.0

### Minor Changes

- Harden execution with independent approver identities, requester self-approval denial, per-run cancellation, compare-and-set terminal transitions, and durable effect receipts for side-effect-safe retries.

  Write tools can now declare `effect: 'write'` with a stable `idempotencyKey`. Completed effects are reused and ambiguous effects stop with `EffectInDoubtError` instead of being replayed.

## 0.4.2

### Patch Changes

- Reject cross-key lease substitution, malformed actors and owners, invalid versions and fencing tokens, non-finite expirations, and leases longer than five minutes across the in-memory and PostgreSQL shared-state adapters.

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

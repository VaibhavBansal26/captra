# @captra-ai/react

## 0.9.0

### Minor Changes

- 6dbb054: Add token-aware durable conversation compaction with separately stored summaries, complete source/model/prompt provenance, bounded context retrieval, authenticated APIs, React access, and Devtools inspection while preserving original messages for audit.

## 0.8.0

### Minor Changes

- 8572913: Add complete conversation lifecycle metadata and collaboration: titles, labels, listing, rename, archive/restore/delete, owner/editor/viewer roles, sharing, ownership transfer, typed client methods, a React lifecycle hook, and a Devtools conversation view.

## 0.7.0

### Minor Changes

- 0f0475d: Add tenant-safe durable conversation storage, server-side chat history, authenticated cursor pagination, and React history loading.

## 0.6.0

### Minor Changes

- 2aa8cbd: Add an accessible customizable `CaptraChat` component and stream approval continuations through the runtime, server, client, and React hook.

## 0.5.0

### Minor Changes

- 59451c5: Add governed streaming chat as a first-class capability, typed model stream events, cancellable client streams, OpenAI usage-aware completion events, and a React `useChat` hook with approvals, cancellation, reconnect, usage, and budget state.

## 0.4.1

### Patch Changes

- Add package-specific npm READMEs with installation, usage, security notes, documentation links, and repository links. Package and public-release checks now fail when README content is missing.

## 0.4.0

### Minor Changes

- Harden execution with independent approver identities, requester self-approval denial, per-run cancellation, compare-and-set terminal transitions, and durable effect receipts for side-effect-safe retries.

  Write tools can now declare `effect: 'write'` with a stable `idempotencyKey`. Completed effects are reused and ambiguous effects stop with `EffectInDoubtError` instead of being replayed.

## 0.3.0

### Minor Changes

- Add Captra State, a typed reactive state graph with subscriptions, request deduplication, prefix invalidation, optimistic updates, rollback, persistence, and hydration. Capabilities can now declare state reads, writes, and invalidations; local and remote React hooks apply those effects after successful execution.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.3.0
  - @captra-ai/state@0.3.0
  - @captra-ai/client@0.3.0

## 0.2.0

### Minor Changes

- 09ce055: Prepare the first compiled Captra framework release with an approved brand system and startup animation, a tested full-stack starter, framework-aware CLI generators and diagnostics, accessible headless UI primitives, typed remote React lifecycle and streaming, composable governance hooks, a versioned third-party plugin contract, agent capabilities, durable execution, adaptive memory, provider integrations, real PostgreSQL and pgvector integration coverage, end-to-end typed HTTP contracts, official Next.js, Hono, Express, and Node backend mounts, transport-safe results, observability, and evaluations.

### Patch Changes

- Updated dependencies [09ce055]
  - @captra-ai/core@0.2.0
  - @captra-ai/client@0.2.0

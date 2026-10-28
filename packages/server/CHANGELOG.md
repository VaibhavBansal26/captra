# @captra-ai/server

## 0.12.0

### Minor Changes

- 8572913: Add complete conversation lifecycle metadata and collaboration: titles, labels, listing, rename, archive/restore/delete, owner/editor/viewer roles, sharing, ownership transfer, typed client methods, a React lifecycle hook, and a Devtools conversation view.

## 0.11.0

### Minor Changes

- 94e59be: Add tenant-safe conversation lifecycle operations, HTTP and client methods, and bounded PostgreSQL retention cleanup.

## 0.10.0

### Minor Changes

- 0f0475d: Add tenant-safe durable conversation storage, server-side chat history, authenticated cursor pagination, and React history loading.

## 0.9.0

### Minor Changes

- 2aa8cbd: Add an accessible customizable `CaptraChat` component and stream approval continuations through the runtime, server, client, and React hook.

## 0.8.0

### Minor Changes

- Add durable model-attempt usage accounting, tenant-safe reporting APIs, PostgreSQL aggregation, typed client queries, and Devtools cost views.

## 0.7.0

### Minor Changes

- Add secure runtime boundaries for agent context, outbound HTTP tools, and public server errors.

  Recalled memory is now carried as explicitly delimited untrusted context instead of being concatenated into trusted system instructions. JSON HTTP access is opt-in through `createFetchJsonTool`, which requires exact allowed origins and enforces header, redirect, and response-size policy. The legacy unconfigured HTTP export now fails closed and network access is no longer included in `builtinTools`.

  Server responses, run records, replay data, trace events, and SSE failures now expose stable sanitized errors and request IDs. Trusted applications can observe original exceptions through the new `onError` callback.

## 0.6.2

### Patch Changes

- Add a provider-neutral structured-output contract with native JSON Schema support, Markdown-fence normalization, Zod validation, one bounded repair attempt, typed `StructuredOutputError` failures, and repair trace events.

  Agents, standalone structured generation, model planning, and memory extraction now share this boundary. The OpenAI adapter maps it to strict Responses API JSON Schema output and supports opt-in strict function schemas.

## 0.6.1

### Patch Changes

- Add package-specific npm READMEs with installation, usage, security notes, documentation links, and repository links. Package and public-release checks now fail when README content is missing.

## 0.6.0

### Minor Changes

- Harden execution with independent approver identities, requester self-approval denial, per-run cancellation, compare-and-set terminal transitions, and durable effect receipts for side-effect-safe retries.

  Write tools can now declare `effect: 'write'` with a stable `idempotencyKey`. Completed effects are reused and ambiguous effects stop with `EffectInDoubtError` instead of being replayed.

## 0.5.0

### Minor Changes

- Add the first Captra 0.5 developer-preview slice: authenticated request rate limiting, the `captra/devtools` run inspector, and a generated Hello AI World agent with demo and OpenAI modes.

## 0.4.0

### Minor Changes

- Add shared multi-agent state with optimistic versioned commits, automatic conflict replanning, expiring leases, fencing tokens, validation, audit history, capability lock declarations, and a tenant-scoped PostgreSQL adapter.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.4.0

## 0.3.0

### Minor Changes

- Add Captra State, a typed reactive state graph with subscriptions, request deduplication, prefix invalidation, optimistic updates, rollback, persistence, and hydration. Capabilities can now declare state reads, writes, and invalidations; local and remote React hooks apply those effects after successful execution.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.3.0

## 0.2.0

### Minor Changes

- 09ce055: Prepare the first compiled Captra framework release with an approved brand system and startup animation, a tested full-stack starter, framework-aware CLI generators and diagnostics, accessible headless UI primitives, typed remote React lifecycle and streaming, composable governance hooks, a versioned third-party plugin contract, agent capabilities, durable execution, adaptive memory, provider integrations, real PostgreSQL and pgvector integration coverage, end-to-end typed HTTP contracts, official Next.js, Hono, Express, and Node backend mounts, transport-safe results, observability, and evaluations.

### Patch Changes

- Updated dependencies [09ce055]
  - @captra-ai/core@0.2.0

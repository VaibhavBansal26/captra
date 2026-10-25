# captra

## 0.17.0

### Minor Changes

- 2aa8cbd: Add an accessible customizable `CaptraChat` component and stream approval continuations through the runtime, server, client, and React hook.

### Patch Changes

- Updated dependencies [2aa8cbd]
  - @captra-ai/core@0.15.0
  - @captra-ai/client@0.6.0
  - @captra-ai/server@0.9.0
  - @captra-ai/react@0.6.0
  - @captra-ai/mcp@0.1.2

## 0.16.0

### Minor Changes

- 59451c5: Add governed streaming chat as a first-class capability, typed model stream events, cancellable client streams, OpenAI usage-aware completion events, and a React `useChat` hook with approvals, cancellation, reconnect, usage, and budget state.

### Patch Changes

- Updated dependencies [59451c5]
  - @captra-ai/core@0.14.0
  - @captra-ai/client@0.5.0
  - @captra-ai/react@0.5.0
  - @captra-ai/openai@0.6.0
  - @captra-ai/mcp@0.1.1

## 0.15.0

### Minor Changes

- Add bidirectional MCP support: governed remote-tool imports, Streamable HTTP clients, capability-contract servers, authenticated identity mapping, durable approval/status/cancellation lifecycle tools, and MCP manifest resources. Capability budgets are now retained in compiled application contracts.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.13.0
  - @captra-ai/mcp@0.1.0

## 0.14.0

### Minor Changes

- Complete the evaluation workflow with portable JSON and JSONL datasets, schema-constrained model judge scorers, repeated-run confidence intervals, a TypeScript-aware `captra eval` command, and GitHub Actions annotations.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.12.0

## 0.13.0

### Minor Changes

- Add repeated evaluation runs, tenant-scoped in-memory and PostgreSQL report history, and an evaluation history dashboard for Devtools.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.11.0
  - @captra-ai/postgres@0.7.0

## 0.12.0

### Minor Changes

- Add named evaluation suites, quality scorers, cost/token/latency gates, variant comparison, and Markdown, JSON, and JUnit reports.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.10.0

## 0.11.0

### Minor Changes

- Add durable model-attempt usage accounting, tenant-safe reporting APIs, PostgreSQL aggregation, typed client queries, and Devtools cost views.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.9.0
  - @captra-ai/server@0.8.0
  - @captra-ai/client@0.4.0
  - @captra-ai/postgres@0.6.0

## 0.10.0

### Minor Changes

- Add production-oriented model provider fallback with named providers, bounded retries, per-provider timeout cancellation, total deadlines, circuit breaking, sticky continuation state, portable provider errors, attempt traces, and aggregate token/cost usage across billed attempts.

  The OpenAI adapter now classifies HTTP failures with status, retryability, stable codes, and reported usage for deterministic fallback policy.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.8.0
  - @captra-ai/openai@0.5.0

## 0.9.0

### Minor Changes

- Add secure runtime boundaries for agent context, outbound HTTP tools, and public server errors.

  Recalled memory is now carried as explicitly delimited untrusted context instead of being concatenated into trusted system instructions. JSON HTTP access is opt-in through `createFetchJsonTool`, which requires exact allowed origins and enforces header, redirect, and response-size policy. The legacy unconfigured HTTP export now fails closed and network access is no longer included in `builtinTools`.

  Server responses, run records, replay data, trace events, and SSE failures now expose stable sanitized errors and request IDs. Trusted applications can observe original exceptions through the new `onError` callback.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.7.0
  - @captra-ai/server@0.7.0

## 0.8.0

### Minor Changes

- Add a provider-neutral structured-output contract with native JSON Schema support, Markdown-fence normalization, Zod validation, one bounded repair attempt, typed `StructuredOutputError` failures, and repair trace events.

  Agents, standalone structured generation, model planning, and memory extraction now share this boundary. The OpenAI adapter maps it to strict Responses API JSON Schema output and supports opt-in strict function schemas.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.6.0
  - @captra-ai/openai@0.4.0
  - @captra-ai/server@0.6.2

## 0.7.1

### Patch Changes

- Add package-specific npm READMEs with installation, usage, security notes, documentation links, and repository links. Package and public-release checks now fail when README content is missing.
- Updated dependencies
  - @captra-ai/core@0.5.1
  - @captra-ai/client@0.3.1
  - @captra-ai/server@0.6.1
  - @captra-ai/react@0.4.1
  - @captra-ai/state@0.4.2
  - @captra-ai/postgres@0.5.1
  - @captra-ai/openai@0.3.2

## 0.7.0

### Minor Changes

- Harden execution with independent approver identities, requester self-approval denial, per-run cancellation, compare-and-set terminal transitions, and durable effect receipts for side-effect-safe retries.

  Write tools can now declare `effect: 'write'` with a stable `idempotencyKey`. Completed effects are reused and ambiguous effects stop with `EffectInDoubtError` instead of being replayed.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.5.0
  - @captra-ai/server@0.6.0
  - @captra-ai/react@0.4.0
  - @captra-ai/postgres@0.5.0

## 0.6.0

### Minor Changes

- Add pre-inference token and cost reservations, atomic user and tenant quotas, provider output ceilings, typed budget failures, lifecycle events, and Devtools budget reporting.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.4.1
  - @captra-ai/openai@0.3.1

## 0.5.1

### Patch Changes

- Bundle the Devtools entry point directly in `captra` so first-time installs do not depend on separate scoped-package visibility.

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

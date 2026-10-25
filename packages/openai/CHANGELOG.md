# @captra-ai/openai

## 0.6.0

### Minor Changes

- 59451c5: Add governed streaming chat as a first-class capability, typed model stream events, cancellable client streams, OpenAI usage-aware completion events, and a React `useChat` hook with approvals, cancellation, reconnect, usage, and budget state.

## 0.5.0

### Minor Changes

- Add production-oriented model provider fallback with named providers, bounded retries, per-provider timeout cancellation, total deadlines, circuit breaking, sticky continuation state, portable provider errors, attempt traces, and aggregate token/cost usage across billed attempts.

  The OpenAI adapter now classifies HTTP failures with status, retryability, stable codes, and reported usage for deterministic fallback policy.

## 0.4.0

### Minor Changes

- Add a provider-neutral structured-output contract with native JSON Schema support, Markdown-fence normalization, Zod validation, one bounded repair attempt, typed `StructuredOutputError` failures, and repair trace events.

  Agents, standalone structured generation, model planning, and memory extraction now share this boundary. The OpenAI adapter maps it to strict Responses API JSON Schema output and supports opt-in strict function schemas.

## 0.3.2

### Patch Changes

- Add package-specific npm READMEs with installation, usage, security notes, documentation links, and repository links. Package and public-release checks now fail when README content is missing.

## 0.3.1

### Patch Changes

- Add pre-inference token and cost reservations, atomic user and tenant quotas, provider output ceilings, typed budget failures, lifecycle events, and Devtools budget reporting.

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

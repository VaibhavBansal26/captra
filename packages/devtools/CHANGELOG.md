# @captra-ai/devtools

## 0.9.0

### Minor Changes

- 6dbb054: Add token-aware durable conversation compaction with separately stored summaries, complete source/model/prompt provenance, bounded context retrieval, authenticated APIs, React access, and Devtools inspection while preserving original messages for audit.

## 0.8.1

### Patch Changes

- 60b384e: Publish Devtools as a standalone package and make `captra/devtools` re-export that canonical implementation so conversation and future inspection views cannot drift between entry points.

## 0.8.0

### Minor Changes

- 8572913: Add complete conversation lifecycle metadata and collaboration: titles, labels, listing, rename, archive/restore/delete, owner/editor/viewer roles, sharing, ownership transfer, typed client methods, a React lifecycle hook, and a Devtools conversation view.

## 0.7.0

### Minor Changes

- Add repeated evaluation runs, tenant-scoped in-memory and PostgreSQL report history, and an evaluation history dashboard for Devtools.

## 0.6.0

### Minor Changes

- Add durable model-attempt usage accounting, tenant-safe reporting APIs, PostgreSQL aggregation, typed client queries, and Devtools cost views.

## 0.5.0

### Minor Changes

- Add the first Captra 0.5 developer-preview slice: authenticated request rate limiting, the `captra/devtools` run inspector, and a generated Hello AI World agent with demo and OpenAI modes.

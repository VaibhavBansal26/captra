# Captra remaining work

This checklist tracks the work between the current developer preview and a credible 1.0 release. Items are ordered by dependency and user impact.

## P0 — Production chat and durability

- [x] Add `PostgresConversationStore`.
  - [x] Design tenant-, user-, and conversation-scoped tables and migrations.
  - [x] Add ordered message indexes and opaque cursor pagination.
  - [x] Implement append, list, archive, delete, and retention operations.
  - [x] Test tenant isolation, ownership checks, deduplication, and concurrent appends against real PostgreSQL.
  - [x] Document migration, backup, retention, and adapter configuration.
- [x] Make chat persistence atomic with run completion.
  - [x] Define the transaction boundary between messages, events, usage, and terminal run state.
  - [x] Prevent `completed` when the assistant message cannot be persisted.
  - [x] Make completion replay-safe with message and effect idempotency keys.
  - [x] Add crash-before-write and crash-after-write recovery tests.
- [x] Add conversation lifecycle metadata.
  - [x] Add title, created/updated timestamps, status, owner, and optional labels.
  - [x] Add list, rename, archive, restore, and delete APIs.
  - [x] Define ownership transfer and shared-conversation authorization policies.
  - [x] Add client methods, React hooks, and Devtools views.
- [ ] Add history compaction and summarization.
  - [ ] Define token-aware selection and compaction thresholds.
  - [ ] Store summaries separately from original messages.
  - [ ] Record source message IDs, model, prompt version, and timestamp as provenance.
  - [ ] Test that retrieval remains bounded and original history remains auditable.
- [ ] Complete recovery and race-condition coverage.
  - [ ] Test cancellation during model, tool, approval, and persistence phases.
  - [ ] Test worker retries, reconnects, duplicate queue delivery, and concurrent approvals.
  - [ ] Verify compare-and-set terminal transitions under contention.
  - [ ] Add deterministic fault injection to CI.
- [ ] Add production load suites.
  - [ ] Define latency, throughput, error-rate, and recovery targets.
  - [ ] Cover concurrent runs, SSE clients, queues, workers, PostgreSQL, and vector search.
  - [ ] Measure database pool pressure, memory growth, event backlog, and reconnect storms.
  - [ ] Publish reproducible scripts and baseline results.

## P1 — Model and chat experience

- [ ] Ship official Anthropic and Gemini provider packages.
  - [ ] Implement model invocation, streaming, tools, structured output, usage, and abort handling.
  - [ ] Normalize provider errors into Captra error classes.
  - [ ] Add environment setup, examples, package READMEs, and release verification.
  - [ ] Add both providers to the fallback-chain documentation and starter options.
- [ ] Complete a cross-provider conformance suite.
  - [ ] Define fixtures for text, tools, schemas, streaming, cancellation, usage, and failures.
  - [ ] Run the same contract against OpenAI, Anthropic, Gemini, and test doubles.
  - [ ] Separate deterministic offline tests from credentialed integration tests.
  - [ ] Publish the compatibility matrix.
- [ ] Add partial structured-object streaming.
  - [ ] Define patch/snapshot events in the versioned event schema.
  - [ ] Validate every emitted snapshot without exposing malformed partial JSON.
  - [ ] Add client accumulation and React rendering support.
  - [ ] Test interruption, repair, and final-object reconciliation.
- [ ] Add provider-aware prompt caching.
  - [ ] Add cache policy hints to model requests.
  - [ ] Map provider-specific cache controls behind the shared interface.
  - [ ] Record cache reads/writes, token savings, and cost in usage events.
  - [ ] Document privacy and invalidation behavior.
- [ ] Add advanced conversation operations.
  - [ ] Support branching from any message and preserve parent lineage.
  - [ ] Add regenerate, edit-and-resubmit, and branch-selection client APIs.
  - [ ] Add optimistic UI with rollback on rejection or cancellation.
  - [ ] Test budget, approval, memory, and audit behavior on branches.
- [ ] Add attachments and multimodal messages.
  - [ ] Define typed image, audio, document, and generic-file message parts.
  - [ ] Add pluggable upload, metadata, signed-access, and retention adapters.
  - [ ] Enforce MIME, size, malware-scan, tenant, and tool-access policies.
  - [ ] Add provider conversion, UI components, and accessibility coverage.

## P1 — Security and governance

- [ ] Commission an independent security review.
  - [ ] Document assets, trust boundaries, attacker models, and abuse cases.
  - [ ] Review identity, approvals, tools, memory, queues, providers, and browser transport.
  - [ ] Triage findings by severity and remediate release blockers.
  - [ ] Publish the threat model and security contact/process.
- [ ] Add automated release security gates.
  - [ ] Enable dependency and license scanning.
  - [ ] Add secret scanning and client-bundle credential checks.
  - [ ] Add SAST, artifact signing, provenance attestations, and SBOM generation.
  - [ ] Define blocking severity thresholds and exception ownership.
- [ ] Add official authentication adapters.
  - [ ] Define the adapter contract for identity, tenant, roles, and session expiry.
  - [ ] Implement Auth.js and Clerk examples plus generic JWT/session middleware.
  - [ ] Test forged claims, expired sessions, tenant switching, and approval identity.
  - [ ] Document serverless, edge, and Node configurations.
- [ ] Add distributed limits and budgets.
  - [ ] Define atomic rate-limit and budget reservation contracts.
  - [ ] Implement PostgreSQL and Redis-compatible adapters.
  - [ ] Handle reservation expiry, refunds, retries, and multi-worker contention.
  - [ ] Add per-user, tenant, capability, provider, and model policies.
- [ ] Harden SSRF defenses.
  - [ ] Validate redirects and every resolved destination.
  - [ ] Block DNS rebinding, IPv4/IPv6 private ranges, and cloud metadata endpoints.
  - [ ] Add allowlists, port policies, response-size limits, and timeouts.
  - [ ] Run an adversarial regression corpus in CI.
- [ ] Add compliance-ready audit workflows.
  - [ ] Define immutable audit events and export formats.
  - [ ] Add retention, legal-hold, redaction, and deletion policies.
  - [ ] Separate operator-visible metadata from sensitive payloads.
  - [ ] Test right-to-access and right-to-delete across all stores.

## P1 — Adoption and developer experience

- [ ] Ship a production Next.js durable-chat starter.
  - [ ] Add authenticated App Router endpoints and tenant identity mapping.
  - [ ] Wire PostgreSQL conversations, runs, usage, memory, and a durable worker.
  - [ ] Include streaming, cancellation, approvals, reconnect, budgets, and history pagination.
  - [ ] Add one-command local setup and a verified deployment path.
- [ ] Finish the production reference application.
  - [ ] Demonstrate deterministic capabilities, agents, chat, tools, memory, and shared state.
  - [ ] Include requester/approver separation and background job recovery.
  - [ ] Add observability, cost reporting, audit history, and failure simulations.
  - [ ] Publish architecture, operations, security, and deployment documentation.
- [ ] Add task-oriented tutorials.
  - [ ] Create minimal guides for chat, agents, tools, structured output, and memory.
  - [ ] Add advanced guides for approvals, budgets, workers, MCP, and recovery.
  - [ ] Verify every snippet in CI as a compilable example.
  - [ ] Add troubleshooting and common-error sections.
- [ ] Generate versioned API reference documentation.
  - [ ] Extract documentation from public TypeScript exports.
  - [ ] Link types to guides and executable examples.
  - [ ] Publish documentation per released version.
  - [ ] Add broken-link and undocumented-export checks to CI.
- [ ] Expand the CLI lifecycle.
  - [ ] Add `upgrade`, `migrate`, and compatibility checks.
  - [ ] Expand `doctor` with provider, database, queue, auth, and deployment diagnostics.
  - [ ] Add deployment validation and production-default warnings.
  - [ ] Add conversation and run inspection/export commands.
- [ ] Expand Captra Devtools.
  - [ ] Add conversation history, branches, and message provenance.
  - [ ] Visualize token/cost budgets, cache activity, and provider fallbacks.
  - [ ] Show retries, effects, approvals, cancellation propagation, and queue state.
  - [ ] Add redaction, access control, export, and replay safeguards.
- [ ] Publish project support and contribution policies.
  - [ ] Define supported runtimes, frameworks, databases, and provider versions.
  - [ ] Add bug, security, feature, and integration issue templates.
  - [ ] Document contribution setup, design review, release, and compatibility rules.
  - [ ] State pre-1.0 stability and deprecation expectations clearly.

## P2 — Integrations and ecosystem

- [ ] Publish the plugin authoring kit.
  - [ ] Freeze plugin metadata, lifecycle, configuration, and compatibility contracts.
  - [ ] Provide a package template, test harness, and local fixture app.
  - [ ] Add compatibility badges and automated version-range checks.
  - [ ] Validate the kit with at least two independently authored plugins.
- [ ] Add official infrastructure and SaaS integrations.
  - [ ] Prioritize integrations using user demand and reference-app needs.
  - [ ] Ship database-platform and OpenTelemetry exporter packages first.
  - [ ] Add representative messaging, search, storage, and business-tool integrations.
  - [ ] Require permissions, audit events, tests, docs, and ownership for every integration.
- [ ] Expand MCP support.
  - [ ] Add OAuth/API-key authentication and credential isolation.
  - [ ] Implement connection lifecycle, discovery caching, cancellation, and reconnect.
  - [ ] Harden input/output validation and tool permission mapping.
  - [ ] Run client and server protocol conformance suites.
- [ ] Add more framework adapters.
  - [ ] Implement and test Remix, Nuxt/Vue, SvelteKit, NestJS, Fastify, and Bun examples.
  - [ ] Preserve Web Standard transport behavior across adapters.
  - [ ] Document runtime limitations for edge, serverless, and long-running processes.
  - [ ] Add starter-generation options where adoption warrants them.
- [ ] Publish deployment recipes.
  - [ ] Cover Vercel, Cloudflare, Render, Fly.io, AWS, and container workers.
  - [ ] Include databases, queues, migrations, secrets, health checks, and scaling.
  - [ ] Verify cold starts, streaming, cancellation, background work, and shutdown behavior.
  - [ ] Automate smoke tests for maintained recipes.
- [ ] Create a plugin registry.
  - [ ] Define package verification, metadata, ownership, security, and removal policies.
  - [ ] Index declared compatibility and supported Captra versions.
  - [ ] Add search, categories, usage examples, and trust signals.
  - [ ] Launch only after external authors validate the compatibility contract.

## P2 — Stability and 1.0 readiness

- [ ] Freeze versioned wire and persistence schemas.
  - [ ] Publish machine-readable HTTP, SSE, manifest, event, checkpoint, and run schemas.
  - [ ] Add golden fixtures and backward/forward compatibility tests.
  - [ ] Define protocol negotiation and unsupported-version errors.
  - [ ] Document additive versus breaking changes.
- [ ] Stabilize adapter contracts.
  - [ ] Review models, memory, conversations, state, runs, queues, budgets, effects, and usage.
  - [ ] Add contract test kits for third-party implementations.
  - [ ] Specify consistency, ordering, cancellation, retry, and transaction guarantees.
  - [ ] Mark the stable surface and isolate experimental extensions.
- [ ] Add upgrade tooling and migration coverage.
  - [ ] Detect installed versions and required source/database migrations.
  - [ ] Provide automated codemods where changes are mechanical.
  - [ ] Test supported upgrade paths using published package artifacts.
  - [ ] Document rollback and irreversible database changes.
- [ ] Add the supported runtime CI matrix.
  - [ ] Test Linux, macOS, and Windows.
  - [ ] Test supported Node versions and Bun where applicable.
  - [ ] Add database and browser compatibility jobs.
  - [ ] Keep required and experimental jobs clearly separated.
- [ ] Define lifecycle and support guarantees.
  - [ ] Publish release cadence, deprecation window, and supported-version policy.
  - [ ] Define security patch, incident communication, and responsible disclosure processes.
  - [ ] Document maintenance ownership and end-of-life handling.
  - [ ] Align package, protocol, and plugin compatibility versioning.
- [ ] Collect production evidence.
  - [ ] Run the reference application under representative traffic.
  - [ ] Measure availability, latency, recovery time, correctness, and per-run cost.
  - [ ] Exercise provider, database, queue, worker, and network failure scenarios.
  - [ ] Publish methodology, results, limitations, and remediation work.
- [ ] Validate the external plugin ecosystem.
  - [ ] Recruit authors outside the core repository.
  - [ ] Observe onboarding without undocumented assistance.
  - [ ] Track compatibility failures and improve contracts/tooling.
  - [ ] Require successful upgrades across a declared version range before 1.0.

## Recommended execution order

1. PostgreSQL conversations and recovery/load testing.
2. Anthropic and Gemini providers with a shared conformance suite.
3. Production Next.js starter and reference application.
4. Security review plus automated release security gates.
5. Stable protocol/adapter contracts and migration tooling.
6. Broader integrations, deployment recipes, and third-party ecosystem validation.

## 1.0 exit criteria

Captra is ready for 1.0 when its primary contracts are stable, upgrades are tested and documented, the production reference application has credible operational evidence, security boundaries have been independently reviewed, and external developers can build compatible plugins without repository-specific knowledge.

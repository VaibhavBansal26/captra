# Captra remaining work

This checklist tracks the work between the current developer preview and a credible 1.0 release. Items are ordered by dependency and user impact.

## P0 — Production chat and durability

- [ ] Add `PostgresConversationStore`, migrations, indexes, retention controls, and tenant-isolation integration tests.
- [ ] Make durable chat writes atomic with run completion so a completed run cannot lose its assistant message.
- [ ] Add conversation metadata: title, creation/update timestamps, archive/delete, and ownership transfer policy.
- [ ] Add history compaction and summarization with explicit token limits and provenance.
- [ ] Exercise cancellation, approval, retry, reconnect, and duplicate-delivery races in recovery tests.
- [ ] Add load tests for concurrent runs, streaming clients, workers, queues, and PostgreSQL adapters.

## P1 — Model and chat experience

- [ ] Ship official Anthropic and Gemini provider packages.
- [ ] Complete cross-provider conformance tests for tools, structured output, streaming, usage, abort, and errors.
- [ ] Add partial structured-object streaming with schema-safe snapshots.
- [ ] Add provider-aware prompt caching and expose cache usage/cost in run accounting.
- [ ] Add conversation branching, regenerate-from-message, edit-and-resubmit, and optimistic UI support.
- [ ] Add attachment and multimodal message contracts with storage adapters and permission checks.

## P1 — Security and governance

- [ ] Commission an independent security review and publish the threat model.
- [ ] Add dependency, secret, SAST, and provenance scanning to release CI.
- [ ] Add official authentication adapters and examples for Auth.js, Clerk, and custom JWT/session auth.
- [ ] Add durable distributed rate-limit and budget adapters; the in-memory defaults remain development-only.
- [ ] Expand SSRF tests for redirects, DNS rebinding, IPv6, metadata endpoints, and private network ranges.
- [ ] Add audit-log export, retention, redaction, and right-to-delete workflows.

## P1 — Adoption and developer experience

- [ ] Ship a production Next.js chat starter backed by PostgreSQL and a durable worker.
- [ ] Finish the reference application with authentication, approvals, background work, streaming, and deployment instructions.
- [ ] Add copy-paste tutorials for chat, agents, tools, memory, approvals, budgets, workers, and MCP.
- [ ] Generate versioned API reference documentation directly from public TypeScript exports.
- [ ] Add CLI commands for upgrades, migrations, doctor checks, deployment validation, and conversation inspection.
- [ ] Add actionable Devtools views for conversations, token/cost budgets, provider fallbacks, retries, and cancellation.
- [ ] Publish a support policy, compatibility matrix, issue templates, and contribution guide.

## P2 — Integrations and ecosystem

- [ ] Publish stable plugin compatibility tests and a third-party plugin authoring kit.
- [ ] Add official integrations for PostgreSQL platforms, observability backends, and common SaaS tools.
- [ ] Expand MCP client/server support with authentication, lifecycle management, cancellation, and conformance tests.
- [ ] Add framework adapters and examples for Remix, Nuxt/Vue, SvelteKit, NestJS, Fastify, and Bun.
- [ ] Publish deployment recipes for Vercel, Cloudflare, Render, Fly.io, AWS, and long-running workers.
- [ ] Create a discoverable plugin registry only after the plugin contract and compatibility suite stabilize.

## P2 — Stability and 1.0 readiness

- [ ] Freeze and document versioned HTTP, SSE, manifest, event, checkpoint, and serialized-run schemas.
- [ ] Stabilize adapter contracts for models, memory, conversations, state, runs, queues, budgets, effects, and usage.
- [ ] Add upgrade tooling and migration tests across every supported minor version.
- [ ] Add Linux, macOS, and Windows CI across the supported Node/Bun runtime matrix.
- [ ] Define deprecation guarantees, release cadence, long-term support expectations, and incident response.
- [ ] Run the reference application under production traffic and publish reliability, recovery, latency, and cost evidence.
- [ ] Recruit external plugin authors and confirm they can target a declared compatibility range without private knowledge.

## Recommended execution order

1. PostgreSQL conversations and recovery/load testing.
2. Anthropic and Gemini providers with a shared conformance suite.
3. Production Next.js starter and reference application.
4. Security review plus automated release security gates.
5. Stable protocol/adapter contracts and migration tooling.
6. Broader integrations, deployment recipes, and third-party ecosystem validation.

## 1.0 exit criteria

Captra is ready for 1.0 when its primary contracts are stable, upgrades are tested and documented, the production reference application has credible operational evidence, security boundaries have been independently reviewed, and external developers can build compatible plugins without repository-specific knowledge.

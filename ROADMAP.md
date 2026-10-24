# Captra roadmap

Captra is an early developer preview. The roadmap is organized around adoption evidence rather than adding primitives for their own sake.

## 0.5 — Developer preview

- Documentation site and versioned API reference
- Official Next.js and worker starters
- Local run inspector for events, tools, memory, state, and checkpoints
- Security model and tenant-isolation guidance
- Release verification for every public package
- Production reference application with authentication, PostgreSQL, approvals, background work, and streaming UI

## 0.6 — Integration preview

- Provider adapters beyond OpenAI
- Official authentication, database, observability, and SaaS plugins
- Plugin authoring guide and compatibility tests
- Deployment recipes for Node, serverless, edge, and long-running workers
- Load, recovery, and protocol compatibility suites

## 0.7 — Stability preview

- Versioned wire protocol and serialized event schema
- Stable adapter contracts for models, state, memory, runs, and queues
- Upgrade tooling and migration guides
- Cross-platform CI and support policy
- Security review and dependency scanning

## 1.0 readiness

Captra reaches 1.0 when the primary contracts are stable, upgrades are documented, the reference application operates under production load, and third-party plugins can target a declared compatibility range.

## Principles

- One capability contract across deterministic and agentic work
- Type safety at application boundaries
- State is exact; memory is recalled context
- LLM inference never holds a database lock
- Tools require explicit registration and authorization
- Serialized runs remain inspectable and recoverable
- Framework defaults stay useful without making infrastructure choices mandatory

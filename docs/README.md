# Captra documentation

Captra is a capability-first TypeScript framework for applications that combine deterministic code, model-directed agents, structured output, adaptive memory, shared state, tools, approvals, and generated UI boundaries.

## Start here

1. [Getting started](getting-started.md)
2. [The Captra mental model](concepts.md)
3. [State and memory](state-and-memory.md)
4. [Backend and deployment](deployment.md)
5. [Integrations and plugins](integrations.md)

For the planned stability milestones, see the [roadmap](/roadmap).

## API entry points

| Entry point | Purpose |
| --- | --- |
| `captra` | Core application and runtime APIs |
| `captra/client` | Typed remote client |
| `captra/react` | React hooks and UI boundaries |
| `captra/state` | Reactive and shared state |
| `captra/server` | Web Standard, Next.js, and Hono handlers |
| `captra/server/node` | Node HTTP adapter |
| `captra/server/express` | Express middleware |
| `captra/postgres` | Durable storage, queues, vectors, and shared state |
| `captra/openai` | OpenAI model and embedding adapters |

These explicit entry points prevent server-only dependencies and credentials from entering browser bundles.

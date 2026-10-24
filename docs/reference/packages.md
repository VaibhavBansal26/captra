# Package map

Most applications should install `captra` and import from its explicit entry points.

| Package | Responsibility |
| --- | --- |
| `captra` | Umbrella package and runtime-safe subpath exports |
| `@captra-ai/core` | Contracts, runtime, agents, tools, memory, stores, events, planners, telemetry, and evaluations |
| `@captra-ai/state` | Reactive state, persistence, optimistic updates, shared state, leases, and coordination |
| `@captra-ai/client` | Typed HTTP execution, approvals, cancellation, replay, and streaming |
| `@captra-ai/react` | React orchestration hooks, state hooks, and UI primitives |
| `@captra-ai/devtools` | Run summaries, event traces, input/output, and checkpoint inspection |
| `@captra-ai/server` | Web Standard handler plus Next.js, Hono, Node, and Express adapters |
| `@captra-ai/postgres` | Runs, memory, vectors, checkpoints, queues, and shared state |
| `@captra-ai/openai` | Responses API and embedding adapters |
| `@captra-ai/cli` | Creation, generation, development, validation, and inspection commands |
| `create-captra` | `npm create captra` bootstrap package |

## Runtime-safe imports

```ts
import { capability,agent,defineApp } from 'captra'
import { createCaptraClient } from 'captra/client'
import { CapabilityBoundary } from 'captra/react'
import { CaptraDevtools } from 'captra/devtools'
import { createCaptraHandler } from 'captra/server'
import { createNodeHandler } from 'captra/server/node'
import { PostgresRunStore } from 'captra/postgres'
import { createOpenAI } from 'captra/openai'
```

Explicit subpaths keep Node and database modules out of browser bundles.

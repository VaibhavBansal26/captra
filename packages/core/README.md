# @captra-ai/core

The typed contract and execution runtime behind Captra: capabilities, agents, tools, scoped memory, approvals, budgets, durable runs, cancellation, checkpoints, effect receipts, telemetry, replay, and evaluations.

Use `chat()` for a streaming conversation that keeps those same guarantees. It emits `chat.delta` events, enforces token and cost reservations, records provider usage, supports scoped memory, and remains an ordinary discoverable Captra capability.

Set `durable:true` to persist message history through the runtime's tenant-safe `ConversationStore`. `InMemoryConversationStore` supports local development and cursor pagination; production adapters implement the same small interface.

`runtime.usage` records every model-provider attempt and can summarize cost, tokens, reliability, and latency by run, capability, user, tenant, provider, or model. Use `InMemoryUsageStore` locally and `PostgresUsageStore` for durable deployments.

```bash
npm install @captra-ai/core zod
```

```ts
import { capability, capabilityViews, createRuntime, defineApp } from '@captra-ai/core'
import { z } from 'zod'

const greet = capability({
  name: 'greet', description: 'Greet a user',
  input: z.object({ name: z.string() }),
  output: z.object({ message: z.string() }),
  run: async ({ name }) => ({ message: `Hello, ${name}!` }),
  view: { name: 'Greeting' },
})

const app = defineApp({ name: 'Demo', scopes: [], capabilities: [greet], surface: capabilityViews() })
const runtime = createRuntime(app)
```

External writes should be declared as write tools with a stable `idempotencyKey`. Human approval records an independent approver identity and denies requester self-approval by default.

Structured generation uses provider-native JSON Schema when supported, then normalizes fences, validates with Zod, and performs one bounded repair attempt before returning a typed `StructuredOutputError`.

Evaluation suites support portable JSON/JSONL datasets, independent schema-constrained model judges, repeated runs, 95% confidence intervals, persistent history, and CI formats including JUnit and GitHub Actions annotations.

[Core documentation](https://vaibhavbansal26.github.io/captra/reference/capabilities) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/core) · MIT

Network tools are opt-in. Use `createFetchJsonTool({allowedOrigins:[...]})`; `builtinTools` contains only scoped memory operations.

Use `createModelFallback()` to compose named model adapters with bounded retries, timeouts, total deadlines, circuit breaking, sticky continuation state, and usage-aware fallback history.

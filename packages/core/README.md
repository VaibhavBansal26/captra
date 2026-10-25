# @captra-ai/core

The typed contract and execution runtime behind Captra: capabilities, agents, tools, scoped memory, approvals, budgets, durable runs, cancellation, checkpoints, effect receipts, telemetry, replay, and evaluations.

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

[Core documentation](https://vaibhavbansal26.github.io/captra/reference/capabilities) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/core) · MIT

Network tools are opt-in. Use `createFetchJsonTool({allowedOrigins:[...]})`; `builtinTools` contains only scoped memory operations.

# Captra

The AI-native TypeScript framework for capability-first applications. This umbrella package exposes Captra's typed runtime, agents, adaptive memory, tools, approvals, state, React bindings, server transport, PostgreSQL adapters, and OpenAI integration.

```bash
npm install captra zod
```

```ts
import { capability, capabilityViews, defineApp, createRuntime } from 'captra'
import { z } from 'zod'

const hello = capability({
  name: 'hello',
  description: 'Say hello',
  input: z.object({ name: z.string() }),
  output: z.object({ message: z.string() }),
  run: async ({ name }) => ({ message: `Hello, ${name}!` }),
  view: { name: 'HelloCard' },
})

const app = defineApp({ name: 'Hello AI', scopes: [], capabilities: [hello], surface: capabilityViews() })
const runtime = createRuntime(app)
```

Use explicit entry points for each environment: `captra/client`, `captra/react`, `captra/server`, `captra/server/node`, `captra/state`, `captra/postgres`, and `captra/openai`.

[Documentation](https://vaibhavbansal26.github.io/captra/) · [GitHub](https://github.com/VaibhavBansal26/captra) · MIT
